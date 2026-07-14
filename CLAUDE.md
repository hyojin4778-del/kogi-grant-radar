# KOGI 지원사업 레이더 (kogi-grant-fit-checker)

K-Startup·기업마당·NIPA·KOCCA·SMTECH 지원사업을 조사해 KOGI(키링형 보조배터리 브랜드)
프로필에 맞는 A/B/C 등급으로 분류하고, 그 결과를 웹 대시보드로 보여주는 프로젝트.
ir-search 스킬의 워크플로·크롤러를 이 프로젝트 안으로 이식해서 쓴다.

## "지원사업 재조사해줘" 요청을 받으면

ir-search 스킬(전역 설치됨)의 워크플로를 따르되, **이 프로젝트에서는 아래 경로를 우선 사용한다**:

1. **프로필**: 전역 스킬이 찾는 `ir-search-profile.md`는 이미 이 프로젝트 루트에 있다 — 새로 물어보지 말고 그대로 쓴다. `마지막 조사` 줄로 직전 보고서 폴더를 파악해 재조사(diff 모드) 여부를 판단한다.
2. **크롤러**: 스킬 기본 경로(`~/.claude/skills/ir-search/scripts/`) 대신 **이 프로젝트의 `collector/`에 이식된 동일 스크립트**를 쓴다:
   ```bash
   python3 collector/kstartup_crawl.py list -o reports/<YYYY-MM-DD>/kstartup_all.jsonl
   python3 collector/sources_crawl.py list all -o reports/<YYYY-MM-DD>/sources_all.jsonl --max-pages 20
   ```
   (`<YYYY-MM-DD>`는 조사 실행일)
3. **전수 검토 → 상세검증 → A/B/C 분류**: SKILL.md 2~4단계 그대로 수행 (grep 필터링 금지, 상세페이지 원문 확인, 확인 안 된 값은 "확인 필요").
4. **출력 — 이 프로젝트만의 추가 규칙**:
   - `reports/<YYYY-MM-DD>/report.md` — ir-search 표준 Markdown 보고서 (A/B/C 3분류 + 보조 섹션 + 우선순위 액션)
   - `reports/<YYYY-MM-DD>/grants.json` — **`docs/grants-json-schema.md`에 정의된 스키마를 정확히 따라서** 작성 (대시보드가 파싱하는 유일한 계약)
   - 완료 후 `reports/<YYYY-MM-DD>/grants.json`을 **`data/latest.json`에 그대로 복사** — 대시보드는 이 파일만 읽는다
5. `ir-search-profile.md`의 `마지막 조사` 줄을 이번 `reports/<YYYY-MM-DD>/` 경로로 갱신한다.
6. 커밋 여부는 사용자에게 확인한다 (git push는 Render 자동 재배포를 트리거하므로 무단으로 push하지 않는다).

## `reports/raw/<날짜>/`는 건드리지 않는다

GitHub Actions(`.github/workflows/update-grants.yml`)가 매일(KST 09:00) 5개 소스 원시 목록을
`reports/raw/<YYYY-MM-DD>/`에 커밋한다. 이건 "재조사" 요청과 무관한 별도의 자동 수집 로그이니,
재조사 시 이 폴더를 참조하거나 덮어쓸 필요 없다 — 재조사는 항상 그 시점에 크롤러를 새로 실행한다.

## `data/latest.json`은 두 경로로 갱신된다 — 우선순위를 알아둘 것

1. **사람/Claude 판단 (권위 있음)** — 위 "재조사해줘" 워크플로. 상세페이지를 실제로 읽고 판단한
   결과이며 `autoClassified` 필드가 없다.
2. **자동 판정 (매일, 무인, 잠정)** — `.github/workflows/update-grants.yml`이 원시 수집 직후
   `collector/auto_classify.py`를 실행해 그날 새로 나타난 공고에만 규칙 기반 임시 A/B/C 등급을
   매긴다(`autoClassified: true`, `groupReason`/`eligibility.note`에 "[자동 판정]" 접두). 이 규칙은
   `ir-search-profile.md`의 KOGI 조건(예비창업자·수도권·하드웨어 소비재)을 명시적 키워드 조건문으로
   인코딩한 것으로, **결정론적 점수 합산이 아니다** — 아래 "하지 말아야 할 것" 항목은 여전히
   `matchingEngine.js` 같은 점수 알고리즘 신설을 금지하지만, 이 명시적 규칙 기반 임시 분류는 사용자
   승인 하에 예외로 도입되었다(2026-07-14).
   **`auto_classify.py`는 이미 사람이 분류한 공고(`autoClassified`가 없는 항목)를 절대 덮어쓰지
   않는다** — id가 겹치면 항상 사람 판단이 남는다. "재조사해줘"를 실행하면 그 공고의 자동 판정은
   사람 판단으로 교체된다.

## 하지 말아야 할 것

- `matchingEngine.js` 같은 "점수를 더해서 등급을 매기는" 알고리즘을 새로 만들지 않는다 —
  ir-search의 A/B/C 분류는 상세검증 원문에 기반한 판단이지 키워드 점수가 아니다.
  (`collector/auto_classify.py`는 예외로 승인된 별도 경로이며, 그마저도 점수 합산이 아니라
  명시적 조건문이고 사람 판단을 덮어쓰지 않는다 — 위 섹션 참고.)
- 확인되지 않은 자격요건·금액·마감일을 추정해서 채우지 않는다 ("확인 필요"로 남긴다).
- `data/latest.json` 필드명을 임의로 바꾸지 않는다 (`public/app.js`가 그 필드명을 그대로 참조).
