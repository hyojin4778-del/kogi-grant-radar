# KOGI 지원사업 레이더

K-Startup·기업마당·NIPA·KOCCA·SMTECH 5개 소스의 창업지원사업 공고를 조사해
KOGI(키링형 보조배터리 브랜드) 기준으로 **A(즉시 지원 가능) / B(요건 충족 시) /
C(변형하면 가능)** 3단계로 분류하고, 그 결과를 웹 대시보드로 보여주는 프로젝트.

ir-search 스킬(전역 설치됨)의 크롤러·워크플로를 이 프로젝트 구조에 맞게 이식했습니다.

## 아키텍처

```
collector/kstartup_crawl.py, sources_crawl.py   원시 목록 수집 (Python, LLM 불필요)
        │
        ▼  (GitHub Actions가 매일 자동 실행)
reports/raw/<날짜>/*.jsonl                       순수 로그 — 분류 없음
```

```
"지원사업 재조사해줘" (Claude Code 세션)
        │
        ▼  ir-search 워크플로 2~4단계: 전수 검토 → 상세검증(원문) → A/B/C 분류
reports/<날짜>/report.md, grants.json
        │
        ▼
data/latest.json  ← grants.json 복사
        │
        ▼
server.js  →  /api/grants  →  public/ 대시보드
```

자세한 규칙은 프로젝트 루트 `CLAUDE.md`(재조사 워크플로)와
`docs/grants-json-schema.md`(JSON 계약)를 참고하세요.

## 로컬 실행

```bash
npm install
npm start          # 또는: npm run dev (파일 변경 시 자동 재시작)
```

http://localhost:3000 에서 확인. 아직 조사 결과가 없으면 대시보드가 빈 상태 안내를 보여줍니다.

## 지원사업 재조사

Claude Code에서 이 프로젝트 폴더를 열고:

```
지원사업 재조사해줘
```

라고 요청하면 `ir-search-profile.md` 기준으로 5개 소스를 전수 조사하고,
`reports/<날짜>/report.md`와 `data/latest.json`을 생성합니다. 두 번째 실행부터는
`ir-search-profile.md`의 "마지막 조사" 경로를 기준으로 증분(diff) 조사가 됩니다.

수집기만 수동으로 돌리고 싶다면:

```bash
pip install -r requirements.txt
python3 collector/kstartup_crawl.py list -o kstartup_all.jsonl
python3 collector/sources_crawl.py list all -o sources_all.jsonl --max-pages 20
```

## 자동 수집 (GitHub Actions)

`.github/workflows/update-grants.yml`이 매일 09:00 KST에 5개 소스 원시 목록만
수집해 `reports/raw/<날짜>/`에 커밋합니다. **A/B/C 분류나 상세검증은 하지
않습니다** — 그 단계는 원문을 읽고 판단하는 작업이라 무인 자동화 대상이
아니며, 위 "지원사업 재조사" 절차로만 갱신됩니다.

## 배포

- GitHub: https://github.com/hyojin4778-del/kogi-grant-radar
- Render: `render.yaml` 블루프린트로 Web Service(대시보드)+Cron Job(원시 수집,
  보조적) 구성. Render는 새 커밋이 push되면 자동 재배포합니다 — 즉
  "지원사업 재조사" 후 `data/latest.json` 변경분을 커밋·push하면 배포된
  화면에도 반영됩니다.

## 보안 노트

공식 API 키를 쓰지 않는 구조입니다 (공개 목록 페이지 스크래핑만 사용). `.env`
파일을 이 프로젝트에 만들 필요가 없습니다.
