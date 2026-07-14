#!/usr/bin/env python3
"""Multi-source crawler for Korean government support-program announcements.

Part of the ir-search skill. Covers sources beyond K-Startup
(see kstartup_crawl.py for the K-Startup crawler):

  bizinfo  Bizinfo (기업마당) — largest aggregated portal, all ministries/regions
  nipa     NIPA (정보통신산업진흥원) — AI/ICT programs
  kocca    KOCCA (한국콘텐츠진흥원) — content-industry programs
  smtech   SMTECH (중소기업 기술개발사업) — SME R&D calls

Only public announcement pages are accessed; no login, no private areas.
A polite delay is applied between requests.

Usage:
  python3 sources_crawl.py bizinfo -o bizinfo.jsonl --max-pages 20
  python3 sources_crawl.py all -o all_sources.jsonl

Unified JSONL schema:
  {"source", "id", "title", "field", "org", "apply_start", "apply_end",
   "reg_date", "url"}

Dependency: curl_cffi>=0.15 recommended (TLS-fingerprint friendly).
Falls back to urllib; if blocked, an install hint is printed.
"""
import argparse
import html as htmllib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

DELAY = 0.4  # seconds between requests (politeness)
REQUEST_TIMEOUT = 45  # seconds per HTTP request (was 30 — GitHub-hosted runner IPs
# to Korean gov/quasi-gov sites sometimes need longer to time out or succeed than a
# home connection does)
MAX_RETRIES = 2  # extra attempts after the first (3 total tries) per request
BACKOFF_BASE = 3  # seconds; exponential backoff between retries: 3s, 6s

# Last-known-good cache: when a source fails today, we backfill from whatever it
# collected last time it fully succeeded, instead of reporting a hard 0 for that
# source. Lives at a fixed path (not under the dated reports/raw/<date>/ folder)
# so it survives across daily runs — the GH Actions workflow commits it back.
LATEST_GOOD_DIR = "reports/raw/_latest_good"


def with_retry(fn, *, retries=MAX_RETRIES, backoff_base=BACKOFF_BASE, label="request"):
    """Call fn() with up to `retries` extra attempts on exception, sleeping
    backoff_base * 2**attempt seconds between attempts (exponential backoff).
    Re-raises the last exception if every attempt fails."""
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — retry network hiccups before giving up
            last_exc = e
            if attempt < retries:
                delay = backoff_base * (2**attempt)
                print(
                    f"[ir-search] {label}: attempt {attempt + 1}/{retries + 1} failed ({e}) "
                    f"— retrying in {delay}s",
                    file=sys.stderr,
                )
                time.sleep(delay)
    raise last_exc


def make_fetcher():
    """Prefer curl_cffi (Safari TLS fingerprint); fall back to urllib. Every request
    is retried (with_retry) before the caller ever sees a failure, so a single slow
    or dropped connection no longer immediately kills the source."""
    try:
        from curl_cffi import requests as cr

        sess = cr.Session(impersonate="safari")

        def raw_fetch(url, data=None):
            # data=dict switches to a POST form submit (some boards paginate that way)
            if data is None:
                r = sess.get(url, timeout=REQUEST_TIMEOUT)
            else:
                r = sess.post(url, data=data, timeout=REQUEST_TIMEOUT)
            return r.status_code, r.text

        backend = "curl_cffi"
    except ImportError:
        import urllib.parse
        import urllib.request

        def raw_fetch(url, data=None):
            body = urllib.parse.urlencode(data).encode() if data is not None else None
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
                    )
                },
            )
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")

        backend = "urllib"

    def fetch(url, data=None):
        return with_retry(lambda: raw_fetch(url, data), label=url[:70])

    return fetch, backend


def clean(s):
    return re.sub(r"\s+", " ", htmllib.unescape(s or "")).strip()


def norm_date(s):
    """Normalize date-ish strings to YYYY-MM-DD; return input if not parseable."""
    s = clean(s)
    m = re.search(r"(\d{4})[.\-/\s]+(\d{1,2})[.\-/\s]+(\d{1,2})", s)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.search(r"(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})", s)  # 26.07.10
    if m:
        return f"20{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return s


def split_period(s):
    """Split '2026-07-07 ~ 2026-07-17'-style ranges into (start, end)."""
    parts = re.split(r"~|∼", s)
    if len(parts) == 2:
        return norm_date(parts[0]), norm_date(parts[1])
    return "", norm_date(s)


# --------------------------------------------------------------------------
# Per-source parsers. Each returns (items, has_more) for one page.
# Structures verified live on 2026-07-11; if a site redesign breaks a parser,
# it fails loudly (0 items) rather than returning wrong data.
# --------------------------------------------------------------------------

def page_bizinfo(fetch, page):
    # List rows: no / field / title+link(pblancId) / period / ministry / agency / reg / views
    url = (
        "https://www.bizinfo.go.kr/sii/siia/selectSIIA200View.do"
        f"?rows=15&cpage={page}&schEndAt=N"
    )
    status, h = fetch(url)
    if status != 200:
        return [], False
    items = []
    for row in re.findall(r"<tr>[\s\S]*?</tr>", h):
        m = re.search(r'href\s*=\s*"([^"]*pblancId=(PBLN_\d+)[^"]*)"[^>]*>\s*([\s\S]*?)</a>', row)
        if not m:
            continue
        tds = [clean(re.sub(r"<[^>]+>", " ", td)) for td in re.findall(r"<td[^>]*>([\s\S]*?)</td>", row)]
        # tds: [no, field, title-cell, period, ministry, agency, reg_date, views]
        start, end = split_period(tds[3]) if len(tds) > 3 else ("", "")
        items.append(
            {
                "source": "bizinfo",
                "id": m.group(2),
                "title": clean(m.group(3)),
                "field": tds[1] if len(tds) > 1 else "",
                "org": " / ".join(x for x in tds[4:6] if x) if len(tds) > 5 else "",
                "apply_start": start,
                "apply_end": end,
                "reg_date": tds[6] if len(tds) > 6 else "",
                "url": f"https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId={m.group(2)}",
            }
        )
    return items, bool(items)


def page_nipa(fetch, page):
    # Table rows: no / D-day / title+link(/home/2-2/{id}) + program tag + period / author / reg
    status, h = fetch(f"https://www.nipa.kr/home/2-2?curPage={page}")
    if status != 200:
        return [], False
    items = []
    for row in re.findall(r"<tr>[\s\S]*?</tr>", h):
        m = re.search(r'href="(/home/2-2/(\d+))"[^>]*>([\s\S]*?)</a>', row)
        if not m:
            continue
        period = re.search(r"신청기간\s*:\s*([^<]+)", row)
        start, end = split_period(period.group(1)) if period else ("", "")
        prog = re.search(r'<span class="box[^"]*">([^<]+)</span>', row)
        reg = re.findall(r'<span class="bco">\s*(\d{4}-\d{2}-\d{2})\s*</span>', row)
        items.append(
            {
                "source": "nipa",
                "id": m.group(2),
                "title": clean(re.sub(r"<!--[\s\S]*?-->", "", m.group(3))),
                "field": clean(prog.group(1)) if prog else "",
                "org": "NIPA",
                "apply_start": start,
                "apply_end": end,
                "reg_date": reg[-1] if reg else "",
                "url": f"https://www.nipa.kr{m.group(1)}",
            }
        )
    return items, bool(items)


def page_kocca(fetch, page):
    # Rows: category / title+link(view.do?intcNo=...) / notice date / apply period / views
    # Pagination is a POST form submit (fn_egov_select_linkPage), not a GET param.
    status, h = fetch(
        "https://www.kocca.kr/kocca/pims/list.do",
        data={"menuNo": "204104", "pageIndex": str(page)},
    )
    if status != 200:
        return [], False
    items = []
    for row in re.findall(r"<tr>[\s\S]*?</tr>", h):
        m = re.search(r'href="(/kocca/pims/view\.do\?intcNo=([^&"]+)[^"]*)"[^>]*>([\s\S]*?)</a>', row)
        if not m:
            continue
        cat = re.search(r'<span class="category_color\d+">([^<]+)</span>', row)
        period = re.search(r'data-label="접수기간">\s*([^<]+)', row)
        notice = re.search(r'data-label="공고일">\s*([^<]+)', row)
        start, end = split_period(period.group(1)) if period else ("", "")
        items.append(
            {
                "source": "kocca",
                "id": m.group(2),
                "title": clean(m.group(3)),
                "field": clean(cat.group(1)) if cat else "",
                "org": "KOCCA",
                "apply_start": start,
                "apply_end": end,
                "reg_date": norm_date(notice.group(1)) if notice else "",
                "url": "https://www.kocca.kr" + htmllib.unescape(m.group(1)),
            }
        )
    return items, bool(items)


def page_smtech(fetch, page):
    # Rows: program / title+link(notice02_detail.do?...ancmId=...) / period / reg / status icons
    status, h = fetch(
        f"https://www.smtech.go.kr/front/ifg/no/notice02_list.do?pageIndex={page}"
    )
    if status != 200:
        return [], False
    items = []
    for row in re.findall(r"<tr>[\s\S]*?</tr>", h):
        m = re.search(r'href="(/front/ifg/no/notice02_detail\.do[^"]*ancmId=([^&"]+)[^"]*)"[^>]*>([\s\S]*?)</a>', row)
        if not m:
            continue
        tds = [clean(re.sub(r"<[^>]+>", " ", td)) for td in re.findall(r"<td[^>]*>([\s\S]*?)</td>", row)]
        period = next((t for t in tds if "~" in t), "")
        start, end = split_period(period) if period else ("", "")
        reg = next((t for t in tds if re.fullmatch(r"\d{4}-\d{2}-\d{2}", t)), "")
        # Drop the session id from the path; keep only the stable query params.
        path = re.sub(r";jsessionid=[^?]*", "", htmllib.unescape(m.group(1)))
        items.append(
            {
                "source": "smtech",
                "id": m.group(2),
                "title": clean(m.group(3)),
                "field": tds[1] if len(tds) > 1 else "",
                "org": "SMTECH(중소기업기술정보진흥원)",
                "apply_start": start,
                "apply_end": end,
                "reg_date": reg,
                "url": f"https://www.smtech.go.kr{path}",
            }
        )
    return items, bool(items)


SOURCES = {
    "bizinfo": page_bizinfo,
    "nipa": page_nipa,
    "kocca": page_kocca,
    "smtech": page_smtech,
}


def crawl(source, fetch, max_pages):
    """Returns (items, error). `error` is None on full success, or a short string
    describing what stopped this source (page + exception, after fetch()'s own
    MAX_RETRIES retries were already exhausted for that request) — this stops the
    source early but keeps whatever was already collected, instead of losing the
    other sources still queued behind it."""
    pager = SOURCES[source]
    seen = {}
    for page in range(1, max_pages + 1):
        try:
            items, has_more = pager(fetch, page)
        except Exception as e:  # noqa: BLE001 — one bad page shouldn't lose pages already collected
            error = f"page {page}: {e} (after {MAX_RETRIES} retries)"
            print(
                f"[ir-search] {source} p{page}: error {e} after {MAX_RETRIES} retries "
                f"— stopping this source, keeping {len(seen)} collected so far",
                file=sys.stderr,
            )
            return list(seen.values()), error
        new = [i for i in items if i["id"] not in seen]
        for i in items:
            seen[i["id"]] = i
        print(
            f"[ir-search] {source} p{page}: {len(items)} parsed, {len(new)} new, total {len(seen)}",
            file=sys.stderr,
        )
        if not has_more or not new:
            break
        time.sleep(DELAY)
    return list(seen.values()), None


def load_latest_good(source):
    """Read the last successful collection for `source` from LATEST_GOOD_DIR.

    Returns (items, collected_at, reason):
      - (items, iso_timestamp, None) if a usable cache exists
      - (None, None, reason) if there's no cache yet, it's empty, or it fails
        to parse — callers must treat this as "no fallback available", not
        crash the source.
    """
    jsonl_path = os.path.join(LATEST_GOOD_DIR, f"{source}.jsonl")
    if not os.path.exists(jsonl_path):
        return None, None, "no cache file"
    try:
        items = []
        with open(jsonl_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    items.append(json.loads(line))
    except (OSError, json.JSONDecodeError) as e:
        return None, None, f"cache file unreadable/corrupted: {e}"
    if not items:
        return None, None, "cache file empty"

    collected_at = None
    meta_path = os.path.join(LATEST_GOOD_DIR, "meta.json")
    try:
        if os.path.exists(meta_path):
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            collected_at = (meta.get(source) or {}).get("collectedAt")
    except (OSError, json.JSONDecodeError):
        pass  # missing/corrupted meta doesn't invalidate the data itself — date just unknown

    return items, collected_at, None


def save_latest_good(source, items, collected_at_iso):
    """Overwrite the last-known-good cache for `source` after a fully successful
    collection. Only called when a source has zero errors — a partial/failed
    run must never clobber a previously good cache with incomplete data."""
    os.makedirs(LATEST_GOOD_DIR, exist_ok=True)
    jsonl_path = os.path.join(LATEST_GOOD_DIR, f"{source}.jsonl")
    with open(jsonl_path, "w", encoding="utf-8") as f:
        for i in items:
            clean = {k: v for k, v in i.items() if k != "is_fallback"}
            f.write(json.dumps(clean, ensure_ascii=False) + "\n")

    meta_path = os.path.join(LATEST_GOOD_DIR, "meta.json")
    meta = {}
    if os.path.exists(meta_path):
        try:
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
        except (OSError, json.JSONDecodeError):
            meta = {}
    meta[source] = {"collectedAt": collected_at_iso, "itemCount": len(items)}
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)


def strip_html(text):
    text = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", "", text)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = htmllib.unescape(text)
    return re.sub(r"\n\s*\n+", "\n", text)


def cmd_detail(fetch, urls, outdir):
    """Save the text of announcement detail pages (any source) for eligibility checks."""
    import os

    os.makedirs(outdir, exist_ok=True)
    allowed = ("bizinfo.go.kr", "nipa.kr", "kocca.kr", "smtech.go.kr", "k-startup.go.kr")
    for n, url in enumerate(urls):
        host = re.sub(r"^https?://([^/]+).*", r"\1", url)
        if not host.endswith(allowed):
            print(f"[ir-search] skip non-source url: {url[:60]}", file=sys.stderr)
            continue
        try:
            status, h = fetch(url)
            if status != 200:
                print(f"[ir-search] {url[:60]}: HTTP {status}", file=sys.stderr)
                continue
            name = re.sub(r"\W+", "_", url.split("://", 1)[1])[:80]
            path = f"{outdir}/{name}.txt"
            with open(path, "w", encoding="utf-8") as f:
                f.write(url + "\n\n" + strip_html(h))
            print(f"[ir-search] saved: {path}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001 — skip failures, keep going
            print(f"[ir-search] {url[:60]}: error {e}", file=sys.stderr)
        time.sleep(DELAY)


def run_list(fetch, source, output, max_pages):
    """Collect one or all sources, write `output`, and (if any source failed)
    write collection_errors.json next to it (message + retries attempted per
    source). Returns the process exit code: 0 on full success AND on partial
    success (>=1 item collected overall), 1 only when every source failed or
    the total collected is 0.

    A source that errors falls back to its LATEST_GOOD_DIR cache (last fully
    successful collection) so a transient block/timeout doesn't zero out that
    source for the day. Any items the failing source did manage to collect
    today are kept as-is (they're fresher than the cache) and the cache only
    fills the gap, deduplicated by id/url so nothing appears twice. A source
    that succeeds today never touches the cache except to refresh it."""
    names = list(SOURCES) if source == "all" else [source]
    out = []
    errors = {}  # source -> {"message", "retriesAttempted", "fallbackApplied", ...}
    run_started_at = datetime.now(timezone.utc).isoformat()
    for name in names:
        try:
            items, error = crawl(name, fetch, max_pages)
            retries_attempted = MAX_RETRIES if error else 0
        except Exception as e:  # noqa: BLE001 — defense in depth if crawl() itself errors unexpectedly
            print(f"[ir-search] {name}: source failed entirely: {e}", file=sys.stderr)
            items, error, retries_attempted = [], str(e), "N/A (unexpected crash outside crawl())"

        for i in items:
            i["is_fallback"] = False

        if error:
            cached_items, cached_at, cache_reason = load_latest_good(name)
            if cached_items:
                today_keys = {i.get("id") or i.get("url") for i in items}
                fallback_items = [
                    {**ci, "is_fallback": True, "original_collected_at": cached_at}
                    for ci in cached_items
                    if (ci.get("id") or ci.get("url")) not in today_keys
                ]
                items = items + fallback_items
                print(
                    f"[ir-search] {name}: fallback applied — {len(fallback_items)} items "
                    f"from last successful collection ({cached_at})",
                    file=sys.stderr,
                )
                errors[name] = {
                    "message": error,
                    "retriesAttempted": retries_attempted,
                    "fallbackApplied": True,
                    "fallbackItemCount": len(fallback_items),
                    "fallbackOriginalCollectedAt": cached_at,
                    "latestGoodCacheAvailable": True,
                }
            else:
                print(
                    f"[ir-search] {name}: no fallback data available ({cache_reason}) "
                    f"— keeping {len(items)} item(s) collected today",
                    file=sys.stderr,
                )
                errors[name] = {
                    "message": f"{error} (fallback cache unavailable: {cache_reason})",
                    "retriesAttempted": retries_attempted,
                    "fallbackApplied": False,
                    "fallbackItemCount": 0,
                    "fallbackOriginalCollectedAt": None,
                    "latestGoodCacheAvailable": False,
                }
        elif items:
            # Only a fully-clean source's data is trustworthy enough to become
            # tomorrow's fallback — a partial run must not overwrite a good cache.
            save_latest_good(name, items, run_started_at)

        out.extend(items)
        time.sleep(DELAY)

    with open(output, "w", encoding="utf-8") as f:
        for i in out:
            f.write(json.dumps(i, ensure_ascii=False) + "\n")

    if errors:
        errors_path = os.path.join(os.path.dirname(output) or ".", "collection_errors.json")
        with open(errors_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "checkedAt": run_started_at,
                    "totalCollected": len(out),
                    "succeededSources": [n for n in names if n not in errors],
                    "failedSources": list(errors.keys()),
                    "errors": errors,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        print(f"[ir-search] failed sources logged: {errors_path}", file=sys.stderr)

    print(f"[ir-search] saved: {output} ({len(out)} items)", file=sys.stderr)

    if len(out) == 0:
        reason = f"failed sources: {', '.join(errors.keys())}" if errors else "no items found"
        print(f"[ir-search] TOTAL FAILURE — 0 items collected ({reason})", file=sys.stderr)
        return 1
    if errors:
        print(
            f"[ir-search] PARTIAL SUCCESS — {len(out)} items collected, "
            f"failed sources (each retried {MAX_RETRIES}x): {', '.join(errors.keys())}",
            file=sys.stderr,
        )
        return 0
    print("[ir-search] OK — all sources succeeded", file=sys.stderr)
    return 0


def main():
    ap = argparse.ArgumentParser(
        description="Crawl Korean support-program announcement boards (ir-search)"
    )
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="crawl announcement lists")
    p_list.add_argument("source", choices=[*SOURCES, "all"], help="source to crawl")
    p_list.add_argument("-o", "--output", default="sources.jsonl")
    p_list.add_argument(
        "--max-pages",
        type=int,
        default=30,
        help="page cap per source (bizinfo lists many announcements — "
        "recent pages usually suffice)",
    )

    p_det = sub.add_parser("detail", help="save detail-page text for given URLs")
    p_det.add_argument("urls", nargs="+", help="announcement detail URLs")
    p_det.add_argument("-o", "--output", default="details")

    args = ap.parse_args()

    fetch, backend = make_fetcher()
    print(f"[ir-search] fetch backend: {backend}", file=sys.stderr)
    if backend == "urllib":
        print(
            "[ir-search] tip: pip install 'curl_cffi>=0.15' if requests get blocked",
            file=sys.stderr,
        )

    if args.cmd == "detail":
        cmd_detail(fetch, args.urls, args.output)
        return

    sys.exit(run_list(fetch, args.source, args.output, args.max_pages))


if __name__ == "__main__":
    main()
