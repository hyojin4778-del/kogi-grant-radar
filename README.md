# KOGI Grant Radar

Personal dashboard that automatically checks new 창업지원사업 공고 (startup
grant announcements) and classifies each one into **추천 / 조건 확인 / 제외**
for KOGI (키링형 보조배터리 브랜드), based on a single editable business
profile — no manual paste-in required for the main flow.

## Architecture

```
services/kstartupSource.js   fetch + parse K-Startup's public listing page
                              (temporary MVP source — see docs/kstartup-api-checklist.md
                              for the pending official OpenAPI integration)
        │
        ▼
matchingEngine.js             classifyGrant(): scores each grant against
                              data/kogiProfile.js and assigns
                              추천 / 조건 확인 / 보류 / 제외
        │
        ▼
scripts/update-grants.js      orchestrates the two steps above and writes a
                              timestamped snapshot to data/grants.json
        │
        ▼
server.js                     serves data/grants.json via /api/grants/kstartup
                              (reads the file — does NOT scrape on every
                              request, so page loads stay fast)
        │
        ▼
index.html                    fetches from the server and renders the
                              추천/조건확인/제외 dashboard, with a
                              마지막 업데이트 timestamp
```

**Business profile — `data/kogiProfile.js`** is the single source of truth
for KOGI's current status (사업자등록 상태, 창업단계, 선호지역, 관심
지원분야, 제외 규칙). Edit that one file when the business status changes
(사업자 등록 완료, 창업 1년 미만, 법인 전환, etc.) — every part of the app
picks it up automatically.

## Running locally

```
npm install   # first time only
npm run update-grants   # fetch + classify today's grants -> data/grants.json
npm start                # or: npm run dev (auto-restarts on file changes)
```

Open **http://localhost:3000**. `type="module"` script imports require the
app to be served over `http://` — opening `index.html` directly via `file://`
will fail with a CORS error in the console.

`data/grants.json` is committed to the repo (not gitignored) so a fresh
checkout/deploy always has *some* data to serve, even before the first
scheduled update runs.

## Keeping data fresh automatically

- **`.github/workflows/update-grants.yml`** — a GitHub Actions workflow that
  runs `npm run update-grants` daily (09:00 KST) and commits `data/grants.json`
  back to the repo if it changed. This is what actually keeps the deployed
  site fresh without you opening a terminal: Render (or any host with
  auto-deploy-on-push) redeploys automatically when this commit lands.
- **`render.yaml`** — also defines a Render **cron job** that runs
  `npm run update-grants` on the same schedule, as a Render-native option.
  Important limitation: on Render's free tier, a cron job and a web service
  don't share a filesystem, so the cron job's own `data/grants.json` never
  reaches the running web service by itself — see the comment at the top of
  `render.yaml`. The GitHub Actions workflow above is what closes that loop
  in practice; the Render cron job is provided because it was explicitly
  requested, but treat it as redundant/optional unless you later add a
  shared persistent disk.

## Security notes — read before adding a real API key

**1. Never create a real `.env` file in this project.**
Only `.env.example` (with empty placeholder values) should exist here. It
documents the two variables a future backend will need:

```
KSTARTUP_API_KEY=
BIZINFO_API_KEY=
```

**2. `.gitignore` already excludes `.env` and `node_modules/`** so a real
`.env` can never be committed by accident — but that's a second line of
defense, not the main one (see #3).

**3. The static file server matters for dotfile exposure.** `server.js` uses
`express.static`, which ignores dotfiles by default (`.env.example` returns
`404`). That's a real improvement over a plain static server, but it's still
not a reason to ever place a real `.env` in this project root — the rule
stays "never put a real secret in a folder a static server exposes."

**4. No real API key is in use yet.** `services/kstartupSource.js` scrapes
K-Startup's public HTML listing page as a temporary MVP data source — no
`KSTARTUP_API_KEY` is read or needed for that. When the official
공공데이터포털 OpenAPI integration is confirmed (see
`docs/kstartup-api-checklist.md`), a new source module should read the key
server-side only (inside a script or `server.js`, via `process.env`), never
in `index.html` or any browser-side file.
