// Vercel serverless function mirroring server.js's /api/report route — same
// path-traversal guard (must resolve inside reports/ and be named report.md).
import { readFile } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const LATEST_PATH = path.join(ROOT, "data", "latest.json");
const REPORTS_ROOT = path.join(ROOT, "reports");

export default async function handler(req, res) {
  try {
    const raw = await readFile(LATEST_PATH, "utf-8");
    const { reportPath } = JSON.parse(raw);
    if (!reportPath) {
      res.status(404).send("보고서 경로가 없습니다.");
      return;
    }

    const resolved = path.resolve(ROOT, reportPath);
    const relative = path.relative(REPORTS_ROOT, resolved);
    const isInsideReports = relative && !relative.startsWith("..") && !path.isAbsolute(relative);
    const isReportMd = path.basename(resolved) === "report.md";
    if (!isInsideReports || !isReportMd) {
      res.status(400).send("허용되지 않은 경로입니다.");
      return;
    }

    const content = await readFile(resolved, "utf-8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send(content);
  } catch (err) {
    res.status(404).send("보고서를 찾을 수 없습니다.");
  }
}
