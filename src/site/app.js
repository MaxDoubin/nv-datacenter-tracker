// Hash-routed static app over the generated JSON API. No framework.
import {
  fmtUsd, fmtNum, fmtWage, fmtPct, fmtGallons, fmtMonth, fmtDate,
  esc, badge, statusBadge, verificationBadge, severityBadge, csvBlobUrl,
} from "./format.js";
import { cumulativeChart, pairedColumns, barList, palette } from "./charts.js";

const main = document.getElementById("main");
let DB = null;

/* ---------------------------------------------------------------- theme --- */
const savedTheme = localStorage.getItem("theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
document.getElementById("theme").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
});

/* ---------------------------------------------------------------- routes --- */
function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(qs || "") };
}

const ROUTES = [
  [/^\/$/, () => viewOverview()],
  [/^\/awards$/, (_, p) => viewAwards(p)],
  [/^\/award\/(.+)$/, (m) => viewAward(m[1])],
  [/^\/companies$/, () => viewCompanies()],
  [/^\/company\/(.+)$/, (m) => viewCompany(m[1])],
  [/^\/counties$/, () => viewCounties()],
  [/^\/county\/(.+)$/, (m) => viewCounty(decodeURIComponent(m[1]))],
  [/^\/resources$/, () => viewResources()],
  [/^\/quality$/, () => viewQuality()],
  [/^\/timeline$/, () => viewTimeline()],
  [/^\/about$/, () => viewAbout()],
];

function render() {
  const { path, params } = parseHash();
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      main.innerHTML = fn(m, params);
      afterRender(path, params);
      const base = "#/" + (path.split("/")[1] || "");
      document.querySelectorAll(".nav a").forEach((a) => {
        if (a.getAttribute("href") === base) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      main.querySelector("h1")?.setAttribute("tabindex", "-1");
      return;
    }
  }
  main.innerHTML = `<h1>Not found</h1><p><a href="#/">Back to the overview</a>.</p>`;
}

addEventListener("hashchange", render);

/* ------------------------------------------------------------------ boot --- */
fetch("./api/v1/all.json")
  .then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then((db) => {
    DB = db;
    const stamp = document.getElementById("build-stamp");
    if (stamp) {
      stamp.textContent = `Dataset ${db.meta.version} — built ${db.meta.generated.slice(0, 10)} — `
        + `${db.meta.totalRows} rows across ${Object.keys(db.meta.rowCounts).length} tables.`;
    }
    render();
  })
  .catch((err) => {
    main.innerHTML = `<h1>Could not load the dataset</h1>
      <p class="muted">${esc(err.message)}</p>
      <p>If you are running this locally, serve the folder over HTTP rather than opening the file directly:</p>
      <pre class="card mono">npx serve dist</pre>`;
  });

/* --------------------------------------------------------------- helpers --- */
const srcLink = (id) => {
  const s = DB.sources.find((x) => x.source_id === id);
  if (!s) return esc(id);
  return `<a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a>`;
};
const srcShort = (id) => {
  const s = DB.sources.find((x) => x.source_id === id);
  if (!s) return esc(id);
  const short = s.title.length > 54 ? s.title.slice(0, 52).trimEnd() + "…" : s.title;
  return `<a href="${esc(s.url)}" rel="noopener" title="${esc(s.title)} — ${esc(s.publisher)}">${esc(short)}</a>`;
};
/** Name a resolution, which may be a source id or one of the literals. */
const resolutionLabel = (r) =>
  r === "computed" ? "recomputed from the underlying figures"
    : r === "unresolved" ? "left unresolved"
    : DB.sources.find((x) => x.source_id === r) ? srcShort(r) : esc(r);
const companyName = (id) => DB.companies.find((c) => c.company_id === id)?.display_name ?? id;
const stat = (label, value, sub) =>
  `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

function sortRows(rows, key, dir) {
  const s = [...rows].sort((a, b) => {
    const x = a[key], y = b[key];
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x).localeCompare(String(y));
  });
  return dir === "desc" ? s.reverse() : s;
}

function th(label, key, params, cls = "") {
  const cur = params.get("sort"), dir = params.get("dir") || "asc";
  const active = cur === key;
  const next = active && dir === "asc" ? "desc" : "asc";
  const q = new URLSearchParams(params);
  q.set("sort", key); q.set("dir", next);
  const arrow = active ? (dir === "asc" ? " ▲" : " ▼") : "";
  return `<th class="sortable ${cls}"${active ? ` aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}>
    <a href="#/awards?${q}" style="color:inherit;text-decoration:none">${esc(label)}${arrow}</a></th>`;
}

/* -------------------------------------------------------------- overview --- */
function viewOverview() {
  const t = DB.summary.totals;
  const active = DB.abatements.filter((a) => a.status === "active");
  const twenty = active.filter((a) => a.sutYears === 20);
  const dc = DB.summary.byCounty;
  const findings = DB.accountabilityFindings;
  const audited = findings.find((f) => f.id === "audits-completed");
  const perJob = findings.find((f) => f.id === "abatement-per-job");

  const wagePremiums = active.filter((a) => a.wagePremium !== null);
  const water24 = DB.water.find((w) => w.id === "google-storey-2024-withdrawn");
  const water23 = DB.water.find((w) => w.id === "google-storey-2023-withdrawn");

  return `
  <h1>Nevada's data center tax abatements</h1>
  <p class="lede">Since 2015, Nevada has approved <strong>${t.active} data center tax abatements</strong> under
  NRS 360.754, forgoing an estimated <strong>${fmtUsd(t.totalAbatement, true)}</strong> in state and local tax revenue
  in exchange for <strong>${fmtNum(t.jobsPromised)} promised permanent jobs</strong>. Every figure on this site links
  to the document it came from.</p>

  <div class="grid stats">
    ${stat("Approved abatement value", fmtUsd(t.totalAbatement, true), `${t.active} active award${t.active === 1 ? "" : "s"}, ${t.withdrawn} withdrawn`)}
    ${stat("Promised capital investment", fmtUsd(t.capitalInvestment, true), "over five years, per applications")}
    ${stat("Promised permanent jobs", fmtNum(t.jobsPromised), `${fmtUsd(t.abatementPerJob, true)} of abatement per job`)}
    ${stat("Longest term", `${Math.max(...active.map((a) => a.sutYears ?? 0))} yrs`, `${twenty.length} award${twenty.length === 1 ? "" : "s"} on the 20-year tier`)}
  </div>

  <div class="callout warn">
    <h3>What the state does not measure</h3>
    <p class="small" style="margin-bottom:.4em">
      ${audited ? `As of ${esc(audited.as_of)}, only <strong>${audited.value} of 13</strong> active data center abatements had a completed audit.` : ""}
      GOED publishes each applicant's projected jobs, wages, capital investment and tax revenue, but does not
      publish measured outcomes against those projections. Construction-worker residency data, which
      NRS 360.754 requires at 50% Nevada residents, is not released.</p>
    <p class="small muted" style="margin:0">Source: ${srcLink("tni-dc-analysis")}</p>
  </div>

  <h2>Approved abatement value over time</h2>
  <p class="muted small">Cumulative approved value of active awards, by Nevada fiscal year. Withdrawn awards are excluded.</p>
  <div class="card">${cumulativeChart(DB.summary.cumulative, (v) => fmtUsd(v, true))}</div>

  <div class="grid cols-2" style="margin-top:22px">
    <div class="card">
      <h3 style="margin-top:0">Where the awards are</h3>
      ${barList(dc.map((c) => ({
        label: esc(c.key), value: c.totals.totalAbatement,
        href: `#/county/${encodeURIComponent(c.key)}`,
        note: `· ${c.totals.active} award${c.totals.active === 1 ? "" : "s"}`,
      })).sort((a, b) => b.value - a.value), (v) => fmtUsd(v, true))}
    </div>
    <div class="card">
      <h3 style="margin-top:0">Who holds them</h3>
      ${barList(DB.summary.byCompany.map((c) => ({
        label: esc(companyName(c.key)), value: c.totals.totalAbatement,
        href: `#/company/${encodeURIComponent(c.key)}`,
        note: `· ${c.totals.active}`,
      })).sort((a, b) => b.value - a.value), (v) => fmtUsd(v, true))}
    </div>
  </div>

  <h2>Promised versus audited, across all GOED abatement programs</h2>
  <p class="muted small">GOED audits abatement recipients at the two-year and five-year marks. These are the state's own
  figures for participating and compliant companies across the standard, aviation and data center programs together —
  GOED does not break audit results out by program, which is itself a limitation of the public record.</p>
  <div class="card">
    ${pairedColumns(
      DB.programAudit.filter((r) => r.audit_state === "complete")
        .map((r) => ({ label: r.fiscal_year, a: Number(r.projected_capex_usd), b: Number(r.audited_capex_usd) })),
      (v) => fmtUsd(v, true), ["Projected capital investment", "Found at audit"])}
  </div>
  <p class="small muted">Across FY2010–FY2019, audited capital investment came to
  ${fmtPct(DB.summary.deliveryTotals.capexRatio, 0)} of what companies projected, while audited job counts came to
  ${fmtPct(DB.summary.deliveryTotals.jobsRatio, 0)} of projections — companies tended to under-deliver on capital and
  over-deliver on headcount, at wages ${fmtPct(DB.summary.deliveryTotals.wageRatio - 1, 0)} above projection.
  Source: ${srcLink("goed-biennial-2023")}.</p>

  <div class="grid cols-2" style="margin-top:22px">
    <div class="card">
      <h3 style="margin-top:0">Wages beat the statutory floor</h3>
      <p class="small muted">Each award must pay at least the statewide average wage. Recent data center awards promise
      far more than the minimum — but for very few jobs.</p>
      ${barList(wagePremiums.map((a) => ({
        label: `${esc(a.entityName.slice(0, 22))} <span class="faint">FY${a.fiscalYear}</span>`,
        value: a.wagePremium, note: `· ${fmtWage(a.avgWage)}/hr vs ${fmtWage(a.statutoryWage)}`,
      })), (v) => `${v.toFixed(2)}×`, { mono: true })}
    </div>
    <div class="card">
      <h3 style="margin-top:0">Water use is climbing fast</h3>
      <p class="small muted">Google's Storey County facility, the only Nevada data center that publishes
      facility-level water data.</p>
      <dl class="dl">
        <dt>2023 withdrawn</dt><dd>${fmtGallons(water23?.gallons)}</dd>
        <dt>2024 withdrawn</dt><dd>${fmtGallons(water24?.gallons)} <span class="badge b-warn">${(water24.gallons / water23.gallons).toFixed(1)}× in one year</span></dd>
      </dl>
      <p class="small" style="margin-top:12px"><a href="#/resources">Water and power detail →</a></p>
    </div>
  </div>

  <h2>Start here</h2>
  <ul class="clean">
    <li class="card"><a href="#/awards"><strong>Every award</strong></a> — filterable, sortable, downloadable table of all ${DB.abatements.length} awards.</li>
    <li class="card"><a href="#/quality"><strong>Data quality ledger</strong></a> — ${DB.discrepancies.length} documented conflicts between official sources, including ${DB.discrepancies.filter((d) => d.severity === "high").length} that change what the record says.</li>
    <li class="card"><a href="#/about"><strong>Methods and downloads</strong></a> — how this was built, what it does not cover, and bulk data in CSV, JSON and SQL.</li>
  </ul>`;
}

/* ---------------------------------------------------------------- awards --- */
function viewAwards(params) {
  const q = (params.get("q") || "").toLowerCase();
  const county = params.get("county") || "";
  const company = params.get("company") || "";
  const status = params.get("status") || "";
  const verification = params.get("verification") || "";
  const sort = params.get("sort") || "fiscalYear";
  const dir = params.get("dir") || "desc";

  let rows = DB.abatements.filter((a) =>
    (!county || a.county === county) &&
    (!company || a.companyId === company) &&
    (!status || a.status === status) &&
    (!verification || a.verification === verification) &&
    (!q || [a.entityName, a.county, companyName(a.companyId), a.notes].join(" ").toLowerCase().includes(q)));
  rows = sortRows(rows, sort, dir);

  const opts = (vals, cur) =>
    `<option value="">All</option>` + vals.map((v) =>
      `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(v)}</option>`).join("");
  const counties = [...new Set(DB.abatements.map((a) => a.county))].sort();
  const companies = [...new Set(DB.abatements.map((a) => a.companyId))].sort();

  const exportCols = ["id", "fiscalYear", "approvedDate", "entityName", "companyId", "county",
    "awardType", "capitalInvestment", "jobsPromised", "avgWage", "sut", "sutYears",
    "personalProperty", "ppYears", "totalAbatement", "abatementPerJob", "status", "verification", "sourceId"];

  return `
  <h1>All awards</h1>
  <p class="lede">Every data center abatement approved by the GOED board under NRS 360.754, plus any pre-2015
  award recorded for comparison. Click an entity for its full record and provenance.</p>

  <form class="controls" id="filters">
    <div class="field"><label for="f-q">Search</label>
      <input type="search" id="f-q" name="q" value="${esc(params.get("q") || "")}" placeholder="entity, operator, note…"></div>
    <div class="field"><label for="f-county">County</label><select id="f-county" name="county">${opts(counties, county)}</select></div>
    <div class="field"><label for="f-company">Operator</label>
      <select id="f-company" name="company"><option value="">All</option>${companies.map((c) =>
        `<option value="${esc(c)}"${c === company ? " selected" : ""}>${esc(companyName(c))}</option>`).join("")}</select></div>
    <div class="field"><label for="f-status">Status</label><select id="f-status" name="status">${opts(["active", "withdrawn"], status)}</select></div>
    <div class="field"><label for="f-verification">Sourcing</label><select id="f-verification" name="verification">${opts(["primary", "secondary", "unverified"], verification)}</select></div>
    <button class="btn" type="reset" id="f-reset">Reset</button>
    <a class="btn" id="dl" download="nv-datacenter-awards-filtered.csv">Download this view</a>
  </form>

  <p class="result-count">${rows.length} of ${DB.abatements.length} awards${rows.length !== DB.abatements.length ? " (filtered)" : ""}.</p>

  ${rows.length === 0 ? `<div class="card empty">Nothing matches those filters.</div>` : `
  <div class="table-scroll"><table>
    <thead><tr>
      ${th("FY", "fiscalYear", params, "num")}
      ${th("Approved", "approvedDate", params)}
      ${th("Entity", "entityName", params)}
      ${th("Operator", "companyId", params)}
      ${th("County", "county", params)}
      ${th("Capital investment", "capitalInvestment", params, "num")}
      ${th("Jobs", "jobsPromised", params, "num")}
      ${th("Wage", "avgWage", params, "num")}
      ${th("Abatement", "totalAbatement", params, "num")}
      ${th("Per job", "abatementPerJob", params, "num")}
      ${th("Term", "sutYears", params, "num")}
      <th>Status</th><th>Source</th>
    </tr></thead>
    <tbody>${rows.map((a) => `<tr>
      <td class="num">${a.fiscalYear}</td>
      <td>${fmtMonth(a.approvedDate)}</td>
      <td><a href="#/award/${encodeURIComponent(a.id)}">${esc(a.entityName)}</a></td>
      <td><a href="#/company/${encodeURIComponent(a.companyId)}">${esc(companyName(a.companyId))}</a></td>
      <td><a href="#/county/${encodeURIComponent(a.county)}">${esc(a.county)}</a></td>
      <td class="num">${fmtUsd(a.capitalInvestment, true)}</td>
      <td class="num">${fmtNum(a.jobsPromised)}</td>
      <td class="num">${fmtWage(a.avgWage)}</td>
      <td class="num">${fmtUsd(a.totalAbatement, true)}${a.totalIsReported ? ' <span class="faint" title="Published as a total; the split between tax types is not available">*</span>' : ""}</td>
      <td class="num">${fmtUsd(a.abatementPerJob, true)}</td>
      <td class="num">${a.sutYears ?? "—"}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${verificationBadge(a.verification)}</td>
    </tr>`).join("")}</tbody>
  </table></div>
  <p class="small faint">* published as a total only; the split between sales-and-use and personal property tax is not in the public record.</p>`}`;
}

/* ---------------------------------------------------------- award detail --- */
function viewAward(id) {
  const a = DB.abatements.find((x) => x.id === decodeURIComponent(id));
  if (!a) return `<h1>Award not found</h1><p><a href="#/awards">Back to all awards</a>.</p>`;
  const co = DB.companies.find((c) => c.company_id === a.companyId);
  const related = DB.discrepancies.filter((d) => d.subject_id === a.id);
  const wage = DB.statewideWage.find((w) => Number(w.fiscal_year) === a.fiscalYear);

  return `
  <p class="crumb"><a href="#/awards">All awards</a> → FY${a.fiscalYear}</p>
  <h1>${esc(a.entityName)}</h1>
  <div class="tag-row">
    ${statusBadge(a.status)} ${verificationBadge(a.verification)}
    ${badge(a.awardType, "neutral")} ${badge(`${a.sutYears ?? "?"}-year term`, "accent")}
    ${badge(a.county + " County", "neutral")}
  </div>

  <div class="grid stats">
    ${stat("Total abatement", fmtUsd(a.totalAbatement), a.totalIsReported ? "published as a total" : "sales & use + personal property")}
    ${stat("Per promised job", fmtUsd(a.abatementPerJob), `${fmtNum(a.jobsPromised)} jobs`)}
    ${stat("Capital investment", fmtUsd(a.capitalInvestment, true), "committed over five years")}
    ${stat("Abatement per $1 capex", a.abatementPerCapexDollar !== null ? `${(a.abatementPerCapexDollar * 100).toFixed(1)}¢` : "—", "share of investment forgone in tax")}
  </div>

  <h2>The record</h2>
  <dl class="dl">
    <dt>Operator</dt><dd><a href="#/company/${encodeURIComponent(a.companyId)}">${esc(companyName(a.companyId))}</a>${co?.parent_company && co.parent_company !== co.display_name ? ` — parent ${esc(co.parent_company)} <span class="badge b-${co.parent_confidence === "confirmed" ? "ok" : "warn"}">${esc(co.parent_confidence)}</span>` : ""}</dd>
    <dt>Approved</dt><dd>${fmtMonth(a.approvedDate)} (Nevada FY${a.fiscalYear})</dd>
    <dt>Program</dt><dd>${a.program === "nrs-360-754" ? "Data center abatement, NRS 360.754" : esc(a.program)}</dd>
    <dt>Sales &amp; use tax</dt><dd>${fmtUsd(a.sut)}${a.sutYears ? ` over ${a.sutYears} years — rate reduced to 2%` : ""}</dd>
    <dt>Personal property tax</dt><dd>${fmtUsd(a.personalProperty)}${a.ppYears ? ` over ${a.ppYears} years — 75% abated` : ""}</dd>
    <dt>Jobs promised</dt><dd>${fmtNum(a.jobsPromised)} full-time Nevada residents within five years</dd>
    <dt>Average wage promised</dt><dd>${fmtWage(a.avgWage)}/hour${a.statutoryWage ? ` against a statutory floor of ${fmtWage(a.statutoryWage)}` : wage ? ` (FY${a.fiscalYear} statutory floor ${fmtWage(Number(wage.statewide_avg_wage_usd))})` : ""}${a.wagePremium ? ` — ${a.wagePremium.toFixed(2)}× the floor` : ""}</dd>
    <dt>Implied annual payroll</dt><dd>${fmtUsd(a.annualWageBill)} <span class="faint small">computed as jobs × wage × 2,080 hours</span></dd>
    <dt>Term ends</dt><dd>${a.termEndsFiscalYear ? `FY${a.termEndsFiscalYear}` : "—"}</dd>
    <dt>Source</dt><dd>${srcLink(a.sourceId)}${a.sourcePage ? `, p.${esc(a.sourcePage)}` : ""}</dd>
  </dl>

  ${a.notes ? `<div class="callout"><h3>Notes</h3><p class="small" style="margin:0">${esc(a.notes)}</p></div>` : ""}
  ${related.length ? `<h2>Source conflicts affecting this award</h2>${discrepancyCards(related)}` : ""}
  <p><a class="btn" href="./api/v1/award/${encodeURIComponent(a.id)}.json">This record as JSON</a></p>`;
}

/* ------------------------------------------------------------- companies --- */
function viewCompanies() {
  const rows = DB.summary.byCompany.map((c) => {
    const co = DB.companies.find((x) => x.company_id === c.key) || {};
    return { ...c, co };
  }).sort((a, b) => b.totals.totalAbatement - a.totals.totalAbatement);

  return `
  <h1>Operators</h1>
  <p class="lede">Abatement applications are filed by single-purpose entities whose names rarely match the operator,
  and never name the ultimate parent. This table resolves entities to operators and flags how solid each
  attribution is.</p>
  <div class="table-scroll"><table>
    <thead><tr><th>Operator</th><th>Parent</th><th>Attribution</th><th>HQ</th>
      <th class="num">Awards</th><th class="num">Abatement</th><th class="num">Jobs</th><th class="num">Per job</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><a href="#/company/${encodeURIComponent(r.key)}">${esc(r.co.display_name ?? r.key)}</a></td>
      <td>${esc(r.co.parent_company || "—")}</td>
      <td>${badge(r.co.parent_confidence ?? "unknown", r.co.parent_confidence === "confirmed" ? "ok" : r.co.parent_confidence === "reported" ? "warn" : "danger")}</td>
      <td>${esc([r.co.hq_city, r.co.hq_state].filter(Boolean).join(", ") || "—")}</td>
      <td class="num">${r.rows.length}</td>
      <td class="num">${fmtUsd(r.totals.totalAbatement, true)}</td>
      <td class="num">${fmtNum(r.totals.jobsPromised)}</td>
      <td class="num">${fmtUsd(r.totals.abatementPerJob, true)}</td>
    </tr>`).join("")}</tbody></table></div>
  <p class="small muted">Operators listed in Nevada's facility inventory without an abatement do not appear here.
  See <a href="#/counties">counties</a> for the full facility list.</p>`;
}

function viewCompany(id) {
  const cid = decodeURIComponent(id);
  const co = DB.companies.find((c) => c.company_id === cid);
  if (!co) return `<h1>Operator not found</h1><p><a href="#/companies">Back to operators</a>.</p>`;
  const awards = DB.abatements.filter((a) => a.companyId === cid);
  const facilities = DB.facilities.filter((f) =>
    f.company.toLowerCase().includes(co.display_name.split(/[ ,]/)[0].toLowerCase()));
  const g = DB.summary.byCompany.find((c) => c.key === cid);

  return `
  <p class="crumb"><a href="#/companies">Operators</a></p>
  <h1>${esc(co.display_name)}</h1>
  <div class="tag-row">
    ${badge(`parent: ${co.parent_company || "unknown"}`, co.parent_confidence === "confirmed" ? "ok" : "warn")}
    ${badge(co.parent_confidence, co.parent_confidence === "confirmed" ? "ok" : "warn")}
    ${co.website ? `<a class="badge b-neutral" href="${esc(co.website)}" rel="noopener">website ↗</a>` : ""}
  </div>
  ${co.ownership_note ? `<p class="lede">${esc(co.ownership_note)}</p>` : ""}

  ${g ? `<div class="grid stats">
    ${stat("Awards", String(awards.length), `${g.totals.withdrawn} withdrawn`)}
    ${stat("Abatement value", fmtUsd(g.totals.totalAbatement, true))}
    ${stat("Jobs promised", fmtNum(g.totals.jobsPromised))}
    ${stat("Per promised job", fmtUsd(g.totals.abatementPerJob, true))}
  </div>` : ""}

  <h2>Awards</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>Entity</th><th class="num">FY</th><th>County</th><th class="num">Abatement</th>
      <th class="num">Jobs</th><th class="num">Wage</th><th>Status</th></tr></thead>
    <tbody>${awards.map((a) => `<tr>
      <td><a href="#/award/${encodeURIComponent(a.id)}">${esc(a.entityName)}</a></td>
      <td class="num">${a.fiscalYear}</td><td>${esc(a.county)}</td>
      <td class="num">${fmtUsd(a.totalAbatement, true)}</td>
      <td class="num">${fmtNum(a.jobsPromised)}</td><td class="num">${fmtWage(a.avgWage)}</td>
      <td>${statusBadge(a.status)}</td></tr>`).join("")}</tbody></table></div>

  ${facilities.length ? `<h2>Facilities in the state inventory</h2>
  <ul class="clean">${facilities.map((f) => `<li class="card small">
    <strong>${esc(f.company)}</strong> — ${esc(f.county)} County ${badge(f.status, f.status === "operational" ? "ok" : f.status === "planned" ? "warn" : "neutral")}
    ${f.note ? `<div class="muted">${esc(f.note)}</div>` : ""}</li>`).join("")}</ul>
  <p class="small muted">Matched by name against ${srcLink("lcb-datacenters-2026")}; a facility here does not imply an abatement.</p>` : ""}`;
}

/* -------------------------------------------------------------- counties --- */
function viewCounties() {
  const byCounty = DB.summary.byCounty;
  const facilityCounts = {};
  for (const f of DB.facilities) {
    facilityCounts[f.county] = facilityCounts[f.county] || { operational: 0, planned: 0, unknown: 0 };
    facilityCounts[f.county][f.status]++;
  }
  const allCounties = [...new Set([...byCounty.map((c) => c.key), ...Object.keys(facilityCounts)])].sort();

  return `
  <h1>Counties</h1>
  <p class="lede">Abatements are approved by the state, but the revenue is forgone locally: sales and use tax
  abatements reduce receipts for every local government through the Consolidated Tax formula, and personal
  property abatements hit the jurisdiction where the equipment sits.</p>

  <div class="table-scroll"><table>
    <thead><tr><th>County</th><th class="num">Awards</th><th class="num">Abatement</th>
      <th class="num">Capital investment</th><th class="num">Jobs</th>
      <th class="num">Facilities operational</th><th class="num">Planned</th><th class="num">Unclassified</th></tr></thead>
    <tbody>${allCounties.map((name) => {
      const g = byCounty.find((c) => c.key === name);
      const f = facilityCounts[name] || { operational: 0, planned: 0, unknown: 0 };
      return `<tr>
        <td><a href="#/county/${encodeURIComponent(name)}">${esc(name)}</a></td>
        <td class="num">${g ? g.rows.length : "—"}</td>
        <td class="num">${g ? fmtUsd(g.totals.totalAbatement, true) : "—"}</td>
        <td class="num">${g ? fmtUsd(g.totals.capitalInvestment, true) : "—"}</td>
        <td class="num">${g ? fmtNum(g.totals.jobsPromised) : "—"}</td>
        <td class="num">${f.operational || "—"}</td><td class="num">${f.planned || "—"}</td>
        <td class="num">${f.unknown || "—"}</td></tr>`;
    }).join("")}</tbody></table></div>

  <div class="callout">
    <h3>Where local revenue actually goes</h3>
    <p class="small" style="margin:0">The City of Reno is the only Nevada local government that has published
    what it actually lost. Across FY2017–FY2024 it redeemed
    ${fmtUsd(DB.redemptions.filter((r) => r.program === "data-center").reduce((a, r) => a + Number(r.amount_usd), 0))}
    in data center abatements — ${fmtUsd(DB.redemptions.find((r) => r.program === "data-center" && r.fiscal_year === "2023")?.amount_usd)}
    of it in FY2023 alone. Source: ${srcLink("reno-goed-memo-2025")}.</p>
  </div>
  <div class="card">
    <h3 style="margin-top:0">City of Reno, abatements actually redeemed</h3>
    ${pairedColumns(
      [...new Set(DB.redemptions.map((r) => r.fiscal_year))].sort().map((fy) => ({
        label: fy,
        a: DB.redemptions.filter((r) => r.fiscal_year === fy && r.program !== "data-center").reduce((s, r) => s + Number(r.amount_usd), 0),
        b: Number(DB.redemptions.find((r) => r.fiscal_year === fy && r.program === "data-center")?.amount_usd || 0),
      })), (v) => fmtUsd(v, true), ["Other programs", "Data centers"])}
  </div>`;
}

function viewCounty(name) {
  const g = DB.summary.byCounty.find((c) => c.key === name);
  const awards = DB.abatements.filter((a) => a.county === name);
  const facilities = DB.facilities.filter((f) => f.county === name);
  const water = DB.water.filter((w) => w.county === name);

  return `
  <p class="crumb"><a href="#/counties">Counties</a></p>
  <h1>${esc(name)} County</h1>
  ${g ? `<div class="grid stats">
    ${stat("Awards", String(awards.length))}
    ${stat("Abatement value", fmtUsd(g.totals.totalAbatement, true))}
    ${stat("Capital investment", fmtUsd(g.totals.capitalInvestment, true))}
    ${stat("Jobs promised", fmtNum(g.totals.jobsPromised))}
  </div>` : `<p class="lede">No data center abatements recorded in this county.</p>`}

  ${awards.length ? `<h2>Awards</h2><div class="table-scroll"><table>
    <thead><tr><th>Entity</th><th class="num">FY</th><th>Operator</th><th class="num">Abatement</th><th class="num">Jobs</th><th>Status</th></tr></thead>
    <tbody>${awards.map((a) => `<tr>
      <td><a href="#/award/${encodeURIComponent(a.id)}">${esc(a.entityName)}</a></td>
      <td class="num">${a.fiscalYear}</td>
      <td><a href="#/company/${encodeURIComponent(a.companyId)}">${esc(companyName(a.companyId))}</a></td>
      <td class="num">${fmtUsd(a.totalAbatement, true)}</td>
      <td class="num">${fmtNum(a.jobsPromised)}</td><td>${statusBadge(a.status)}</td></tr>`).join("")}</tbody></table></div>` : ""}

  ${facilities.length ? `<h2>Facilities in the state inventory (${facilities.length})</h2>
  <div class="table-scroll"><table><thead><tr><th>Operator</th><th>Status</th><th>Confidence</th><th class="wrap-cell">Note</th></tr></thead>
  <tbody>${facilities.map((f) => `<tr><td>${esc(f.company)}</td>
    <td>${badge(f.status, f.status === "operational" ? "ok" : f.status === "planned" ? "warn" : "neutral")}</td>
    <td>${badge(f.status_confidence, f.status_confidence === "high" ? "ok" : "warn")}</td>
    <td class="wrap-cell small">${esc(f.note || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}

  ${water.length ? `<h2>Water</h2><div class="table-scroll"><table>
    <thead><tr><th>Subject</th><th class="num">Year</th><th>Metric</th><th class="num">Gallons</th><th>Source</th></tr></thead>
    <tbody>${water.map((w) => `<tr><td>${esc(w.subject)}</td><td class="num">${w.year}</td>
      <td>${esc(w.metric.replace("_", " "))}</td><td class="num">${fmtGallons(Number(w.gallons))}</td>
      <td>${srcShort(w.source_id)}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
}

/* ------------------------------------------------------------- resources --- */
function viewResources() {
  const facility = DB.water.filter((w) => w.subject_type !== "benchmark");
  const bench = DB.water.filter((w) => w.subject_type === "benchmark");
  const gw = DB.energy.find((e) => e.id === "nv-energy-requests");
  const shares = DB.energy.filter((e) => e.metric === "share_of_national_electricity");
  const mix = DB.energy.filter((e) => e.metric === "share_of_dc_electricity");

  return `
  <h1>Water and power</h1>
  <p class="lede">Abatement filings say almost nothing about resource use. These figures come from utility filings,
  company environmental reports and local planning documents, compiled in the Legislature's own March 2026 briefing.</p>

  <div class="grid stats">
    ${stat("Power requested", `${gw.value} GW`, "roughly a dozen data centers, within a decade")}
    ${stat("US electricity share 2023", "4.4%", "up from 1.9% in 2019")}
    ${stat("Projected by 2028", "6.7–12%", "of all US electricity")}
    ${stat("Cooling", "40%+", "of a data center's power draw")}
  </div>
  <p class="small muted">${esc(gw.notes)} Source: ${srcLink(gw.source_id)}.</p>

  <h2>Nevada water observations</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>Subject</th><th>County</th><th class="num">Year</th><th>Metric</th><th class="num">Gallons</th><th>Source</th></tr></thead>
    <tbody>${facility.map((w) => `<tr>
      <td>${esc(w.subject)}</td><td>${esc(w.county || "—")}</td><td class="num">${w.year}</td>
      <td>${esc(w.metric.replace("_", " "))}</td><td class="num">${fmtGallons(Number(w.gallons))}</td>
      <td>${srcShort(w.source_id)}</td></tr>`).join("")}</tbody></table></div>
  <p class="small muted">"Withdrawn" is water taken from a source; "consumed" is water not returned to it. Most
  Nevada data centers publish neither.</p>

  <h2>For scale</h2>
  <div class="card">${barList(bench.map((b) => ({ label: esc(b.subject), value: Number(b.gallons) })), fmtGallons)}</div>
  <p class="small muted">Annual use. Nevada is the driest state in the nation, and over half its groundwater
  basins are over-appropriated. Source: ${srcLink("lcb-datacenters-2026")}.</p>

  <div class="grid cols-2" style="margin-top:22px">
    <div class="card"><h3 style="margin-top:0">US data center share of electricity</h3>
      ${barList(shares.map((s) => ({ label: `${s.year}${s.id.includes("low") ? " (low)" : s.id.includes("high") ? " (high)" : ""}`, value: Number(s.value) })), (v) => `${v}%`, { mono: true })}</div>
    <div class="card"><h3 style="margin-top:0">What powers them, nationally</h3>
      ${barList(mix.map((s) => ({ label: esc(s.subject), value: Number(s.value) })), (v) => `${v}%`)}</div>
  </div>`;
}

/* --------------------------------------------------------------- quality --- */
function discrepancyCards(rows) {
  return `<ul class="clean">${rows.map((d) => `<li class="card">
    <div class="tag-row" style="margin:0 0 8px">${severityBadge(d.severity)}
      <span class="badge b-neutral">${esc(d.field)}</span>
      ${d.subject_id ? `<a class="badge b-accent" href="#/award/${encodeURIComponent(d.subject_id)}">${esc(d.subject_id)}</a>` : ""}
      ${badge(d.resolution === "unresolved" ? "unresolved" : "resolved", d.resolution === "unresolved" ? "warn" : "ok")}</div>
    <div class="table-scroll" style="margin-bottom:10px"><table><tbody>
      <tr><td class="mono">${esc(d.value_a)}</td><td class="small">${srcShort(d.source_a) || esc(d.source_a)}</td></tr>
      <tr><td class="mono">${esc(d.value_b)}</td><td class="small">${srcShort(d.source_b) || esc(d.source_b)}</td></tr>
    </tbody></table></div>
    <p class="small" style="margin:0">${esc(d.notes)}</p>
    <p class="small muted" style="margin:.5em 0 0">${d.resolution === "unresolved"
      ? "Both values are recorded; this conflict is <strong>unresolved</strong>."
      : `This dataset follows ${resolutionLabel(d.resolution)}.`}</p>
  </li>`).join("")}</ul>`;
}

function viewQuality() {
  const d = DB.discrepancies;
  const bySev = (s) => d.filter((x) => x.severity === s);
  const unverified = DB.abatements.filter((a) => a.verification !== "primary");
  const lowConf = DB.facilities.filter((f) => f.status_confidence === "low");
  const unknownParents = DB.companies.filter((c) => c.parent_confidence !== "confirmed");

  return `
  <h1>Data quality ledger</h1>
  <p class="lede">Official sources disagree with each other. Rather than silently pick a value, this project records
  every conflict it found, which source it follows, and why. ${d.length} conflicts are documented below —
  ${bySev("high").length} of them change what the public record says.</p>

  <div class="grid stats">
    ${stat("Documented conflicts", String(d.length), `${bySev("high").length} high, ${bySev("medium").length} medium, ${bySev("low").length} low`)}
    ${stat("Awards on primary sources", `${DB.abatements.length - unverified.length}/${DB.abatements.length}`, `${unverified.length} still need a primary document`)}
    ${stat("Parent attributions unconfirmed", String(unknownParents.length), "of " + DB.companies.length + " operators")}
    ${stat("Facilities unclassified", String(lowConf.length), "status could not be read reliably")}
  </div>

  <div class="callout warn">
    <h3>The largest single finding</h3>
    <p class="small" style="margin:0">GOED's FY2023–24 report to the Legislature places Novva's FY2024 award in
    <strong>Clark County</strong> under the entity <strong>Novva Holdings, LLC</strong>. GOED's own board packet for
    the same award — identical to the dollar in both tax figures — describes a 300,000&nbsp;sq&nbsp;ft facility in
    <strong>Storey County</strong> filed as <strong>Novva Reno, LLC</strong>. Both the county and the entity in the
    legislative report are wrong.</p>
  </div>

  <h2>All documented conflicts</h2>
  ${discrepancyCards([...d].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity]))}

  ${unverified.length ? `<h2>Awards still needing a primary source</h2>
  <ul class="clean">${unverified.map((a) => `<li class="card small">
    <a href="#/award/${encodeURIComponent(a.id)}"><strong>${esc(a.entityName)}</strong></a> — FY${a.fiscalYear},
    ${esc(a.county)} County ${verificationBadge(a.verification)}
    <div class="muted">${esc(a.notes)}</div></li>`).join("")}</ul>` : ""}

  <h2>Known gaps</h2>
  <ul class="clean">
    <li class="card small"><strong>No outcome data.</strong> GOED publishes projections but not measured results, and
    does not break audit findings out by program. Promised-versus-delivered can only be shown program-wide.</li>
    <li class="card small"><strong>Confidential schedules.</strong> Applicants routinely request confidentiality under
    NRS 231.069 for their detailed capital equipment and employment schedules, so the year-by-year build-up behind each
    headline number is not public.</li>
    <li class="card small"><strong>Redemptions only for Reno.</strong> Awarded is not redeemed. Only the City of Reno
    has published what it actually forgave; every other jurisdiction is unknown.</li>
    <li class="card small"><strong>Personal property terms inferred.</strong> The FY2010–2022 report headers say
    10 years; the FY2023–24 report drops the term. Statute permits 10 or 20. Board packets confirm 10 years only for
    the three most recent awards.</li>
  </ul>
  <p><a class="btn" href="./data/discrepancies.csv" download>Download the ledger as CSV</a></p>`;
}

/* -------------------------------------------------------------- timeline --- */
function viewTimeline() {
  const rows = [...DB.policyTimeline].sort((a, b) => a.date.localeCompare(b.date));
  return `
  <h1>Policy timeline</h1>
  <p class="lede">How Nevada's data center abatement came to exist, and what has been changing around it.</p>
  <div class="timeline">${rows.map((e) => `<div class="tl-item">
    <div class="tl-date">${fmtDate(e.date)} · ${esc(e.category.replace("-", " "))}
      ${e.verification !== "primary" ? verificationBadge(e.verification) : ""}</div>
    <h3 style="margin:.2em 0">${esc(e.title)}</h3>
    ${e.citation ? `<p class="small mono muted" style="margin:0 0 .3em">${esc(e.citation)}</p>` : ""}
    ${e.notes ? `<p class="small" style="margin:0">${esc(e.notes)}</p>` : ""}
    ${e.source_id ? `<p class="src" style="margin:.4em 0 0">${srcLink(e.source_id)}</p>` : ""}
  </div>`).join("")}</div>`;
}

/* ----------------------------------------------------------------- about --- */
function viewAbout() {
  return `
  <h1>Methods, limits and downloads</h1>
  <p class="lede">This is an independent dataset assembled from primary public documents. It is not affiliated with
  the State of Nevada or GOED. Every row cites a source with a retrieval date, and every conflict between sources is
  recorded rather than resolved silently.</p>

  <h2>How a figure gets in</h2>
  <ol>
    <li><strong>Primary first.</strong> GOED board packets outrank GOED's reports to the Legislature, which outrank
    press releases, which outrank trade press.</li>
    <li><strong>Sourced, not computed.</strong> The CSVs hold what documents actually say. Anything derived —
    abatement per job, implied payroll, cumulative totals — is computed at build time and labelled.</li>
    <li><strong>Conflicts recorded.</strong> Where two official documents disagree, both values, both sources and the
    reasoning go in <a href="#/quality">the ledger</a>.</li>
    <li><strong>Validated in CI.</strong> Every column is schema-checked, references must resolve, and domain rules
    are enforced — fiscal years must match approval dates, and abatement components must sum to published totals.</li>
  </ol>

  <h2>What this does not tell you</h2>
  <ul class="clean">
    <li class="card small">Whether any company met its promises. That is not published.</li>
    <li class="card small">What each local government actually lost, outside the City of Reno.</li>
    <li class="card small">Facility-level power draw or water use, except where a company volunteers it.</li>
    <li class="card small">Abatements under other programs. A pre-2015 data center such as Apple's sits under the
    standard program and is out of scope for the NRS 360.754 table.</li>
  </ul>

  <h2>Download the data</h2>
  <div class="grid cols-2">
    <div class="card"><h3 style="margin-top:0">Bulk</h3><ul class="clean small">
      <li><a href="./exports/nv-datacenter-tracker.json">Everything as JSON</a></li>
      <li><a href="./exports/abatements.jsonl">Awards as JSONL</a></li>
      <li><a href="./exports/nv-datacenter-tracker.sql">SQLite/Postgres SQL dump</a></li>
      <li><a href="./datapackage.json">Frictionless Data Package</a></li>
    </ul></div>
    <div class="card"><h3 style="margin-top:0">Tables (CSV)</h3><ul class="clean small">
      ${Object.keys(DB.meta.rowCounts).map((t) =>
        `<li><a href="./data/${t}.csv">${t}.csv</a> <span class="faint">${DB.meta.rowCounts[t]} rows</span></li>`).join("")}
    </ul></div>
  </div>

  <h2>JSON API</h2>
  <p class="small">Static, versioned, CORS-open. No key required.</p>
  <div class="table-scroll"><table><thead><tr><th>Endpoint</th><th>Returns</th></tr></thead><tbody>
    <tr><td class="mono"><a href="./api/v1/all.json">/api/v1/all.json</a></td><td>Everything, including derived summaries</td></tr>
    <tr><td class="mono"><a href="./api/v1/summary.json">/api/v1/summary.json</a></td><td>Headline totals and aggregates</td></tr>
    <tr><td class="mono"><a href="./api/v1/abatements.json">/api/v1/abatements.json</a></td><td>All awards, derived fields included</td></tr>
    <tr><td class="mono">/api/v1/award/{id}.json</td><td>One award</td></tr>
    <tr><td class="mono"><a href="./api/v1/sources.json">/api/v1/sources.json</a></td><td>Every source document</td></tr>
    <tr><td class="mono"><a href="./api/v1/discrepancies.json">/api/v1/discrepancies.json</a></td><td>The data quality ledger</td></tr>
  </tbody></table></div>

  <h2>Sources</h2>
  <ul class="clean">${DB.sources.map((s) => `<li class="card small">
    <a href="${esc(s.url)}" rel="noopener"><strong>${esc(s.title)}</strong></a>
    ${badge(s.doc_type, s.doc_type.includes("news") ? "warn" : "ok")}
    <div class="muted">${esc(s.publisher)}${s.published ? ` · published ${fmtDate(s.published)}` : ""} · retrieved ${fmtDate(s.retrieved)}</div>
    ${s.notes ? `<div class="small" style="margin-top:4px">${esc(s.notes)}</div>` : ""}</li>`).join("")}</ul>

  <h2>Corrections</h2>
  <p>Found an error, or have a board packet this is missing? Open an issue with the source document and it will be
  fixed. Corrections to the underlying figures are the most valuable contribution you can make.</p>`;
}

/* ------------------------------------------------------- post-render wiring */
function afterRender(path, params) {
  const form = document.getElementById("filters");
  if (form) {
    const submit = () => {
      const q = new URLSearchParams();
      for (const [k, v] of new FormData(form).entries()) if (String(v).trim()) q.set(k, v);
      for (const k of ["sort", "dir"]) if (params.get(k)) q.set(k, params.get(k));
      location.hash = `#/awards${q.toString() ? "?" + q : ""}`;
    };
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    form.querySelectorAll("select").forEach((el) => el.addEventListener("change", submit));
    let timer;
    form.querySelector("#f-q")?.addEventListener("input", () => {
      clearTimeout(timer); timer = setTimeout(submit, 220);
    });
    form.querySelector("#f-reset")?.addEventListener("click", (e) => {
      e.preventDefault(); location.hash = "#/awards";
    });

    const dl = document.getElementById("dl");
    if (dl) {
      const q = (params.get("q") || "").toLowerCase();
      const rows = DB.abatements.filter((a) =>
        (!params.get("county") || a.county === params.get("county")) &&
        (!params.get("company") || a.companyId === params.get("company")) &&
        (!params.get("status") || a.status === params.get("status")) &&
        (!params.get("verification") || a.verification === params.get("verification")) &&
        (!q || [a.entityName, a.county, companyName(a.companyId), a.notes].join(" ").toLowerCase().includes(q)));
      dl.href = csvBlobUrl(rows, Object.keys(DB.abatements[0] ?? {}));
    }
  }
  if (!location.hash.includes("?")) scrollTo({ top: 0 });
}
