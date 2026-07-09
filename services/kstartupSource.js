// K-Startup listing-page data source — a TEMPORARY MVP stand-in for the
// official 공공데이터포털 OpenAPI ("창업진흥원_K-Startup(사업소개,사업공고,콘텐츠
// 등)_조회서비스"). That integration is still pending confirmed Base URL /
// endpoint path / auth param / field names (see docs/kstartup-api-checklist.md).
//
// This file is deliberately narrow: it only fetches + parses raw listing-page
// data into our common "base grant" shape. It does NOT score or classify
// anything — that's matchingEngine.js's job (see classifyGrant there). Keeping
// these separate means a future real-API source module can implement the same
// two functions (fetch + parse-into-base-grant-shape) and scripts/update-grants.js
// / matchingEngine.js won't need to change at all.
//
// Runs server-side only (Node's `fetch`, no browser code here).

import * as cheerio from "cheerio";

export const KSTARTUP_ONGOING_URL = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do";

export async function fetchKStartupHtml() {
  const res = await fetch(KSTARTUP_ONGOING_URL);
  if (!res.ok) {
    throw new Error(`K-Startup 페이지 요청 실패 (HTTP ${res.status})`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// This scrapes the public HTML of the ongoing-announcements listing page
// instead of calling the official API (see module comment above for why).
//
// Fragile by nature: depends on k-startup.go.kr's current page markup
// (verified against the live page's actual HTML on 2026-07 — class names
// `li.notice`, `p.tit`, `span.flag`, `span.flag_agency`, and the
// `.bottom span.list` items in a fixed order: [사업명, 주관기관, 등록일자,
// 시작일자, 마감일자, 조회수]). If the site changes its markup, parsing will
// silently return 0 items — callers should treat an empty array as "source
// unavailable, fall back" rather than "no grants today".
//
// The detail-page URL pattern (`?schM=view&pbancSn=<id>`) is not a guess —
// it's read directly from the page's own `go_view(pbancSn)` JS function.
//
// Fields the listing page does NOT expose (지원금, 제출서류, 상세 지원내용,
// 신청대상, 문의처, 지역, 창업단계) are left as "확인 필요" rather than
// invented.
// ---------------------------------------------------------------------------
export function parseKStartupOngoingHtml(html) {
  const $ = cheerio.load(html);
  const grants = [];

  $("li.notice").each((_, el) => {
    const $el = $(el);

    const detailHref = $el.find("a[href*='go_view(']").attr("href") || "";
    const idMatch = detailHref.match(/go_view\((\d+)\)/);
    const pbancSn = idMatch ? idMatch[1] : null;

    const title = $el.find("p.tit").first().text().trim();
    if (!pbancSn || !title) return; // can't reliably identify this item — skip it rather than guess

    const supportTypeRaw = $el.find("span.flag").not(".day").first().text().trim();
    const agency = $el.find("span.flag_agency").first().text().trim();

    // Fixed order confirmed against the live page: [사업명(often duplicates
    // title), 주관기관, "등록일자 YYYY-MM-DD", "시작일자 YYYY-MM-DD",
    // "마감일자 YYYY-MM-DD", "조회 N,NNN"].
    const listSpans = $el
      .find(".bottom span.list")
      .map((i, s) => $(s).text().trim())
      .get();
    const organization = listSpans[1] || "확인 필요";
    const registeredRaw = (listSpans[2] || "").replace("등록일자", "").trim();
    const startRaw = (listSpans[3] || "").replace("시작일자", "").trim();
    const endRaw = (listSpans[4] || "").replace("마감일자", "").trim();
    const viewCountRaw = (listSpans[5] || "").replace("조회", "").trim();

    grants.push({
      id: `kstartup-${pbancSn}`,
      title,
      organization,
      sourceName: "K-Startup",
      sourceUrl: KSTARTUP_ONGOING_URL,
      // Confirmed via the page's own go_view(pbancSn) function, not guessed.
      originalNoticeUrl: `${KSTARTUP_ONGOING_URL}?schM=view&pbancSn=${pbancSn}`,
      region: [], // not shown on the listing page
      startupStage: [], // not shown on the listing page
      supportType: supportTypeRaw ? [supportTypeRaw] : [],
      supportAmount: "확인 필요", // not shown on the listing page
      applicationStartDate: startRaw || null,
      applicationEndDate: endRaw || null,
      dDay: null, // always computed live client-side from applicationEndDate — the page's own "D-N" label is not persisted here
      target: "확인 필요", // not shown on the listing page
      // Assembled only from fields the listing page genuinely provides
      // (공공/민간 구분, 지원분야, 등록일자, 조회수) — not a substitute for
      // the real 사업개요, which isn't available here.
      description: `[${agency || "확인 필요"}] 지원분야: ${supportTypeRaw || "확인 필요"} · 등록일자: ${registeredRaw || "확인 필요"} · 조회수: ${viewCountRaw || "확인 필요"}`,
      requirements: ["확인 필요"], // not shown on the listing page
      documents: ["확인 필요"], // not shown on the listing page
      contact: "확인 필요", // not shown on the listing page
      dataStatus: "needs_review",
      verifiedAt: new Date().toISOString(),
      deadlineStatus: null, // computed dynamically client-side from applicationEndDate
      summary: `[${agency || "확인 필요"}] 지원분야: ${supportTypeRaw || "확인 필요"} · 마감일: ${endRaw || "확인 필요"}`,
    });
  });

  return grants;
}
