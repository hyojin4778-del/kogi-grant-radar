// Mock grant-announcement data for KOGI Grant Radar.
//
// This is a static, hand-curated placeholder dataset — none of it has been
// crawled or fetched from a real source yet (dataStatus is always "mock",
// verifiedAt is always null). It exists so the UI has something stable to
// render while services/grantApi.js is wired up to real sources.
//
// Field shape matches what a normalized API response should look like:
//   id, title, organization, sourceName, sourceUrl, originalNoticeUrl,
//   region, startupStage, supportType, supportAmount,
//   applicationStartDate, applicationEndDate, dDay, target, description,
//   requirements, documents, contact, dataStatus, verifiedAt, deadlineStatus
//
// A few extra fields (fitScore, scoreBreakdown, recommendation, summary,
// whyReasons, conditionsToCheck, risks, strategy) ride along on top — those
// are KOGI-specific curation/matching data the current UI renders, kept here
// so the screen doesn't change this round. When real sources replace this
// mock data, those curation fields will need to come from a separate
// matching step rather than the raw announcement data itself.

export const mockGrants = [
  {
    id: "g1",
    title: "2026년 하반기 창업기업 사업화자금 추가모집(수도권)",
    organization: "중소벤처기업부·서울지방중소벤처기업청",
    sourceName: "K-Startup",
    sourceUrl: "https://www.k-startup.go.kr",
    originalNoticeUrl: null,
    region: ["서울", "경기", "인천"],
    startupStage: ["예비창업", "초기창업"],
    supportType: ["사업화자금"],
    supportAmount: "최대 7천만원",
    applicationStartDate: null,
    applicationEndDate: "2026-08-15",
    dDay: null,
    target: "예비창업자 또는 창업 3년 이내 수도권 소재 기업 대표자",
    description: "수도권 소재 예비·초기창업기업을 대상으로 사업화자금을 지원하는 하반기 추가모집 공고입니다.",
    requirements: ["예비창업자 또는 창업 3년 이내 기업", "수도권(서울·경기·인천) 소재"],
    documents: ["사업계획서", "사업자등록증(또는 사업자등록 예정 확인서)", "제품 소개자료", "견적서(시제품 제작비)", "(해당 시) 특허·실용신안증"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 92,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 24, max: 25 }, support: { score: 22, max: 25 }, item: { score: 18, max: 20 }, readiness: { score: 8, max: 10 }
    },
    recommendation: "적극 검토",
    summary: "시제품 고도화와 초기 마케팅 비용 확보에 적합한 사업화자금 공고입니다.",
    whyReasons: [
      "예비창업자와 초기창업자를 모두 지원 대상으로 포함해 현재 KOGI 단계와 정확히 맞습니다.",
      "시제품 고도화, 금형 제작 등 하드웨어 개발비로 사용할 수 있는 사업화자금입니다.",
      "수도권(서울·경기·인천) 소재 기업을 대상으로 해 KOGI의 서울 소재 조건과 일치합니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "불필요 (예비창업자도 지원 가능)" },
      { label: "업력 조건", value: "제한 없음" },
      { label: "지역 조건", value: "수도권(서울·경기·인천) 소재" },
      { label: "자부담 여부", value: "공고 원문에서 자부담 비율 재확인 필요" },
      { label: "선정 후 의무사항", value: "정기 실적보고 제출 의무" }
    ],
    risks: [
      "추가모집 특성상 예산이 소진되면 예정보다 일찍 마감될 수 있습니다.",
      "실제 공고문 기준으로 자부담 비율을 다시 확인해야 합니다."
    ],
    strategy: ["빠른 서류 준비로 조기 마감 리스크에 대비하세요.", "시제품 완성도와 향후 양산 계획을 구체적으로 제시하세요."]
  },
  {
    id: "g2",
    title: "2026년 초기창업패키지",
    organization: "중소벤처기업부·서울창업허브",
    sourceName: "서울창업허브",
    sourceUrl: "https://seoulstartuphub.com",
    originalNoticeUrl: null,
    region: ["전국"],
    startupStage: ["초기창업", "3년 이내"],
    supportType: ["사업화자금", "마케팅"],
    supportAmount: "최대 1억원",
    applicationStartDate: null,
    applicationEndDate: "2026-09-01",
    dDay: null,
    target: "창업 3년 이내 제조·서비스 기반 기업 대표자",
    description: "제조 기반 소비재 스타트업의 사업화 및 초기 마케팅 자금을 지원하는 전국 단위 공고입니다.",
    requirements: ["창업 3년 이내 기업(등록 완료)", "제조 또는 서비스 기반 유망 아이템 보유"],
    documents: ["사업계획서", "사업자등록증", "제품 소개자료", "재무제표"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 74,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 12, max: 25 }, support: { score: 20, max: 25 }, item: { score: 16, max: 20 }, readiness: { score: 6, max: 10 }
    },
    recommendation: "조건 확인",
    summary: "제조 기반 초기창업기업의 사업화 자금이지만 사업자등록 여부 확인이 먼저 필요합니다.",
    whyReasons: [
      "제조 기반 소비재 스타트업을 명시적으로 지원 대상에 포함하고 있습니다.",
      "초기 마케팅 및 유통 파트너십 구축 비용으로 활용할 수 있습니다.",
      "전국 단위 지원이라 지역 제약 없이 신청할 수 있습니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "필요 (창업 3년 이내 등록 기업만 대상, 예비창업자는 제외)" },
      { label: "업력 조건", value: "창업 3년 이내" },
      { label: "지역 조건", value: "전국 (지역 제한 없음)" },
      { label: "자부담 여부", value: "확인 필요" },
      { label: "선정 후 의무사항", value: "협약 기간 내 자금 집행 계획 준수" }
    ],
    risks: [
      "KOGI가 아직 사업자등록 전이면 이 공고는 신청 자체가 불가할 수 있습니다.",
      "최근 1년 내 유사 사업화 자금을 수혜했다면 중복 지원 제한이 있을 수 있습니다."
    ],
    strategy: ["초기 매출·고객 반응 데이터를 근거로 시장성을 제시하세요.", "제조·유통 파트너십 확보 계획을 구체화하세요."]
  },
  {
    id: "g3",
    title: "여성기업 창업성장 지원사업",
    organization: "여성기업종합지원센터",
    sourceName: "기업마당",
    sourceUrl: "https://www.bizinfo.go.kr",
    originalNoticeUrl: null,
    region: ["전국"],
    startupStage: ["초기창업", "3년 이내", "7년 이내"],
    supportType: ["마케팅"],
    supportAmount: "최대 3천만원",
    applicationStartDate: null,
    applicationEndDate: "2026-07-30",
    dDay: null,
    target: "여성기업확인서를 보유한 창업 7년 이내 기업 대표자",
    description: "여성기업을 대상으로 브랜드 마케팅·콘텐츠 제작 비용을 지원하는 공고입니다.",
    requirements: ["대표자가 여성인 기업(지분 요건 충족)", "창업 7년 이내(등록 완료)"],
    documents: ["여성기업확인서", "사업계획서", "사업자등록증", "마케팅 활용 계획서"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 69,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 14, max: 25 }, support: { score: 16, max: 25 }, item: { score: 14, max: 20 }, readiness: { score: 5, max: 10 }
    },
    recommendation: "조건 확인",
    summary: "여성기업 확인서가 있다면 브랜드 마케팅 자금으로 활용할 수 있는 공고입니다.",
    whyReasons: [
      "라이프스타일 액세서리 브랜드의 콘텐츠·마케팅 예산으로 바로 활용할 수 있습니다.",
      "20-30대 여성을 타깃으로 하는 KOGI 브랜드 방향과 잘 맞습니다.",
      "여성기업확인서 보유 시 가점을 받을 수 있는 트랙입니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "필요 (창업 7년 이내 등록 기업 대상)" },
      { label: "업력 조건", value: "창업 7년 이내" },
      { label: "지역 조건", value: "전국" },
      { label: "자부담 여부", value: "확인 필요" },
      { label: "선정 후 의무사항", value: "여성기업확인서 유효기간 유지 의무" }
    ],
    risks: [
      "여성기업확인서가 없다면 사전 발급 절차부터 진행해야 합니다.",
      "KOGI가 아직 사업자등록 전이면 신청 불가할 수 있습니다."
    ],
    strategy: ["목표 고객(20-30대 여성)과 대표자 배경의 연결고리를 강조하세요."]
  },
  {
    id: "g4",
    title: "시제품 제작 지원사업(메이커스페이스 연계)",
    organization: "창업진흥원·메이커스페이스",
    sourceName: "창업지원포털",
    sourceUrl: null,
    originalNoticeUrl: null,
    region: ["서울", "경기"],
    startupStage: ["예비창업", "초기창업"],
    supportType: ["R&D"],
    supportAmount: "최대 2천만원",
    applicationStartDate: null,
    applicationEndDate: "2026-08-05",
    dDay: null,
    target: "제작할 시제품 아이디어를 보유한 예비·초기창업자",
    description: "메이커스페이스 장비를 활용해 시제품 제작비를 지원하는 R&D 트랙입니다.",
    requirements: ["예비창업자 또는 창업 초기 기업", "제작할 시제품 아이디어 보유"],
    documents: ["시제품 제작 계획서", "제품 소개자료", "견적서", "신분증 사본"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 92,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 24, max: 25 }, support: { score: 22, max: 25 }, item: { score: 19, max: 20 }, readiness: { score: 7, max: 10 }
    },
    recommendation: "적극 검토",
    summary: "키링형 보조배터리 시제품을 고도화할 메이커스페이스 연계 R&D 지원입니다.",
    whyReasons: [
      "키링형 보조배터리의 폼팩터·소재 개선에 바로 쓸 수 있는 시제품 제작 자금입니다.",
      "메이커스페이스 장비를 활용해 외부 제작비를 절감할 수 있습니다.",
      "예비창업자도 지원 가능해 사업자등록 여부와 무관하게 신청할 수 있습니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "불필요 (예비창업자도 지원 가능)" },
      { label: "업력 조건", value: "제한 없음 (창업 초기 기업 우대)" },
      { label: "지역 조건", value: "서울·경기 소재" },
      { label: "자부담 여부", value: "없음" },
      { label: "선정 후 의무사항", value: "메이커스페이스 장비 사용 일정 준수" }
    ],
    risks: [
      "메이커스페이스 장비·인력 예약이 몰릴 수 있어 일정 여유가 필요합니다.",
      "예산 소진 시 조기 마감 가능합니다."
    ],
    strategy: ["기존 시제품의 문제점과 개선 목표를 구체적 수치로 제시하세요."]
  },
  {
    id: "g5",
    title: "1인 창업자 공유오피스 입주 지원",
    organization: "서울산업진흥원(SBA)",
    sourceName: "서울창업허브",
    sourceUrl: "https://seoulstartuphub.com",
    originalNoticeUrl: null,
    region: ["서울"],
    startupStage: ["예비창업", "초기창업", "3년 이내"],
    supportType: ["공간지원"],
    supportAmount: "입주공간 + 운영비 일부 지원",
    applicationStartDate: null,
    applicationEndDate: "2026-07-25",
    dDay: null,
    target: "서울 소재(또는 이전 예정) 1인 창업기업",
    description: "1인 창업기업에게 서울 소재 공유오피스 입주 공간과 운영비 일부를 지원하는 공고입니다.",
    requirements: ["1인 또는 소규모 창업기업", "서울 소재(또는 이전 예정)"],
    documents: ["사업자등록증(또는 예정 확인서)", "입주 신청서"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 75,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 22, max: 25 }, support: { score: 14, max: 25 }, item: { score: 12, max: 20 }, readiness: { score: 7, max: 10 }
    },
    recommendation: "조건 확인",
    summary: "1인 기업 KOGI가 서울에 사무공간을 확보할 수 있는 공간지원 공고입니다.",
    whyReasons: [
      "1인 기업 체제인 KOGI가 정식 사업장 주소를 확보하는 데 도움이 됩니다.",
      "서울 소재 조건을 그대로 충족하는 공간지원 트랙입니다.",
      "예비창업자부터 신청 가능해 진입장벽이 낮습니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "불필요 (예비창업자도 신청 가능)" },
      { label: "업력 조건", value: "창업 3년 이내 권장" },
      { label: "지역 조건", value: "서울 소재(또는 이전 예정)" },
      { label: "자부담 여부", value: "운영비 일부 자부담 가능성 있음" },
      { label: "선정 후 의무사항", value: "출근 의무 조건 존재 가능성 (확인 필요)" }
    ],
    risks: [
      "출근 의무 조건이 있는 경우 재택 중심 운영과 충돌할 수 있습니다.",
      "지원 우선순위가 시제품·마케팅 자금보다는 낮을 수 있습니다."
    ],
    strategy: ["공유오피스를 활용한 미팅·촬영 공간 확보 계획을 함께 제시하세요."]
  },
  {
    id: "g6",
    title: "브랜드 마케팅·콘텐츠 제작 지원사업",
    organization: "경기도경제과학진흥원",
    sourceName: "지자체·수도권",
    sourceUrl: null,
    originalNoticeUrl: null,
    region: ["경기"],
    startupStage: ["초기창업", "3년 이내", "7년 이내"],
    supportType: ["마케팅"],
    supportAmount: "최대 1500만원",
    applicationStartDate: null,
    applicationEndDate: "2026-09-10",
    dDay: null,
    target: "경기도 소재 자체 브랜드 보유 창업 7년 이내 기업",
    description: "경기도 소재 기업의 브랜드 콘텐츠·광고 제작비를 지원하는 지자체 공고입니다.",
    requirements: ["경기도 소재 기업(등록 완료)", "자체 브랜드 보유"],
    documents: ["사업자등록증", "마케팅 활용 계획서", "제품 소개자료"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 60,
    scoreBreakdown: {
      region: { score: 4, max: 20 }, stage: { score: 18, max: 25 }, support: { score: 20, max: 25 }, item: { score: 14, max: 20 }, readiness: { score: 4, max: 10 }
    },
    recommendation: "보류",
    summary: "경기도 소재 기업 전용이라 서울 소재인 KOGI는 사업장 이전이 필요합니다.",
    whyReasons: [
      "브랜드 콘텐츠·광고 제작비로 KOGI의 마케팅 니즈와 맞습니다.",
      "라이프스타일 소비재 브랜드를 지원 대상으로 명시하고 있습니다.",
      "다만 경기도 소재 기업 전용이라 서울 소재인 KOGI는 자격 요건부터 재검토가 필요합니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "필요" },
      { label: "업력 조건", value: "창업 7년 이내" },
      { label: "지역 조건", value: "경기도 소재 기업만 가능 — KOGI(서울)는 현재 미충족" },
      { label: "자부담 여부", value: "확인 필요" },
      { label: "선정 후 의무사항", value: "결과물(콘텐츠) 제출 의무" }
    ],
    risks: [
      "현재 서울 소재라면 사업장 이전 없이는 신청 자격이 없습니다.",
      "KOGI가 아직 사업자등록 전이면 추가로 신청 불가할 수 있습니다."
    ],
    strategy: ["신청 전 경기도 소재 사업장 확보 가능성부터 검토하세요."]
  },
  {
    id: "g7",
    title: "글로벌 진출 바우처 지원사업",
    organization: "중소기업진흥공단",
    sourceName: "기업마당",
    sourceUrl: "https://www.bizinfo.go.kr",
    originalNoticeUrl: null,
    region: ["전국"],
    startupStage: ["3년 이내", "7년 이내"],
    supportType: ["사업화자금", "마케팅"],
    supportAmount: "최대 5000만원",
    applicationStartDate: null,
    applicationEndDate: "2026-10-01",
    dDay: null,
    target: "해외 진출 계획을 보유한 창업 3~7년 이내 기업",
    description: "해외 판로 개척을 준비하는 기업에게 바우처 형태로 자금을 지원하는 공고입니다.",
    requirements: ["수출 또는 해외 진출 계획 보유 기업(등록 완료)"],
    documents: ["해외진출 계획서", "사업자등록증", "제품 소개자료"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 57,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 16, max: 25 }, support: { score: 10, max: 25 }, item: { score: 8, max: 20 }, readiness: { score: 3, max: 10 }
    },
    recommendation: "보류",
    summary: "해외 진출 준비가 아직 이른 KOGI에는 우선순위가 낮은 글로벌 바우처입니다.",
    whyReasons: [
      "장기적으로 해외 이커머스 진출을 고려한다면 활용할 수 있는 자금입니다.",
      "바우처 방식이라 필요한 항목만 선택적으로 사용할 수 있습니다.",
      "다만 현재 KOGI는 국내 판로 확보가 우선이라 지금 시점의 우선순위는 낮습니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "필요" },
      { label: "업력 조건", value: "창업 3~7년 이내" },
      { label: "지역 조건", value: "전국" },
      { label: "자부담 여부", value: "일부 자부담 발생 가능" },
      { label: "선정 후 의무사항", value: "해외 진출 실적 보고 의무" }
    ],
    risks: [
      "구체적인 해외 바이어·유통 계약이 없으면 서류 평가에서 불리합니다.",
      "KOGI가 아직 사업자등록 전이면 신청 불가할 수 있습니다."
    ],
    strategy: ["당장 지원하기보다 국내 판로 안정화 이후 재검토를 추천합니다."]
  },
  {
    id: "g8",
    title: "청년창업사관학교",
    organization: "중소벤처기업진흥공단",
    sourceName: "K-Startup",
    sourceUrl: "https://www.k-startup.go.kr",
    originalNoticeUrl: null,
    region: ["전국"],
    startupStage: ["예비창업", "초기창업", "3년 이내"],
    supportType: ["사업화자금", "교육·멘토링"],
    supportAmount: "최대 1억원 + 보육 프로그램",
    applicationStartDate: null,
    applicationEndDate: "2026-08-20",
    dDay: null,
    target: "만 39세 이하 또는 창업 3년 이내(예비창업자 포함) 제조 기반 기업 대표자",
    description: "제조 기반 청년 창업자에게 사업화 자금과 전담 보육 프로그램을 함께 제공하는 공고입니다.",
    requirements: ["만 39세 이하 대표자", "창업 3년 이내 또는 예비창업자"],
    documents: ["사업계획서", "신분증 사본", "제품 소개자료", "(해당 시) 졸업/경력증명서"],
    contact: null,
    dataStatus: "mock",
    verifiedAt: null,
    deadlineStatus: null,

    fitScore: 89,
    scoreBreakdown: {
      region: { score: 20, max: 20 }, stage: { score: 23, max: 25 }, support: { score: 22, max: 25 }, item: { score: 18, max: 20 }, readiness: { score: 6, max: 10 }
    },
    recommendation: "적극 검토",
    summary: "제조 기반 청년 창업자를 위한 사업화 자금과 보육 프로그램이 함께 제공됩니다.",
    whyReasons: [
      "제조 기반 액세서리 아이템을 명시적으로 지원 대상에 포함합니다.",
      "사업화 자금과 전담 보육 프로그램을 함께 받을 수 있습니다.",
      "예비창업자부터 신청 가능해 KOGI의 현재 단계와 잘 맞습니다."
    ],
    conditionsToCheck: [
      { label: "사업자등록 필요 여부", value: "불필요 (예비창업자도 지원 가능)" },
      { label: "업력 조건", value: "창업 3년 이내 또는 예비창업자" },
      { label: "지역 조건", value: "전국" },
      { label: "자부담 여부", value: "없음" },
      { label: "선정 후 의무사항", value: "합숙형 보육 프로그램 참여 의무" }
    ],
    risks: [
      "보육 프로그램 참여 의무가 있어 다른 일정과 조율이 필요합니다.",
      "합숙 일정이 KOGI 운영 일정과 겹칠 수 있습니다."
    ],
    strategy: ["보육 프로그램에서 얻고자 하는 목표(양산·투자유치 등)를 명확히 제시하세요."]
  },
];
