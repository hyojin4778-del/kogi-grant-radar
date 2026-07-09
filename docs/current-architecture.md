# 현재 아키텍처 (실제 K-Startup API 연동 전)

이 문서는 지금 시점의 데이터 흐름과, 실제 API 연동 시 무엇을 바꿔야 하는지,
그리고 그 전까지 하면 안 되는 것을 한 곳에 정리한 스냅샷이다.

## 1. 데이터 흐름 (일일 스냅샷 방식)

관련 파일: `scripts/update-grants.js`, `services/kstartupSource.js`,
`matchingEngine.js`, `data/grants.json`, `server.js`, `index.html`.

1. **`scripts/update-grants.js`** (하루 1회 실행 — 로컬 `npm run
   update-grants`, 또는 `.github/workflows/update-grants.yml`의 스케줄) —
   `services/kstartupSource.js`의 `fetchKStartupHtml()` +
   `parseKStartupOngoingHtml()`로 K-Startup "모집중" 목록을 가져온 뒤,
   `matchingEngine.js`의 `classifyGrant()`로 KOGI 프로필(`data/kogiProfile.js`)
   기준 채점·분류를 적용한다.
2. 실패(네트워크 오류, 페이지 구조 변경으로 0건 파싱)하면 `data/mockGrants.js`
   (손으로 큐레이션된 8개 예시 공고, 이미 `recommendation`이 정해져 있어 재채점하지
   않음)로 대체한다.
3. 결과를 `{ lastUpdated, dataSource, message, grants }` 형태로
   **`data/grants.json`에 저장**한다 (레포에 커밋됨 — 최초 배포/체크아웃 시에도
   빈 화면이 뜨지 않도록).
4. **`server.js`의 `/api/grants/kstartup`**은 이제 K-Startup을 직접 호출하지
   않고, `data/grants.json`을 **읽기만** 한다 — 그래서 페이지 요청마다 스크래핑이
   일어나지 않고 응답이 빠르다. 신선도는 순전히 1번 스크립트가 얼마나 자주
   실행되느냐에 달려 있다. 파일이 없거나 손상된 경우에만 `mockGrants`로
   폴백한다.
5. **`index.html`**은 `services/grantApi.js`의 `fetchAllGrants()`를 통해 이
   라우트를 호출하고, 응답의 `dataSource`/`lastUpdated`/`message`를 그대로
   신뢰해 상단 배너에 표시한다. 백엔드 자체가 응답하지 않을 때만(서버 다운 등)
   프론트가 번들된 `data/mockGrants.js`로 한 번 더 폴백한다.

## 2. 실제 K-Startup API 연동 시 수정해야 할 파일

- **`services/kstartupSource.js`** — `fetchKStartupHtml()`/
  `parseKStartupOngoingHtml()`를 실제 API 호출 + 응답 매핑으로 교체
  (`process.env.KSTARTUP_API_KEY` 사용, 확인된 endpoint/파라미터 적용). 함수
  시그니처(입력 없음 → base grant 배열 반환)만 유지하면 `scripts/update-grants.js`,
  `matchingEngine.js`는 전혀 수정할 필요가 없다.
- **`docs/kstartup-api-checklist.md`** — 공식 문서에서 확인한 endpoint,
  파라미터명, 응답 필드명을 채워 넣는 기준 문서로 계속 사용.
- **`.env`** (신규 생성, 커밋 금지) — 실제 `KSTARTUP_API_KEY` 값을 이 파일에
  설정. `.env.example`은 값이 비어있는 템플릿으로 계속 유지. 배포 환경에서는
  Render/GitHub Actions의 환경변수·시크릿으로 주입한다.

## 3. 실제 API 연동 전 절대 하면 안 되는 것

1. **프론트엔드에 API 키 하드코딩 금지** — `index.html`, `services/grantApi.js`
   등 브라우저에서 실행되는 어떤 파일에도 실제 `KSTARTUP_API_KEY`/
   `BIZINFO_API_KEY` 값을 직접 적지 않는다. 키는 오직 서버 사이드 스크립트
   (`scripts/update-grants.js`, `services/kstartupSource.js`)가 `process.env`
   에서만 읽는다.
2. **실제 `.env` 파일을 정적 서버에 노출 금지** — 실제 `.env`는 이 프로젝트
   루트에도 만들지 않는다.
3. **공식 문서 확인 전 API endpoint나 필드명 추측 금지** — `docs/kstartup-api-checklist.md`에
   "확인 필요"로 남아있는 항목은 실제 공공데이터포털 문서로 확인하기 전까지
   임의의 값으로 채우거나 코드에 반영하지 않는다.
4. **폐기된 K-Startup API 기준으로 구현 금지** — 반드시 현재 서비스 중인
   "창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)" API 기준으로만
   작업한다.
