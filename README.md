# 일본어 회화 튜터 (JP Tutor)

Anthropic Claude API를 브라우저에서 직접 호출하는 1:1 일본어 회화 연습 웹앱.
빌드 도구 없는 순수 정적 파일 3개 — 어디든 그대로 올리면 동작합니다.

```
jp-tutor/
├── index.html    마크업 + 설정/퀴즈 모달 + 대화·학습 탭
├── styles.css    모바일 퍼스트 메신저 UI (라이트/다크 자동)
├── vocab.js      내장 단어 은행 (N5~N4 수준 240개, 하루 10개 × 24일)
├── srs.js        간격 반복 학습(SRS) 엔진 — 순수 로직 + localStorage
├── sync.js       기기 간 동기화 (Firebase Firestore, 선택 기능)
├── app.js        Claude API 호출 · STT · TTS · 암호화 저장 · 학습 UI
└── README.md
```

## 로컬 실행

`file://`로 열어도 대부분 동작하지만, **Web Speech API(마이크)는 보안 컨텍스트를 요구**하므로
반드시 로컬 서버로 띄우세요. `http://localhost` / `http://127.0.0.1`은 보안 컨텍스트로 취급됩니다.

```powershell
# Python (권장 — 별도 설치 불필요)
cd C:\Users\이한수\jp-tutor
python -m http.server 8765

# 또는 Node
npx serve -l 8765 .
```

브라우저에서 <http://127.0.0.1:8765> 접속 → ⚙️ 설정에서 API 키 입력 → 저장.

키 발급: <https://console.anthropic.com/settings/keys>

## 배포

정적 호스팅이면 어디든 됩니다. 빌드 명령 없음, 출력 디렉터리는 프로젝트 루트.

| 서비스 | 방법 |
|---|---|
| **Netlify** | 폴더를 <https://app.netlify.com/drop> 에 드래그 앤 드롭 |
| **Vercel** | `npx vercel --prod` (Framework: Other, Build Command 비움) |
| **GitHub Pages** | 저장소 푸시 → Settings → Pages → Branch: `main` / `/ (root)` |
| **Cloudflare Pages** | 저장소 연결, Build command 비움, Output directory `/` |

배포된 사이트는 HTTPS이므로 마이크와 AES-GCM 암호화가 모두 활성화됩니다.

## 사용하는 Claude API

`POST https://api.anthropic.com/v1/messages` 를 `fetch`로 직접 호출합니다.

```
content-type: application/json
x-api-key: sk-ant-...
anthropic-version: 2023-06-01
anthropic-dangerous-direct-browser-access: true   ← 브라우저 직접 호출 허용 (CORS)
```

- **모델**: 기본 `claude-sonnet-5`. 설정에서 `claude-opus-5`(최고 품질) / `claude-haiku-4-5`(가장 빠름)로 변경 가능.
- **구조화 출력**: `output_config.format` 의 JSON 스키마로 응답 형태를 강제합니다.
  덕분에 `[교정 및 피드백]`은 한국어 카드로, 일본어 본문/추가 질문은 별도 필드로 받아
  **TTS가 일본어 문장만 정확히 읽습니다** (한국어 해설을 일본어 음성으로 읽는 사고 방지).

  | 필드 | 내용 |
  |---|---|
  | `correction_needed` / `corrected_jp` / `feedback_ko` | 교정 여부 · 고친 일본어 문장 · 한국어 설명 |
  | `reply_jp` / `reply_kana` / `reply_ko` | 튜터 응답 · 히라가나 발음 · 한국어 번역 |
  | `question_jp` / `question_kana` / `question_ko` | 대화를 잇는 추가 질문 1개 (동일 3종) |

- **지연시간 최적화**: 회화는 깊은 추론이 필요 없으므로 `thinking: {type:"disabled"}` +
  `output_config.effort: "low"` 로 응답을 빠르게 합니다.
  `effort`를 지원하지 않는 Haiku 4.5에서는 두 파라미터를 자동으로 생략합니다.
- 대화 맥락은 최근 24개 메시지까지 함께 전송합니다 (`MAX_HISTORY`).

## 듣기 · 말하기

- **말하기 (STT)** — `webkitSpeechRecognition`, `lang = "ja-JP"`.
  마이크를 누르면 빨간 펄스 애니메이션이 돌고, 인식이 끝나면 **자동 전송**됩니다.
  중간 인식 결과가 입력창에 실시간으로 표시됩니다.
- **듣기 (TTS)** — `speechSynthesis`, `lang = "ja-JP"`, 기본 배속 `0.95`(설정에서 0.6~1.3 조절).
  응답이 오면 자동 재생되고, 각 말풍선의 `🔈 다시 듣기`로 수동 재생도 됩니다.
  상단 🔊 버튼으로 자동 재생을 끌 수 있습니다.
  일본어 보이스는 Kyoko / Google 日本語 / Nanami 등을 우선 선택합니다.

### 브라우저 지원

| | STT (마이크) | TTS |
|---|---|---|
| Chrome / Edge (데스크톱·안드로이드) | ✅ | ✅ |
| Safari (macOS · iOS 14.5+) | ✅ | ✅ (첫 탭 제스처로 잠금 해제됨 — 앱이 자동 처리) |
| Firefox | ❌ (키보드 입력으로 대체, 마이크 버튼 자동 숨김) | ✅ |
| iOS의 Chrome/Firefox | ❌ (WebKit 제약) | ✅ |

설정 모달 하단에서 현재 브라우저의 실제 지원 상태를 확인할 수 있습니다.

## API 키 저장 방식과 한계

- Web Crypto **AES-GCM 256**으로 암호화해 `localStorage`에 저장합니다
  (`jt.key` = 암호문, `jt.ek` = 이 기기에서 생성된 랜덤 키). 새로고침해도 유지됩니다.
- **한계를 분명히 해 둡니다.** 복호화 키가 같은 브라우저 안에 있으므로,
  그 기기에서 개발자도구를 열 수 있는 사람은 키를 꺼낼 수 있습니다.
  이는 *평문 노출 방지*이지 서버급 보안이 아닙니다.
- 따라서 **공용 PC에서는 사용 후 설정 → `키 삭제`** 를 눌러 주세요.
- 비-HTTPS(`http://` 원격지)에서는 `crypto.subtle`이 없어 base64 인코딩으로 폴백합니다.
  설정 패널이 이 상태를 표시합니다.
- 키가 사용자 기기를 벗어나 전송되는 곳은 `api.anthropic.com` 뿐입니다.

> **여러 사람에게 배포할 계획이라면** 키를 클라이언트에 두지 마세요.
> Netlify Functions / Vercel Edge Functions 같은 서버리스 프록시를 하나 두고,
> `app.js`의 `API_URL`을 그 엔드포인트로 바꾸고 `x-api-key` 헤더를 제거하면 됩니다.
> 지금 구조는 "내 키로 나 혼자 쓰는 앱"에 맞춰져 있습니다.

## 단어 학습 (SRS)

히라가나·가타카나를 몰라도 되도록 모든 일본어 발음을 **로마자(헵번식)** 로 표기합니다.
대화 탭의 일본어 문장은 **후리가나 스타일**로, 문장 전체가 아니라 단어/구 조각(chunk)
단위로 나눠 각 조각 바로 아래에 그 조각의 로마자를 붙입니다 (`*_chunks: {jp, romaji}[]`
필드 — 조각의 jp를 이어붙이면 원문과 정확히 같아야 하며, 모델이 규칙을 어기면
`renderRuby()`가 안전하게 평문으로 폴백합니다).

- **오늘의 새 단어**: 내장 단어 은행(`vocab.js`, N5~N4 수준 240개 · 24일치)에서 매일 10개씩
  순서대로 배정됩니다. 하루가 지나면 다음 10개로 넘어가며, 그날 배정은 새로고침해도 유지됩니다.
- **단어 은행 자동 확장**: 240개를 다 배우고 나면, 앱이 **백그라운드에서 Claude API를 호출해**
  부족한 만큼 새 단어를 스스로 생성하고(`requestMoreVocab`, `output_config.format` JSON 스키마로
  jp/romaji/ko/cat 필드를 강제) `localStorage`(`jt.vocabExt`)에 기존 은행 뒤로 이어 붙입니다.
  이미 있는 단어와 절대 겹치지 않게 지시하고, 배치가 늘어날수록(24일→25일→26일…) 난이도를
  N5→N4→N3로 서서히 올리도록 프롬프트에 넣어뒀습니다. 즉 **사람이 다시 손댈 필요 없이
  무한히 이어집니다.** 생성은 앱을 열 때 한 번만 시도하고(초기 화면 표시는 지연시키지 않음),
  API 호출이 실패하면(키 없음, 오프라인 등) 조용히 넘어가고 다음에 앱을 열 때 다시 시도합니다.
- **이 단어로 대화 연습**: 오늘의 10단어를 시스템 프롬프트에 주입해 Claude가 그 단어들을
  자연스럽게 섞어 쓰고, 사용자에게도 사용을 유도합니다. 정확히 사용하면 교정 카드에서 칭찬합니다.
- **오늘의 테스트**: 오늘 단어로 4지선다 퀴즈(일본어→한국어 뜻)를 봅니다. 오답은 자동으로
  **'다시 풀기'** 큐에 쌓여 아무 때나 재도전할 수 있고, 맞히면 큐에서 빠집니다.
- **복습 스케줄**: 모든 단어는 학습일 기준 **+3일 / +1주 / +3주**에 각각 한 번씩 복습 테스트가
  자동으로 예약됩니다. 복습에서 맞히면 다음 단계로, 틀리면 같은 단계에 남아 다음날 다시 나옵니다
  (스케줄 자체는 틀려도 늦춰지지 않는 고정 트랙입니다).
- 학습 기록은 `localStorage`(`jt.srs`)에 저장됩니다. 단어 은행은 API 호출 없이 앱에 내장되어
  있어 오프라인에서도 단어 목록·퀴즈는 동작합니다(대화 연습만 API가 필요).

## 기기 간 동기화 (PC ↔ 폰, 선택 기능)

기본 상태에서는 모든 데이터가 브라우저별로 로컬(localStorage)에만 저장되어, PC와 폰이
서로 다른 진행 기록을 가집니다. 무료 [Firebase](https://firebase.google.com) Firestore를
연결하면 **단어 학습 진행 기록**(오늘의 단어, 복습 스케줄, 자동 생성된 단어, 설정)이
기기 간에 자동으로 동기화됩니다.

**동기화되지 않는 것**: API 키(`jt.key`), 대화 내역(`jt.chat`) — 각 기기에 남습니다.
API 키는 보안상 의도적으로 동기화 대상에서 뺐습니다 (제3자 서비스에 API 키가 오가지
않도록). 대화 내역은 용량이 계속 커질 수 있어 뺐습니다.

### 설정 방법 (최초 1회, 5분)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 구글 계정으로 로그인 →
   **프로젝트 추가** → 이름은 아무거나 (예: `jp-tutor-sync`) → Google Analytics는 꺼도 됨.
2. 왼쪽 메뉴 **빌드 → Firestore Database** → **데이터베이스 만들기** → 위치는 가까운 곳
   (예: `asia-northeast3`) → **테스트 모드로 시작** (규칙은 3번에서 교체).
3. **Firestore → 규칙(Rules)** 탭에서 아래로 교체하고 **게시**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /syncData/{syncKey} {
         allow read, write: if true;
       }
     }
   }
   ```
   > 로그인 시스템이 없는 만큼, 동기화 코드 자체가 사실상의 비밀번호입니다. 코드를 아는
   > 사람은 그 문서 하나만 읽고 쓸 수 있습니다 (다른 사용자 데이터는 접근 불가). 학습
   > 진행 기록일 뿐 API 키 등 민감정보는 여기 올라가지 않으니, 개인용으로는 충분합니다.
4. 왼쪽 위 톱니바퀴 → **프로젝트 설정** → 아래 **내 앱** → `</>` (웹 앱 아이콘) →
   앱 닉네임 아무거나 입력 → **앱 등록** (Firebase Hosting 체크 불필요).
5. 화면에 나오는 `firebaseConfig` 객체를 통째로 복사해 `sync.js`의 `FIREBASE_CONFIG`에
   붙여넣기:
   ```js
   const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "jp-tutor-sync.firebaseapp.com",
     projectId: "jp-tutor-sync",
     storageBucket: "jp-tutor-sync.appspot.com",
     messagingSenderId: "...",
     appId: "...",
   };
   ```
   (이 값들은 비밀정보가 아닙니다 — 실제 접근 제어는 3번의 Firestore 규칙이 담당합니다.)
6. 커밋 후 배포(`git add -A && git commit -m "Firebase 설정" && git push`).

### 사용 방법

- **첫 번째 기기(PC)**: 설정 ⚙️ → "기기 간 동기화" → **이 기기를 기준으로 새 코드 만들기**
  → 32자리 코드 생성됨 → **코드 복사**.
- **두 번째 기기(폰)**: 같은 사이트 접속 → 설정 → 코드 붙여넣기 → **연결**.
  (이미 폰에서 며칠 학습한 기록이 있다면, 연결 시 PC 기록으로 덮어써진다는 확인창이 뜹니다.)
- 이후로는 두 기기 모두 학습 진행 기록이 바뀔 때마다(퀴즈 채점, 새 단어 배정 등) 자동으로
  업로드되고, 앱을 열 때마다 더 최신 데이터를 자동으로 받아옵니다.
- 충돌 처리는 "마지막에 저장한 쪽이 이긴다" 방식입니다 — 두 기기를 동시에 쓰지 않고
  번갈아 쓰는 사용 패턴을 가정합니다.

## 기타

- 대화 내역도 `localStorage`(`jt.chat`)에 저장되어 새로고침 후 이어집니다. 🗑️로 초기화.
- 학습 수준(초급/중급/고급)을 바꾸면 시스템 프롬프트의 난이도 지시가 달라집니다.
- 데스크톱은 `Enter` 전송 / `Shift+Enter` 줄바꿈, 모바일은 `Enter`가 줄바꿈입니다.
- 오류는 상태 코드별로 한국어 안내와 `다시 시도` 버튼으로 표시됩니다
  (401 키 오류 · 404 모델 없음 · 429 rate limit · 529 과부하 · 네트워크/CORS 차단 등).

## 검증 완료 항목

로컬 서버(`127.0.0.1:8765`) + Chrome에서 확인:

- `anthropic-dangerous-direct-browser-access` 헤더로 브라우저 → `api.anthropic.com` **CORS 통과 확인**
  (잘못된 키로 401 `authentication_error` 정상 수신)
- API 키 AES-GCM 암호화 저장 → 새로고침 후 복호화 성공
- 401 오류의 한국어 매핑 + 재시도 버튼, 대화 내역 복원, 일본어 보이스 탐지(`Google 日本語`)
- 콘솔 에러 0건

**실제 대화 왕복은 유효한 API 키가 있어야 확인 가능합니다** — 키를 넣고 한 번 보내 보세요.
