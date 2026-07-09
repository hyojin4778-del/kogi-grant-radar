// Daily grant-refresh job — run via `npm run update-grants` (locally, or by
// a scheduled job: GitHub Actions / Render cron, see README + render.yaml).
//
// Pipeline: fetch raw listing data -> classify against data/kogiProfile.js ->
// write a snapshot to data/grants.json that the running web server
// (server.js) simply reads on each request — no live scraping happens on the
// request path anymore, so page loads stay fast even if k-startup.go.kr is
// slow, and freshness is entirely controlled by how often this script runs.
//
// Swapping to the official K-Startup OpenAPI later only means writing a new
// "fetch raw grants" module with the same shape as services/kstartupSource.js
// (fetch + parse-into-base-grant-shape) and swapping the import below —
// classifyGrant() and everything downstream is already source-agnostic.

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { fetchKStartupHtml, parseKStartupOngoingHtml } from "../services/kstartupSource.js";
import { classifyGrant, kogiProfile } from "../matchingEngine.js";
import { mockGrants } from "../data/mockGrants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "data", "grants.json");

async function fetchRawGrants() {
  try {
    const html = await fetchKStartupHtml();
    const raw = parseKStartupOngoingHtml(html);
    if (raw.length > 0) {
      return { grants: raw, dataSource: "live", message: null };
    }
    return {
      grants: [],
      dataSource: "unavailable",
      message: "K-Startup 페이지에서 공고를 파싱하지 못했습니다 (페이지 구조 변경 가능).",
    };
  } catch (err) {
    return {
      grants: [],
      dataSource: "unavailable",
      message: `K-Startup 페이지에 접속하지 못했습니다 (${err.message}).`,
    };
  }
}

export async function buildSnapshot() {
  const { grants: rawGrants, dataSource, message } = await fetchRawGrants();

  let grants;
  let finalDataSource;
  let finalMessage;

  if (dataSource === "live") {
    // 실시간으로 새로 받아온 목록만 KOGI 프로필 기준으로 다시 분류한다 —
    // mockGrants는 이미 손으로 큐레이션된 값이라 재채점 대상이 아니다.
    grants = rawGrants.map((g) => classifyGrant(g, kogiProfile));
    finalDataSource = "live";
    finalMessage = null;
  } else {
    grants = mockGrants;
    finalDataSource = "mock";
    finalMessage = `${message} mockGrants로 대체합니다.`;
  }

  return {
    lastUpdated: new Date().toISOString(),
    dataSource: finalDataSource,
    message: finalMessage,
    grants,
  };
}

async function main() {
  const snapshot = await buildSnapshot();
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf-8");

  const counts = snapshot.grants.reduce((acc, g) => {
    acc[g.recommendation] = (acc[g.recommendation] || 0) + 1;
    return acc;
  }, {});
  console.log(`[update-grants] lastUpdated=${snapshot.lastUpdated} dataSource=${snapshot.dataSource}`);
  console.log(`[update-grants] total=${snapshot.grants.length}`, counts);
  if (snapshot.message) console.log(`[update-grants] ${snapshot.message}`);
}

// Only auto-run when executed directly (`node scripts/update-grants.js`),
// not when imported elsewhere (e.g. a future test file).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error("[update-grants] unexpected failure:", err);
    process.exit(1);
  });
}
