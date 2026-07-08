// Express backend for KOGI Grant Radar.
//
// Purpose right now:
//   1. Serve the existing static frontend (index.html, data/, services/,
//      etc.) exactly as before — no frontend files, UI, or matching logic
//      changed.
//   2. Provide a backend-only route, /api/grants/kstartup, which scrapes the
//      public K-Startup "모집중" (ongoing) listing page as a TEMPORARY MVP
//      data source — see the big comment above parseKStartupOngoingHtml()
//      below for why, and docs/kstartup-api-checklist.md for the official
//      OpenAPI integration this is standing in for until that's ready.

import "dotenv/config"; // loads .env into process.env if one exists; safe no-op otherwise — see README.md, no real .env should exist yet
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import { calculateMatchScore, kogiProfile } from "./matchingEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Serves index.html, data/*.js, services/*.js, etc. unchanged.
// Note: express.static ignores dotfiles (e.g. a real .env) by default —
// safer than the plain `npx serve` used previously, which did expose them —
// but that's a secondary safeguard, not a reason to ever put a real .env here.
app.use(express.static(__dirname));

const KSTARTUP_ONGOING_URL = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do";

// ---------------------------------------------------------------------------
// TEMPORARY MVP DATA SOURCE — NOT the official 공공데이터포털 OpenAPI.
//
// The official "창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)_조회서비스"
// integration is still pending real Base URL / endpoint path / auth param /
// field names (see docs/kstartup-api-checklist.md, section 6 — those are
// still "확인 필요" and have NOT been guessed here). To unblock the MVP, this
// scrapes the public HTML of the ongoing-announcements listing page instead.
//
// This is inherently fragile: it depends on k-startup.go.kr's current page
// markup (verified against the live page's actual HTML on 2026-07 — class
// names `li.notice`, `p.tit`, `span.flag`, `span.flag_agency`, and the
// `.bottom span.list` items in a fixed order: [사업명, 주관기관, 등록일자,
// 시작일자, 마감일자, 조회수]). If the site changes its markup, parsing will
// silently return 0 items and this route reports failure — which is exactly
// what should happen; see the fallback behavior in the route handler below.
//
// The detail-page URL pattern (`?schM=view&pbancSn=<id>`) is not a guess —
// it's read directly from the page's own `go_view(pbancSn)` JS function.
//
// Fields the listing page does NOT expose (지원금, 제출서류, 상세 지원내용,
// 신청대상, 문의처, 지역, 창업단계) are left as "확인 필요" rather than
// invented. dataStatus is always "needs_review": scraped-and-parsed data is
// never as trustworthy as a documented API contract, even when parsing
// succeeds.
// ---------------------------------------------------------------------------
function parseKStartupOngoingHtml(html) {
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

    const baseGrant = {
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
    };

    // Real KOGI-fit evaluation (see matchingEngine.js) — listing-page data
    // only, no detail-page fetch.
    const match = calculateMatchScore(baseGrant, kogiProfile);

    grants.push({
      ...baseGrant,
      fitScore: match.fitScore,
      scoreBreakdown: match.scoreBreakdown,
      recommendation: match.recommendation,
      recommendationReason: match.recommendationReason,
      matchReasons: match.matchReasons,
      riskFlags: match.riskFlags,
      summary: `[${agency || "확인 필요"}] 지원분야: ${supportTypeRaw || "확인 필요"} · 마감일: ${endRaw || "확인 필요"}`,
      // whyReasons/risks are NOT part of the fields this step asked for
      // (matchReasons/riskFlags) — they're aliases kept so the existing UI
      // (index.html's modalHTML, unchanged) doesn't break: it reads
      // g.whyReasons/g.risks specifically, a naming decision from an earlier
      // round working with curated mock data. Same content, two names.
      whyReasons: match.matchReasons,
      risks: match.riskFlags,
      conditionsToCheck: [
        { label: "사업자등록 필요 여부", value: "확인 필요" },
        { label: "업력 조건", value: "확인 필요" },
        { label: "지역 조건", value: "확인 필요" },
        { label: "자부담 여부", value: "확인 필요" },
        { label: "선정 후 의무사항", value: "확인 필요" },
      ],
      strategy: ["확인 필요"],
    });
  });

  return grants;
}

app.get("/api/grants/kstartup", async (req, res) => {
  try {
    const pageRes = await fetch(KSTARTUP_ONGOING_URL);
    if (!pageRes.ok) {
      return res.json({
        ok: false,
        grants: [],
        dataStatus: "mock",
        message: `K-Startup 페이지 요청 실패 (HTTP ${pageRes.status}) — mockGrants로 폴백합니다.`,
      });
    }
    const html = await pageRes.text();
    const grants = parseKStartupOngoingHtml(html);
    if (grants.length === 0) {
      return res.json({
        ok: false,
        grants: [],
        dataStatus: "mock",
        message: "K-Startup 페이지에서 공고를 파싱하지 못했습니다 (페이지 구조 변경 가능) — mockGrants로 폴백합니다.",
      });
    }
    return res.json({ ok: true, grants, dataStatus: "needs_review", message: null });
  } catch (err) {
    // Network error, timeout, DNS failure, etc. — never let this route throw.
    return res.json({
      ok: false,
      grants: [],
      dataStatus: "mock",
      message: "K-Startup 페이지에 접속하지 못했습니다 — mockGrants로 폴백합니다.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`KOGI Grant Radar server listening at http://localhost:${PORT}`);
});
