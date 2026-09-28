# 일본어 회화 튜터 (JP Tutor)

Anthropic Claude API를 브라우저에서 직접 호출하는 1:1 일본어 회화 연습 웹앱.
빌드 도구 없는 순수 정적 파일 3개 — 어디든 그대로 올리면 동작합니다.

```
jp-tutor/
├── index.html    마크업 + 설정/퀴즈 모달 + 대화·학습 탭
├── styles.css    모바일 퍼스트 메신저 UI (라이트/다크 자동)
├── vocab.js      내장 단어 은행 (N5~N4 수준 240개, 하루 10개 × 24일)
├── srs.js        간격 반복 학습(SRS) 엔진 — 순수 로직 + localStorage
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

히라가나·가타카나를 몰라도 되도록 모든 일본어 발음을 **로마자(헵번식)** 로 표기합니다
(교정 카드 포함, `corrected_romaji`/`reply_romaji`/`question_romaji` 필드).

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
