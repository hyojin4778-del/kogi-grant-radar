// KOGI 사업 프로필 — 지원사업 추천 기준의 단일 진실 소스(Single Source of Truth).
//
// 이 파일 하나만 고치면 아래 세 곳에 모두 자동 반영됩니다:
//   1. matchingEngine.js — 실시간/목업 공고의 채점·추천등급(적극 검토/조건 확인/
//      보류/제외) 계산
//   2. index.html — 화면 상단 "내 사업 상태" 표시줄
//   3. index.html — 보조 기능(공고문 직접 붙여넣어 분석)의 기본값
//
// 사업 상태가 바뀌면 다른 파일은 건드릴 필요 없이 아래 값만 수정하세요.

export const kogiProfile = {
  // ---- 기본 정보 ----
  brandName: "KOGI",
  itemDescription: "예쁘지만 실용적인 키링형 보조배터리 및 라이프스타일 액세서리",
  // 화면 상단 "KOGI 기준" 한 줄 요약에 쓰는 짧은 이름.
  itemShortLabel: "키링형 보조배터리",
  // 공고 제목/기관명 텍스트에서 "아이템 결이 맞는지" 판단할 때 쓰는 성격 태그.
  itemType: "하드웨어·소비재·라이프스타일 (키링형 보조배터리)",

  // ---- 사업자 등록 상태 ----
  // "not_registered" (사업자 등록 전) | "registered" (사업자 등록 완료)
  //
  // 예시) 사업자 등록을 마쳤다면 아래 두 줄을 이렇게 바꾸세요:
  //   registrationStatus: "registered",
  //   businessRegisteredDate: "2026-09-01",  // 실제 등록일(YYYY-MM-DD)
  registrationStatus: "not_registered",
  businessRegisteredDate: null, // 등록 전이면 null 유지

  // "개인" | "법인" | "예정"(아직 미정 — 예비창업자 기본값)
  //
  // 예시) 법인 전환 시:
  //   entityType: "법인",
  entityType: "예정",

  // ---- 창업 단계 ----
  // startupStageLabel: 화면 표시용 라벨. stageRange: 실제 매칭에 쓰는 값
  // (공고 태그 체계 — "예비창업" | "초기창업" | "3년 이내" | "7년 이내").
  //
  // 예시) 사업자 등록 완료 + 창업 1년 미만으로 전환 시:
  //   startupStageLabel: "창업 1년 미만",
  //   stageRange: ["초기창업", "3년 이내"],
  //
  // 예시) 창업 3~7년 차로 넘어가면:
  //   startupStageLabel: "창업 5년 차",
  //   stageRange: ["3년 이내", "7년 이내"],
  startupStageLabel: "예비창업자",
  stageRange: ["예비창업", "초기창업"],

  // ---- 선호 지역 ----
  // 이 지역과 겹치지 않는 공고는 감점되고, "지방 이전이 필수"인 공고는
  // exclude.relocationRequired 규칙에 따라 제외로 분류됩니다.
  preferredRegions: ["서울", "경기", "인천"],

  // ---- 관심 지원사업 키워드 ----
  // 공고 제목/기관명/지원분야 텍스트에 아래 키워드가 있으면 가점 대상입니다.
  // 사업 방향이 바뀌면(예: 수출 준비 시작 등) 이 배열에 키워드를 추가/삭제하세요.
  interestKeywords: [
    "초기창업", "시제품 제작", "제조", "하드웨어", "브랜드", "브랜딩", "마케팅",
    "창업공간", "여성창업", "여성기업",
  ],

  // ---- 제외 규칙 ----
  // 아래 항목은 "이런 성격의 공고는 KOGI에 맞지 않으니 제외해달라"는 규칙 스위치.
  // 대부분 계속 true로 두면 되고, 특수한 상황에서만 false로 바꾸세요.
  exclude: {
    // 지방(수도권 외) 소재로 이전이 필수인 공고를 제외
    relocationRequired: true,
    // stageRange와 겹치지 않는 업력 조건(예: 창업 7년 이상 전용) 공고를 낮게 평가
    stageMismatch: true,
  },

  // ---- 보조 기능(공고문 직접 분석) 전용 값 ----
  // 메인 추천 로직(matchingEngine.js)과는 무관하고, index.html의 "공고문 직접
  // 붙여넣어 분석하기" 기능이 기본값을 채울 때만 사용됩니다.
  manualAnalyzer: {
    founderAge: null, // 실제 만 나이를 적으면 나이 요건 체크가 활성화됩니다
    employees: 1,
    annualRevenue: 0, // 만원 단위. 사업자 등록 전이라 0
    industryKeywords: "액세서리, 라이프스타일, 커머스, 전자기기",
    preferredTags: ["여성기업"], // PREFERRED_KEYWORDS의 key 중 해당하는 것
  },
};
