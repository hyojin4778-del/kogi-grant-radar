// Express backend for KOGI 지원사업 레이더.
//
// Purpose:
//   1. Serve the static dashboard (public/index.html, app.js, styles.css).
//   2. Serve /api/grants by reading data/latest.json — a snapshot produced
//      either by GitHub Actions (raw collection only, see
//      .github/workflows/update-grants.yml) or, for the actual classified
//      data the dashboard shows, by a Claude Code session running the
//      ir-search workflow ("지원사업 재조사해줘" — see CLAUDE.md). This
//      server never scrapes or classifies anything itself.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LATEST_PATH = path.join(__dirname, "data", "latest.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const REPORTS_ROOT = path.join(__dirname, "reports");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(PUBLIC_DIR));

// Serves only the single report.md referenced by data/latest.json's reportPath —
// not a static mount of reports/, so raw jsonl/details subfolders stay unreachable.
app.get("/api/report", async (req, res) => {
  try {
    const raw = await readFile(LATEST_PATH, "utf-8");
    const { reportPath } = JSON.parse(raw);
    if (!reportPath) {
      return res.status(404).send("보고서 경로가 없습니다.");
    }

    const resolved = path.resolve(__dirname, reportPath);
    const relative = path.relative(REPORTS_ROOT, resolved);
    const isInsideReports = relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    const isReportMd = path.basename(resolved) === "report.md";
    if (!isInsideReports || !isReportMd) {
      return res.status(400).send("허용되지 않은 경로입니다.");
    }

    const content = await readFile(resolved, "utf-8");
    res.type("text/plain; charset=utf-8").send(content);
  } catch (err) {
    return res.status(404).send("보고서를 찾을 수 없습니다.");
  }
});

app.get("/api/grants", async (req, res) => {
  try {
    const raw = await readFile(LATEST_PATH, "utf-8");
    const snapshot = JSON.parse(raw);
    return res.json({ ok: true, ...snapshot });
  } catch (err) {
    // data/latest.json missing or unreadable (no survey run yet) — return an
    // empty-but-valid shape so the dashboard can show a clear empty state
    // instead of breaking. See docs/grants-json-schema.md for the real shape.
    return res.json({
      ok: true,
      generatedAt: null,
      profileSummary: null,
      sources: [],
      reportPath: null,
      counts: { A: 0, B: 0, C: 0, "제외": 0 },
      grants: [],
      message: "아직 조사 결과가 없습니다. Claude Code에서 \"지원사업 재조사해줘\"라고 요청하세요.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`KOGI 지원사업 레이더 서버 실행 중: http://localhost:${PORT}`);
});
