/* ─────────────────────────────────────────────────────────────
   기기 간 학습 진행 동기화 (Firebase Firestore, 선택 기능).

   동작 방식:
   - 기기마다 "동기화 코드"(32자리 랜덤 hex)를 공유하면, 그 코드를 문서 ID로 쓰는
     Firestore 문서 하나(syncData/{코드})에 학습 진행 기록을 읽고 쓴다.
   - 로그인/계정 시스템이 없으므로 이 코드 자체가 사실상의 비밀번호다.
     아무나 이 코드를 알면 그 데이터를 읽고 쓸 수 있으니, 코드는 노출하지 말 것
     (민감한 데이터는 아니지만 — 학습 진행 기록일 뿐, API 키는 여기 포함되지 않는다).
   - 동기화 대상: 단어 학습 진행(jt.srs), 자동 생성된 단어(jt.vocabExt), 설정(jt.settings).
     API 키(jt.key)와 대화 내역(jt.chat)은 동기화하지 않는다 — 각 기기에 남겨둔다.
   - 충돌 처리는 단순 "마지막에 쓴 쪽이 이긴다(last-write-wins)" 방식이다.
     두 기기를 동시에 쓰지 않고 번갈아 쓰는 사용 패턴을 가정한다.

   Firebase 프로젝트를 아직 안 만들었다면 FIREBASE_CONFIG가 비어 있어 이 기능은
   자동으로 꺼진 상태로 동작한다 (앱의 나머지 기능에는 영향 없음).
   ───────────────────────────────────────────────────────────── */
'use strict';

const SYNC_KEY_LS = 'jt.syncKey';
const SYNC_SEEN_LS = 'jt.syncSeenAt';
const SYNC_DEBOUNCE_MS = 1500;

/**
 * 본인 Firebase 프로젝트 설정으로 교체할 것 (Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정).
 * apiKey 등은 비밀정보가 아니다 — 실제 접근 제어는 Firestore 보안 규칙이 담당한다.
 */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA4kIW7GNKP1sb6aW_JqS-l7eCKnFnjsKQ',
  authDomain: 'jp-tutor-sync.firebaseapp.com',
  projectId: 'jp-tutor-sync',
  storageBucket: 'jp-tutor-sync.firebasestorage.app',
  messagingSenderId: '894291517724',
  appId: '1:894291517724:web:6328a85da617f8ce5c9ad9',
};

let fbApp = null;
let fbDb = null;
let syncDebounceTimer = null;

function syncEnabled() {
  return !!FIREBASE_CONFIG.projectId;
}

function initFirebaseIfNeeded() {
  if (!syncEnabled() || fbApp) return;
  fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  fbDb = firebase.firestore();
}

function getSyncKey() {
  return localStorage.getItem(SYNC_KEY_LS) || '';
}

/** 새 동기화 코드를 만든다 (이 기기가 "원본"이 되는 경우). */
function generateSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const key = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(SYNC_KEY_LS, key);
  localStorage.removeItem(SYNC_SEEN_LS);
  return key;
}

/** 다른 기기에서 만든 코드를 입력해 그 데이터에 연결한다. */
function setSyncKey(key) {
  localStorage.setItem(SYNC_KEY_LS, key.trim());
  localStorage.removeItem(SYNC_SEEN_LS);
}

function clearSyncKey() {
  localStorage.removeItem(SYNC_KEY_LS);
  localStorage.removeItem(SYNC_SEEN_LS);
}

function localSnapshot() {
  return {
    srs: localStorage.getItem('jt.srs') || null,
    vocabExt: localStorage.getItem('jt.vocabExt') || null,
    settings: localStorage.getItem('jt.settings') || null,
  };
}

/** app.js가 정의하면(있을 때만) 동기화 상태 UI를 갱신한다. */
function notifySyncStatus(state, ts) {
  if (typeof renderSyncStatus === 'function') renderSyncStatus(state, ts);
}

/** 현재 로컬 상태를 즉시 클라우드에 올린다. */
async function pushSyncNow() {
  if (!syncEnabled()) return;
  const key = getSyncKey();
  if (!key) return;
  initFirebaseIfNeeded();
  const now = Date.now();
  try {
    await fbDb.collection('syncData').doc(key).set({ updatedAt: now, ...localSnapshot() });
    localStorage.setItem(SYNC_SEEN_LS, String(now));
    notifySyncStatus('ok', now);
  } catch (e) {
    console.warn('[jt] 동기화 업로드 실패', e);
    notifySyncStatus('error');
  }
}

/** 로컬 데이터가 바뀔 때마다 호출 — 짧은 지연 후 한 번만 업로드한다(연타 방지). */
function scheduleSyncPush() {
  if (!syncEnabled() || !getSyncKey()) return;
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(pushSyncNow, SYNC_DEBOUNCE_MS);
}

/**
 * 앱 시작 시 한 번 호출 — 클라우드가 로컬보다 최신이면 로컬(localStorage)에 반영한다.
 * @returns {Promise<boolean>} 로컬 데이터가 갱신되었는지 여부
 */
async function pullSyncOnStart() {
  if (!syncEnabled()) return false;
  const key = getSyncKey();
  if (!key) return false;
  initFirebaseIfNeeded();
  try {
    const doc = await fbDb.collection('syncData').doc(key).get();
    if (!doc.exists) { notifySyncStatus('ok', 0); return false; }
    const data = doc.data();
    const seen = Number(localStorage.getItem(SYNC_SEEN_LS) || 0);
    if (data.updatedAt && data.updatedAt > seen) {
      if (data.srs) localStorage.setItem('jt.srs', data.srs);
      if (data.vocabExt) localStorage.setItem('jt.vocabExt', data.vocabExt);
      if (data.settings) localStorage.setItem('jt.settings', data.settings);
      localStorage.setItem(SYNC_SEEN_LS, String(data.updatedAt));
      notifySyncStatus('ok', data.updatedAt);
      return true;
    }
    notifySyncStatus('ok', seen);
  } catch (e) {
    console.warn('[jt] 동기화 다운로드 실패', e);
    notifySyncStatus('error');
  }
  return false;
}
