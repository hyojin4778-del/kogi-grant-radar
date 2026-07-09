// Data-source layer for KOGI Grant Radar's frontend.
//
// fetchAllGrants() is the single entry point the UI should call. It calls our
// OWN backend route (/api/grants/kstartup, served by server.js), which reads
// a pre-built snapshot (data/grants.json, produced by `npm run update-grants`
// on a schedule — see scripts/update-grants.js). The backend already decides
// whether that snapshot is live or a mock fallback and reports it via
// dataSource/message — this file trusts that and only falls back to the
// bundled mockGrants itself if the backend can't be reached at all (dev
// server not running, network error, non-2xx response).
//
// fetchBizinfoGrants() is still an unimplemented placeholder — out of scope
// for this step.

import { mockGrants } from "../data/mockGrants.js";

export const SOURCES = {
  "K-Startup": { url: "https://www.k-startup.go.kr", desc: "중기부·창업진흥원 통합 창업지원 공고 포털" },
  "기업마당": { url: "https://www.bizinfo.go.kr", desc: "중소벤처기업부 기업지원 통합정보 시스템" },
  "서울창업허브": { url: "https://seoulstartuphub.com", desc: "서울시 창업지원 거점기관" },
  "창업지원포털": { url: null, desc: "연동 예정 (정확한 사이트 확인 필요)" },
  "지자체·수도권": { url: null, desc: "서울/경기/인천 등 지자체별 개별 공고 (사이트 다수)" },
};

// Calls our own backend route (server.js's /api/grants/kstartup) — never the
// external K-Startup API directly from this browser-side file (API keys, if
// any are ever added, must stay server-side). Returns
// { ok, grants, dataSource, lastUpdated, message } and never throws, so
// callers can fall back to local mock data instead of breaking the page.
export async function fetchKStartupGrants() {
  try {
    const res = await fetch("/api/grants/kstartup");
    if (!res.ok) {
      return { ok: false, grants: [], dataSource: null, lastUpdated: null, message: null };
    }
    const json = await res.json();
    const grants = Array.isArray(json.grants) ? json.grants : [];
    if (!json.ok) {
      return { ok: false, grants: [], dataSource: null, lastUpdated: null, message: null };
    }
    return {
      ok: true,
      grants,
      dataSource: json.dataSource || null,
      lastUpdated: json.lastUpdated || null,
      message: json.message || null,
    };
  } catch (e) {
    // Backend unreachable (server not running, network error, etc.).
    return { ok: false, grants: [], dataSource: null, lastUpdated: null, message: null };
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
export async function fetchAllGrants() {
  const kstartup = await fetchKStartupGrants();
  if (kstartup.ok) {
    // The backend already determined live-vs-mock and why — trust it as-is.
    return {
      grants: kstartup.grants,
      dataSource: kstartup.dataSource || "mock",
      lastUpdated: kstartup.lastUpdated,
      message: kstartup.message,
    };
  }
  // Backend itself unreachable — one more local fallback so the screen never breaks.
  return {
    grants: mockGrants,
    dataSource: "mock",
    lastUpdated: null,
    message: "백엔드에 연결할 수 없어 예시 데이터를 표시합니다.",
  };
}
