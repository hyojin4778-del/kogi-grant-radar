// Vercel serverless function mirroring server.js's /api/grants route.
// Kept separate from server.js (which stays the Render/local `npm start` entry
// point) because Vercel's zero-config "Other" preset maps api/*.js files to
// routes directly — no Express wrapper needed, and public/ is served natively.
import { readFile } from "fs/promises";
import path from "path";

const LATEST_PATH = path.join(process.cwd(), "data", "latest.json");

export default async function handler(req, res) {
  try {
    const raw = await readFile(LATEST_PATH, "utf-8");
    const snapshot = JSON.parse(raw);
    res.status(200).json({ ok: true, ...snapshot });
  } catch (err) {
    res.status(200).json({
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
}
