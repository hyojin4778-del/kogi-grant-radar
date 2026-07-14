// KOGI 지원사업 레이더 — dashboard logic.
//
// Reads /api/grants (server.js, which just proxies data/latest.json — see
// docs/grants-json-schema.md for the exact shape) and renders a
// searchable/filterable list + detail view. No build step, no framework.

const SOURCE_ORDER = ["K-Startup", "기업마당", "NIPA", "KOCCA", "SMTECH"];
const GROUP_ORDER = ["A", "B", "C", "제외"];
const GROUP_LABEL = { A: "A · 즉시 지원 가능", B: "B · 요건 충족 시", C: "C · 변형하면 가능", "제외": "제외" };
const STATUS_ORDER = ["모집중", "마감임박", "마감", "확인 필요"];

const state = {
  grants: [],
  search: "",
  sources: new Set(),
  groups: new Set(["A", "B", "C"]), // 제외는 기본 숨김, 토글로 확인
  statuses: new Set(STATUS_ORDER),
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function $(id) { return document.getElementById(id); }

function computeStatus(grant) {
  if (grant.status) return grant.status;
  if (!grant.applicationEndDate) return "확인 필요";
  const end = new Date(grant.applicationEndDate);
  if (Number.isNaN(end.getTime())) return "확인 필요";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end - today) / 86400000);
  if (days < 0) return "마감";
  if (days <= 3) return "마감임박";
  return "모집중";
}

async function fetchGrants() {
  try {
    const res = await fetch("/api/grants");
    const json = await res.json();
    return json;
  } catch (e) {
    return { ok: false, grants: [], message: "서버에 연결할 수 없습니다." };
  }
}

function renderHeader(data) {
  $("profileSummary").textContent = data.profileSummary || "";
  const meta = [];
  if (data.generatedAt) meta.push(`마지막 조사: ${new Date(data.generatedAt).toLocaleString("ko-KR")}`);
  if (data.sources?.length) meta.push(`소스: ${data.sources.join(", ")}`);
  $("metaLine").textContent = meta.join(" · ");

  const reportLink = $("reportLink");
  if (data.reportPath) {
    reportLink.href = "/api/report";
    reportLink.hidden = false;
  } else {
    reportLink.hidden = true;
  }
}

function renderStatTiles(data) {
  const counts = data.counts || GROUP_ORDER.reduce((acc, g) => {
    acc[g] = data.grants.filter((x) => x.group === g).length;
    return acc;
  }, {});
  const el = $("statTiles");
  el.innerHTML = ["전체", ...GROUP_ORDER].map((key) => {
    const value = key === "전체" ? data.grants.length : (counts[key] || 0);
    return `<div class="stat-tile stat-${key === "전체" ? "total" : key}"><span class="stat-value">${value}</span><span class="stat-label">${escapeHtml(key === "전체" ? "전체" : GROUP_LABEL[key])}</span></div>`;
  }).join("");
}

function renderFilterChips(containerId, values, activeSet, onToggle) {
  const el = $(containerId);
  el.innerHTML = values.map((v) => {
    const active = activeSet.has(v);
    const label = GROUP_LABEL[v] || v;
    return `<button type="button" class="chip ${active ? "chip-active" : ""}" data-value="${escapeHtml(v)}">${escapeHtml(label)}</button>`;
  }).join("");
  el.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.value;
      if (activeSet.has(v)) activeSet.delete(v); else activeSet.add(v);
      onToggle();
    });
  });
}

function matchesFilters(grant) {
  const status = computeStatus(grant);
  if (state.search) {
    const q = state.search.toLowerCase();
    const hay = `${grant.title || ""} ${grant.organization || ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.sources.size && !state.sources.has(grant.source)) return false;
  if (state.groups.size && !state.groups.has(grant.group)) return false;
  if (state.statuses.size && !state.statuses.has(status)) return false;
  return true;
}

function renderList() {
  const filtered = state.grants.filter(matchesFilters);
  const list = $("grantList");
  const emptyState = $("emptyState");

  if (state.grants.length === 0) {
    list.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = state.emptyMessage || "아직 조사 결과가 없습니다.";
    return;
  }
  if (filtered.length === 0) {
    list.innerHTML = "";
    emptyState.hidden = false;
    emptyState.textContent = "조건에 맞는 공고가 없습니다. 검색어/필터를 확인하세요.";
    return;
  }
  emptyState.hidden = true;

  const sorted = [...filtered].sort((a, b) => {
    const gi = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (gi !== 0) return gi;
    const ad = a.applicationEndDate || "9999-12-31";
    const bd = b.applicationEndDate || "9999-12-31";
    return ad.localeCompare(bd);
  });

  list.innerHTML = sorted.map((g) => {
    const status = computeStatus(g);
    const regions = (g.region || []).join("·") || "전국/확인 필요";
    return `
      <article class="grant-card group-${escapeHtml(g.group || "")}" data-id="${escapeHtml(g.id)}">
        <div class="card-top">
          <span class="badge badge-source">${escapeHtml(g.source || "확인 필요")}</span>
          <span class="badge badge-group group-${escapeHtml(g.group || "")}">${escapeHtml(g.group || "?")}</span>
          <span class="badge badge-status status-${escapeHtml(status)}">${escapeHtml(status)}</span>
          ${g.autoClassified ? `<span class="badge badge-auto" title="상세페이지 미검증 — 규칙 기반 임시 등급">자동 판정</span>` : ""}
        </div>
        <h3 class="card-title">${escapeHtml(g.title)}</h3>
        <p class="card-org">${escapeHtml(g.organization || "확인 필요")}</p>
        <p class="card-meta">${escapeHtml(regions)} · ${escapeHtml(g.supportField || "확인 필요")} · 마감 ${escapeHtml(g.applicationEndDate || "확인 필요")}</p>
      </article>
    `;
  }).join("");

  list.querySelectorAll(".grant-card").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
  });
}

function openDetail(id) {
  const g = state.grants.find((x) => x.id === id);
  if (!g) return;
  const status = computeStatus(g);
  const elig = g.eligibility || {};
  $("modalBody").innerHTML = `
    <div class="card-top">
      <span class="badge badge-source">${escapeHtml(g.source || "확인 필요")}</span>
      <span class="badge badge-group group-${escapeHtml(g.group || "")}">${escapeHtml(GROUP_LABEL[g.group] || g.group || "?")}</span>
      <span class="badge badge-status status-${escapeHtml(status)}">${escapeHtml(status)}</span>
      ${g.autoClassified ? `<span class="badge badge-auto" title="상세페이지 미검증 — 규칙 기반 임시 등급">자동 판정</span>` : ""}
    </div>
    <h2>${escapeHtml(g.title)}</h2>
    <p class="modal-org">${escapeHtml(g.organization || "확인 필요")}</p>
    <p class="modal-reason"><strong>판정 이유:</strong> ${escapeHtml(g.groupReason || "확인 필요")}</p>
    <dl class="detail-grid">
      <dt>지역</dt><dd>${escapeHtml((g.region || []).join(", ") || "확인 필요")}</dd>
      <dt>지원분야</dt><dd>${escapeHtml(g.supportField || "확인 필요")}</dd>
      <dt>신청기간</dt><dd>${escapeHtml(g.applicationStartDate || "확인 필요")} ~ ${escapeHtml(g.applicationEndDate || "확인 필요")}</dd>
      <dt>지원금액</dt><dd>${escapeHtml(g.supportAmount || "확인 필요")}</dd>
      <dt>예비창업자 가능 여부</dt><dd>${escapeHtml(String(elig.preStartupAllowed ?? "확인 필요"))}</dd>
      <dt>지역 제한</dt><dd>${escapeHtml(elig.regionRestriction || "확인 필요")}</dd>
      <dt>비고</dt><dd>${escapeHtml(elig.note || "확인 필요")}</dd>
      <dt>문의처</dt><dd>${escapeHtml(g.contact || "확인 필요")}</dd>
      <dt>상세검증 시각</dt><dd>${g.verifiedAt ? escapeHtml(new Date(g.verifiedAt).toLocaleString("ko-KR")) : "미검증 (목록 단계)"}</dd>
    </dl>
    ${g.url ? `<a class="detail-link" href="${escapeHtml(g.url)}" target="_blank" rel="noopener noreferrer">원문 공고 바로가기 ↗</a>` : "<p>원문 URL 미확인</p>"}
  `;
  $("detailModal").hidden = false;
}

function closeDetail() {
  $("detailModal").hidden = true;
}

async function init() {
  const data = await fetchGrants();
  state.grants = Array.isArray(data.grants) ? data.grants : [];
  state.emptyMessage = data.message;

  renderHeader(data);
  renderStatTiles(data);

  const presentSources = SOURCE_ORDER.filter((s) => state.grants.some((g) => g.source === s));
  state.sources = new Set(presentSources);
  renderFilterChips("sourceFilters", presentSources, state.sources, renderList);
  renderFilterChips("groupFilters", GROUP_ORDER, state.groups, renderList);
  renderFilterChips("statusFilters", STATUS_ORDER, state.statuses, renderList);

  $("searchInput").addEventListener("input", (e) => {
    state.search = e.target.value.trim();
    renderList();
  });
  $("modalClose").addEventListener("click", closeDetail);
  $("modalBackdrop").addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

  renderList();
}

init();
