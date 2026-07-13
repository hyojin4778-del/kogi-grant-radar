# reports/ 폴더 구조

- `reports/raw/<YYYY-MM-DD>/` — GitHub Actions가 매일 자동으로 커밋하는 원시 수집 결과
  (`kstartup_all.jsonl`, `sources_all.jsonl`). 분류 없음, LLM 미사용. 순수 로그 성격.
- `reports/<YYYY-MM-DD>/` — Claude Code에서 "지원사업 재조사해줘" 요청을 처리할 때마다
  생성되는 전체 조사 결과: `report.md`(A/B/C 보고서), `grants.json`(대시보드용,
  `data/latest.json`으로 복사됨), 그리고 그때 사용한 원시 jsonl.

두 종류를 혼동하지 말 것 — `raw/` 아래는 재조사 diff 모드가 참조하는 "직전 조사 폴더"가
아니다 (자세한 내용은 프로젝트 루트 `CLAUDE.md` 참고).
