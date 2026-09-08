// Hash-routed static app over the generated JSON API. No framework.
import {
  fmtUsd, fmtNum, fmtWage, fmtPct, fmtGallons, fmtMonth, fmtDate,
  esc, badge, statusBadge, verificationBadge, severityBadge, csvBlobUrl,
} from "./format.js";
import {
  cumulativeChart, pairedColumns, barList, palette,
  gantt, scatter, dumbbell, lollipop, donut, treemap, stackedBars,
  proportionalCircles, heatmap,
} from "./charts.js";
import { choropleth, choroplethLegend, markerLegend } from "./map.js";

const main = document.getElementById("main");
let DB = null;
let FY = 2027;

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------------------------------------------- scroll & motion --- */
const topbar = document.querySelector(".topbar");
const toTop = document.getElementById("totop");
addEventListener("scroll", () => {
  topbar.classList.toggle("scrolled", scrollY > 4);
  toTop.classList.toggle("show", scrollY > 700);
}, { passive: true });
toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }));

/* --------------------------------------------------------- chart tooltips --- */
// Every chart shape carries an SVG <title> for accessibility, but the browser's
// own hover popup is slow and plain. Show a styled tooltip instead, hiding the
// native one by detaching its <title> for as long as ours is visible (restored
// on mouse-out, so keyboard/screen-reader access is untouched).
const chartTip = document.createElement("div");
chartTip.className = "chart-tip";
document.body.appendChild(chartTip);
let tipEl = null, tipTitle = null;

function findTitle(el) {
  for (let node = el, depth = 0; node && depth < 4 && !node.classList?.contains("chart"); node = node.parentElement, depth++) {
    const t = node.querySelector(":scope > title");
    if (t) return t;
  }
  return null;
}
function positionTip(x, y) {
  const pad = 14;
  chartTip.style.left = "0px"; chartTip.style.top = "0px"; // reset before measuring
  const r = chartTip.getBoundingClientRect();
  let left = x + pad, top = y + pad;
  if (left + r.width > innerWidth - 8) left = x - r.width - pad;
  if (top + r.height > innerHeight - 8) top = y - r.height - pad;
  chartTip.style.left = `${Math.max(4, left)}px`;
  chartTip.style.top = `${Math.max(4, top)}px`;
}
function hideTip() {
  if (tipEl && tipTitle) tipEl.prepend(tipTitle);
  tipEl = null; tipTitle = null;
  chartTip.classList.remove("show");
}
main.addEventListener("pointerover", (e) => {
  const el = e.target.closest?.(".chart rect, .chart circle, .chart path, .chart line");
  if (!el || el === tipEl) return;
  const title = findTitle(el);
  if (!title) return;
  if (tipEl) hideTip();
  tipEl = el; tipTitle = title;
  chartTip.textContent = title.textContent;
  title.remove();
  chartTip.classList.add("show");
  positionTip(e.clientX, e.clientY);
});
main.addEventListener("pointermove", (e) => { if (tipEl) positionTip(e.clientX, e.clientY); });
main.addEventListener("pointerout", (e) => {
  if (tipEl && e.target.closest?.(".chart rect, .chart circle, .chart path, .chart line") === tipEl
    && !tipEl.contains(e.relatedTarget)) hideTip();
});
addEventListener("scroll", () => { if (tipEl) hideTip(); }, { passive: true });

/* --------------------------------------------------------- timeline rail --- */
// The vertical rail on the policy timeline fills in step with how far the
// reader has scrolled through it, tracking the viewport rather than a fixed
// duration so it works the same at any scroll speed.
let timelineRaf = false;
function updateTimelineFill() {
  const fill = document.querySelector(".timeline-fill");
  if (!fill) return;
  const r = fill.parentElement.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (innerHeight - r.top) / (r.height + innerHeight)));
  fill.style.height = `${(pct * 100).toFixed(1)}%`;
}
addEventListener("scroll", () => {
  if (timelineRaf) return;
  timelineRaf = true;
  requestAnimationFrame(() => { timelineRaf = false; updateTimelineFill(); });
}, { passive: true });
addEventListener("resize", updateTimelineFill);

// Scroll-reveal is progressive enhancement over content that already exists in the
// DOM. If IntersectionObserver is ever unavailable, reveal everything immediately
// rather than leave data permanently hidden behind a broken animation.
const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          revealObserver.unobserve(e.target);
        }
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" })
  : { observe: (el) => el.classList.add("in-view") };

/** Animate a formatted stat value ("$1.36B", "13,245", "6.7 to 12%") up from zero. */
function countUp(el) {
  if (reduceMotion()) return;
  const text = el.textContent.trim();
  const m = text.match(/^(\D*)([\d,]*\.?\d+)(.*)$/);
  if (!m) return;
  const [, prefix, numStr, suffix] = m;
  const target = parseFloat(numStr.replace(/,/g, ""));
  if (!Number.isFinite(target)) return;
  const decimals = (numStr.split(".")[1] || "").length;
  const grouped = numStr.includes(",");
  const dur = 900, t0 = performance.now();
  (function frame(t) {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - (1 - p) ** 3;
    const val = target * eased;
    const numOut = decimals ? val.toFixed(decimals)
      : grouped ? Math.round(val).toLocaleString("en-US") : String(Math.round(val));
    el.textContent = `${prefix}${numOut}${suffix}`;
    if (p < 1) requestAnimationFrame(frame); else el.textContent = text;
  })(t0);
}
const countObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          countUp(e.target);
          countObserver.unobserve(e.target);
        }
      }
    }, { threshold: 0.4 })
  : { observe: () => {} };

/** Stagger cards/figures/list rows in as they scroll into view. */
function wireReveal() {
  const els = main.querySelectorAll(".card, figure.fig, .callout, .timeline > .tl-item, ul.clean > li");
  els.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.setProperty("--i", i % 10);
    revealObserver.observe(el);
  });
  main.querySelectorAll(".stat .value").forEach((el) => countObserver.observe(el));
}

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
  [/^\/map$/, (_, p) => viewMap(p)],
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
      hideTip(); // never let a stale tooltip from the outgoing page float over the next one
      main.innerHTML = fn(m, params);
      main.classList.remove("page-enter");
      void main.offsetWidth; // restart the entrance animation on every route change
      main.classList.add("page-enter");
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
    // Nevada's fiscal year starts in July.
    const d = new Date(db.meta.generated);
    FY = d.getUTCMonth() + 1 >= 7 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    const stamp = document.getElementById("build-stamp");
    if (stamp) {
      stamp.textContent = `Dataset ${db.meta.version}, built ${db.meta.generated.slice(0, 10)}. `
        + `${db.meta.totalRows} rows across ${Object.keys(db.meta.rowCounts).length} tables.`;
    }
    render();
  })
  .catch((err) => {
    main.innerHTML = `<h1>Could not load the dataset</h1>
      <p class="muted">${esc(err.message)}</p>
      <p>If you are running this locally, serve the folder over HTTP rather than opening the file directly:</p>
      <pre class="card mono">npm run serve</pre>`;
  });

/* --------------------------------------------------------------- helpers --- */
const srcLink = (id) => {
  const s = DB.sources.find((x) => x.source_id === id);
  return s ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a>` : esc(id);
};
const srcShort = (id) => {
  const s = DB.sources.find((x) => x.source_id === id);
  if (!s) return esc(id);
  const short = s.title.length > 54 ? s.title.slice(0, 52).trimEnd() + "…" : s.title;
  return `<a href="${esc(s.url)}" rel="noopener" title="${esc(s.title)}, ${esc(s.publisher)}">${esc(short)}</a>`;
};
const resolutionLabel = (r) =>
  r === "computed" ? "recomputed from the underlying figures"
    : r === "unresolved" ? "left unresolved"
    : DB.sources.find((x) => x.source_id === r) ? srcShort(r) : esc(r);

const companyName = (id) => DB.companies.find((c) => c.company_id === id)?.display_name ?? id;
const active = () => DB.abatements.filter((a) => a.status === "active");

const stat = (label, value, sub) =>
  `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

/** Chart wrapper: title, optional subtitle, body, optional source line. */
const fig = (title, sub, body, source) => `<figure class="fig">
  <figcaption><div class="fig-title">${title}</div>${sub ? `<div class="fig-sub">${sub}</div>` : ""}</figcaption>
  ${body}
  ${source ? `<div class="fig-source">${source}</div>` : ""}
</figure>`;

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
  const on = cur === key;
  const q = new URLSearchParams(params);
  q.set("sort", key);
  q.set("dir", on && dir === "asc" ? "desc" : "asc");
  const arrow = on ? (dir === "asc" ? " ▲" : " ▼") : "";
  return `<th class="sortable ${cls}"${on ? ` aria-sort="${dir === "asc" ? "ascending" : "descending"}"` : ""}>
    <a href="#/awards?${q}" style="color:inherit;text-decoration:none">${esc(label)}${arrow}</a></th>`;
}

/** County-keyed metric maps, reused by every map on the site. */
function countyMetrics() {
  const byCounty = DB.summary.byCounty;
  const pick = (fn) => Object.fromEntries(byCounty.map((c) => [c.key, fn(c)]));
  const facilities = {};
  for (const f of DB.facilities) facilities[f.county] = (facilities[f.county] ?? 0) + 1;
  return {
    abatement: pick((c) => c.totals.totalAbatement),
    capex: pick((c) => c.totals.capitalInvestment),
    jobs: pick((c) => c.totals.jobsPromised),
    awards: pick((c) => c.rows.length),
    facilities,
  };
}

const METRICS = {
  abatement: { label: "abatement approved", fmt: (v) => fmtUsd(v, true) },
  capex: { label: "capital investment promised", fmt: (v) => fmtUsd(v, true) },
  jobs: { label: "jobs promised", fmt: (v) => fmtNum(Math.round(v)) },
  awards: { label: "awards", fmt: (v) => fmtNum(Math.round(v)) },
  facilities: { label: "data centers listed", fmt: (v) => fmtNum(Math.round(v)) },
};

const MAP_CAVEAT = `Dots are placed at county centroids, not at street addresses:
  the state inventory records a county, not a location.`;

/* -------------------------------------------------------------- overview --- */
function viewOverview() {
  const t = DB.summary.totals;
  const act = active();
  const twenty = act.filter((a) => a.sutYears === 20);
  const m = countyMetrics();
  const findings = DB.accountabilityFindings;
  const audited = findings.find((f) => f.id === "audits-completed");
  const water23 = DB.water.find((w) => w.id === "google-storey-2023-withdrawn");
  const water24 = DB.water.find((w) => w.id === "google-storey-2024-withdrawn");
  const dt = DB.summary.deliveryTotals;
  const lastExpiry = Math.max(...act.map((a) => a.termEndsFiscalYear ?? 0));

  return `
  <div class="hero">
  <h1>Nevada's data center tax abatements</h1>
  <p class="lede">Since 2015 Nevada has approved <strong>${t.active} data center tax abatements</strong> under
  NRS 360.754, forgoing an estimated <strong>${fmtUsd(t.totalAbatement, true)}</strong> in state and local tax
  revenue in exchange for <strong>${fmtNum(t.jobsPromised)} promised permanent jobs</strong>. Every figure on
  this site links to the document it came from.</p>
  </div>

  <div class="grid stats">
    ${stat("Abatement approved", fmtUsd(t.totalAbatement, true), `${t.active} active, ${t.withdrawn} withdrawn`)}
    ${stat("Capital investment promised", fmtUsd(t.capitalInvestment, true), "over five years, per applications")}
    ${stat("Permanent jobs promised", fmtNum(t.jobsPromised), `${fmtUsd(t.abatementPerJob, true)} of abatement per job`)}
    ${stat("Locked in until", `FY${lastExpiry}`, `${twenty.length} award${twenty.length === 1 ? "" : "s"} on the 20 year tier`)}
  </div>

  <div class="callout warn">
    <h2>What the state does not measure</h2>
    <p class="small" style="margin-bottom:.4em">
      ${audited ? `As of ${esc(audited.as_of)}, only <strong>${audited.value} of 13</strong> active data center
      abatements had a completed audit.` : ""}
      GOED publishes each applicant's projected jobs, wages, capital investment and tax revenue, but does not
      publish measured outcomes against those projections. Construction worker residency data, which
      NRS 360.754 requires to be at least 50 percent Nevada residents, is not released.</p>
    <p class="small muted" style="margin:0">Source: ${srcLink("tni-dc-analysis")}</p>
  </div>

  <h2>Where the money goes</h2>
  <div class="fig-grid fig-grid-map">
    ${fig("Abatement approved by county",
      "Two counties hold every award. Click a county for its detail page.",
      choropleth(DB.geo, m.abatement, METRICS.abatement.fmt, {
        detail: Object.fromEntries(DB.summary.byCounty.map((c) =>
          [c.key, `${c.rows.length} awards, ${fmtNum(c.totals.jobsPromised)} jobs promised`])),
        label: "abatement approved", bubbles: true,
      }) + choroplethLegend(Object.values(m.abatement), METRICS.abatement.fmt, "Abatement approved"),
      `Circle area is proportional to value, because Storey County holds the largest share and is one of the
       smallest counties in the state. Boundaries: ${esc(DB.geo.attribution)}.
       <a href="#/map">Full map view</a>`)}

    <div>
      ${fig("Abatement approved by operator",
        "Area is proportional to approved value. Switch's two 2015 awards still dominate a decade later.",
        treemap(DB.summary.byCompany.map((c) => ({
          label: companyName(c.key), value: c.totals.totalAbatement,
          href: `#/company/${encodeURIComponent(c.key)}`,
        })), (v) => fmtUsd(v, true)))}

      ${fig("Abatement per promised job",
        "Each award's approved abatement divided by the jobs it committed to. The dashed line is the Tesla large investment award for comparison.",
        lollipop(active().filter((a) => a.abatementPerJob).map((a) => ({
          label: a.entityName, value: a.abatementPerJob,
          href: `#/award/${encodeURIComponent(a.id)}`,
        })), (v) => fmtUsd(v, true), { reference: { value: 190000, label: "Tesla, $190K" } }),
        `Tesla comparison from ${srcLink("tni-dc-analysis")}`)}
    </div>
  </div>

  ${fig("Approved abatement value over time",
    "Cumulative approved value of active awards by Nevada fiscal year, with the amount approved each year. Withdrawn awards are excluded.",
    cumulativeChart(DB.summary.cumulative, (v) => fmtUsd(v, true)))}

  ${fig("How long each abatement runs",
    `Every award, from board approval to the fiscal year its term expires. The ten year and twenty year tiers
     mean decisions made in 2015 still bind local revenue into the 2030s.`,
    gantt(DB.abatements.map((a, i) => ({
      label: a.entityName, start: a.fiscalYear,
      end: a.termEndsFiscalYear ?? a.fiscalYear + 10,
      value: a.totalAbatement ?? 0, status: a.status, colorIndex: i,
      href: `#/award/${encodeURIComponent(a.id)}`,
    })), (v) => fmtUsd(v, true), { currentFy: FY }),
    "Struck through and greyed: withdrawn after approval.")}

  <h2>Promised against delivered</h2>
  <div class="fig-grid">
    ${fig("Capital investment: projected against audited",
      `GOED's own audit figures, all abatement programs combined. Across FY2010 to FY2019 companies delivered
       ${fmtPct(dt.capexRatio, 0)} of the capital investment they projected.`,
      dumbbell(DB.programAudit.filter((r) => r.audit_state === "complete").map((r) => ({
        label: r.fiscal_year, a: Number(r.projected_capex_usd), b: Number(r.audited_capex_usd),
      })), (v) => fmtUsd(v, true), ["projected", "found at audit"]),
      `GOED does not break audit results out by program, so this covers standard, aviation and data center
       abatements together. Source: ${srcLink("goed-biennial-2023")}`)}

    ${fig("What each award actually abates",
      "Sales and use tax against personal property tax, per award. The sales tax reduction to 2 percent is the larger share in almost every case.",
      stackedBars(active().filter((a) => a.sut !== null && a.personalProperty !== null).map((a) => ({
        label: a.entityName, href: `#/award/${encodeURIComponent(a.id)}`,
        parts: [{ label: "sales and use tax", value: a.sut }, { label: "personal property tax", value: a.personalProperty }],
      })), (v) => fmtUsd(v, true), { partLabels: ["sales and use tax", "personal property tax"] }))}
  </div>

  <div>
    ${fig("Water use is climbing fast",
      "Google's Storey County facility is the only Nevada data center publishing facility level water data.",
      proportionalCircles([
        { label: "2023 withdrawn", value: Number(water23.gallons) },
        { label: "2024 withdrawn", value: Number(water24.gallons) },
        { label: "2023 consumed", value: 200000 },
        { label: "2024 consumed", value: 1500000 },
      ], fmtGallons),
      `Withdrawal rose ${DB.summary.waterGrowth}x in a single year.
       <a href="#/resources">Water and power detail</a>. Source: ${srcShort("lcb-datacenters-2026")}`)}
  </div>

  <h2>Start here</h2>
  <ul class="clean">
    <li class="card"><a href="#/map"><strong>The map</strong></a>, every county and all
      ${DB.facilities.length} data centers the state has counted, abated or not.</li>
    <li class="card"><a href="#/awards"><strong>Every award</strong></a>, filterable, sortable and downloadable.</li>
    <li class="card"><a href="#/quality"><strong>Data quality ledger</strong></a>,
      ${DB.discrepancies.length} documented conflicts between official sources, including
      ${DB.discrepancies.filter((d) => d.severity === "high").length} that change what the record says.</li>
    <li class="card"><a href="#/about"><strong>Methods and downloads</strong></a>, how this was built and what
      it does not cover, plus bulk data in CSV, JSON and SQL.</li>
  </ul>`;
}

/* ------------------------------------------------------------------- map --- */
function viewMap(params) {
  const metric = METRICS[params.get("metric")] ? params.get("metric") : "abatement";
  const m = countyMetrics();
  const values = m[metric];
  const cfg = METRICS[metric];

  const tabs = Object.entries(METRICS).map(([k, v]) =>
    `<a class="btn ${k === metric ? "primary" : ""}" href="#/map?metric=${k}">${esc(v.label)}</a>`).join(" ");

  const fyKeys = [...new Set(DB.abatements.map((a) => a.fiscalYear))].sort();
  const countyKeys = [...new Set(DB.abatements.map((a) => a.county))].sort();

  const detail = Object.fromEntries(DB.summary.byCounty.map((c) =>
    [c.key, `${c.rows.length} awards, ${fmtUsd(c.totals.totalAbatement, true)} abated, ${fmtNum(c.totals.jobsPromised)} jobs promised`]));

  return `
  <h1>The map</h1>
  <p class="lede">Nevada has 17 counties. Data center abatements have gone to exactly two of them, while
  announced and operating facilities reach into six. Shade the map by any metric.</p>

  <div class="controls">${tabs}</div>

  <div class="map-wide">
    ${fig(`Counties by ${esc(cfg.label)}`,
      `Circle area is proportional to ${esc(cfg.label)}. Small dots are every facility in the state
       inventory, coloured by status. Click a shaded county to open it.`,
      choropleth(DB.geo, values, cfg.fmt, {
        detail, label: cfg.label, markers: DB.facilities, bubbles: true,
      }) + choroplethLegend(Object.values(values), cfg.fmt, cfg.label) + markerLegend(),
      `Albers equal area projection, so shaded area is comparable between counties. Graduated circles carry
       the magnitude because county size and abatement value are unrelated. ${esc(MAP_CAVEAT)}
       Boundaries: ${esc(DB.geo.attribution)}`)}
  </div>

  <div class="fig-grid">
    <div>
      ${fig("Awards by fiscal year and county",
        "Where and when the state committed. Blank means no award that year.",
        heatmap(countyKeys, fyKeys, (c, fy) =>
          DB.abatements.filter((a) => a.county === c && a.fiscalYear === fy)
            .reduce((s, a) => s + (a.totalAbatement ?? 0), 0),
          (v) => fmtUsd(v, true), { title: "Abatement by county and fiscal year" }))}

      ${fig("Facilities counted by the Legislature",
        `${DB.facilities.length} locations, operating or announced. Most hold no abatement at all.`,
        barList(Object.entries(
          DB.facilities.reduce((acc, f) => {
            acc[f.county] = acc[f.county] || { operational: 0, planned: 0, unknown: 0 };
            acc[f.county][f.status]++;
            return acc;
          }, {})).map(([county, s]) => ({
            label: esc(county), value: s.operational + s.planned + s.unknown,
            href: `#/county/${encodeURIComponent(county)}`,
            note: `· ${s.operational} operating, ${s.planned} planned${s.unknown ? `, ${s.unknown} unclassified` : ""}`,
          })).sort((a, b) => b.value - a.value), (v) => `${v}`),
        `Source: ${srcLink("lcb-datacenters-2026")}`)}
    </div>
  </div>

  ${fig("Every county", "Abated and unabated together, so the absences are visible too.",
    countyTable())}`;
}

function countyTable() {
  const m = countyMetrics();
  const names = DB.geo.counties.map((c) => c.name);
  return `<div class="table-scroll"><table>
    <thead><tr><th>County</th><th class="num">Awards</th><th class="num">Abatement</th>
      <th class="num">Capital investment</th><th class="num">Jobs</th>
      <th class="num">Facilities</th><th class="num">Land (sq mi)</th></tr></thead>
    <tbody>${DB.geo.counties.map((c) => {
      const has = m.awards[c.name];
      return `<tr>
        <td>${has ? `<a href="#/county/${encodeURIComponent(c.name)}">${esc(c.name)}</a>` : esc(c.name)}</td>
        <td class="num">${m.awards[c.name] ?? "n/a"}</td>
        <td class="num">${m.abatement[c.name] ? fmtUsd(m.abatement[c.name], true) : "n/a"}</td>
        <td class="num">${m.capex[c.name] ? fmtUsd(m.capex[c.name], true) : "n/a"}</td>
        <td class="num">${m.jobs[c.name] ? fmtNum(m.jobs[c.name]) : "n/a"}</td>
        <td class="num">${m.facilities[c.name] ?? "n/a"}</td>
        <td class="num faint">${fmtNum(c.landSqMi)}</td></tr>`;
    }).join("")}</tbody></table></div>`;
}

/* ---------------------------------------------------------------- awards --- */
function filteredAwards(params) {
  const q = (params.get("q") || "").toLowerCase();
  return DB.abatements.filter((a) =>
    (!params.get("county") || a.county === params.get("county")) &&
    (!params.get("company") || a.companyId === params.get("company")) &&
    (!params.get("status") || a.status === params.get("status")) &&
    (!params.get("verification") || a.verification === params.get("verification")) &&
    (!q || [a.entityName, a.county, companyName(a.companyId), a.notes].join(" ").toLowerCase().includes(q)));
}

function viewAwards(params) {
  const sort = params.get("sort") || "fiscalYear";
  const dir = params.get("dir") || "desc";
  const rows = sortRows(filteredAwards(params), sort, dir);

  const opts = (vals, cur) => `<option value="">All</option>` + vals.map((v) =>
    `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(v)}</option>`).join("");
  const counties = [...new Set(DB.abatements.map((a) => a.county))].sort();
  const companies = [...new Set(DB.abatements.map((a) => a.companyId))].sort();
  const withBoth = rows.filter((a) => a.capitalInvestment && a.jobsPromised);

  return `
  <h1>All awards</h1>
  <p class="lede">Every data center abatement approved by the GOED board under NRS 360.754. Click an entity for
  its full record and provenance.</p>

  <form class="controls" id="filters">
    <div class="field"><label for="f-q">Search</label>
      <div class="search-wrap">
        <input type="search" id="f-q" name="q" value="${esc(params.get("q") || "")}" placeholder="entity, operator, note">
        <button type="button" class="search-clear" aria-label="Clear search"${params.get("q") ? "" : ' hidden'}>&times;</button>
      </div></div>
    <div class="field"><label for="f-county">County</label><select id="f-county" name="county">${opts(counties, params.get("county") || "")}</select></div>
    <div class="field"><label for="f-company">Operator</label>
      <select id="f-company" name="company"><option value="">All</option>${companies.map((c) =>
        `<option value="${esc(c)}"${c === params.get("company") ? " selected" : ""}>${esc(companyName(c))}</option>`).join("")}</select></div>
    <div class="field"><label for="f-status">Status</label><select id="f-status" name="status">${opts(["active", "withdrawn"], params.get("status") || "")}</select></div>
    <div class="field"><label for="f-verification">Sourcing</label><select id="f-verification" name="verification">${opts(["primary", "secondary", "unverified"], params.get("verification") || "")}</select></div>
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
      <td class="num">${a.sutYears ?? "n/a"}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${verificationBadge(a.verification)}</td>
    </tr>`).join("")}</tbody>
  </table></div>
  <p class="small faint">* published as a total only. The split between sales and use tax and personal property
  tax is not in the public record.</p>

  <h2>The same awards, seen differently</h2>
  <div class="fig-grid">
    ${fig("Investment against jobs",
      "Bubble area is the approved abatement. The cluster at the bottom is the recent pattern: large capital, very few jobs.",
      scatter(withBoth.map((a) => ({
        x: a.capitalInvestment, y: a.jobsPromised, r: a.totalAbatement ?? 1,
        label: `${a.entityName} (FY${a.fiscalYear})`, href: `#/award/${encodeURIComponent(a.id)}`,
      })), {
        xLabel: "capital investment promised", yLabel: "jobs promised",
        xFmt: (v) => fmtUsd(v, true), yFmt: (v) => fmtNum(Math.round(v)), rFmt: (v) => fmtUsd(v, true),
      }))}

    ${fig("Term length by award",
      "Ten year and twenty year tiers, drawn to scale against the fiscal years they cover.",
      gantt(rows.map((a, i) => ({
        label: a.entityName, start: a.fiscalYear, end: a.termEndsFiscalYear ?? a.fiscalYear + 10,
        value: a.totalAbatement ?? 0, status: a.status, colorIndex: i,
        href: `#/award/${encodeURIComponent(a.id)}`,
      })), (v) => fmtUsd(v, true), { currentFy: FY }))}
  </div>`}`;
}

/* ---------------------------------------------------------- award detail --- */
function viewAward(id) {
  const a = DB.abatements.find((x) => x.id === decodeURIComponent(id));
  if (!a) return `<h1>Award not found</h1><p><a href="#/awards">Back to all awards</a>.</p>`;
  const co = DB.companies.find((c) => c.company_id === a.companyId);
  const related = DB.discrepancies.filter((d) => d.subject_id === a.id);
  const wage = DB.statewideWage.find((w) => Number(w.fiscal_year) === a.fiscalYear);
  const peers = active().filter((x) => x.abatementPerJob);

  return `
  <p class="crumb"><a href="#/awards">All awards</a> → FY${a.fiscalYear}</p>
  <h1>${esc(a.entityName)}</h1>
  <div class="tag-row">
    ${statusBadge(a.status)} ${verificationBadge(a.verification)}
    ${badge(a.awardType, "neutral")} ${badge(`${a.sutYears ?? "?"} year term`, "accent")}
    ${badge(a.county + " County", "neutral")}
  </div>

  <div class="grid stats">
    ${stat("Total abatement", fmtUsd(a.totalAbatement), a.totalIsReported ? "published as a total" : "sales and use plus personal property")}
    ${stat("Per promised job", fmtUsd(a.abatementPerJob), `${fmtNum(a.jobsPromised)} jobs`)}
    ${stat("Capital investment", fmtUsd(a.capitalInvestment, true), "committed over five years")}
    ${stat("Abatement per $1 capex", a.abatementPerCapexDollar !== null ? `${(a.abatementPerCapexDollar * 100).toFixed(1)}¢` : "n/a", "share of investment forgone in tax")}
  </div>

  <div class="fig-grid" style="margin-top:18px">
    ${a.sut !== null && a.personalProperty !== null ? fig("Composition",
      "Which taxes this award abates.",
      donut([
        { label: "Sales and use tax", value: a.sut },
        { label: "Personal property tax", value: a.personalProperty },
      ], (v) => fmtUsd(v, true), {
        centre: fmtUsd(a.totalAbatement, true), centreSub: `over ${a.sutYears} years`,
        title: "Abatement composition",
      })) : ""}

    ${a.abatementPerJob ? fig("How it compares",
      "Abatement per promised job against every other active award.",
      lollipop(peers.map((x) => ({
        label: x.id === a.id ? `▶ ${x.entityName}` : x.entityName,
        value: x.abatementPerJob,
        href: `#/award/${encodeURIComponent(x.id)}`,
      })), (v) => fmtUsd(v, true))) : ""}
  </div>

  <h2>The record</h2>
  <dl class="dl">
    <dt>Operator</dt><dd><a href="#/company/${encodeURIComponent(a.companyId)}">${esc(companyName(a.companyId))}</a>${co?.parent_company && co.parent_company !== co.display_name ? `, parent ${esc(co.parent_company)} <span class="badge b-${co.parent_confidence === "confirmed" ? "ok" : "warn"}">${esc(co.parent_confidence)}</span>` : ""}</dd>
    <dt>Approved</dt><dd>${fmtMonth(a.approvedDate)} (Nevada FY${a.fiscalYear})</dd>
    <dt>Program</dt><dd>${a.program === "nrs-360-754" ? "Data center abatement, NRS 360.754" : esc(a.program)}</dd>
    <dt>Sales and use tax</dt><dd>${fmtUsd(a.sut)}${a.sutYears ? `, over ${a.sutYears} years, rate reduced to 2 percent` : ""}</dd>
    <dt>Personal property tax</dt><dd>${fmtUsd(a.personalProperty)}${a.ppYears ? `, over ${a.ppYears} years, 75 percent abated` : ""}</dd>
    <dt>Jobs promised</dt><dd>${fmtNum(a.jobsPromised)} full time Nevada residents within five years</dd>
    <dt>Average wage promised</dt><dd>${fmtWage(a.avgWage)} per hour${a.statutoryWage ? `, against a statutory floor of ${fmtWage(a.statutoryWage)}` : wage ? ` (FY${a.fiscalYear} statutory floor ${fmtWage(Number(wage.statewide_avg_wage_usd))})` : ""}${a.wagePremium ? `, ${a.wagePremium.toFixed(2)}x the floor` : ""}</dd>
    <dt>Implied annual payroll</dt><dd>${fmtUsd(a.annualWageBill)} <span class="faint small">computed as jobs x wage x 2,080 hours</span></dd>
    <dt>Term ends</dt><dd>${a.termEndsFiscalYear ? `FY${a.termEndsFiscalYear}` : "n/a"}</dd>
    <dt>Source</dt><dd>${srcLink(a.sourceId)}${a.sourcePage ? `, p.${esc(a.sourcePage)}` : ""}</dd>
  </dl>

  ${a.notes ? `<div class="callout"><h3>Notes</h3><p class="small" style="margin:0">${esc(a.notes)}</p></div>` : ""}
  ${related.length ? `<h2>Source conflicts affecting this award</h2>${discrepancyCards(related)}` : ""}
  <p><a class="btn" href="./api/v1/award/${encodeURIComponent(a.id)}.json">This record as JSON</a></p>`;
}

/* ------------------------------------------------------------- companies --- */
function viewCompanies() {
  const rows = DB.summary.byCompany.map((c) => ({
    ...c, co: DB.companies.find((x) => x.company_id === c.key) || {},
  })).sort((a, b) => b.totals.totalAbatement - a.totals.totalAbatement);

  return `
  <h1>Operators</h1>
  <p class="lede">Abatement applications are filed by single purpose entities whose names rarely match the
  operator, and never name the ultimate parent. This resolves entities to operators and flags how solid each
  attribution is.</p>

  <div class="fig-grid">
    ${fig("Share of approved abatement", "Area proportional to approved value.",
      treemap(rows.map((r) => ({
        label: r.co.display_name ?? r.key, value: r.totals.totalAbatement,
        href: `#/company/${encodeURIComponent(r.key)}`,
      })), (v) => fmtUsd(v, true)))}
    ${fig("Abatement per promised job, by operator",
      "Jobs committed across all of an operator's awards, divided into its total abatement.",
      lollipop(rows.filter((r) => r.totals.abatementPerJob).map((r) => ({
        label: r.co.display_name ?? r.key, value: r.totals.abatementPerJob,
        href: `#/company/${encodeURIComponent(r.key)}`,
      })), (v) => fmtUsd(v, true)))}
  </div>

  <div class="table-scroll"><table>
    <thead><tr><th>Operator</th><th>Parent</th><th>Attribution</th><th>HQ</th>
      <th class="num">Awards</th><th class="num">Abatement</th><th class="num">Jobs</th><th class="num">Per job</th></tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td><a href="#/company/${encodeURIComponent(r.key)}">${esc(r.co.display_name ?? r.key)}</a></td>
      <td>${esc(r.co.parent_company || "n/a")}</td>
      <td>${badge(r.co.parent_confidence ?? "unknown", r.co.parent_confidence === "confirmed" ? "ok" : r.co.parent_confidence === "reported" ? "warn" : "danger")}</td>
      <td>${esc([r.co.hq_city, r.co.hq_state].filter(Boolean).join(", ") || "n/a")}</td>
      <td class="num">${r.rows.length}</td>
      <td class="num">${fmtUsd(r.totals.totalAbatement, true)}</td>
      <td class="num">${fmtNum(r.totals.jobsPromised)}</td>
      <td class="num">${fmtUsd(r.totals.abatementPerJob, true)}</td>
    </tr>`).join("")}</tbody></table></div>
  <p class="small muted">Operators listed in Nevada's facility inventory without an abatement do not appear
  here. See <a href="#/map">the map</a> for the full facility list.</p>`;
}

function viewCompany(id) {
  const cid = decodeURIComponent(id);
  const co = DB.companies.find((c) => c.company_id === cid);
  if (!co) return `<h1>Operator not found</h1><p><a href="#/companies">Back to operators</a>.</p>`;
  const awards = DB.abatements.filter((a) => a.companyId === cid);
  const token = co.display_name.split(/[ ,(]/)[0].toLowerCase();
  const facilities = DB.facilities.filter((f) => f.company.toLowerCase().includes(token));
  const g = DB.summary.byCompany.find((c) => c.key === cid);
  const counties = Object.fromEntries(
    [...new Set(awards.filter((a) => a.status === "active").map((a) => a.county))]
      .map((c) => [c, awards.filter((a) => a.county === c && a.status === "active")
        .reduce((s, a) => s + (a.totalAbatement ?? 0), 0)]));

  return `
  <p class="crumb"><a href="#/companies">Operators</a></p>
  <h1>${esc(co.display_name)}</h1>
  <div class="tag-row">
    ${badge(`parent: ${co.parent_company || "unknown"}`, co.parent_confidence === "confirmed" ? "ok" : "warn")}
    ${badge(co.parent_confidence, co.parent_confidence === "confirmed" ? "ok" : "warn")}
    ${co.website ? `<a class="badge b-neutral" href="${esc(co.website)}" rel="noopener">website</a>` : ""}
  </div>
  ${co.ownership_note ? `<p class="lede">${esc(co.ownership_note)}</p>` : ""}

  ${g ? `<div class="grid stats">
    ${stat("Awards", String(awards.length), `${g.totals.withdrawn} withdrawn`)}
    ${stat("Abatement value", fmtUsd(g.totals.totalAbatement, true))}
    ${stat("Jobs promised", fmtNum(g.totals.jobsPromised))}
    ${stat("Per promised job", fmtUsd(g.totals.abatementPerJob, true))}
  </div>` : ""}

  <div class="fig-grid" style="margin-top:18px">
    ${Object.keys(counties).length ? fig("Where its awards are",
      "Shaded by this operator's approved abatement.",
      choropleth(DB.geo, counties, (v) => fmtUsd(v, true), {
        label: "abatement approved", bubbles: true,
      })) : ""}
    ${fig("Its awards over time",
      "Term length per award, drawn against the fiscal years covered.",
      gantt(awards.map((a, i) => ({
        label: a.entityName, start: a.fiscalYear, end: a.termEndsFiscalYear ?? a.fiscalYear + 10,
        value: a.totalAbatement ?? 0, status: a.status, colorIndex: i,
        href: `#/award/${encodeURIComponent(a.id)}`,
      })), (v) => fmtUsd(v, true), { currentFy: FY }))}
  </div>

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
    <strong>${esc(f.company)}</strong>, ${esc(f.county)} County ${badge(f.status, f.status === "operational" ? "ok" : f.status === "planned" ? "warn" : "neutral")}
    ${f.note ? `<div class="muted">${esc(f.note)}</div>` : ""}</li>`).join("")}</ul>
  <p class="small muted">Matched by name against ${srcLink("lcb-datacenters-2026")}. A facility here does not
  imply an abatement.</p>` : ""}`;
}

/* -------------------------------------------------------------- counties --- */
function viewCounties() {
  const m = countyMetrics();
  const fys = [...new Set(DB.redemptions.map((r) => r.fiscal_year))].sort();
  const dcTotal = DB.redemptions.filter((r) => r.program === "data-center")
    .reduce((a, r) => a + Number(r.amount_usd), 0);

  return `
  <h1>Counties</h1>
  <p class="lede">Abatements are approved by the state, but the revenue is forgone locally. Sales and use tax
  abatements reduce receipts for every local government through the Consolidated Tax formula, and personal
  property abatements hit the jurisdiction where the equipment sits.</p>

  <div class="fig-grid">
    ${fig("Abatement approved by county", "Click a shaded county to open it.",
      choropleth(DB.geo, m.abatement, (v) => fmtUsd(v, true), {
        detail: Object.fromEntries(DB.summary.byCounty.map((c) =>
          [c.key, `${c.rows.length} awards`])),
        label: "abatement approved", bubbles: true,
      }) + choroplethLegend(Object.values(m.abatement), (v) => fmtUsd(v, true), "Abatement approved"),
      `Circle area is proportional to value. Boundaries: ${esc(DB.geo.attribution)}`)}

    ${fig("City of Reno, abatements actually redeemed",
      `Awarded is a ceiling. Redeemed is what a jurisdiction actually forgave. Reno is the only Nevada local
       government that publishes it: ${fmtUsd(dcTotal)} of data center abatements across FY2017 to FY2024.`,
      pairedColumns(fys.map((fy) => ({
        label: fy,
        a: DB.redemptions.filter((r) => r.fiscal_year === fy && r.program !== "data-center")
          .reduce((s, r) => s + Number(r.amount_usd), 0),
        b: Number(DB.redemptions.find((r) => r.fiscal_year === fy && r.program === "data-center")?.amount_usd || 0),
      })), (v) => fmtUsd(v, true), ["other programs", "data centers"]),
      `Source: ${srcLink("reno-goed-memo-2025")}`)}
  </div>

  ${fig("Every county", "Abated and unabated together.", countyTable())}`;
}

function viewCounty(name) {
  const g = DB.summary.byCounty.find((c) => c.key === name);
  const awards = DB.abatements.filter((a) => a.county === name);
  const facilities = DB.facilities.filter((f) => f.county === name);
  const water = DB.water.filter((w) => w.county === name);
  const geoRow = DB.geo.counties.find((c) => c.name === name);

  return `
  <p class="crumb"><a href="#/counties">Counties</a> · <a href="#/map">Map</a></p>
  <h1>${esc(name)} County</h1>
  ${g ? `<div class="grid stats">
    ${stat("Awards", String(awards.length))}
    ${stat("Abatement value", fmtUsd(g.totals.totalAbatement, true))}
    ${stat("Capital investment", fmtUsd(g.totals.capitalInvestment, true))}
    ${stat("Jobs promised", fmtNum(g.totals.jobsPromised))}
  </div>` : `<p class="lede">No data center abatements recorded in this county.</p>`}

  <div class="fig-grid" style="margin-top:18px">
    ${fig(`${esc(name)} County in Nevada`,
      `${geoRow ? `${fmtNum(geoRow.landSqMi)} square miles of land.` : ""} ${facilities.length} data center${facilities.length === 1 ? "" : "s"} in the state inventory.`,
      choropleth(DB.geo, { [name]: 1 }, () => "", { label: "this county", markers: facilities })
        + markerLegend(),
      esc(MAP_CAVEAT))}

    ${awards.length ? fig("Abatement terms in this county", "From approval to expiry.",
      gantt(awards.map((a, i) => ({
        label: a.entityName, start: a.fiscalYear, end: a.termEndsFiscalYear ?? a.fiscalYear + 10,
        value: a.totalAbatement ?? 0, status: a.status, colorIndex: i,
        href: `#/award/${encodeURIComponent(a.id)}`,
      })), (v) => fmtUsd(v, true), { currentFy: FY })) : ""}
  </div>

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

  ${water.length ? `<h2>Water</h2>
  ${fig("Recorded water figures", "Facility observations and planning estimates for this county.",
    proportionalCircles(water.map((w) => ({
      label: `${w.subject.replace(/ (County|Nevada)$/, "")} ${w.year} ${w.metric.replace("_", " ")}`,
      value: Number(w.gallons),
    })), fmtGallons),
    `Sources: ${[...new Set(water.map((w) => w.source_id))].map(srcShort).join(", ")}`)}` : ""}`;
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
  <p class="lede">Abatement filings say almost nothing about resource use. These figures come from utility
  filings, company environmental reports and local planning documents, compiled in the Legislature's own
  March 2026 briefing.</p>

  <div class="grid stats">
    ${stat("Power requested", `${gw.value} GW`, "roughly a dozen data centers, within a decade")}
    ${stat("US electricity share 2023", "4.4%", "up from 1.9% in 2019")}
    ${stat("Projected by 2028", "6.7 to 12%", "of all US electricity")}
    ${stat("Cooling", "40%+", "of a data center's power draw")}
  </div>
  <p class="small muted">${esc(gw.notes)} Source: ${srcLink(gw.source_id)}</p>

  <div class="fig-grid">
    ${fig("Nevada data center water, to scale",
      "Circle area is proportional to gallons. Google's southern Nevada site dwarfs every published northern figure.",
      proportionalCircles(facility.map((w) => ({
        label: `${w.subject.replace(/ (southern Nevada|Storey County)$/, "")} ${w.year}`,
        value: Number(w.gallons),
      })), fmtGallons),
      `Withdrawn is water taken from a source; consumed is water not returned to it. Most Nevada data centers
       publish neither. Source: ${srcLink("lcb-datacenters-2026")}`)}

    ${fig("What powers them, nationally",
      "There is no Nevada specific generation mix for data centers in the public record.",
      donut(mix.map((s) => ({ label: s.subject, value: Number(s.value) })), (v) => `${v}%`,
        { centre: "100%", centreSub: "of supply", title: "Generation mix" }),
      `IEA figures via ${srcShort("lcb-datacenters-2026")}`)}
  </div>

  ${fig("For scale, annual use",
    "A single planned Washoe County data center against everyday Nevada buildings, and the threshold that triggers regional review.",
    lollipop(bench.map((b) => ({ label: b.subject, value: Number(b.gallons) })), fmtGallons),
    `City of Reno and TMRPA planning comparisons. Nevada is the driest state in the nation and over half its
     groundwater basins are over-appropriated. Source: ${srcLink("lcb-datacenters-2026")}`)}

  ${fig("US data center share of national electricity",
    "Measured for 2019 and 2023; low and high scenarios for 2028.",
    barList(shares.map((s) => ({
      label: `${s.year}${s.id.includes("low") ? " low" : s.id.includes("high") ? " high" : ""}`,
      value: Number(s.value),
    })), (v) => `${v}%`, { mono: true }),
    `Lawrence Berkeley National Laboratory via ${srcShort("lcb-datacenters-2026")}`)}

  <h2>Every water figure on record</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>Subject</th><th>County</th><th class="num">Year</th><th>Metric</th><th class="num">Gallons</th><th>Source</th></tr></thead>
    <tbody>${DB.water.map((w) => `<tr>
      <td>${esc(w.subject)}</td><td>${esc(w.county || "n/a")}</td><td class="num">${w.year}</td>
      <td>${esc(w.metric.replace("_", " "))}</td><td class="num">${fmtGallons(Number(w.gallons))}</td>
      <td>${srcShort(w.source_id)}</td></tr>`).join("")}</tbody></table></div>`;
}

/* --------------------------------------------------------------- quality --- */
function discrepancyCards(rows) {
  return `<ul class="clean">${rows.map((d) => `<li class="card">
    <div class="tag-row" style="margin:0 0 8px">${severityBadge(d.severity)}
      <span class="badge b-neutral">${esc(d.field)}</span>
      ${d.subject_id ? `<a class="badge b-accent" href="#/award/${encodeURIComponent(d.subject_id)}">${esc(d.subject_id)}</a>` : ""}
      ${badge(d.resolution === "unresolved" ? "unresolved" : "resolved", d.resolution === "unresolved" ? "warn" : "ok")}</div>
    <div class="table-scroll" style="margin-bottom:10px"><table><tbody>
      <tr><td class="mono wrap-any">${esc(d.value_a)}</td><td class="small wrap-any">${srcShort(d.source_a) || esc(d.source_a)}</td></tr>
      <tr><td class="mono wrap-any">${esc(d.value_b)}</td><td class="small wrap-any">${srcShort(d.source_b) || esc(d.source_b)}</td></tr>
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
  const order = { high: 0, medium: 1, low: 2 };

  return `
  <h1>Data quality ledger</h1>
  <p class="lede">Official sources disagree with each other. Rather than silently pick a value, this project
  records every conflict it found, which source it follows, and why. ${d.length} conflicts are documented
  below, ${bySev("high").length} of which change what the public record says.</p>

  <div class="grid stats">
    ${stat("Documented conflicts", String(d.length), `${bySev("high").length} high, ${bySev("medium").length} medium, ${bySev("low").length} low`)}
    ${stat("Awards on primary sources", `${DB.abatements.length - unverified.length}/${DB.abatements.length}`, `${unverified.length} still need a primary document`)}
    ${stat("Parent attributions unconfirmed", String(unknownParents.length), `of ${DB.companies.length} operators`)}
    ${stat("Facilities unclassified", String(lowConf.length), "status could not be read reliably")}
  </div>

  <div class="fig-grid">
    ${fig("Conflicts by severity", "High severity means the published record is wrong, not merely unclear.",
      donut(["high", "medium", "low"].map((s) => ({ label: `${s} severity`, value: bySev(s).length }))
        .filter((s) => s.value), (v) => `${v}`,
        { centre: String(d.length), centreSub: "conflicts", title: "Conflicts by severity" }))}
    ${fig("Sourcing strength by award", "Primary means a GOED document. Secondary means trade press only.",
      barList(["primary", "secondary", "unverified"].map((v) => ({
        label: v, value: DB.abatements.filter((a) => a.verification === v).length,
      })).filter((r) => r.value), (v) => `${v} award${v === 1 ? "" : "s"}`))}
  </div>

  <div class="callout warn">
    <h2>The largest single finding</h2>
    <p class="small" style="margin:0">GOED's FY2023 to FY2024 report to the Legislature places Novva's FY2024
    award in <strong>Clark County</strong> under the entity <strong>Novva Holdings, LLC</strong>. GOED's own
    board packet for the same award, identical to the dollar in both tax figures, describes a
    300,000 square foot facility in <strong>Storey County</strong> filed as
    <strong>Novva Reno, LLC</strong>. Both the county and the entity in the legislative report are wrong.</p>
  </div>

  <h2>All documented conflicts</h2>
  ${discrepancyCards([...d].sort((a, b) => order[a.severity] - order[b.severity]))}

  ${unverified.length ? `<h2>Awards still needing a primary source</h2>
  <ul class="clean">${unverified.map((a) => `<li class="card small">
    <a href="#/award/${encodeURIComponent(a.id)}"><strong>${esc(a.entityName)}</strong></a>, FY${a.fiscalYear},
    ${esc(a.county)} County ${verificationBadge(a.verification)}
    <div class="muted">${esc(a.notes)}</div></li>`).join("")}</ul>` : ""}

  <h2>Known gaps</h2>
  <ul class="clean">
    <li class="card small"><strong>No outcome data.</strong> GOED publishes projections but not measured
    results, and does not break audit findings out by program. Promised against delivered can only be shown
    program wide.</li>
    <li class="card small"><strong>Confidential schedules.</strong> Applicants routinely request
    confidentiality under NRS 231.069 for their detailed capital equipment and employment schedules, so the
    year by year build up behind each headline number is not public.</li>
    <li class="card small"><strong>Redemptions only for Reno.</strong> Awarded is not redeemed. Only the City
    of Reno has published what it actually forgave; every other jurisdiction is unknown.</li>
    <li class="card small"><strong>Personal property terms inferred.</strong> The FY2010 to FY2022 report
    headers say 10 years; the FY2023 to FY2024 report drops the term. Statute permits 10 or 20. Board packets
    confirm 10 years only for the three most recent awards.</li>
    <li class="card small"><strong>County level map precision.</strong> ${esc(MAP_CAVEAT)}</li>
  </ul>
  <p><a class="btn" href="./data/discrepancies.csv" download>Download the ledger as CSV</a></p>`;
}

/* -------------------------------------------------------------- timeline --- */
function viewTimeline() {
  const rows = [...DB.policyTimeline].sort((a, b) => a.date.localeCompare(b.date));
  const cumulative = DB.summary.cumulative;
  return `
  <h1>Policy timeline</h1>
  <p class="lede">How Nevada's data center abatement came to exist, and what has been changing around it.</p>

  ${fig("Approved value against the policy record",
    "The 2015 statute is the whole story: two awards in its first year account for more than half of everything approved since.",
    cumulativeChart(cumulative, (v) => fmtUsd(v, true)))}

  <h2>Every event, in order</h2>
  <div class="timeline"><div class="timeline-fill"></div>${rows.map((e) => `<div class="tl-item">
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
  <p class="lede">This is an independent dataset assembled from primary public documents. It is not affiliated
  with the State of Nevada or GOED. Every row cites a source with a retrieval date, and every conflict between
  sources is recorded rather than resolved silently.</p>

  <h2>How a figure gets in</h2>
  <ol>
    <li><strong>Primary first.</strong> GOED board packets outrank GOED's reports to the Legislature, which
    outrank press releases, which outrank trade press.</li>
    <li><strong>Sourced, not computed.</strong> The CSVs hold what documents actually say. Anything derived,
    such as abatement per job, implied payroll or cumulative totals, is computed at build time and labelled.</li>
    <li><strong>Conflicts recorded.</strong> Where two official documents disagree, both values, both sources
    and the reasoning go in <a href="#/quality">the ledger</a>.</li>
    <li><strong>Validated in CI.</strong> Every column is schema checked, references must resolve, and domain
    rules are enforced: fiscal years must match approval dates, and abatement components must sum to published
    totals.</li>
  </ol>

  <h2>Maps</h2>
  <p class="small">County boundaries come from ${esc(DB.geo.attribution)}, projected at build time with an
  Albers equal area conic so shaded area is comparable between counties. ${esc(DB.geo.processing)}
  ${esc(MAP_CAVEAT)}</p>

  <h2>What this does not tell you</h2>
  <ul class="clean">
    <li class="card small">Whether any company met its promises. That is not published.</li>
    <li class="card small">What each local government actually lost, outside the City of Reno.</li>
    <li class="card small">Facility level power draw or water use, except where a company volunteers it.</li>
    <li class="card small">Abatements under other programs. A pre 2015 data center such as Apple's sits under
    the standard program and is out of scope for the NRS 360.754 table.</li>
  </ul>

  <h2>Download the data</h2>
  <div class="fig-grid">
    <div class="card"><h3 style="margin-top:0">Bulk</h3><ul class="clean small">
      <li><a href="./exports/nv-datacenter-tracker.json">Everything as JSON</a></li>
      <li><a href="./exports/abatements.jsonl">Awards as JSONL</a></li>
      <li><a href="./exports/nv-datacenter-tracker.sql">SQLite or Postgres SQL dump</a></li>
      <li><a href="./datapackage.json">Frictionless Data Package</a></li>
      <li><a href="./data/geo/nv-counties.geojson">Nevada counties GeoJSON</a></li>
    </ul></div>
    <div class="card"><h3 style="margin-top:0">Tables (CSV)</h3><ul class="clean small">
      ${Object.keys(DB.meta.rowCounts).map((t) =>
        `<li><a href="./data/${t}.csv">${t}.csv</a> <span class="faint">${DB.meta.rowCounts[t]} rows</span></li>`).join("")}
    </ul></div>
  </div>

  <h2>JSON API</h2>
  <p class="small">Static, versioned, CORS open. No key required.</p>
  <div class="table-scroll"><table><thead><tr><th>Endpoint</th><th>Returns</th></tr></thead><tbody>
    <tr><td class="mono"><a href="./api/v1/all.json">/api/v1/all.json</a></td><td>Everything, including derived summaries and map geometry</td></tr>
    <tr><td class="mono"><a href="./api/v1/summary.json">/api/v1/summary.json</a></td><td>Headline totals and aggregates</td></tr>
    <tr><td class="mono"><a href="./api/v1/abatements.json">/api/v1/abatements.json</a></td><td>All awards, derived fields included</td></tr>
    <tr><td class="mono"><a href="./api/v1/geo.json">/api/v1/geo.json</a></td><td>Projected county paths and centroids</td></tr>
    <tr><td class="mono">/api/v1/award/{id}.json</td><td>One award, plus its company, source and conflicts</td></tr>
    <tr><td class="mono"><a href="./api/v1/discrepancies.json">/api/v1/discrepancies.json</a></td><td>The data quality ledger</td></tr>
    <tr><td class="mono"><a href="./api/v1/index.json">/api/v1/index.json</a></td><td>Every endpoint</td></tr>
  </tbody></table></div>

  <h2>Sources</h2>
  <ul class="clean">${DB.sources.map((s) => `<li class="card small">
    <a href="${esc(s.url)}" rel="noopener"><strong>${esc(s.title)}</strong></a>
    ${badge(s.doc_type, s.doc_type.includes("news") ? "warn" : "ok")}
    <div class="muted">${esc(s.publisher)}${s.published ? `, published ${fmtDate(s.published)}` : ""}, retrieved ${fmtDate(s.retrieved)}</div>
    ${s.notes ? `<div class="small" style="margin-top:4px">${esc(s.notes)}</div>` : ""}</li>`).join("")}</ul>

  <h2>Corrections</h2>
  <p>Found an error, or have a board packet this is missing? Open an issue with the source document and it will
  be fixed. Corrections to the underlying figures are the most valuable contribution you can make.</p>`;
}

/* ------------------------------------------------------- post-render wiring */
function afterRender(path, params) {
  wireReveal();
  updateTimelineFill();
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
    const qInput = form.querySelector("#f-q");
    const clearBtn = form.querySelector(".search-clear");
    qInput?.addEventListener("input", () => {
      clearBtn.hidden = !qInput.value;
      clearTimeout(timer);
      timer = setTimeout(submit, 220);
    });
    clearBtn?.addEventListener("click", () => {
      qInput.value = "";
      clearBtn.hidden = true;
      qInput.focus();
      clearTimeout(timer);
      submit();
    });
    form.querySelector("#f-reset")?.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = "#/awards";
    });

    const dl = document.getElementById("dl");
    if (dl) dl.href = csvBlobUrl(filteredAwards(params), Object.keys(DB.abatements[0] ?? {}));
  }
  if (!location.hash.includes("?")) scrollTo({ top: 0 });
}
