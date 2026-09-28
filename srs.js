/* ─────────────────────────────────────────────────────────────
   간격 반복 학습(SRS) 엔진 — 순수 로직 + localStorage 영속화.
   채점 자체는 API 호출 없이 동작한다 (app.js의 퀴즈 UI가 채점 담당).

   스케줄 규칙 (사용자 요청대로 고정):
     - 하루 목표: 새 단어 10개
     - 학습일 기준 +3일 / +7일 / +21일에 각각 한 번씩 복습 테스트
     - 어느 테스트에서든 틀리면 '다시 풀기' 큐에 남아 아무 때나 재도전 가능
       (틀렸다고 3/7/21일 스케줄 자체가 늦춰지지는 않음 — 별도 트랙)

   단어 은행 자동 확장:
     - vocab.js의 VOCAB_BANK(고정 240개)가 바닥나면, 오늘의 신규 단어가
       10개보다 적게 남는다. 이때 app.js가 정의하는 requestMoreVocab()을
       통해 Claude API로 새 단어를 생성해 localStorage(jt.vocabExt)에
       계속 이어 붙인다 — 즉 사람이 vocab.js를 다시 편집할 필요가 없다.
     - 생성은 앱 시작 시 백그라운드에서 한 번 시도한다 (실패해도 조용히
       무시하고 기존 단어만으로 하루를 진행 — 다음날 다시 시도됨).
   ───────────────────────────────────────────────────────────── */
'use strict';

const SRS_KEY = 'jt.srs';
const VOCAB_EXT_KEY = 'jt.vocabExt';
const DAILY_GOAL = 10;
const REVIEW_OFFSETS = [3, 7, 21]; // 일 단위

function pad2(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/* ── 단어 은행 (고정 240개 + API로 자동 생성되는 확장분) ─────── */

let vocabExt = [];          // [{id, jp, romaji, ko, cat}, ...] — VOCAB_BANK 뒤에 이어짐
let extById = new Map();

function loadVocabExt() {
  try {
    vocabExt = JSON.parse(localStorage.getItem(VOCAB_EXT_KEY) || '[]');
    if (!Array.isArray(vocabExt)) vocabExt = [];
  } catch { vocabExt = []; }
  extById = new Map(vocabExt.map((w) => [w.id, w]));
}

function saveVocabExt() {
  try {
    localStorage.setItem(VOCAB_EXT_KEY, JSON.stringify(vocabExt));
  } catch (e) {
    console.warn('[jt] 확장 단어 저장 실패', e);
  }
  if (typeof scheduleSyncPush === 'function') scheduleSyncPush();
}

function allWords() {
  return vocabExt.length ? VOCAB_BANK.concat(vocabExt) : VOCAB_BANK;
}

function wordById(id) {
  return VOCAB_BY_ID.get(id) || extById.get(id);
}

/**
 * API가 생성한 단어들을 은행 끝에 이어 붙인다.
 * @param {Array<{jp,romaji,ko,cat}>} words
 * @returns {Array} 실제로 추가된, id가 부여된 단어들
 */
function appendVocabWords(words) {
  let nextId = VOCAB_BANK.length + vocabExt.length + 1;
  const added = words
    .filter((w) => w && w.jp && w.romaji && w.ko)
    .map((w) => ({ id: nextId++, jp: w.jp, romaji: w.romaji, ko: w.ko, cat: w.cat || '확장' }));
  vocabExt = vocabExt.concat(added);
  added.forEach((w) => extById.set(w.id, w));
  saveVocabExt();
  return added;
}

/* ── SRS 상태 ──────────────────────────────────────────────── */

function blankSrs() {
  return {
    todayDate: '',       // 오늘의 신규 단어 세트를 마지막으로 산출한 날짜
    todayNewIds: [],     // 그날 배정된 신규 단어 id 목록 (하루 동안 고정, 자동 생성 시 추가될 수 있음)
    progress: {},        // wordId -> { id, learnedAt, reviewDates:[3], nextReviewIdx, needsRetry, history:[] }
  };
}

let srs = blankSrs();

function readSrsFromLocalStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(SRS_KEY) || 'null');
    if (raw && typeof raw === 'object') srs = { ...blankSrs(), ...raw, progress: raw.progress || {} };
  } catch { /* 기본값 유지 */ }
}

/**
 * 상태 복원 — localStorage에서 SRS 상태와 확장 단어를 읽고, 동기화가 설정되어 있으면
 * 클라우드에 더 최신 데이터가 있는지 먼저 확인한 뒤(최대 4초 대기) 오늘의 세트를 확정한다.
 * 동기화가 없거나 느려도 로컬 데이터만으로 정상 진행된다.
 */
async function loadSrs() {
  readSrsFromLocalStorage();
  loadVocabExt();

  if (typeof pullSyncOnStart === 'function') {
    try {
      const updated = await Promise.race([
        pullSyncOnStart(),
        new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
      ]);
      if (updated) {
        readSrsFromLocalStorage(); // pullSyncOnStart가 localStorage를 갱신했으니 다시 읽는다
        loadVocabExt();
      }
    } catch (e) {
      console.warn('[jt] 동기화 확인 실패 — 로컬 데이터로 진행합니다.', e);
    }
  }

  ensureTodaySet();
}

function saveSrs() {
  try {
    localStorage.setItem(SRS_KEY, JSON.stringify(srs));
  } catch (e) {
    console.warn('[jt] 학습 기록 저장 실패', e);
  }
  if (typeof scheduleSyncPush === 'function') scheduleSyncPush();
}

/**
 * 오늘의 신규 단어 목록을 채운다. 이미 채워져 있으면 그대로 두고,
 * 목표(10개)보다 적으면 은행에서 더 뽑아 채운다 — 여러 번 호출해도 안전하다
 * (확장 단어가 새로 생겨서 top-up이 필요할 때 다시 불러도 됨).
 */
function ensureTodaySet() {
  const today = todayStr();
  if (srs.todayDate !== today) {
    srs.todayDate = today;
    srs.todayNewIds = [];
  }

  if (srs.todayNewIds.length < DAILY_GOAL) {
    const learnedIds = new Set(Object.keys(srs.progress).map(Number));
    const already = new Set(srs.todayNewIds);
    for (const w of allWords()) {
      if (srs.todayNewIds.length >= DAILY_GOAL) break;
      if (learnedIds.has(w.id) || already.has(w.id)) continue;
      srs.todayNewIds.push(w.id);
      already.add(w.id);
    }
  }

  for (const id of srs.todayNewIds) {
    if (srs.progress[id]) continue;
    srs.progress[id] = {
      id,
      learnedAt: today,
      reviewDates: REVIEW_OFFSETS.map((n) => addDays(today, n)),
      nextReviewIdx: 0,
      needsRetry: false,
      history: [],
    };
  }
  saveSrs();
}

/**
 * 오늘의 신규 단어가 목표(10개)에 못 미치면 app.js의 requestMoreVocab()으로
 * Claude API를 호출해 부족한 만큼 생성하고 은행에 이어 붙인다.
 * 앱 시작 시 한 번, 백그라운드에서(await 없이) 호출된다 — 실패해도 조용히 넘어간다.
 */
async function refillVocabIfNeeded() {
  ensureTodaySet();
  const need = DAILY_GOAL - srs.todayNewIds.length;
  if (need <= 0) return false;
  if (typeof requestMoreVocab !== 'function') return false;

  try {
    const words = await requestMoreVocab(need);
    if (words && words.length) {
      appendVocabWords(words);
      ensureTodaySet(); // 새로 생긴 단어로 오늘의 세트를 top-up
      return true;
    }
  } catch (e) {
    console.warn('[jt] 단어 자동 생성 실패 — 기존 단어만으로 진행합니다.', e);
  }
  return false;
}

/** 오늘의 신규 단어 (자동 생성이 아직 안 끝났거나 실패하면 10개 미만일 수 있음). */
function getTodayNewWords() {
  ensureTodaySet();
  return srs.todayNewIds.map(wordById).filter(Boolean);
}

/** 은행이 완전히 바닥났는지 — 자동 생성도 실패했고 더 배울 단어가 없을 때만 true. */
function isBankExhausted() {
  ensureTodaySet();
  return srs.todayNewIds.length === 0 && Object.keys(srs.progress).length >= allWords().length;
}

/** 오늘 이미 신규 단어 테스트를 봤는지 (mode:'new' 기록이 있는지). */
function isTodayTested() {
  const words = getTodayNewWords();
  return words.length > 0 && words.every((w) => {
    const p = srs.progress[w.id];
    return p && p.history.some((h) => h.mode === 'new');
  });
}

/** 오늘 복습이 도래한 단어들 (당일 신규 단어는 스케줄상 자동 제외됨). */
function getDueReviews() {
  ensureTodaySet();
  const today = todayStr();
  const out = [];
  for (const p of Object.values(srs.progress)) {
    if (p.nextReviewIdx >= REVIEW_OFFSETS.length) continue;
    if (p.reviewDates[p.nextReviewIdx] <= today) {
      const w = wordById(p.id);
      if (w) out.push(w);
    }
  }
  return out;
}

/** '다시 풀기' 큐 — 가장 최근 테스트에서 틀린 단어. 아무 때나 재도전 가능. */
function getRetryQueue() {
  const out = [];
  for (const p of Object.values(srs.progress)) {
    if (p.needsRetry) {
      const w = wordById(p.id);
      if (w) out.push(w);
    }
  }
  return out;
}

/**
 * 퀴즈 채점 결과를 반영한다.
 * @param {number} wordId
 * @param {boolean} correct
 * @param {'new'|'review'|'retry'} mode
 */
function recordTestResult(wordId, correct, mode) {
  const p = srs.progress[wordId];
  if (!p) return;
  p.history.push({ date: todayStr(), correct, mode });

  if (mode === 'review') {
    if (correct) p.nextReviewIdx += 1;
    p.needsRetry = !correct;
  } else {
    // 'new' 또는 'retry'
    p.needsRetry = !correct;
  }
  saveSrs();
}

function getStats() {
  ensureTodaySet();
  const total = Object.keys(srs.progress).length;
  const mastered = Object.values(srs.progress).filter((p) => p.nextReviewIdx >= REVIEW_OFFSETS.length).length;
  return {
    totalLearned: total,
    mastered,
    todayGoal: DAILY_GOAL,
    todayNewCount: srs.todayNewIds.length,
    todayTested: isTodayTested(),
    dueReviewCount: getDueReviews().length,
    retryCount: getRetryQueue().length,
    bankTotal: allWords().length,
    bankExhausted: isBankExhausted(),
  };
}

/** 4지선다 문제 세트를 만든다. 보기는 전체 단어 은행(고정+확장)에서 무작위로 뽑는다. */
function buildQuiz(words) {
  const pool = allWords();
  return words.map((w) => {
    const distractorPool = pool.filter((x) => x.id !== w.id && x.ko !== w.ko);
    const distractors = shuffleArr(distractorPool).slice(0, 3).map((x) => x.ko);
    const options = shuffleArr([w.ko, ...distractors]);
    return { word: w, options, correctAnswer: w.ko };
  });
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
