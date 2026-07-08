# KOGI Grant Radar

Personal curation prototype that shows startup-support grant announcements
relevant to KOGI. Static frontend (`index.html` + ES modules under `data/`
and `services/`) served by a small Express backend (`server.js`), which also
hosts a backend-only route reserved for real K-Startup API integration.

## Running locally

```
npm install   # first time only
npm start
```

This runs `node server.js` — an Express server that serves the existing
static frontend unchanged, plus `/api/grants/kstartup` (currently a mock
route — see Security notes below). Open **http://localhost:3000**.

`type="module"` script imports require the app to be served over `http://`
— opening `index.html` directly via `file://` (double-click) will fail with
a CORS error in the console.

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

**3. The static file server matters for dotfile exposure.** We previously
ran this project with `npx serve`, a plain static server with no path
restrictions — it served *any* file in the directory over HTTP, including
dotfiles (`.env.example` returned `200 OK` from it). Now that `server.js`
uses `express.static`, dotfiles are ignored by default (`.env.example` now
returns `404`) — a real improvement. **This is still not a reason to ever
place a real `.env` in this project root.** Non-dotfiles (e.g. `server.js`,
`package.json`) are still served as static assets either way, `express.static`'s
dotfile-ignoring is a default that could be changed or misconfigured, and
`.gitignore` only affects `git`, not what any file server hands out. **The
rule stays "never put a real secret in a folder a static server exposes,"**
regardless of which server is in front of it.

**4. A backend now exists (`server.js`), but it does not call the real
K-Startup API yet.** `/api/grants/kstartup` currently returns a mock
response (the K-Startup-tagged subset of `data/mockGrants.js`) — no external
request is made, and `process.env.KSTARTUP_API_KEY` is only referenced in a
`TODO` comment describing the planned real implementation. When that's
filled in, the key will be read server-side inside `server.js` and never
sent to the browser — that's the whole reason this backend exists instead of
calling data.go.kr directly from frontend JS.

**Important — the frontend and backend mock paths are currently separate.**
`services/grantApi.js`'s `fetchKStartupGrants()`/`fetchAllGrants()` still run
entirely in the browser and do **not** call `/api/grants/kstartup` yet — they
still fall back straight to the bundled `data/mockGrants.js` on their own, and
the UI still shows "실시간 공고 데이터를 불러오지 못해 예시 데이터를 표시합니다."
from that frontend-side fallback, not from the new backend route. Wiring the
frontend to actually call `/api/grants/kstartup` (instead of maintaining its
own separate mock fallback) is a natural next step, not done yet.
