/* ─────────────────────────────────────────────────────────────
   일본어 회화 튜터 — Anthropic Messages API (브라우저 직접 호출)
   ───────────────────────────────────────────────────────────── */
'use strict';

/* ── 1. 설정 ───────────────────────────────────────────────── */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

/**
 * 모델별 지원 파라미터.
 *   effort   : output_config.effort — Haiku 4.5는 미지원이므로 null (보내면 400).
 *   thinking : 매 턴마다 문장을 단어→글자(mora) 2단 구조로 정확히 나누고 원문과 한 글자도
 *              틀림없이 이어붙여야 하는 까다로운 작업이라, thinking을 꺼두면(특히 Sonnet 5)
 *              조각 배열을 통째로 비우거나 글자를 빠뜨리는 경우가 실측 확인됐다. thinking은
 *              끄지 않고 기본(adaptive)으로 둔다 — 문장이 짧으면 사고 토큰도 몇 개 안 써서
 *              비용/지연 영향은 작다. effort는 low에서 medium으로 올렸다 — low에서는 이
 *              2단 중첩 스키마 작업 자체를 가끔 통째로 건너뛰는(빈 배열만 반환) 경우가
 *              실측됐기 때문. (렌더링 쪽에도 안전장치가 있어 그래도 드물게 실패하면
 *              해당 메시지만 로마자 없는 평문으로 조용히 대체된다 — 화면이 깨지진 않음.)
 */
const MODELS = {
  'claude-sonnet-5': {
    label: 'Claude Sonnet 5 — 균형 (권장)',
    help: '속도·품질·비용의 균형. 회화 연습에 가장 적합합니다. ($2 / $10 per MTok)',
    effort: 'medium', thinking: null,
  },
  'claude-opus-5': {
    label: 'Claude Opus 5 — 최고 품질',
    help: '교정 설명이 가장 정확하고 섬세합니다. 조금 느리고 비쌉니다. ($5 / $25 per MTok)',
    effort: 'medium', thinking: null,
  },
  'claude-haiku-4-5': {
    label: 'Claude Haiku 4.5 — 가장 빠름',
    help: '응답이 가장 빠르고 저렴합니다. 교정의 깊이는 얕습니다. ($1 / $5 per MTok)',
    effort: null, thinking: null,
  },
};
const DEFAULT_MODEL = 'claude-sonnet-5';

const LEVELS = {
  beginner:     '초급 (JLPT N5~N4). 기초 문형과 쉬운 어휘만 사용하고, 한 번에 한 가지만 가르칠 것.',
  intermediate: '중급 (JLPT N3~N2). 일상 회화 속도로 말하고, 자연스러운 관용 표현을 적극적으로 소개할 것.',
  advanced:     '고급 (JLPT N1). 뉘앙스 차이, 경어(敬語), 비즈니스/격식 표현의 미묘한 차이까지 지적할 것.',
};

/**
 * 문장 하나를 글자(모라) 단위로 나눈 평평한(flat) 조각 배열의 스키마.
 * 각 조각의 jp를 순서대로 이어붙이면 원문 문장과 완전히 같아야 한다.
 * ko(한국어 뜻)는 단어/조사가 시작하는 조각에만 채우고 나머지는 비워둔다 — 단어 단위로
 * "묶어서 보여주는" 작업은 모델에게 시키지 않고 렌더링 쪽(renderRuby)에서 처리한다.
 * (한 번 2단 중첩 배열로 만들어봤더니 모델이 종종 배열 전체를 비워버려 신뢰도가 떨어졌음 —
 * 평평한 구조가 훨씬 안정적으로 채워져서 이 방식으로 되돌렸다.)
 */
function chunksSchema(desc) {
  return {
    type: 'array',
    description: desc,
    items: {
      type: 'object',
      properties: {
        jp:     { type: 'string', description: '이 조각의 일본어 원문 (한자/가나/구두점/공백 그대로)' },
        romaji: { type: 'string', description: '이 조각의 로마자 발음. 구두점·공백처럼 발음이 없으면 빈 문자열' },
        ko:     { type: 'string', description: '단어/조사가 시작하는 조각에만 그 단어 전체의 한국어 뜻(조사는 문법 기능). 같은 단어의 나머지 글자 조각과 구두점은 빈 문자열' },
      },
      required: ['jp', 'romaji', 'ko'],
      additionalProperties: false,
    },
  };
}

/** 응답 스키마 — output_config.format 으로 JSON 구조를 강제한다. */
const SCHEMA = {
  type: 'object',
  properties: {
    correction_needed: { type: 'boolean', description: '사용자의 직전 일본어 발화에 고칠 점이 있으면 true' },
    user_input_chunks: chunksSchema('사용자가 방금 보낸 메시지 원문 그대로를 단어/구 단위로 나눈 배열 (교정 전, 사용자가 실제로 쓴 그대로). 조각의 jp를 이어붙이면 사용자 메시지 원문과 완전히 같아야 함. 사용자 메시지에 일본어가 전혀 없으면(순수 한국어 질문 등) 빈 배열'),
    corrected_jp:      { type: 'string',  description: '교정된 전체 일본어 문장. 고칠 점이 없으면 빈 문자열' },
    corrected_chunks:  chunksSchema('corrected_jp를 단어/구 단위로 나눈 배열. corrected_jp가 빈 문자열이면 빈 배열'),
    feedback_ko:       { type: 'string',  description: '무엇이 왜 어색한지 한국어 설명. 없으면 빈 문자열' },
    reply_jp:          { type: 'string',  description: '튜터의 자연스러운 일본어 응답 (1~2문장)' },
    reply_chunks:      chunksSchema('reply_jp를 단어/구 단위로 나눈 배열. 비우지 말 것'),
    reply_ko:          { type: 'string',  description: 'reply_jp 의 한국어 번역' },
    question_jp:       { type: 'string',  description: '대화를 이어가기 위한 추가 질문 1개 (일본어)' },
    question_chunks:   chunksSchema('question_jp를 단어/구 단위로 나눈 배열. 비우지 말 것'),
    question_ko:       { type: 'string',  description: 'question_jp 의 한국어 번역' },
  },
  required: [
    'correction_needed', 'user_input_chunks', 'corrected_jp', 'corrected_chunks', 'feedback_ko',
    'reply_jp', 'reply_chunks', 'reply_ko',
    'question_jp', 'question_chunks', 'question_ko',
  ],
  additionalProperties: false,
};

/** 오늘의 학습 단어로 대화 연습 중일 때, 시스템 프롬프트에 덧붙일 지시문. */
function practiceBlock() {
  if (!state.practiceMode || !state.practiceWords.length) return '';
  const list = state.practiceWords.map((w) => `${w.jp}(${w.romaji}, ${w.ko})`).join(', ');
  return [
    '',
    '[오늘의 학습 단어 — 이번 대화에서 반드시 활용할 것]',
    list,
    '- 위 단어들을 자연스럽게 대화에 섞어 쓰고, reply_jp 또는 question_jp에 매 턴 최소 1개 이상 포함시킬 것.',
    '- 사용자에게도 이 단어들을 써 보도록 자연스럽게 유도할 것 (질문을 그 단어와 관련된 주제로 던지는 식으로).',
    '- 사용자가 이 단어들 중 하나를 정확히 사용했다면 feedback_ko 맨 앞에 짧게 칭찬할 것 (예: "「食べる」를 정확히 쓰셨네요!").',
  ].join('\n');
}

function systemPrompt() {
  return [
    '당신은 한국어 모어 화자를 1:1로 가르치는 친절하고 실용적인 일본어 회화 튜터입니다.',
    `학습자 수준: ${LEVELS[state.level] || LEVELS.intermediate}`,
    '',
    '중요: 학습자는 히라가나·가타카나를 전혀 읽지 못합니다. 로마자(알파벳) 발음 표기가',
    '학습자가 일본어 문장을 이해하는 유일한 수단이므로, 모든 *_chunks 배열을 절대 비우지 말 것.',
    '로마자는 수정 헵번식으로 쓰고 장음은 겹모음으로 적을 것 (예: きょう→kyou, がっこう→gakkou, ラーメン→raamen).',
    '',
    '*_chunks 배열 공통 규칙 (글자 하나하나 밑에 발음을 보여주는 후리가나 스타일 —',
    '단어 단위가 아니라 최대한 잘게, 글자 단위로 나눌 것):',
    '- 원칙: 한자 한 글자 = 한 조각, 히라가나·가타카나 한 글자 = 한 조각. 절대 단어 전체를 통째로',
    '  한 조각으로 묶지 말 것 (예: 日本語는 日/本/語 세 조각으로).',
    '- 예외 1 (요음) — 작은 ゃゅょ(きゃ·しゅ·ちょ 등)는 분리하면 발음이 깨지므로 바로 앞 글자와',
    '  합쳐 한 조각으로. 예: 「きゃ」→ 한 조각, romaji "kya".',
    '- 예외 2 (촉음) — 작은 っ은 그 자체로 소리가 없고 뒤 글자의 자음을 겹치게 하므로, 바로 뒤',
    '  글자와 합쳐 한 조각으로 하고 그 자음을 겹쳐 적을 것. 예: がっこう → が(ga) / っこ(kko) / う(u).',
    '- 예외 3 (장음) — 가타카나 장음 부호 ー나 앞 글자의 모음을 그대로 늘이는 글자는 바로 앞',
    '  글자와 합쳐 모음을 늘여 적을 것. 예: ラーメン → ラー(raa) / メ(me) / ン(n).',
    '- 예외 4 (숙자훈) — 今日(kyou)·一日(ichinichi)처럼 한자별로 쪼개면 의미가 깨지는 고유 읽기',
    '  단어만 예외적으로 단어 전체를 한 조각으로 묶을 것. 흔치 않은 경우에만 적용.',
    '- 조각들의 jp를 순서대로 그대로 이어 붙이면 원문 문장과 한 글자도 틀림없이 같아야 한다',
    '  (구두점·공백·기호도 빠짐없이 각자 조각으로 포함). 구두점(。、！？「」 등)의 romaji는',
    '  반드시 빈 문자열 ""로 — "。"를 "."처럼 로마자 기호로 옮기지 말 것.',
    '- 조사(は·が·を·に 등)도 각각 독립된 한 조각이며 반드시 romaji를 채울 것.',
    '- ko(그 조각의 한국어 뜻)는 "단어·조사 단위"로 그 단어가 시작하는 첫 조각에만 채우고,',
    '  같은 단어의 나머지 글자 조각들은 ko를 빈 문자열로 둘 것 — 화면에서 그 뜻이 이 조각부터',
    '  다음 뜻이 있는 조각 전까지를 자동으로 한 단어로 묶어서 보여준다. 조사는 한 글자짜리',
    '  조각 하나뿐이므로 그 조각에 문법 기능을 짧게 적을 것 (예: は→"~은/는", を→"~을/를",',
    '  に→"~에", が→"~이/가"). 예: 日本語 → 日(ni, ko:"일본어") / 本(hon, ko:"") / 語(go, ko:"").',
    '',
    '매 턴마다 지정된 JSON 스키마로만 응답하십시오. 각 필드 규칙:',
    '1. correction_needed — 사용자의 직전 발화에 문법·조사·어휘 선택·경어·부자연스러운 어순 문제가 있으면 true.',
    '   사용자가 한국어로 질문했거나, 발화가 이미 자연스러우면 false.',
    '2. user_input_chunks — 사용자가 방금 보낸 메시지 "원문 그대로"(교정하지 않고)를 위 규칙대로 나눈 배열.',
    '   사용자도 자신이 방금 뭐라고 말했는지 로마자로 확인할 수 있게 하는 용도. 메시지가 순수 한국어면 빈 배열 [].',
    '3. corrected_jp — 원래 의도를 살린 자연스러운 일본어 전체 문장. correction_needed가 false면 빈 문자열.',
    '4. corrected_chunks — corrected_jp를 위 규칙대로 나눈 배열. corrected_jp가 빈 문자열이면 빈 배열 [].',
    '5. feedback_ko — 무엇이 왜 어색했는지 한국어로 1~3문장. 규칙을 짧고 구체적으로. false면 빈 문자열.',
    '   일본어 단어를 언급할 때 괄호로 로마자를 끼워 넣지 말 것 (예: "「見ました」는 잘못된 표현이에요" ○,',
    '   "「見ました(mimashita)」는 잘못된 표현이에요" ×) — 순수 한국어 문장으로만 쓸 것.',
    '6. reply_jp — 튜터로서 대화를 이어가는 자연스러운 일본어 응답 1~2문장. 학습자 수준에 맞춘 어휘를 쓸 것.',
    '7. reply_chunks — reply_jp를 위 규칙대로 나눈 배열. 비워두지 말 것.',
    '8. reply_ko — reply_jp의 한국어 번역.',
    '9. question_jp — 대화를 이어가기 위한 추가 질문을 정확히 1개만. 학습자가 대답하기 쉬운 열린 질문으로.',
    '10. question_chunks / question_ko — 9번을 위 규칙대로 나눈 배열과 한국어 번역.',
    practiceBlock(),
    '',
    '태도: 격려하되 과장하지 말 것. 훈계조·장황한 설명 금지. 사용자가 한국어로 물으면 한국어로 답하되,',
    'reply_jp는 항상 일본어로 유지하고 대화를 일본어로 되돌릴 것.',
    'JSON 외의 텍스트나 내부/시스템 XML 태그를 출력하지 마십시오.',
  ].join('\n');
}

const MAX_HISTORY = 24;   // API로 보낼 최근 메시지 개수 (user+assistant 합산)

/* ── 2. 상태 ───────────────────────────────────────────────── */

const state = {
  apiKey: '',
  model: DEFAULT_MODEL,
  level: 'intermediate',
  rate: 0.95,
  autoTts: true,
  romajiIme: true,  // 로마자 입력 시 히라가나로 실시간 자동 변환 (wanakana) — 일본어 타자를 못 치는 사용자를 위함
  history: [],   // Anthropic messages 배열 [{role, content}]
  turns: [],     // 화면 렌더용 [{kind, ...}]
  busy: false,
  recording: false,
  practiceMode: false,   // 오늘의 단어로 대화 연습 중인지
  practiceWords: [],     // 연습 중인 단어 목록 (vocab.js 항목)
  practiceStartTurn: null, // 연습이 시작된 시점의 state.turns 길이 — 종료 시 이후 턴만 훑어 단어 사용 여부를 판단
};

const LS = { key: 'jt.key', ek: 'jt.ek', settings: 'jt.settings', chat: 'jt.chat' };

/* ── 3. API 키 암호화 저장 (AES-GCM / Web Crypto) ───────────── */
/* 주의: 같은 브라우저에서 개발자도구를 열 수 있으면 복호화가 가능하다.
   평문 노출만 막는 수준이며, 공유 기기에서는 '키 삭제'를 사용할 것. */

const b64 = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))),
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

const hasSubtle = !!(window.crypto && window.crypto.subtle);

async function cryptoKey() {
  const stored = localStorage.getItem(LS.ek);
  if (stored) {
    return crypto.subtle.importKey('raw', b64.dec(stored), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  localStorage.setItem(LS.ek, b64.enc(await crypto.subtle.exportKey('raw', key)));
  return crypto.subtle.importKey('raw', b64.dec(localStorage.getItem(LS.ek)), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function saveApiKey(plain) {
  if (!plain) { localStorage.removeItem(LS.key); return; }
  if (!hasSubtle) {                       // http:// 등 비보안 컨텍스트 폴백
    localStorage.setItem(LS.key, 'p:' + btoa(unescape(encodeURIComponent(plain))));
    return;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, await cryptoKey(), new TextEncoder().encode(plain),
  );
  localStorage.setItem(LS.key, 'e:' + b64.enc(iv) + '.' + b64.enc(ct));
}

async function loadApiKey() {
  const raw = localStorage.getItem(LS.key);
  if (!raw) return '';
  try {
    if (raw.startsWith('p:')) return decodeURIComponent(escape(atob(raw.slice(2))));
    const [ivB, ctB] = raw.slice(2).split('.');
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64.dec(ivB) }, await cryptoKey(), b64.dec(ctB),
    );
    return new TextDecoder().decode(pt);
  } catch (e) {
    console.warn('[jt] 저장된 키를 복호화하지 못했습니다. 다시 입력해 주세요.', e);
    localStorage.removeItem(LS.key);
    return '';
  }
}

/* ── 4. DOM 참조 ───────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);
const el = {
  chat: $('chat'), input: $('input'), composer: $('composer'),
  btnSend: $('btnSend'), btnMic: $('btnMic'), btnRomajiIme: $('btnRomajiIme'), btnKatakana: $('btnKatakana'), status: $('statusLine'),
  btnSettings: $('btnSettings'), btnReset: $('btnReset'), btnAutoTts: $('btnAutoTts'),
  backdrop: $('settingsBackdrop'), btnClose: $('btnCloseSettings'),
  apiKeyInput: $('apiKeyInput'), btnToggleKey: $('btnToggleKey'),
  modelSelect: $('modelSelect'), modelHelp: $('modelHelp'), levelSelect: $('levelSelect'),
  rateInput: $('rateInput'), rateOut: $('rateOut'),
  btnSave: $('btnSaveSettings'), btnClearKey: $('btnClearKey'),
  caps: $('capabilities'), starters: $('starters'),

  syncStatus: $('syncStatus'), syncKeyInput: $('syncKeyInput'),
  btnSyncConnect: $('btnSyncConnect'), btnSyncNew: $('btnSyncNew'), btnSyncCopy: $('btnSyncCopy'),

  tabChat: $('tabChat'), tabStudy: $('tabStudy'), studyBadge: $('studyBadge'),
  chatView: $('chatView'), studyView: $('studyView'), studyContent: $('studyContent'),
  practiceBanner: $('practiceBanner'), practiceBannerCount: $('practiceBannerCount'), btnEndPractice: $('btnEndPractice'),

  quizBackdrop: $('quizBackdrop'), quizTitle: $('quizTitle'),
  quizProgressBar: $('quizProgressBar'), quizBody: $('quizBody'), btnCloseQuiz: $('btnCloseQuiz'),
};

/* ── 5. 렌더링 ─────────────────────────────────────────────── */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function atBottom() {
  return el.chat.scrollHeight - el.chat.scrollTop - el.chat.clientHeight < 120;
}

function scrollDown(force) {
  if (force || atBottom()) {
    requestAnimationFrame(() => { el.chat.scrollTop = el.chat.scrollHeight; });
  }
}

function renderAll() {
  el.chat.innerHTML = '';
  state.turns.forEach(addTurnNode);
  el.starters.hidden = state.turns.filter((t) => t.kind === 'user').length > 0;
  scrollDown(true);
}

function addTurn(turn, { persist = true } = {}) {
  state.turns.push(turn);
  const node = addTurnNode(turn);
  if (turn.kind === 'user') el.starters.hidden = true;
  if (persist) persistChat();
  scrollDown(turn.kind === 'user');
  return node;
}

function addTurnNode(turn) {
  let node;
  if (turn.kind === 'user') node = userNode(turn);
  else if (turn.kind === 'bot') node = botNode(turn);
  else if (turn.kind === 'summary') node = summaryNode(turn);
  else node = noticeNode(turn);
  el.chat.appendChild(node);
  return node;
}

/** 대화 연습 종료 시 뜨는 "오늘의 단어 정리" 카드 — 실제로 대화에 등장한 단어에 표시를 남긴다. */
function summaryNode(turn) {
  const row = document.createElement('div');
  row.className = 'row bot';
  const cards = turn.words.map((w) => `
    <div class="word-card ${w.used ? 'used' : ''}">
      <div class="w-cat">${w.used ? '✅ 오늘 사용함' : w.cat}</div>
      <div class="w-jp">${esc(w.jp)}</div>
      <div class="w-romaji">${esc(w.romaji)}</div>
      <div class="w-ko">${esc(w.ko)}</div>
    </div>`).join('');
  const usedCount = turn.words.filter((w) => w.used).length;
  row.innerHTML = `<div class="bubble">
    <div class="c-title" style="color:var(--accent);margin-bottom:8px">📚 오늘의 단어 정리 · ${usedCount}/${turn.words.length}개 사용함</div>
    <div class="word-grid">${cards}</div>
  </div>`;
  return row;
}

function userNode(turn) {
  const row = document.createElement('div');
  row.className = 'row user';
  // turn.chunks는 응답이 돌아온 뒤 updateUserRuby()가 채운다 — 그 전까진 평문으로 표시.
  row.innerHTML = `<div class="bubble"><div class="jp">${renderRuby(turn.text, turn.chunks)}</div></div>`;
  return row;
}

/** 사용자 메시지를 보낸 뒤 응답에 담겨온 로마자 조각으로 그 말풍선을 갱신한다. */
function updateUserRuby(rowEl, turn) {
  if (!rowEl || !turn) return;
  const jpDiv = rowEl.querySelector('.jp');
  if (jpDiv) jpDiv.innerHTML = renderRuby(turn.text, turn.chunks);
  persistChat();   // 로마자가 채워진 상태로 저장해서 새로고침해도 유지되게 한다.
}

// 구두점/공백/기호만으로 된 mora는 모델이 로마자를 채워 보내도 무시한다 (예: 。→"." 같은 습관 방지).
const RUBY_PUNCT_RE = /^[\s。、！？「」『』・…—―ー～〜.,!?"'()（）\[\]{}:;：；\-–]+$/;

/** mora 하나(글자 단위) — jp 위에 로마자를 붙인 작은 세로 박스. 구두점/발음 없음이면 평문. */
function renderMora(m) {
  const jp = esc(m?.jp ?? '');
  const isPunct = RUBY_PUNCT_RE.test(m?.jp ?? '');
  const rj = isPunct ? '' : (m?.romaji || '').trim();
  if (!rj) return `<span class="ruby-plain">${jp}</span>`;
  return `<span class="ruby-chunk"><span class="ruby-jp">${jp}</span><span class="ruby-romaji">${esc(rj)}</span></span>`;
}

/**
 * 평평한(flat) 글자 조각 배열을 후리가나 스타일로 렌더링한다 — 글자(mora) 하나하나
 * 밑에 그 발음을 붙인다. ko(뜻)가 채워진 조각을 "새 단어의 시작"으로 보고, 다음에
 * ko가 채워진 조각(또는 구두점, 또는 끝)이 나올 때까지의 조각들을 하나의 시각적
 * 단어 묶음으로 그룹핑해서, 그 뜻을 단어 묶음 전체 밑에 한 번만 배치한다 — 이 그룹핑은
 * 모델이 아니라 여기(클라이언트)에서 하므로 API가 중첩 구조를 정확히 채워야 하는
 * 부담이 없다. chunks가 없거나 원문과 이어붙인 결과가 다르면(모델이 규칙을 어긴 경우)
 * 안전하게 원문 전체 텍스트만 보여준다.
 */
function renderRuby(jpText, chunks) {
  const valid = Array.isArray(chunks) && chunks.length > 0
    && chunks.map((c) => c?.jp ?? '').join('') === jpText;

  if (!valid) return esc(jpText);

  // 1) 단어 묶음으로 그룹핑: 구두점은 항상 단독 묶음, ko가 채워진 조각은 새 묶음 시작.
  const groups = [];
  for (const c of chunks) {
    const isPunct = RUBY_PUNCT_RE.test(c.jp);
    const ko = isPunct ? '' : (c.ko || '').trim();
    const startsNewGroup = isPunct || ko || groups.length === 0;
    if (startsNewGroup) groups.push({ ko, mora: [c] });
    else groups[groups.length - 1].mora.push(c);
  }

  // 2) 각 묶음을 렌더링: 글자별 발음 행 + (있으면) 묶음 전체의 뜻 한 줄.
  return groups.map((g) => {
    const moraHtml = g.mora.map(renderMora).join('');
    const koHtml = g.ko ? `<span class="ruby-ko">${esc(g.ko)}</span>` : '';
    return `<span class="ruby-word"><span class="ruby-mora-row">${moraHtml}</span>${koHtml}</span>`;
  }).join('');
}

function botNode(turn) {
  const d = turn.data;
  const row = document.createElement('div');
  row.className = 'row bot';

  let html = '';

  if (d.correction_needed && (d.corrected_jp || d.feedback_ko)) {
    html += '<div class="correction">';
    html += '<div class="c-title">교정 및 피드백</div>';
    if (d.corrected_jp) html += `<div class="c-fix">${renderRuby(d.corrected_jp, d.corrected_chunks)}</div>`;
    if (d.feedback_ko) html += `<ul><li>${esc(d.feedback_ko)}</li></ul>`;
    html += '</div>';
  } else if (turn.hadUserInput) {
    html += '<div class="correction good"><div class="c-title">자연스러워요 👍</div></div>';
  }

  if (d.reply_jp) {
    html += `<div class="jp">${renderRuby(d.reply_jp, d.reply_chunks)}</div>`;
  }
  if (d.question_jp) {
    html += `<div class="jp q-jp">${renderRuby(d.question_jp, d.question_chunks)}</div>`;
  }

  const ko = [d.reply_ko, d.question_ko].filter(Boolean).join(' ');
  if (ko) html += `<div class="ko">${esc(ko)}</div>`;

  html += '<div class="bubble-tools">'
        + '<button class="tool-btn" type="button" data-act="speak">🔈 다시 듣기</button>'
        + '<button class="tool-btn" type="button" data-act="copy">복사</button>'
        + '</div>';

  row.innerHTML = `<div class="bubble">${html}</div>`;

  const jpText = speakText(d);
  row.querySelector('[data-act="speak"]').addEventListener('click', (e) => speak(jpText, e.currentTarget));
  row.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
    navigator.clipboard?.writeText(jpText);
    e.currentTarget.textContent = '복사됨';
    setTimeout(() => { e.currentTarget.textContent = '복사'; }, 1200);
  });
  return row;
}

function noticeNode(turn) {
  const div = document.createElement('div');
  div.className = 'notice' + (turn.error ? ' error' : '');
  div.innerHTML = turn.html || esc(turn.text);
  if (turn.retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '다시 시도';
    b.addEventListener('click', () => { div.remove(); retryLast(); });
    div.appendChild(b);
  }
  return div;
}

/** TTS로 읽을 일본어만 뽑는다 (한국어 피드백은 제외). */
function speakText(d) {
  return [d.reply_jp, d.question_jp].filter(Boolean).join(' ');
}

/* 타이핑 인디케이터 */
let typingNode = null;
function showTyping() {
  typingNode = document.createElement('div');
  typingNode.className = 'row bot';
  typingNode.innerHTML = '<div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  el.chat.appendChild(typingNode);
  scrollDown(true);
}
function hideTyping() {
  typingNode?.remove();
  typingNode = null;
}

/* ── 6. Claude API 호출 ────────────────────────────────────── */

/** 현재 선택된 모델이 지원하는 effort/thinking 파라미터를 body에 덧붙인다. */
function applyModelParams(body) {
  const spec = MODELS[state.model] || MODELS[DEFAULT_MODEL];
  if (spec.effort) body.output_config.effort = spec.effort;
  if (spec.thinking) body.thinking = { type: spec.thinking };
  return body;
}

function buildBody() {
  return applyModelParams({
    model: state.model,
    // 예전엔 1600이었는데, 글자 단위 chunks(각 필드마다 jp/romaji/ko 배열)가 응답을
    // 훨씬 길게 만들면서 너무 빠듯해졌다 — thinking이 토큰을 많이 쓰면 실제 응답 쓸
    // 자리가 없어서 통째로 잘리는 경우까지 실측 확인되어 넉넉하게 올렸다.
    max_tokens: 8000,
    system: systemPrompt(),
    messages: state.history.slice(-MAX_HISTORY),
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  });
}

/** 회화 응답 생성과 단어 자동 생성이 공유하는 저수준 호출부. */
async function callClaudeRaw(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': API_VERSION,
      // 브라우저에서 직접 호출하기 위해 필요한 헤더
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* 본문 없음 */ }
    throw new ApiError(res.status, detail);
  }

  const msg = await res.json();

  // refusal은 HTTP 200으로 온다 — content를 읽기 전에 먼저 확인
  if (msg.stop_reason === 'refusal') {
    throw new ApiError(0, '모델이 이 요청에 응답하지 않았습니다. 다른 표현으로 다시 말해 주세요.');
  }
  return msg;
}

async function callClaude() {
  const msg = await callClaudeRaw(buildBody());
  const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (msg.stop_reason === 'max_tokens') {
      throw new ApiError(0, '응답이 너무 길어 잘렸습니다. 짧게 다시 말해 주세요.');
    }
    throw new ApiError(0, '응답 형식을 해석하지 못했습니다.');
  }
  return data;
}

/* ── 6b. 단어 자동 생성 (단어 은행이 바닥나면 Claude가 이어서 채운다) ── */

const VOCAB_GEN_SCHEMA = {
  type: 'object',
  properties: {
    words: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          jp:     { type: 'string', description: '일본어 단어 또는 짧은 표현' },
          romaji: { type: 'string', description: '수정 헵번식 로마자 발음 (장음은 겹모음으로)' },
          ko:     { type: 'string', description: '한국어 뜻. 이미 있는 단어와 뜻이 겹치면 괄호로 구분 (예: "눈 (신체)")' },
          cat:    { type: 'string', description: '주제 카테고리, 한국어 2~4자 (예: 여행, 날씨, 쇼핑)' },
        },
        required: ['jp', 'romaji', 'ko', 'cat'],
        additionalProperties: false,
      },
    },
  },
  required: ['words'],
  additionalProperties: false,
};

/**
 * 단어 은행이 바닥났을 때 부족한 만큼 새 단어를 생성한다.
 * srs.js의 refillVocabIfNeeded()가 앱 시작 시 백그라운드에서 호출한다.
 * @param {number} count 필요한 단어 수
 * @returns {Promise<Array<{jp,romaji,ko,cat}>>}
 */
async function requestMoreVocab(count) {
  if (!state.apiKey) return [];

  const existing = allWords().map((w) => w.jp);
  // 컨텍스트 크기를 무한정 늘리지 않도록 최근 400개까지만 중복 검사에 사용한다.
  const recentTerms = existing.slice(-400);
  const batchNum = Math.floor(existing.length / DAILY_GOAL) + 1;
  const ask = count + 3; // 모델이 중복/부적합으로 일부 걸러질 것을 대비한 여유분

  const body = applyModelParams({
    model: state.model,
    max_tokens: 2000,
    system: [
      '당신은 일본어 학습 앱의 단어 은행을 채우는 어휘 큐레이터입니다.',
      '실생활 회화에서 자주 쓰이는 실용적인 단어/짧은 표현만 고르십시오.',
      '아래 [이미 있는 단어] 목록과 절대 중복되지 않게 새 단어를 고르십시오 (같은 단어, 같은 뜻 모두 금지).',
      `이번은 ${batchNum}번째 확장 배치입니다. 배치 번호가 커질수록 JLPT N5→N4→N3로 난이도를 서서히 올리십시오.`,
      '로마자는 수정 헵번식(장음은 겹모음, 예: きょう→kyou)으로 표기하고, 한글 뜻이 기존 단어와 겹치면',
      '괄호로 구분하십시오 (예: 雪는 "눈 (날씨)", 目는 "눈 (신체)").',
    ].join('\n'),
    messages: [{
      role: 'user',
      content: `[이미 있는 단어]\n${recentTerms.join(', ')}\n\n위와 겹치지 않는 새로운 일본어 회화 단어를 ${ask}개 만들어 주세요.`,
    }],
    output_config: { format: { type: 'json_schema', schema: VOCAB_GEN_SCHEMA } },
  });

  const msg = await callClaudeRaw(body);
  const text = (msg.content || []).find((b) => b.type === 'text')?.text || '';
  const data = JSON.parse(text);

  const existingSet = new Set(existing);
  const unique = (data.words || []).filter((w) => w && w.jp && !existingSet.has(w.jp));
  return unique.slice(0, count);
}

class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

function errorMessage(err) {
  if (err instanceof TypeError) {
    return '네트워크 요청에 실패했습니다. 인터넷 연결을 확인하거나, 광고 차단·기업 프록시가 '
         + '<code>api.anthropic.com</code> 호출을 막고 있는지 확인해 주세요.';
  }
  if (!(err instanceof ApiError)) return esc(err.message || '알 수 없는 오류');

  switch (err.status) {
    case 401: return 'API 키가 올바르지 않습니다. <b>설정 ⚙️</b>에서 키를 다시 확인해 주세요.';
    case 403: return '이 키에는 접근 권한이 없습니다. Anthropic 콘솔에서 키 권한을 확인해 주세요.';
    case 404: return `모델 <b>${esc(state.model)}</b> 을(를) 사용할 수 없습니다. 설정에서 다른 모델을 선택해 주세요.`;
    case 400: return `요청이 거부되었습니다.<br><small>${esc(err.detail)}</small>`;
    case 413: return '대화가 너무 길어졌습니다. 대화를 초기화해 주세요.';
    case 429: return '요청 한도를 초과했습니다 (rate limit). 잠시 후 다시 시도해 주세요.';
    case 529: return 'Anthropic 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.';
    default:
      if (err.status >= 500) return `서버 오류 (${err.status}). 잠시 후 다시 시도해 주세요.`;
      return esc(err.message);
  }
}

/* ── 7. 메시지 전송 ────────────────────────────────────────── */

async function send(text) {
  text = (text || '').trim();
  if (!text || state.busy) return;

  if (!state.apiKey) {
    openSettings();
    addTurn({ kind: 'notice', text: '먼저 Anthropic API 키를 등록해 주세요.', error: true });
    return;
  }

  stopRecording();
  synth?.cancel();

  state.history.push({ role: 'user', content: text });
  const userTurn = { kind: 'user', text };
  const userRow = addTurn(userTurn);
  el.input.value = '';
  autoGrow();

  await runTurn(userTurn, userRow);
}

/**
 * 히스토리 마지막이 user 메시지인 상태에서 응답을 받아 온다. 재시도도 이 함수를 재사용.
 * @param {object} [userTurn] 이번에 보낸 사용자 턴 객체 — 응답의 user_input_chunks로 그 말풍선에 로마자를 채우는 데 씀.
 * @param {HTMLElement} [userRow] 그 사용자 턴의 DOM 행.
 */
async function runTurn(userTurn, userRow) {
  if (state.busy) return;
  setBusy(true);
  showTyping();

  try {
    const data = await callClaude();
    hideTyping();

    // 모델이 실제로 생성한 원문(JSON)을 그대로 히스토리에 넣어야 다음 턴 맥락이 유지된다.
    state.history.push({ role: 'assistant', content: JSON.stringify(data) });

    if (userTurn && Array.isArray(data.user_input_chunks) && data.user_input_chunks.length) {
      userTurn.chunks = data.user_input_chunks;
      updateUserRuby(userRow, userTurn);
    }

    addTurn({ kind: 'bot', data, hadUserInput: true });

    if (state.autoTts) speak(speakText(data));
  } catch (err) {
    hideTyping();
    console.error('[jt]', err);
    // user 메시지는 히스토리에 남겨 두고, '다시 시도'로 같은 턴을 재요청한다.
    addTurn({ kind: 'notice', html: errorMessage(err), error: true, retry: true });
  } finally {
    setBusy(false);
    el.input.focus({ preventScroll: true });
  }
}

function retryLast() {
  const last = state.history[state.history.length - 1];
  if (!last || last.role !== 'user') return;
  const userTurn = [...state.turns].reverse().find((t) => t.kind === 'user');
  const userRows = el.chat.querySelectorAll('.row.user');
  const userRow = userRows[userRows.length - 1];
  runTurn(userTurn, userRow);
}

function setBusy(v) {
  state.busy = v;
  el.btnSend.disabled = v;
  el.input.disabled = v;
  setStatus(v ? '응답 생성 중…' : null);
}

/* ── 8. 음성 인식 (STT) ────────────────────────────────────── */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;

function initSTT() {
  if (!SR) { el.btnMic.hidden = true; return; }

  recog = new SR();
  recog.lang = 'ja-JP';
  recog.continuous = false;
  recog.interimResults = true;
  recog.maxAlternatives = 1;

  let finalText = '';
  let sttHadError = false;   // 'error'와 'end'가 같은 실패에 대해 알림을 중복으로 띄우지 않기 위한 플래그
  let sttWatchdog = null;    // 크롬 내장 음성 인식은 구글 서버로 오디오를 보내 처리한다 — 광고 차단기/
                             // 개인정보 보호 확장 프로그램이 그 통신을 막으면 result·error·end 중
                             // 아무 이벤트도 없이 무한정 멈출 수 있어, 일정 시간 지나면 강제로 끊는다.
  const STT_TIMEOUT_MS = 8000;

  function sttGiveUp(message) {
    clearTimeout(sttWatchdog);
    sttHadError = true;
    try { recog.abort(); } catch { /* noop */ }
    state.recording = false;
    el.btnMic.classList.remove('recording');
    setStatus(null);
    addTurn({ kind: 'notice', text: message, error: true });
  }

  recog.addEventListener('start', () => {
    finalText = '';
    sttHadError = false;
    state.recording = true;
    el.btnMic.classList.add('recording');
    setStatus('🎙️ 듣는 중… 일본어로 말해 보세요');
    clearTimeout(sttWatchdog);
    sttWatchdog = setTimeout(() => {
      sttGiveUp('음성 인식 서버로부터 응답이 없습니다. 크롬 내장 음성 인식은 구글 서버와 통신하는데, '
        + '광고 차단기·개인정보 보호 확장 프로그램이나 방화벽/VPN이 이 통신을 막고 있을 수 있어요. '
        + '해당 확장 프로그램을 잠시 꺼보시거나, 키보드로 입력해 주세요.');
    }, STT_TIMEOUT_MS);
  });

  recog.addEventListener('result', (e) => {
    clearTimeout(sttWatchdog);   // 결과가 오기 시작했으니 워치독은 해제 (아직 문장은 안 끝났을 수 있음)
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    el.input.value = (finalText + interim).trim();
    autoGrow();
  });

  recog.addEventListener('error', (e) => {
    clearTimeout(sttWatchdog);
    if (e.error === 'aborted') return;   // 사용자가 버튼을 다시 눌러 직접 멈춘 경우 — 조용히 무시
    console.warn('[jt] 음성 인식 오류:', e.error);
    sttHadError = true;

    let m;
    switch (e.error) {
      case 'no-speech':
        m = '음성이 감지되지 않았어요. 마이크에 조금 더 가까이 대고 또렷하게 말해 주세요.';
        break;
      case 'not-allowed':
      case 'service-not-allowed':
        m = '마이크 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘에서 마이크를 허용해 주세요.';
        break;
      case 'audio-capture':
        m = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지, 다른 앱이 사용 중은 아닌지 확인해 주세요.';
        break;
      case 'network':
        m = '음성 인식 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.';
        break;
      default:
        m = `음성 인식 오류: ${e.error}`;
    }
    addTurn({ kind: 'notice', text: m, error: true });
  });

  recog.addEventListener('end', () => {
    clearTimeout(sttWatchdog);
    state.recording = false;
    el.btnMic.classList.remove('recording');
    setStatus(null);
    const t = (finalText || el.input.value).trim();
    if (t) { send(t); return; }        // 인식이 끝나면 자동 전송
    // 에러 이벤트 없이 그냥 조용히 끝나면서 아무것도 못 잡은 경우에도 피드백을 준다.
    if (!sttHadError) {
      addTurn({ kind: 'notice', text: '음성이 인식되지 않았어요. 마이크 🎙️를 다시 눌러 말해 주세요.', error: true });
    }
  });
}

function startRecording() {
  if (!recog || state.recording || state.busy) return;
  synth?.cancel();
  unlockTts();
  el.input.value = '';
  try { recog.start(); } catch (e) { console.warn('[jt] 음성 인식 시작 실패 (이미 시작된 경우일 수 있음)', e); }
}

function stopRecording() {
  if (recog && state.recording) { try { recog.stop(); } catch { /* noop */ } }
}

/* ── 9. 음성 합성 (TTS) ────────────────────────────────────── */

const synth = window.speechSynthesis;
let jaVoice = null;
let ttsUnlocked = false;

const VOICE_PREFS = ['Kyoko', 'O-ren', 'Otoya', 'Google 日本語', 'Nanami', 'Ayumi', 'Haruka', 'Sayaka'];

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang));
  if (!voices.length) return;
  jaVoice = voices.find((v) => VOICE_PREFS.some((p) => v.name.includes(p))) || voices[0];
}

/** iOS/Safari는 사용자 제스처 안에서 한 번 speak()를 호출해야 이후 재생이 허용된다. */
function unlockTts() {
  if (ttsUnlocked || !synth) return;
  ttsUnlocked = true;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  try { synth.speak(u); } catch { /* noop */ }
}

function speak(text, btn) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = state.rate;
  u.pitch = 1;
  if (!jaVoice) pickVoice();
  if (jaVoice) u.voice = jaVoice;

  if (btn) {
    btn.classList.add('speaking');
    const off = () => btn.classList.remove('speaking');
    u.addEventListener('end', off);
    u.addEventListener('error', off);
  }
  synth.speak(u);
}

/* ── 10. 설정 모달 ─────────────────────────────────────────── */

function openSettings() {
  el.apiKeyInput.value = state.apiKey;
  el.modelSelect.value = state.model;
  el.levelSelect.value = state.level;
  el.rateInput.value = state.rate;
  el.rateOut.textContent = Number(state.rate).toFixed(2);
  updateModelHelp();
  renderCaps();
  renderSyncUi();
  el.backdrop.hidden = false;
}

function closeSettings() { el.backdrop.hidden = true; }

function updateModelHelp() {
  el.modelHelp.textContent = MODELS[el.modelSelect.value]?.help || '';
}

function renderCaps() {
  const voices = synth ? synth.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang)).length : 0;
  const row = (ok, label) => `<div class="${ok ? 'yes' : 'no'}">${label}</div>`;
  el.caps.innerHTML =
      row(!!SR, `음성 인식 (STT): ${SR ? '사용 가능' : '이 브라우저는 미지원 — 키보드 입력을 사용하세요'}`)
    + row(!!synth, `음성 합성 (TTS): ${synth ? `사용 가능 · 일본어 음성 ${voices}개` : '미지원'}`)
    + row(hasSubtle, `키 암호화: ${hasSubtle ? 'AES-GCM' : 'base64 인코딩만 (HTTPS에서 열면 암호화됨)'}`);
}

/* 기기 간 동기화 UI */

function fmtSyncTime(ts) {
  if (!ts) return '아직 동기화 안 됨';
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 10) return '방금 전';
  if (diffSec < 60) return `${diffSec}초 전`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  return new Date(ts).toLocaleString('ko-KR');
}

/** sync.js가 업로드/다운로드 성공·실패 시 호출한다 (설정 창이 열려 있을 때만 반영). */
function renderSyncStatus(state_, ts) {
  if (el.backdrop.hidden) return;
  if (state_ === 'error') {
    el.syncStatus.textContent = '동기화 실패 — 인터넷 연결을 확인해 주세요.';
    return;
  }
  const key = getSyncKey();
  el.syncStatus.textContent = key
    ? `연결됨 · 마지막 동기화: ${fmtSyncTime(ts)}`
    : '아직 다른 기기와 연결되지 않았습니다.';
}

function renderSyncUi() {
  if (typeof syncEnabled !== 'function' || !syncEnabled()) {
    el.syncStatus.textContent = 'Firebase 설정이 아직 안 되어 있어 이 기능은 꺼져 있습니다 (README 참고).';
    el.syncKeyInput.disabled = true;
    el.btnSyncConnect.disabled = true;
    el.btnSyncNew.disabled = true;
    return;
  }
  const key = getSyncKey();
  el.syncKeyInput.value = key;
  el.btnSyncCopy.hidden = !key;
  renderSyncStatus('ok', Number(localStorage.getItem('jt.syncSeenAt') || 0));
}

async function handleSyncNew() {
  if (getSyncKey() && !confirm('이미 연결된 코드가 있습니다. 새 코드를 만들면 이 기기가 새로운 동기화 그룹의 기준이 됩니다. 계속할까요?')) return;
  generateSyncKey();
  el.syncStatus.textContent = '업로드 중…';
  await pushSyncNow();
  renderSyncUi();
}

async function handleSyncConnect() {
  const key = el.syncKeyInput.value.trim();
  if (!key) return;
  if (getStats().totalLearned > 0
    && !confirm('연결하면 이 기기의 기존 학습 진행 기록이 다른 기기의 기록으로 덮어써질 수 있습니다. 계속할까요?')) return;

  setSyncKey(key);
  el.syncStatus.textContent = '불러오는 중…';
  await pullSyncOnStart();
  location.reload(); // 새로 받아온 진행 기록으로 화면 전체를 다시 그린다
}

async function saveSettings() {
  const key = el.apiKeyInput.value.trim();
  state.apiKey = key;
  state.model = el.modelSelect.value;
  state.level = el.levelSelect.value;
  state.rate = parseFloat(el.rateInput.value);

  await saveApiKey(key);
  persistSettings();
  setStatus(null);
  closeSettings();
}

/* ── 11. 영속화 ────────────────────────────────────────────── */

function persistSettings() {
  localStorage.setItem(LS.settings, JSON.stringify({
    model: state.model, level: state.level, rate: state.rate, autoTts: state.autoTts,
    romajiIme: state.romajiIme,
  }));
  if (typeof scheduleSyncPush === 'function') scheduleSyncPush();
}

function persistChat() {
  try {
    localStorage.setItem(LS.chat, JSON.stringify({
      history: state.history,
      turns: state.turns.filter((t) => t.kind !== 'notice'),
    }));
  } catch (e) {
    console.warn('[jt] 대화 저장 실패 (용량 초과일 수 있습니다).', e);
  }
}

function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(LS.settings) || '{}');
    if (MODELS[s.model]) state.model = s.model;
    if (LEVELS[s.level]) state.level = s.level;
    if (s.rate) state.rate = s.rate;
    if (typeof s.autoTts === 'boolean') state.autoTts = s.autoTts;
    if (typeof s.romajiIme === 'boolean') state.romajiIme = s.romajiIme;
  } catch { /* 기본값 유지 */ }

  try {
    const c = JSON.parse(localStorage.getItem(LS.chat) || '{}');
    if (Array.isArray(c.history)) state.history = c.history;
    if (Array.isArray(c.turns)) state.turns = c.turns;
  } catch { /* 기본값 유지 */ }
}

function resetChat() {
  if (state.turns.length && !confirm('대화 내역을 모두 지울까요?')) return;
  synth?.cancel();
  endPractice();
  state.history = [];
  state.turns = [];
  localStorage.removeItem(LS.chat);
  greet();
  renderAll();
}

function greet() {
  // 로컬 인사말 — API 히스토리에는 넣지 않는다.
  state.turns.push({
    kind: 'bot',
    hadUserInput: false,
    data: {
      correction_needed: false, corrected_jp: '', corrected_chunks: [], feedback_ko: '',
      reply_jp: 'こんにちは！日本語の会話練習を始めましょう。',
      reply_chunks: [
        { jp: 'こ', romaji: 'ko', ko: '안녕하세요' }, { jp: 'ん', romaji: 'n', ko: '' }, { jp: 'に', romaji: 'ni', ko: '' },
        { jp: 'ち', romaji: 'chi', ko: '' }, { jp: 'は', romaji: 'wa', ko: '' }, { jp: '！', romaji: '', ko: '' },
        { jp: '日', romaji: 'ni', ko: '일본어' }, { jp: '本', romaji: 'hon', ko: '' }, { jp: '語', romaji: 'go', ko: '' },
        { jp: 'の', romaji: 'no', ko: '~의' }, { jp: '会', romaji: 'kai', ko: '회화' }, { jp: '話', romaji: 'wa', ko: '' },
        { jp: '練', romaji: 'ren', ko: '연습' }, { jp: '習', romaji: 'shuu', ko: '' }, { jp: 'を', romaji: 'wo', ko: '~을/를' },
        { jp: '始', romaji: 'haji', ko: '시작해요' }, { jp: 'め', romaji: 'me', ko: '' }, { jp: 'ま', romaji: 'ma', ko: '' },
        { jp: 'しょう', romaji: 'shou', ko: '' }, { jp: '。', romaji: '', ko: '' },
      ],
      reply_ko: '안녕하세요! 일본어 회화 연습을 시작해 볼까요.',
      question_jp: '今日はどんな一日でしたか？',
      question_chunks: [
        { jp: '今日', romaji: 'kyou', ko: '오늘' }, { jp: 'は', romaji: 'wa', ko: '~은/는' },
        { jp: 'ど', romaji: 'do', ko: '어떤' }, { jp: 'ん', romaji: 'n', ko: '' }, { jp: 'な', romaji: 'na', ko: '' },
        { jp: '一', romaji: 'ichi', ko: '하루' }, { jp: '日', romaji: 'nichi', ko: '' },
        { jp: 'で', romaji: 'de', ko: '~였다' }, { jp: 'し', romaji: 'shi', ko: '' }, { jp: 'た', romaji: 'ta', ko: '' },
        { jp: 'か', romaji: 'ka', ko: '~까?' }, { jp: '？', romaji: '', ko: '' },
      ],
      question_ko: '오늘은 어떤 하루였나요?',
    },
  });
}

/* ── 12. 입력창 동작 ───────────────────────────────────────── */

function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 140) + 'px';
}

/**
 * 일본어 IME가 없어 히라가나를 직접 칠 수 없는 사용자를 위해, 로마자로 치면
 * 실시간으로 히라가나로 자동 변환해 주는 wanakana 바인딩을 켜고 끈다.
 * (한국어로 질문을 입력하는 경우도 있으므로 기본은 켜져 있되 언제든 끌 수 있게 둔다.)
 */
function syncRomajiIme() {
  if (typeof wanakana === 'undefined') return;
  // unbind()는 아직 바인딩된 적 없는 요소에 호출하면 예외를 던지므로 감싸준다.
  try { wanakana.unbind(el.input); } catch { /* 바인딩된 적 없음 — 무시 */ }
  if (state.romajiIme) wanakana.bind(el.input);
}

/**
 * 외래어(가타카나) 입력용 — wanakana.bind()는 항상 히라가나로만 변환하므로,
 * 선택한 부분(또는 선택이 없으면 커서 바로 앞의 "단어")을 가타카나로 바꿔주는
 * 보조 버튼. 실제 일본어 IME의 F7 변환 키와 같은 역할.
 */
function convertToKatakana() {
  if (typeof wanakana === 'undefined') return;
  const value = el.input.value;
  let start = el.input.selectionStart;
  let end = el.input.selectionEnd;

  if (start === end) {
    let i = start;
    while (i > 0 && !/[\s。、！？.,!?]/.test(value[i - 1])) i--;
    start = i;
  }
  if (start === end) return;

  const converted = wanakana.toKatakana(value.slice(start, end));
  el.input.value = value.slice(0, start) + converted + value.slice(end);
  const pos = start + converted.length;
  el.input.focus();
  el.input.setSelectionRange(pos, pos);
  autoGrow();
}

const isTouch = window.matchMedia('(pointer: coarse)').matches;

function setStatus(text) {
  if (text) { el.status.textContent = text; el.status.className = ''; return; }
  if (!state.apiKey) {
    el.status.textContent = 'API 키를 등록해 주세요 — 설정 ⚙️';
    el.status.className = 'err';
  } else {
    el.status.textContent = `준비 완료 · ${MODELS[state.model]?.label.split(' —')[0] || state.model}`;
    el.status.className = 'ok';
  }
}

/* ── 13. 단어 학습 (SRS) ───────────────────────────────────── */

function switchView(view) {
  const chat = view === 'chat';
  el.chatView.hidden = !chat;
  el.studyView.hidden = chat;
  el.tabChat.setAttribute('aria-selected', String(chat));
  el.tabStudy.setAttribute('aria-selected', String(!chat));
  if (!chat) renderStudyView();
}

function wordCardHtml(w) {
  return `
    <div class="word-card">
      <button class="w-speak" type="button" data-speak="${esc(w.jp)}" title="발음 듣기">🔈</button>
      <div class="w-cat">${esc(w.cat)}</div>
      <div class="w-jp">${esc(w.jp)}</div>
      <div class="w-romaji">${esc(w.romaji)}</div>
      <div class="w-ko">${esc(w.ko)}</div>
    </div>`;
}

function renderStudyView() {
  const stats = getStats();
  const newWords = getTodayNewWords();
  const due = getDueReviews();
  const retry = getRetryQueue();

  let html = `
    <div class="stat-row">
      <div class="stat-tile"><b>${stats.totalLearned}</b><span>학습한 단어</span></div>
      <div class="stat-tile"><b>${stats.mastered}</b><span>마스터</span></div>
      <div class="stat-tile"><b>${stats.dueReviewCount}</b><span>복습 대기</span></div>
      <div class="stat-tile"><b>${stats.retryCount}</b><span>다시 풀기</span></div>
    </div>

    <div class="study-section">
      <div class="study-section-head">
        <h3>오늘의 새 단어</h3>
        <span>${newWords.length}/${DAILY_GOAL}${stats.todayTested ? ' · 테스트 완료 ✅' : ''}</span>
      </div>`;

  if (newWords.length) {
    html += `<div class="word-grid">${newWords.map(wordCardHtml).join('')}</div>`;
    html += `
      <div class="action-row">
        <button class="action-btn primary" type="button" data-act="practice">🗨️ 이 단어로 대화 연습</button>
        <button class="action-btn secondary" type="button" data-act="quiz-new">📝 오늘의 테스트${stats.todayTested ? ' (다시 보기)' : ''}</button>
      </div>`;
  } else {
    html += '<div class="empty-note">🎉 단어 은행을 모두 학습했습니다!<br>아래 복습만 계속 진행해 주세요.</div>';
  }
  html += '</div>';

  if (due.length) {
    html += `
      <div class="study-section">
        <div class="study-section-head"><h3>오늘 복습할 단어</h3><span>${due.length}개 · +3일/+1주/+3주 일정</span></div>
        <div class="word-grid">${due.map(wordCardHtml).join('')}</div>
        <div class="action-row">
          <button class="action-btn primary" type="button" data-act="quiz-review">✅ 복습 테스트 시작</button>
        </div>
      </div>`;
  }

  if (retry.length) {
    html += `
      <div class="study-section">
        <div class="study-section-head"><h3>다시 풀기</h3><span>지난 테스트에서 틀린 단어 ${retry.length}개</span></div>
        <div class="word-grid">${retry.map(wordCardHtml).join('')}</div>
        <div class="action-row">
          <button class="action-btn secondary" type="button" data-act="quiz-retry">🔁 다시 풀기 시작</button>
        </div>
      </div>`;
  }

  if (!due.length && !retry.length && !newWords.length) {
    html += '<div class="empty-note">오늘은 예정된 복습이 없어요. 내일 다시 확인해 주세요!</div>';
  }

  el.studyContent.innerHTML = html;

  el.studyContent.querySelectorAll('[data-speak]').forEach((btn) => {
    btn.addEventListener('click', () => speak(btn.dataset.speak));
  });
  const act = (sel, fn) => el.studyContent.querySelector(sel)?.addEventListener('click', fn);
  act('[data-act="practice"]', startPractice);
  act('[data-act="quiz-new"]', () => openQuiz(newWords, 'new', '오늘의 테스트'));
  act('[data-act="quiz-review"]', () => openQuiz(due, 'review', '복습 테스트'));
  act('[data-act="quiz-retry"]', () => openQuiz(retry, 'retry', '다시 풀기'));

  updateStudyBadge(stats);
}

function updateStudyBadge(stats) {
  const s = stats || getStats();
  const pending = (s.todayNewCount > 0 && !s.todayTested ? 1 : 0) + s.dueReviewCount + s.retryCount;
  el.studyBadge.hidden = pending === 0;
  el.studyBadge.textContent = pending > 99 ? '99+' : String(pending);
}

/* 대화 연습 모드 */

function startPractice() {
  const words = getTodayNewWords();
  if (!words.length) return;
  state.practiceMode = true;
  state.practiceWords = words;
  state.practiceStartTurn = state.turns.length;
  el.practiceBanner.hidden = false;
  el.practiceBannerCount.textContent = words.length;
  switchView('chat');
  send('오늘 배운 단어로 대화 연습을 시작해 줘.');
}

/** 봇 턴 하나에 들어있는 일본어 텍스트를 전부 모아 하나의 문자열로 합친다 (단어 등장 여부 검사용). */
function turnJpText(turn) {
  if (turn.kind === 'user') return turn.text || '';
  if (turn.kind !== 'bot') return '';
  const d = turn.data || {};
  return [d.corrected_jp, d.reply_jp, d.question_jp].filter(Boolean).join(' ');
}

/** 연습 세션 동안(practiceStartTurn 이후) 오늘의 단어가 실제로 대화에 등장했는지 정리한다. */
function buildPracticeSummary() {
  const sessionTurns = state.turns.slice(state.practiceStartTurn ?? 0);
  const sessionText = sessionTurns.map(turnJpText).join(' ');
  return state.practiceWords.map((w) => ({ ...w, used: sessionText.includes(w.jp) }));
}

function endPractice() {
  const hadSession = state.practiceMode && state.practiceStartTurn !== null
    && state.turns.length > state.practiceStartTurn;

  if (hadSession) {
    const summary = buildPracticeSummary();
    if (summary.some((w) => w.used)) {
      addTurn({ kind: 'summary', words: summary });
    }
  }

  state.practiceMode = false;
  state.practiceWords = [];
  state.practiceStartTurn = null;
  el.practiceBanner.hidden = true;
}

/* 퀴즈 */

let quizState = null;

function openQuiz(words, mode, title) {
  if (!words.length) return;
  el.quizTitle.textContent = title;
  quizState = { questions: buildQuiz(shuffleArr(words)), idx: 0, mode, correctCount: 0, results: [] };
  el.quizBackdrop.hidden = false;
  renderQuizQuestion();
}

function closeQuiz() {
  el.quizBackdrop.hidden = true;
  quizState = null;
  if (!el.studyView.hidden) renderStudyView();
  else updateStudyBadge();
}

function renderQuizQuestion() {
  const { questions, idx } = quizState;
  el.quizProgressBar.style.width = `${Math.round((idx / questions.length) * 100)}%`;

  if (idx >= questions.length) { renderQuizResult(); return; }

  const q = questions[idx];
  el.quizBody.innerHTML = `
    <div class="quiz-question">
      <div class="q-jp">${esc(q.word.jp)}</div>
      <div class="q-romaji">${esc(q.word.romaji)}</div>
    </div>
    <div class="quiz-options">
      ${q.options.map((opt) => `<button class="quiz-opt" type="button">${esc(opt)}</button>`).join('')}
    </div>`;

  el.quizBody.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => answerQuiz(btn, q));
  });
}

function answerQuiz(btn, q) {
  const correct = btn.textContent === q.correctAnswer;
  quizState.results.push({ word: q.word, correct });
  if (correct) quizState.correctCount += 1;
  recordTestResult(q.word.id, correct, quizState.mode);

  el.quizBody.querySelectorAll('.quiz-opt').forEach((b) => {
    b.disabled = true;
    if (b.textContent === q.correctAnswer) b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong');
  });

  speak(q.word.jp);

  const next = document.createElement('button');
  next.className = 'quiz-next';
  next.type = 'button';
  next.textContent = quizState.idx + 1 < quizState.questions.length ? '다음 문제' : '결과 보기';
  next.addEventListener('click', () => { quizState.idx += 1; renderQuizQuestion(); });
  el.quizBody.appendChild(next);
}

function renderQuizResult() {
  const { correctCount, results, questions } = quizState;
  el.quizProgressBar.style.width = '100%';
  const wrong = results.filter((r) => !r.correct);

  el.quizBody.innerHTML = `
    <div class="quiz-result">
      <div><div class="r-score">${correctCount} / ${questions.length}</div><div class="r-label">정답</div></div>
      ${wrong.length ? `
        <div class="quiz-result-list">
          ${wrong.map((r) => `
            <div class="rl-item wrong">
              <span class="rl-mark">❌</span>
              <span class="rl-text">
                <span class="rl-jp">${esc(r.word.jp)}</span>
                <span class="rl-romaji">${esc(r.word.romaji)}</span>
                <span class="rl-ko">${esc(r.word.ko)}</span>
              </span>
            </div>`).join('')}
        </div>
        <div class="r-label">틀린 단어는 '다시 풀기'에 자동으로 저장됩니다.</div>
      ` : '<div class="r-label">전부 맞혔어요! 🎉</div>'}
      <button class="quiz-next" type="button" id="btnQuizDone">확인</button>
    </div>`;
  document.getElementById('btnQuizDone').addEventListener('click', closeQuiz);
}

/* ── 14. 초기화 ────────────────────────────────────────────── */

function bind() {
  el.composer.addEventListener('submit', (e) => { e.preventDefault(); send(el.input.value); });

  el.input.addEventListener('input', autoGrow);
  el.input.addEventListener('keydown', (e) => {
    // 데스크톱: Enter 전송 / Shift+Enter 줄바꿈. 모바일: Enter는 항상 줄바꿈.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !isTouch) {
      e.preventDefault();
      send(el.input.value);
    }
  });

  el.btnMic.addEventListener('click', () => (state.recording ? stopRecording() : startRecording()));

  el.btnRomajiIme.addEventListener('click', () => {
    state.romajiIme = !state.romajiIme;
    el.btnRomajiIme.setAttribute('aria-pressed', String(state.romajiIme));
    syncRomajiIme();
    persistSettings();
  });

  el.btnKatakana.addEventListener('click', convertToKatakana);

  el.btnSettings.addEventListener('click', openSettings);
  el.btnClose.addEventListener('click', closeSettings);
  el.btnSave.addEventListener('click', saveSettings);
  el.backdrop.addEventListener('click', (e) => { if (e.target === el.backdrop) closeSettings(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.backdrop.hidden) closeSettings();
    else if (!el.quizBackdrop.hidden) closeQuiz();
  });

  el.btnToggleKey.addEventListener('click', () => {
    const show = el.apiKeyInput.type === 'password';
    el.apiKeyInput.type = show ? 'text' : 'password';
    el.btnToggleKey.textContent = show ? '숨기기' : '보기';
  });

  el.btnClearKey.addEventListener('click', async () => {
    el.apiKeyInput.value = '';
    state.apiKey = '';
    await saveApiKey('');
    localStorage.removeItem(LS.ek);
    setStatus(null);
    closeSettings();
  });

  el.btnSyncNew.addEventListener('click', handleSyncNew);
  el.btnSyncConnect.addEventListener('click', handleSyncConnect);
  el.btnSyncCopy.addEventListener('click', () => {
    navigator.clipboard?.writeText(getSyncKey());
    el.btnSyncCopy.textContent = '복사됨';
    setTimeout(() => { el.btnSyncCopy.textContent = '코드 복사'; }, 1200);
  });

  el.modelSelect.addEventListener('change', updateModelHelp);
  el.rateInput.addEventListener('input', () => {
    el.rateOut.textContent = Number(el.rateInput.value).toFixed(2);
  });

  el.btnReset.addEventListener('click', resetChat);

  el.btnAutoTts.addEventListener('click', () => {
    state.autoTts = !state.autoTts;
    el.btnAutoTts.setAttribute('aria-pressed', String(state.autoTts));
    if (!state.autoTts) synth?.cancel();
    persistSettings();
  });

  el.starters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) send(chip.dataset.text);
  });

  // 첫 사용자 제스처에서 iOS TTS 잠금 해제
  document.addEventListener('pointerdown', unlockTts, { once: true });

  // 탭을 떠나면 재생 중단
  document.addEventListener('visibilitychange', () => { if (document.hidden) synth?.cancel(); });

  // 상단 탭 (대화 / 단어 학습)
  el.tabChat.addEventListener('click', () => switchView('chat'));
  el.tabStudy.addEventListener('click', () => switchView('study'));
  el.btnEndPractice.addEventListener('click', endPractice);

  // 퀴즈 모달
  el.btnCloseQuiz.addEventListener('click', closeQuiz);
  el.quizBackdrop.addEventListener('click', (e) => { if (e.target === el.quizBackdrop) closeQuiz(); });
}

async function main() {
  // 모델 드롭다운
  for (const [id, m] of Object.entries(MODELS)) {
    el.modelSelect.add(new Option(m.label, id));
  }

  restore();
  await loadSrs();
  state.apiKey = await loadApiKey();

  el.btnAutoTts.setAttribute('aria-pressed', String(state.autoTts));
  el.btnRomajiIme.setAttribute('aria-pressed', String(state.romajiIme));
  syncRomajiIme();

  if (!state.turns.length) greet();
  renderAll();
  updateStudyBadge();

  // 단어 은행이 바닥났으면 백그라운드에서 자동으로 새 단어를 생성한다.
  // await하지 않음 — 초기 화면 표시를 API 호출로 지연시키지 않기 위함.
  refillVocabIfNeeded().then((added) => {
    if (!added) return;
    updateStudyBadge();
    if (!el.studyView.hidden) renderStudyView();
  });

  initSTT();
  if (synth) {
    pickVoice();
    // 음성 목록은 비동기로 로드된다 — 로드되면 설정 패널의 표시도 갱신
    synth.addEventListener('voiceschanged', () => {
      pickVoice();
      if (!el.backdrop.hidden) renderCaps();
    });
  }

  bind();
  setStatus(null);
  autoGrow();

  if (!state.apiKey) openSettings();
}

main();
