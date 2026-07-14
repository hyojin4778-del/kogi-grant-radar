#!/usr/bin/env python3
"""Daily unattended provisional classifier for the GitHub Actions pipeline.

This is NOT the ir-search workflow. ir-search (triggered by "지원사업 재조사해줘"
in a Claude Code session) reads each announcement's detail page and makes a
judgment call — that is the authoritative classification. This script only
has list-level fields (title/org/field/dates) to work with, so it applies a
small set of EXPLICIT, named keyword rules (no additive scoring) to give new
announcements a provisional A/B/C/제외 grade the same morning they appear,
instead of leaving them unclassified until the next manual survey.

Every grant this script produces is stamped `autoClassified: true` and its
`groupReason`/`eligibility.note` are prefixed "[자동 판정]" so the dashboard
can show it's a provisional machine call, not a verified one (see
public/app.js badge rendering).

Merge rule with the existing data/latest.json: an existing grant that does
NOT have autoClassified=true was produced by a real ir-search survey — this
script never overwrites it. Only brand-new grant ids, or ids that were
themselves auto-classified before, get replaced with today's result. Grants
missing from today's input (e.g. a source failed with no fallback cache)
are left untouched, never deleted.

Usage:
  python3 auto_classify.py --kstartup reports/raw/<date>/kstartup_all.jsonl \\
                            --sources reports/raw/<date>/sources_all.jsonl \\
                            --output data/latest.json
"""
import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

DISPLAY_SOURCE_ORDER = ["K-Startup", "기업마당", "NIPA", "KOCCA", "SMTECH"]
SOURCE_DISPLAY = {"bizinfo": "기업마당", "nipa": "NIPA", "kocca": "KOCCA", "smtech": "SMTECH"}

DEFAULT_PROFILE_SUMMARY = "예비창업자 · 수도권 · 하드웨어 소비재(키링형 보조배터리)"

# --------------------------------------------------------------------------
# KOGI 프로필(ir-search-profile.md) 기준 명시적 키워드 규칙. 점수 합산이 아니라
# "이 키워드가 있으면 이 판단" 형태의 결정론적 조건문이며, 목록 단계 정보만으로는
# 확신할 수 없는 항목은 최대한 보수적으로("확인 필요") 처리한다.
# --------------------------------------------------------------------------
CAPITAL_KEYWORDS = ["서울", "경기", "인천", "수도권", "전국"]
NONCAPITAL_KEYWORDS = [
    "부산", "대구", "광주", "대전", "울산", "세종", "강원",
    "충북", "충남", "전북", "전남", "경북", "경남", "제주",
]
LOCAL_ONLY_PATTERNS = [
    "지역 소재", "지역소재", "관내기업", "관내 기업", "지역 기업만",
    "지역인재", "본사 소재", "사업장 소재", "지역 이전",
]

PRESTARTUP_KEYWORDS = ["예비창업", "예비 창업"]
STARTUP_FRIENDLY_KEYWORDS = ["초기창업", "초기 창업", "청년창업", "청년 창업", "창업기업", "스타트업"]
HISTORY_REQUIRED_KEYWORDS = [
    "업력 3년", "업력 5년", "업력 7년", "기창업", "재도약", "스케일업",
    "3년 이상", "5년 이상", "도약기",
]

HARDWARE_KEYWORDS = [
    "하드웨어", "제조", "시제품", "프로토타입", "목업", "완제품", "소비재",
    "라이프스타일", "웨어러블", "액세서리", "생활용품", "디자인", "IoT",
    "제품개발", "제품 개발",
]
SUPPORT_TYPE_KEYWORDS = [
    "입주", "보육", "멘토", "사업화", "판로", "마케팅", "브랜드", "브랜딩",
    "시제품 제작", "시제품제작", "유통",
]

# Audience-exclusion keywords are checked against the TITLE ONLY (see classify()) —
# checking organization/field too caused false positives like "한국의료기기협동조합"
# (an operating agency whose own name happens to contain "협동조합", not an audience
# restriction) getting excluded.
NON_STARTUP_AUDIENCE_KEYWORDS = ["대학생 대상", "청소년 대상", "재직자 대상", "교원 대상", "농업인 대상"]


def has_any(text, keywords):
    return any(k in text for k in keywords)


def load_jsonl(path):
    if not path or not os.path.exists(path):
        print(f"[auto-classify] WARNING: input file not found: {path}", file=sys.stderr)
        return []
    items = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    items.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError as e:
        print(f"[auto-classify] WARNING: could not read {path}: {e}", file=sys.stderr)
        return []
    return items


def kstartup_to_schema(rec):
    orig_id = str(rec.get("pbancSn", "")).strip()
    return {
        "id": f"kstartup-{orig_id}",
        "source": "K-Startup",
        "title": rec.get("title") or rec.get("program") or "",
        "organization": rec.get("org", ""),
        "supportField": rec.get("category", ""),
        "applicationStartDate": rec.get("start", ""),
        "applicationEndDate": rec.get("deadline", ""),
        "url": rec.get("url", ""),
    }


def sources_to_schema(rec):
    src = rec.get("source", "")
    orig_id = str(rec.get("id", "")).strip()
    return {
        "id": f"{src}-{orig_id}",
        "source": SOURCE_DISPLAY.get(src, src),
        "title": rec.get("title", ""),
        "organization": rec.get("org", ""),
        "supportField": rec.get("field", ""),
        "applicationStartDate": rec.get("apply_start", ""),
        "applicationEndDate": rec.get("apply_end", ""),
        "url": rec.get("url", ""),
    }


def classify(mapped):
    """Returns (group, reason, review_items) via explicit, named rule checks —
    not additive scoring. Falls back to the most conservative bucket ("C" +
    a "확인 필요" note) whenever list-level text doesn't give a clear signal."""
    text = f"{mapped['title']} {mapped['organization']} {mapped['supportField']}"

    # Organization names routinely contain words like "협동조합"/"교육" as part of the
    # operating agency's own name, not the target audience — audience-exclusion is
    # checked against the title only, where an actual audience restriction is stated.
    non_startup_audience = has_any(mapped["title"], NON_STARTUP_AUDIENCE_KEYWORDS)
    capital_region = has_any(text, CAPITAL_KEYWORDS)
    noncapital_region = has_any(text, NONCAPITAL_KEYWORDS)
    local_only = has_any(text, LOCAL_ONLY_PATTERNS) and noncapital_region and not capital_region
    history_required = has_any(text, HISTORY_REQUIRED_KEYWORDS)
    prestartup = has_any(text, PRESTARTUP_KEYWORDS)
    startup_friendly = prestartup or has_any(text, STARTUP_FRIENDLY_KEYWORDS)
    hardware_fit = has_any(text, HARDWARE_KEYWORDS)
    support_type_fit = has_any(text, SUPPORT_TYPE_KEYWORDS)
    noncapital_only = noncapital_region and not capital_region

    review_items = []
    if not prestartup:
        review_items.append("예비창업자(사업자등록 전) 지원 가능 여부")
    if not capital_region:
        review_items.append("수도권(서울·경기·인천) 신청 가능 여부")
    if not (hardware_fit or support_type_fit):
        review_items.append("KOGI 사업분야(하드웨어·소비재)와의 연관성")
    review_items.append("지원금액 및 문의처")

    if non_startup_audience:
        group = "제외"
        reason = "지원 대상이 스타트업/예비창업자가 아닌 것으로 보임(목록 정보 기준)"
    elif local_only:
        group = "제외"
        reason = "해당 지역 소재기업 한정으로 보이는 표현이 있어 수도권 예비창업자와 맞지 않을 가능성이 높음"
    elif history_required and not prestartup:
        group = "C"
        reason = "사업자등록/업력 요건이 있는 것으로 보임 — 예비창업자 조건에는 현재 맞지 않을 수 있음"
    elif prestartup and (hardware_fit or support_type_fit) and not noncapital_only:
        group = "A"
        reason = "예비창업자 지원 명시 + KOGI 사업분야(하드웨어·제조·시제품 등) 또는 지원유형(입주·사업화·판로 등) 부합, 지역 제한 신호 없음"
    elif prestartup and noncapital_only:
        group = "C"
        reason = "예비창업자 지원은 명시되어 있으나 비수도권 지역명이 언급되어 지역 제한 가능성이 있음"
    elif prestartup:
        group = "B"
        reason = "예비창업자 지원은 명시되어 있으나 KOGI 사업분야 적합성은 목록 정보만으로 판단하기 어려움"
    elif (hardware_fit or support_type_fit) and startup_friendly:
        group = "B"
        reason = "KOGI 사업분야 또는 지원유형과 부합 가능성이 있고 창업기업 대상으로 보이나, 예비창업자 지원 가능 여부는 확인되지 않음"
    elif hardware_fit or support_type_fit:
        group = "B"
        reason = "KOGI 사업분야(하드웨어·제조·시제품 등) 또는 지원유형과 부합 가능성이 있으나, 지원 대상 조건은 확인되지 않음"
    else:
        group = "C"
        reason = "목록 정보만으로는 KOGI 사업분야·지원 대상과의 연관성을 확인하기 어려움"

    return group, reason, review_items, prestartup, capital_region, noncapital_only


def build_grant(mapped, checked_at_iso):
    group, reason, review_items, prestartup, capital_region, noncapital_only = classify(mapped)

    if capital_region:
        region_restriction = "수도권 포함 신청 가능으로 보임(목록 정보 기준 추정)"
    elif noncapital_only:
        region_restriction = "비수도권 지역명이 언급됨 — 수도권 신청 가능 여부 확인 필요"
    else:
        region_restriction = "확인 필요"

    return {
        "id": mapped["id"],
        "source": mapped["source"],
        "title": mapped["title"],
        "organization": mapped["organization"] or "확인 필요",
        "group": group,
        "groupReason": f"[자동 판정] {reason}",
        "region": [],
        "supportField": mapped["supportField"] or "확인 필요",
        "applicationStartDate": mapped["applicationStartDate"] or "",
        "applicationEndDate": mapped["applicationEndDate"] or "",
        "eligibility": {
            "preStartupAllowed": True if prestartup else "확인 필요",
            "regionRestriction": region_restriction,
            "note": f"[자동 판정] 확인 필요: {', '.join(review_items)}",
        },
        "supportAmount": "확인 필요",
        "contact": "확인 필요",
        "url": mapped["url"],
        "verifiedAt": None,
        "autoClassified": True,
        "autoClassifiedAt": checked_at_iso,
    }


def merge_into_existing(existing_data, new_grants, sources_present, checked_at_iso):
    existing_grants = {g["id"]: g for g in (existing_data or {}).get("grants", []) if g.get("id")}
    merged = dict(existing_grants)
    added, refreshed, skipped_human = 0, 0, 0

    for g in new_grants:
        prior = existing_grants.get(g["id"])
        if prior is not None and not prior.get("autoClassified"):
            skipped_human += 1
            continue  # a real ir-search verdict — never overwritten by the auto path
        if prior is None:
            added += 1
        else:
            refreshed += 1
        merged[g["id"]] = g

    grants_list = list(merged.values())
    counts = {k: 0 for k in ("A", "B", "C", "제외")}
    for g in grants_list:
        if g.get("group") in counts:
            counts[g["group"]] += 1

    result = {
        "generatedAt": checked_at_iso,
        "profileSummary": (existing_data or {}).get("profileSummary") or DEFAULT_PROFILE_SUMMARY,
        "sources": sources_present,
        "reportPath": (existing_data or {}).get("reportPath"),
        "counts": counts,
        "grants": grants_list,
    }
    stats = {"added": added, "refreshed": refreshed, "skippedHumanVerified": skipped_human, "total": len(grants_list)}
    return result, stats


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--kstartup", required=True, help="reports/raw/<date>/kstartup_all.jsonl")
    ap.add_argument("--sources", required=True, help="reports/raw/<date>/sources_all.jsonl")
    ap.add_argument("--output", default="data/latest.json")
    ap.add_argument("--summary-output", default=None, help="optional audit-log json path")
    args = ap.parse_args()

    checked_at = datetime.now(KST).isoformat()

    kstartup_raw = load_jsonl(args.kstartup)
    sources_raw = load_jsonl(args.sources)

    if not kstartup_raw and not sources_raw:
        print(
            f"[auto-classify] no input data from either {args.kstartup} or {args.sources} "
            f"— leaving {args.output} untouched",
            file=sys.stderr,
        )
        return 0

    mapped = [kstartup_to_schema(r) for r in kstartup_raw if r.get("pbancSn")]
    mapped += [sources_to_schema(r) for r in sources_raw if r.get("id")]
    classified = [build_grant(m, checked_at) for m in mapped]

    present = {g["source"] for g in classified}
    sources_present = [s for s in DISPLAY_SOURCE_ORDER if s in present]

    existing = None
    if os.path.exists(args.output):
        try:
            with open(args.output, encoding="utf-8") as f:
                existing = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"[auto-classify] WARNING: existing {args.output} unreadable ({e}) — treating as empty", file=sys.stderr)
            existing = None

    result, stats = merge_into_existing(existing, classified, sources_present, checked_at)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(
        f"[auto-classify] {args.output} updated — "
        f"added {stats['added']}, refreshed {stats['refreshed']}, "
        f"skipped (human-verified, untouched) {stats['skippedHumanVerified']}, "
        f"total {stats['total']} — counts {result['counts']}",
        file=sys.stderr,
    )

    if args.summary_output:
        os.makedirs(os.path.dirname(args.summary_output) or ".", exist_ok=True)
        with open(args.summary_output, "w", encoding="utf-8") as f:
            json.dump({"checkedAt": checked_at, **stats, "counts": result["counts"]}, f, ensure_ascii=False, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())
