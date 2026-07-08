# 현재 아키텍처 (실제 K-Startup API 연동 전)

이 문서는 지금 시점의 데이터 흐름과, 실제 API 연동 시 무엇을 바꿔야 하는지,
그리고 그 전까지 하면 안 되는 것을 한 곳에 정리한 스냅샷이다.

## 1. 데이터 흐름

관련 파일: `index.html`, `services/grantApi.js`, `/api/grants/kstartup`
(`server.js`에서 처리), `data/mockGrants.js`.

1. **`index.html`** — 화면이 뜰 때 `initGrid()`가 `fetchAllGrants()`를 호출한다.
2. **`services/grantApi.js` `fetchAllGrants()`** — `fetchKStartupGrants()`를
   먼저 호출한다. 그 결과가 성공(`ok:true`)이고 `grants` 배열이 비어있지
   않으면 그대로 사용(`dataSource:"live"`); 그렇지 않으면 3번의 폴백으로
   넘어간다.
3. **`services/grantApi.js` `fetchKStartupGrants()`** — 외부 K-Startup API를
   직접 호출하지 않고, 같은 출처(same-origin)의 백엔드 라우트인
   `/api/grants/kstartup`만 `fetch()`한다.
4. **`/api/grants/kstartup` (`server.js`에서 처리)** — 현재는 실제 K-Startup
   API를 호출하지 않고, `data/mockGrants.js`의 **`mockGrants` 8개 전체**를
   `{ ok:true, grants:[...8개], dataStatus:"mock", message:"..." }` 형태로
   그대로 반환한다.
5. **실패 시 폴백** — `/api/grants/kstartup` 호출이 실패하거나(백엔드 미실행,
   네트워크 오류, HTTP 오류), 응답이 `ok:false`이거나, `grants` 배열이
   비어있으면 `fetchKStartupGrants()`는 `{ ok:false, ... }`를 반환하고,
   `fetchAllGrants()`는 로컬 `data/mockGrants.js`의 `mockGrants`로 폴백하며
   `dataSource:"mock"`과 함께 "실시간 공고 데이터를 불러오지 못해 예시
   데이터를 표시합니다." 메시지를 반환한다. `index.html`의 `initGrid()`는 이
   메시지를 상단 배너(`#topBanner`)에 표시한다.

현재는 4번 단계에서 `server.js`가 항상 mock 데이터를 성공 응답으로 주기
때문에, 실제로는 5번(로컬 폴백)까지 가지 않고 매번 "성공 경로"로 8개 카드가
표시된다. 다만 4가지 실패 상황(성공/빈 배열/HTTP 오류/네트워크 오류)에 대한
폴백 동작은 이전 단계에서 mock fetch로 검증되어 있다.

## 2. 실제 K-Startup API 연동 시 수정해야 할 파일

- **`server.js`** — `/api/grants/kstartup` 핸들러 안의 mock 응답 블록을
  실제 K-Startup API 호출로 교체 (`process.env.KSTARTUP_API_KEY` 사용,
  확인된 endpoint/파라미터 적용).
- **`services/grantApi.js`** — `normalizeKStartupGrant(rawGrant)`의 각
  필드 매핑을 실제 API 응답 필드명으로 교체.
- **`docs/kstartup-api-checklist.md`** — 공식 문서에서 확인한 endpoint,
  파라미터명, 응답 필드명을 채워 넣는 기준 문서로 계속 사용.
- **`.env`** (신규 생성, 커밋 금지) — 실제 `KSTARTUP_API_KEY` 값을 이 파일에
  설정. `.env.example`은 값이 비어있는 템플릿으로 계속 유지.

## 3. 실제 API 연동 전 절대 하면 안 되는 것

1. **프론트엔드에 API 키 하드코딩 금지** — `index.html`, `services/grantApi.js`
   등 브라우저에서 실행되는 어떤 파일에도 실제 `KSTARTUP_API_KEY`/
   `BIZINFO_API_KEY` 값을 직접 적지 않는다. 키는 오직 `server.js`가 서버
   프로세스의 `process.env`에서만 읽는다.
2. **실제 `.env` 파일을 정적 서버에 노출 금지** — 실제 `.env`는 이 프로젝트
   루트에도 만들지 않는다. `express.static`이 기본적으로 dotfile을
   무시하긴 하지만, 그건 보조 안전장치일 뿐 "정적으로 서빙되는 폴더에
   실제 비밀값을 두지 않는다"는 원칙 자체를 대체하지 않는다.
3. **공식 문서 확인 전 API endpoint나 필드명 추측 금지** — `docs/kstartup-api-checklist.md`에
   "확인 필요"로 남아있는 항목은 실제 공공데이터포털 문서로 확인하기 전까지
   임의의 값으로 채우거나 코드에 반영하지 않는다.
4. **폐기된 K-Startup API 기준으로 구현 금지** — 반드시 현재 서비스 중인
   "창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)" API 기준으로만
   작업한다. 폐기된 "창업진흥원_창업지원공고(K-Startup)" API의 엔드포인트나
   필드명을 참고하지 않는다.
