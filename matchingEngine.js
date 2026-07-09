// KOGI fit-matching engine.
//
// calculateMatchScore(grant, profile) scores ONE Grant object against the
// business profile in data/kogiProfile.js — the single source of truth for
// "who KOGI is right now". Update that file when the business status changes
// (registered, older, different region, etc.) and this engine's output
// changes with it automatically; nothing here should hardcode KOGI-specific
// facts.
//
// classifyGrant(baseGrant, profile) wraps calculateMatchScore and assembles
// the full grant object the UI expects (fitScore, recommendation,
// conditionsToCheck, strategy, summary, ...). It only fills a field with a
// generic "확인 필요" default when the base grant doesn't already have a
// better value — so a future real-API source that DOES know e.g. 지원금액
// can just set that field before calling classifyGrant, without needing any
// change here.
//
// Uses ONLY fields the K-Startup listing-page scraper actually produces
// (title, organization, supportType, applicationEndDate) — no detail-page
// fetch (see services/kstartupSource.js's comment on why this MVP stays on
// the listing page only).
//
// matchReasons contains ONLY positive findings (why this might fit). riskFlags
// contains ONLY things to verify or reasons for caution. Anything the listing
// page can't actually tell us (사업자등록 여부, 지원금 액수, etc.) is reported
// as "확인 필요"/"불가" in riskFlags rather than guessed in either direction.

import { kogiProfile } from "./data/kogiProfile.js";
export { kogiProfile };

// All 17 시/도 minus the profile's preferred regions is computed at call time
// (see scoreRegion) so this stays correct if preferredRegions ever changes.
const ALL_REGIONS = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

// "이 공고는 지방 이전 필수"라는 신호 — profile.exclude.relocationRequired가
// true일 때만 이 신호를 근거로 제외 처리한다.
const RELOCATION_REQUIRED_SIGNALS = ["이전 필수", "이전 의무", "사업장 이전 후", "지역 이전 후", "이전하여야"];

const STAGE_KEYWORD_MAP = {
  "예비창업": ["예비창업", "1인 창업", "교육생", "입주자 모집"],
  "초기창업": ["초기창업", "청년창업", "인큐베이터"],
  "3년 이내": ["3년 이내"],
  "7년 이내": ["7년 이내"],
};
// "기업 모집"처럼 너무 일반적인 문구는 뺐다 — "예비창업자 및 창업기업 모집"처럼
// 예비창업자를 명시적으로 포함하는 공고까지 오탐으로 걸러내는 문제가 있었다.
const REGISTERED_BUSINESS_SIGNALS = ["입주기업", "사업자등록", "사업자 등록", "법인 설립"];
const LATE_STAGE_SIGNALS = ["시리즈A", "시리즈B", "시리즈C", "IPO", "M&A", "인수합병", "투자유치", "TIPS"];
// These aren't grants a company applies to at all — recruiting evaluators/
// mentors, not funding applicants. KOGI should never be routed toward these.
const NOT_APPLICABLE_SIGNALS = ["멘토 모집", "멘토 위원", "심사위원 모집", "평가위원 모집", "자문단 모집", "심사역 모집"];
const HARDWARE_UNFRIENDLY_SIGNALS = ["바이오", "의료기기", "소프트웨어", "콘텐츠", "핀테크", "게임"];

// Each score*() function returns { score, kind, reason }.
// kind: "positive" -> goes into matchReasons; "negative"/"unknown" -> riskFlags.

function scoreRegion(text, profile) {
  const preferred = profile.preferredRegions;
  const hasPreferred = preferred.some((r) => text.includes(r)) || text.includes("수도권");
  const otherRegions = ALL_REGIONS.filter((r) => !preferred.includes(r));
  const hasOtherOnly = otherRegions.some((r) => text.includes(r)) && !hasPreferred;

  if (hasOtherOnly) {
    return { score: 2, kind: "negative", reason: `${preferred.join("·")} 외 지역으로 추정되어 선호 지역과 거리가 있어 확인이 필요합니다.` };
  }
  if (hasPreferred) {
    return { score: 20, kind: "positive", reason: `선호 지역(${preferred.join("·")})과 일치합니다.` };
  }
  return { score: 10, kind: "positive", reason: "전국 대상일 가능성이 있어 신청 가능성 검토가 필요합니다." };
}

function scoreStage(text, profile) {
  if (NOT_APPLICABLE_SIGNALS.some((k) => text.includes(k))) {
    return { score: 2, kind: "negative", reason: "멘토/심사위원 모집 성격으로 지원사업과 무관합니다." };
  }
  if (LATE_STAGE_SIGNALS.some((k) => text.includes(k))) {
    return { score: 5, kind: "negative", reason: `투자 유치 이후 단계(시리즈 투자 등) 대상으로 보여 ${profile.startupStageLabel} 단계와 업력 조건이 맞지 않습니다.` };
  }
  if (REGISTERED_BUSINESS_SIGNALS.some((k) => text.includes(k))) {
    return { score: 10, kind: "negative", reason: "이미 사업자등록을 마친 기업(입주기업 등) 대상으로 보여 현재 단계에는 불리할 수 있습니다." };
  }
  const matchesRange = profile.stageRange.some((stage) => (STAGE_KEYWORD_MAP[stage] || []).some((k) => text.includes(k)));
  if (matchesRange) {
    return { score: 22, kind: "positive", reason: `${profile.startupStageLabel} 대상 신호가 있어 현재 단계와 부합합니다.` };
  }
  return { score: 12, kind: "unknown", reason: null }; // covered by the standing 사업자등록 risk flag instead
}

function scoreSupport(supportTypeList, profile) {
  const t = (supportTypeList || []).join(",");
  const wantsSpace = profile.interestKeywords.includes("창업공간");
  if (t.includes("판로") || t.includes("해외진출")) {
    return { score: 22, kind: "positive", reason: "판로·해외진출 성격의 공고로 초기 판매 채널 확보와 연결 가능합니다." };
  }
  if (t.includes("사업화")) {
    return { score: 22, kind: "positive", reason: "사업화 성격의 공고로 시제품 제작·R&D·마케팅 등에 폭넓게 연결 가능합니다." };
  }
  if (wantsSpace && (t.includes("시설") || t.includes("공간") || t.includes("보육"))) {
    return { score: 18, kind: "positive", reason: "창업공간 지원으로 관심 지원분야와 일치합니다." };
  }
  if (t.includes("멘토링") || t.includes("컨설팅") || t.includes("교육")) {
    return { score: 14, kind: "positive", reason: "멘토링·컨설팅·교육 지원으로 사업 운영에 간접적인 도움이 될 수 있습니다." };
  }
  if (t.includes("시설") || t.includes("공간") || t.includes("보육")) {
    return { score: 12, kind: "negative", reason: "공간·보육 중심 지원으로 관심 지원분야와는 거리가 있습니다." };
  }
  if (t.includes("행사") || t.includes("네트워크")) {
    return { score: 8, kind: "negative", reason: "행사·네트워크성 지원으로 직접적인 자금 지원과는 거리가 있습니다." };
  }
  return { score: 12, kind: "unknown", reason: "지원분야 정보가 불명확해 상세 공고 확인이 필요합니다." };
}

function scoreItem(text, profile) {
  if (NOT_APPLICABLE_SIGNALS.some((k) => text.includes(k))) {
    return { score: 2, kind: "negative", reason: null }; // already covered by the stage-level NOT_APPLICABLE risk flag
  }
  const matchedInterests = profile.interestKeywords.filter((k) => text.includes(k));
  if (matchedInterests.length) {
    return { score: 18, kind: "positive", reason: `관심 지원분야(${matchedInterests.join("/")})와 관련된 키워드가 있어 ${profile.brandName}와 결이 맞습니다.` };
  }
  if (HARDWARE_UNFRIENDLY_SIGNALS.some((k) => text.includes(k))) {
    return { score: 6, kind: "negative", reason: "다른 특정 산업(바이오/소프트웨어 등) 대상으로 보여 하드웨어 소비재와는 결이 다릅니다." };
  }
  return { score: 10, kind: "unknown", reason: "관심 지원분야와의 직접 연관 여부가 불명확합니다." };
}

function scoreReadiness(applicationEndDate) {
  if (!applicationEndDate) {
    return { score: 5, kind: "unknown", reason: null }; // covered by the standing 마감일 정보 risk if needed elsewhere
  }
  const end = new Date(applicationEndDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end - today) / (1000 * 60 * 60 * 24));
  if (Number.isFinite(days) && days < 7) {
    return { score: 4, kind: "negative", reason: `마감까지 ${days}일 이내로 임박해 서류 준비 시간이 부족할 수 있습니다.` };
  }
  if (Number.isFinite(days) && days < 30) {
    return { score: 7, kind: "unknown", reason: null };
  }
  return { score: 9, kind: "unknown", reason: null };
}

export function calculateMatchScore(grant, profile = kogiProfile) {
  const text = `${grant.title || ""} ${grant.organization || ""}`;

  const region = scoreRegion(text, profile);
  const stage = scoreStage(text, profile);
  const support = scoreSupport(grant.supportType, profile);
  const item = scoreItem(text, profile);
  const readiness = scoreReadiness(grant.applicationEndDate);

  const scoreBreakdown = {
    region: { score: region.score, max: 20 },
    stage: { score: stage.score, max: 25 },
    support: { score: support.score, max: 25 },
    item: { score: item.score, max: 20 },
    readiness: { score: readiness.score, max: 10 },
  };
  const fitScore = region.score + stage.score + support.score + item.score + readiness.score;

  const notApplicable = NOT_APPLICABLE_SIGNALS.some((k) => text.includes(k));

  // "지방 이전이 필수"로 보이는 공고 — profile.exclude.relocationRequired가 켜져
  // 있고, 선호 지역/수도권 언급이 전혀 없을 때만 제외 대상으로 판단한다.
  const hasPreferredRegion = profile.preferredRegions.some((r) => text.includes(r)) || text.includes("수도권");
  const relocationConflict =
    profile.exclude.relocationRequired &&
    RELOCATION_REQUIRED_SIGNALS.some((k) => text.includes(k)) &&
    !hasPreferredRegion;

  // "업력 조건이 명백히 맞지 않는" 공고 — 시리즈 투자/IPO 등 후기 단계 신호가
  // 있으면 profile.stageRange(예비창업/초기창업)와 근본적으로 다른 단계이므로
  // 점수와 무관하게 제외한다.
  const lateStageConflict = profile.exclude.stageMismatch && LATE_STAGE_SIGNALS.some((k) => text.includes(k));

  // "사업자 등록 필수인데 예비창업자는 지원 불가"로 보이는 공고 — 목록 페이지는
  // 이를 확정적으로 알려주지 않으므로(문구만으로 판단), profile.registrationStatus가
  // "not_registered"일 때만 이 신호를 근거로 제외한다. 사업자 등록을 마치면
  // (profile.registrationStatus를 "registered"로 바꾸면) 이 제약은 자동으로 사라진다.
  const hasRegistrationSignal = REGISTERED_BUSINESS_SIGNALS.some((k) => text.includes(k));
  const registrationConflict = profile.registrationStatus === "not_registered" && hasRegistrationSignal;

  // Positive-only reasons (recommendationReason is prepended further down,
  // once it's known — kept separate here so it can't influence itself).
  const matchReasons = [region, stage, support, item, readiness]
    .filter((d) => d.kind === "positive" && d.reason)
    .map((d) => d.reason);
  if (matchReasons.length === 0) {
    matchReasons.push("현재 확인된 긍정적 근거가 없어, 상세 공고 확인이 필요합니다.");
  }

  // Risk/uncertainty-only findings, most specific first. Always includes the
  // two standing risks the listing page can never resolve.
  const riskFlags = [region, stage, support, item, readiness]
    .filter((d) => d.kind !== "positive" && d.reason)
    .map((d) => d.reason);
  riskFlags.push("목록 페이지에서 사업자등록 필요 여부를 확인할 수 없습니다.");
  riskFlags.push("지원금/예산 정보가 목록에 없어 상세 공고 확인이 필요합니다.");

  // ---------------------------------------------------------------------
  // 추천 등급 산정 — 아래 순서대로 우선 적용 (앞 조건이 뒤 조건보다 우선함):
  //   1. 강제 제외 조건 — 멘토/심사위원 모집 등 애초에 지원사업이 아니면
  //      점수와 무관하게 "제외".
  //   2. 지방 이전 필수 — 점수와 무관하게 "제외".
  //   3. 업력 조건 불일치 — 시리즈 투자 이후 등 명백히 다른 단계면 "제외".
  //   4. 사업자등록 필수 신호 — profile.registrationStatus가 "not_registered"인데
  //      이미 등록된 기업 대상으로 보이면 "제외". (주의: 목록 페이지 문구만으로
  //      판단하는 휴리스틱이라 완전히 확실하지는 않음 — 제외 공고함을 가끔
  //      직접 훑어보는 걸 권장.)
  //   5. 최종 점수 기준 — 위 1~4에 해당하지 않을 때만 순수 점수로 결정:
  //      80점 이상 "적극 검토" / 60~79점 "조건 확인" / 40~59점 "보류" /
  //      39점 이하 "제외".
  // ---------------------------------------------------------------------
  let recommendation;
  let recommendationReason;

  if (notApplicable) {
    recommendation = "제외";
    recommendationReason = "멘토/심사위원 모집 성격으로 신청할 지원사업이 아니므로 제외했습니다.";
  } else if (relocationConflict) {
    recommendation = "제외";
    recommendationReason = `지방 이전이 필수 조건으로 보여 선호 지역(${profile.preferredRegions.join("·")}) 기준과 맞지 않아 제외했습니다.`;
  } else if (lateStageConflict) {
    recommendation = "제외";
    recommendationReason = `투자 유치 이후 단계 대상으로 보여 업력 조건(${profile.startupStageLabel})이 맞지 않아 제외했습니다.`;
  } else if (registrationConflict) {
    recommendation = "제외";
    recommendationReason = "이미 사업자등록을 마친 기업 전용으로 보이는데 현재 사업자 등록 전이라 신청 자격이 없어 제외했습니다.";
  } else {
    if (fitScore >= 80) recommendation = "적극 검토";
    else if (fitScore >= 60) recommendation = "조건 확인";
    else if (fitScore >= 40) recommendation = "보류";
    else recommendation = "제외";

    if (recommendation === "적극 검토" && fitScore >= 75 && riskFlags.length >= 2) {
      // listing page는 사업자등록·지원금을 절대 확인해주지 않으므로 riskFlags는
      // 사실상 항상 2개 이상이라, 이 데이터 소스에서는 "적극 검토"가 구조적으로
      // 나오기 어렵다 — 의도된 보수적 동작.
      recommendation = "조건 확인";
      recommendationReason = "일부 조건은 맞지만 지원금·사업자등록·상세 지원내용 확인이 필요해 조건 확인으로 분류했습니다.";
    } else if (recommendation === "적극 검토") {
      recommendationReason = "우선 조건과 잘 맞고 확인되지 않은 리스크도 적어 적극 검토로 분류했습니다.";
    } else if (recommendation === "조건 확인") {
      recommendationReason = "일부 조건은 맞지만 지원금·사업자등록·상세 지원내용 확인이 필요해 조건 확인으로 분류했습니다.";
    } else if (recommendation === "보류") {
      recommendationReason = "관련성이 낮거나 현재 준비 가능성이 낮아 보류로 분류했습니다.";
    } else {
      recommendationReason = "점수가 낮아 우선순위와 맞지 않는 것으로 보여 제외로 분류했습니다.";
    }
  }

  // Fold recommendationReason into the existing matchReasons/riskFlags lists
  // so the modal's existing "왜 추천하는지"/"리스크" sections (unchanged)
  // surface it without any new UI area — see classifyGrant() for how these
  // map to grant.whyReasons/grant.risks.
  if (recommendation === "적극 검토") {
    matchReasons.unshift(recommendationReason);
  } else {
    riskFlags.unshift(recommendationReason);
  }

  return { fitScore, scoreBreakdown, recommendation, recommendationReason, matchReasons, riskFlags };
}

const DEFAULT_CONDITIONS_TO_CHECK = [
  { label: "사업자등록 필요 여부", value: "확인 필요" },
  { label: "업력 조건", value: "확인 필요" },
  { label: "지역 조건", value: "확인 필요" },
  { label: "자부담 여부", value: "확인 필요" },
  { label: "선정 후 의무사항", value: "확인 필요" },
];

// baseGrant + 채점 결과를 합쳐 UI가 기대하는 완성된 grant 객체를 만든다.
// baseGrant에 이미 값이 있는 필드(예: 미래의 실제 API가 supportAmount를 직접
// 아는 경우)는 그대로 유지하고, 없는 것만 "확인 필요" 기본값으로 채운다 —
// 그래야 데이터 소스가 바뀌어도(스크래핑 -> 공식 API) 이 함수를 고칠 필요가 없다.
export function classifyGrant(baseGrant, profile = kogiProfile) {
  const match = calculateMatchScore(baseGrant, profile);
  return {
    ...baseGrant,
    fitScore: match.fitScore,
    scoreBreakdown: match.scoreBreakdown,
    recommendation: match.recommendation,
    recommendationReason: match.recommendationReason,
    matchReasons: match.matchReasons,
    riskFlags: match.riskFlags,
    whyReasons: match.matchReasons,
    risks: match.riskFlags,
    conditionsToCheck: baseGrant.conditionsToCheck || DEFAULT_CONDITIONS_TO_CHECK,
    strategy: baseGrant.strategy || ["확인 필요"],
    summary: baseGrant.summary || `[${baseGrant.organization || "확인 필요"}] 지원분야: ${(baseGrant.supportType || []).join("/") || "확인 필요"} · 마감일: ${baseGrant.applicationEndDate || "확인 필요"}`,
  };
}
