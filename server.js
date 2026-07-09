// Express backend for KOGI Grant Radar.
//
// Purpose:
//   1. Serve the existing static frontend (index.html, data/, services/,
//      etc.) exactly as before.
//   2. Serve /api/grants/kstartup by reading the pre-built snapshot at
//      data/grants.json — NOT by scraping K-Startup on every request. The
//      snapshot is produced by `npm run update-grants` (scripts/update-grants.js),
//      run on a schedule (see render.yaml / .github/workflows/update-grants.yml)
//      so freshness is controlled by that job, not by page-load traffic.

import "dotenv/config"; // loads .env into process.env if one exists; safe no-op otherwise — see README.md, no real .env should exist yet
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { mockGrants } from "./data/mockGrants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRANTS_SNAPSHOT_PATH = path.join(__dirname, "data", "grants.json");

const app = express();
const PORT = process.env.PORT || 3000;

// Serves index.html, data/*.js, services/*.js, etc. unchanged.
// Note: express.static ignores dotfiles (e.g. a real .env) by default — see
// README.md, that's still not a reason to ever put a real .env here.
app.use(express.static(__dirname));

app.get("/api/grants/kstartup", async (req, res) => {
  try {
    const raw = await readFile(GRANTS_SNAPSHOT_PATH, "utf-8");
    const snapshot = JSON.parse(raw);
    return res.json({
      ok: true,
      grants: snapshot.grants,
      dataSource: snapshot.dataSource,
      lastUpdated: snapshot.lastUpdated,
      message: snapshot.message,
    });
  } catch (err) {
    // data/grants.json missing or unreadable (e.g. `npm run update-grants`
    // has never been run in this environment) — fall back to the bundled
    // mockGrants so the page never breaks, same as the old live-scrape route
    // did on failure.
    return res.json({
      ok: true,
      grants: mockGrants,
      dataSource: "mock",
      lastUpdated: null,
      message: "저장된 공고 스냅샷을 찾을 수 없어 mock 데이터를 표시합니다 — npm run update-grants를 실행해보세요.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`KOGI Grant Radar server listening at http://localhost:${PORT}`);
});
