# data/latest.json 스키마

`지원사업 재조사해줘` 요청을 처리할 때(ir-search 워크플로 2~4단계 완료 후) 이 문서의 형식으로
`reports/<YYYY-MM-DD>/grants.json`을 작성하고, 그 내용을 그대로 `data/latest.json`에 복사한다.
`server.js`의 `/api/grants`는 `data/latest.json`을 읽기만 하므로, 이 스키마가 대시보드와의 유일한 계약이다.

```jsonc
{
  // 이 조사를 실행한 시각 (ISO-8601)
  "generatedAt": "2026-07-13T09:00:00+09:00",

  // ir-search-profile.md 요약 한 줄 (대시보드 상단 표시용)
  "profileSummary": "예비창업자 · 수도권 · 하드웨어 소비재(키링형 보조배터리)",

  // 이번 조사에 실제로 포함된 소스 (커버리지 표시용 — 빠진 소스가 있으면 반드시 명시)
  "sources": ["K-Startup", "기업마당", "NIPA", "KOCCA", "SMTECH"],

  // 이 조사의 전문 Markdown 보고서 경로 (대시보드에서 링크)
  "reportPath": "reports/2026-07-13/report.md",

  // A/B/C/제외 건수 요약 (상단 통계 타일용)
  "counts": { "A": 0, "B": 0, "C": 0, "제외": 0 },

  "grants": [
    {
      // "{source}-{원본 id}" 형식 (예: "kstartup-178481", "bizinfo-PBLN_00012345")
      "id": "kstartup-178481",

      // "K-Startup" | "기업마당" | "NIPA" | "KOCCA" | "SMTECH"
      "source": "K-Startup",

      "title": "2026년 예비창업패키지 모집공고",
      "organization": "중소벤처기업부",

      // ir-search SKILL.md의 3분류 체계. 지원사업이 아닌 것(멘토 모집 등)이나
      // 상세검증 결과 자격 미달인 것은 "제외"
      "group": "A",
      // 판정 이유 한 줄 (상세검증 원문 근거)
      "groupReason": "예비창업자 명시적으로 포함, 수도권 소재 제한 없음, 마감 임박 아님",

      "region": ["서울", "경기", "인천"],
      "supportField": "사업화자금",

      "applicationStartDate": "2026-07-01",
      "applicationEndDate": "2026-08-15",
      // "모집중" | "마감임박"(3일 이내) | "마감" | "확인 필요" — 서버에서 넣어도 되고
      // 프론트에서 applicationEndDate 기준으로 계산해도 됨(둘 다 있으면 프론트 계산 우선)
      "status": "모집중",

      // 3단계 상세검증 결과. 확인 안 된 항목은 반드시 "확인 필요"로 남기고 추정 금지
      "eligibility": {
        "preStartupAllowed": true,
        "regionRestriction": "제한 없음 (전국 접수)",
        "note": "사업자등록증 요구 없음, 예비창업자용 별도 서식 존재"
      },

      "supportAmount": "최대 7천만원",
      "contact": "02-000-0000 / 확인 필요",

      // 원문 공고 URL — 항상 채운다 (핵심 추천/보조 후보/제외 모두)
      "url": "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=178481",

      // 상세페이지를 실제로 열어 검증했으면 그 시각, 목록 단계에서만 걸러졌으면 null
      "verifiedAt": "2026-07-13T09:10:00+09:00",

      // true면 collector/auto_classify.py가 매긴 잠정 등급(사람 미검증) — 없으면 사람이 검증한 것.
      // 대시보드는 이 필드로 "자동 판정" 배지를 표시한다.
      "autoClassified": false
      // "autoClassifiedAt": "2026-07-14T09:00:12+09:00"  — autoClassified:true일 때만 존재
    }
  ]
}
```

## 규칙

- 원문에서 확인되지 않은 값은 추정하지 말고 `"확인 필요"`로 남긴다 (기존 matchingEngine.js의 원칙을 그대로 계승).
- `group: "제외"`인 항목도 배열에서 지우지 말고 포함한다 — 대시보드가 "제외" 필터로 걸러서 보여주므로, 왜 제외됐는지(`groupReason`)를 남겨야 나중에 재검토할 수 있다.
- `sources` 배열에 5개 소스 중 이번에 크롤링하지 못한 소스가 있으면 반드시 빼고, `report.md`에도 "미갱신" 소스로 명시한다 (ir-search SKILL.md의 diff 모드 규칙과 동일).
- 이 문서의 필드를 늘리는 건 자유롭지만(예: 대시보드 상세보기에 필요한 항목 추가), 기존 필드명은 바꾸지 않는다 — `public/app.js`가 이 필드명을 그대로 참조한다.
