// Data-source layer for KOGI Grant Radar.
//
// fetchAllGrants() is the single entry point the UI should call. It calls our
// OWN backend proxy route (/api/grants/kstartup, served by server.js) — never
// the external K-Startup API directly from this browser-side file. If that
// call fails, returns no data, or the backend itself isn't reachable, this
// falls back to the bundled mockGrants so the screen never breaks.
// fetchBizinfoGrants() is still an unimplemented placeholder — out of scope
// for this step.
//
// ---------------------------------------------------------------------------
// SECURITY NOTE:
// This file runs directly in the browser (loaded via `<script type="module">`
// in index.html). Anything referenced here — including anything read from an
// "environment variable" — ships in plain text to every visitor's browser and
// is visible via DevTools/view-source. That's exactly why fetchKStartupGrants()
// below calls our own same-origin backend route instead of data.go.kr
// directly: the real KSTARTUP_API_KEY is meant to be read server-side, inside
// server.js's process.env, and never sent to the browser at all.
//
// Also: do NOT create a real `.env` file in this project root even for local
// testing — see README.md for the full write-up of why a static-served
// directory is never a safe place for one, regardless of which server is in
// front of it.
// ---------------------------------------------------------------------------

import { mockGrants } from "../data/mockGrants.js";

export const SOURCES = {
  "K-Startup": { url: "https://www.k-startup.go.kr", desc: "중기부·창업진흥원 통합 창업지원 공고 포털" },
  "기업마당": { url: "https://www.bizinfo.go.kr", desc: "중소벤처기업부 기업지원 통합정보 시스템" },
  "서울창업허브": { url: "https://seoulstartuphub.com", desc: "서울시 창업지원 거점기관" },
  "창업지원포털": { url: null, desc: "연동 예정 (정확한 사이트 확인 필요)" },
  "지자체·수도권": { url: null, desc: "서울/경기/인천 등 지자체별 개별 공고 (사이트 다수)" },
};

// Converts one raw K-Startup API record into our app's common Grant shape.
// This is meant to run server-side (inside server.js, once the real API call
// is implemented there) — it's kept in this shared file so both the backend
// and this frontend module agree on the same mapping, not because the
// frontend calls it itself.
//
// TODO: every `rawGrant.<field>` access below is an UNCONFIRMED GUESS at the
// response shape of the *current* 공공데이터포털 API "창업진흥원_K-Startup
// (사업소개,사업공고,콘텐츠 등)" — NOT the deprecated "창업진흥원_창업지원공고
// (K-Startup)" API. Do not trust these field names; replace each one only
// after checking the official API docs/response sample, then remove this
// notice once confirmed.
export function normalizeKStartupGrant(rawGrant) {
  return {
    id: rawGrant.id /* TODO: confirm real field name */ ?? null,
    title: rawGrant.title /* TODO: confirm real field name */ ?? null,
    organization: rawGrant.organization /* TODO: confirm real field name */ ?? null,
    sourceName: "K-Startup",
    sourceUrl: SOURCES["K-Startup"].url,
    originalNoticeUrl: rawGrant.originalNoticeUrl /* TODO: confirm real field name — likely a detail-page URL */ ?? null,
    region: rawGrant.region /* TODO: confirm real field name + whether it's a code or free text; map to our 서울/경기/인천/전국 tags */ ?? [],
    startupStage: rawGrant.startupStage /* TODO: confirm real field name + value taxonomy; map to our 예비창업/초기창업/3년 이내/7년 이내 tags */ ?? [],
    supportType: rawGrant.supportType /* TODO: confirm real field name + value taxonomy; map to our 사업화자금/공간지원/교육·멘토링/마케팅/R&D tags */ ?? [],
    supportAmount: rawGrant.supportAmount /* TODO: confirm real field name + unit formatting */ ?? null,
    applicationStartDate: rawGrant.applicationStartDate /* TODO: confirm real field name + date format */ ?? null,
    applicationEndDate: rawGrant.applicationEndDate /* TODO: confirm real field name + date format */ ?? null,
    dDay: null, // always computed live client-side from applicationEndDate — never trust a stale precomputed value from the source
    target: rawGrant.target /* TODO: confirm real field name */ ?? null,
    description: rawGrant.description /* TODO: confirm real field name */ ?? null,
    requirements: rawGrant.requirements /* TODO: confirm real field name + whether it needs parsing out of free text */ ?? [],
    documents: rawGrant.documents /* TODO: confirm real field name + whether it needs parsing out of free text */ ?? [],
    contact: rawGrant.contact /* TODO: confirm real field name */ ?? null,
    dataStatus: "needs_review", // fetched live but not yet human-verified against the real announcement
    verifiedAt: null,
    deadlineStatus: null, // computed dynamically from applicationEndDate, not trusted from source
  };
}

// Calls our own backend proxy (server.js's /api/grants/kstartup) — never the
// external K-Startup API directly from this browser-side file (see SECURITY
// NOTE above). The backend currently returns mock data; this function
// doesn't need to know or care about that, it just consumes whatever
// Grant-shaped array the route responds with. Real normalization (once real
// K-Startup integration exists) happens server-side, not here.
//
// Returns { ok, grants, reason } and never throws, so callers can fall back
// to local mock data instead of breaking the page — a stopped/unreachable
// backend, a non-2xx response, or an empty grants array are all treated as
// "not available" rather than errors.
export async function fetchKStartupGrants() {
  try {
    const res = await fetch("/api/grants/kstartup");
    if (!res.ok) {
      return { ok: false, grants: [], reason: "http_error" };
    }
    const json = await res.json();
    const grants = Array.isArray(json.grants) ? json.grants : [];
    if (!json.ok || grants.length === 0) {
      return { ok: false, grants: [], reason: "empty_response" };
    }
    return { ok: true, grants, reason: null };
  } catch (e) {
    // Backend unreachable (server not running, network error, etc.).
    return { ok: false, grants: [], reason: "network_error" };
  }
}

// PLACEHOLDER — not implemented yet (out of scope for this step).
// Will call the 기업마당(bizinfo) Open API using a server-side
// BIZINFO_API_KEY and normalize the response into our grant shape.
export async function fetchBizinfoGrants() {
  // const apiKey = process.env.BIZINFO_API_KEY; // backend-only, never in frontend code
  // const res = await fetch(`https://apis.data.go.kr/.../bizinfoService?serviceKey=${apiKey}&...`);
  // const json = await res.json();
  // return normalizeBizinfoResponse(json);
  return [];
}

// Single entry point the UI calls.
// Order: try K-Startup -> use it if it returned data -> otherwise fall back
// to mockGrants and tell the caller why, so the UI can surface that state
// instead of silently pretending mock data is live.
export async function fetchAllGrants() {
  const kstartup = await fetchKStartupGrants();
  if (kstartup.ok && kstartup.grants.length > 0) {
    return { grants: kstartup.grants, dataSource: "live", message: null };
  }
  return {
    grants: mockGrants,
    dataSource: "mock",
    message: "실시간 공고 데이터를 불러오지 못해 예시 데이터를 표시합니다.",
  };
}
