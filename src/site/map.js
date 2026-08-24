// Nevada county maps. Geometry is projected at build time (Albers equal-area),
// so this file only has to shade paths and place dots.
//
// Shading uses fill-opacity over the themed accent colour rather than a baked
// colour ramp, so the same scale reads correctly in light and dark without
// hardcoding hex values.

import { esc } from "./format.js";

const MIN_OPACITY = 0.1;
const MAX_OPACITY = 0.92;

/** Five graduated steps, so the legend and the shapes cannot disagree. */
export function scaleFor(values) {
  const positive = values.filter((v) => v > 0);
  if (!positive.length) return { max: 0, step: () => 0, breaks: [] };
  const max = Math.max(...positive);
  const breaks = [0.2, 0.4, 0.6, 0.8, 1].map((f) => f * max);
  return {
    max,
    breaks,
    step(v) {
      if (!v) return 0;
      const i = breaks.findIndex((b) => v <= b + 1e-9);
      const t = (i < 0 ? breaks.length - 1 : i) / (breaks.length - 1);
      return MIN_OPACITY + t * (MAX_OPACITY - MIN_OPACITY);
    },
  };
}

/**
 * Choropleth of Nevada's 17 counties.
 * values: { [countyName]: number }.  detail: { [countyName]: string } for tooltips.
 */
export function choropleth(map, values, fmt, opts = {}) {
  const {
    detail = {}, hrefBase = "#/county/", label = "value", markers = null,
    bubbles = false,
  } = opts;
  const scale = scaleFor(Object.values(values));
  const max = scale.max;

  // With bubbles on, the shading drops back to context and the circles carry
  // the magnitude. Nevada needs this: Storey County holds the largest share of
  // abatement value and is one of the smallest counties in the state, so a
  // choropleth alone makes the biggest number nearly invisible.
  const fillCeiling = bubbles ? 0.45 : 1;

  const shapes = map.counties.map((c) => {
    const v = values[c.name] ?? 0;
    const o = scale.step(v) * fillCeiling;
    const tip = `${c.name} County: ${v ? fmt(v) : `no ${label}`}${detail[c.name] ? `\n${detail[c.name]}` : ""}`;
    const fill = v ? `fill="var(--accent)" fill-opacity="${o.toFixed(3)}"` : `fill="var(--surface-2)"`;
    // A visible outline is what makes a tiny county findable at all.
    const stroke = v
      ? `stroke="var(--accent)" stroke-width="1.6"`
      : `stroke="var(--bg)" stroke-width="1.1"`;
    const inner = `<path d="${c.path}" ${fill} ${stroke}><title>${esc(tip)}</title></path>`;
    return v
      ? `<a href="${hrefBase}${encodeURIComponent(c.name)}" aria-label="${esc(tip)}">${inner}</a>`
      : `<g aria-label="${esc(tip)}">${inner}</g>`;
  }).join("");

  const withData = map.counties.filter((c) => values[c.name]);

  const circles = bubbles ? withData.map((c) => {
    const v = values[c.name];
    const r = Math.max(7, Math.sqrt(v / max) * 34);
    const [x, y] = c.centroid;
    const tip = `${c.name} County: ${fmt(v)}${detail[c.name] ? `\n${detail[c.name]}` : ""}`;
    return `<a href="${hrefBase}${encodeURIComponent(c.name)}" aria-label="${esc(tip)}">
      <circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="var(--accent)" fill-opacity=".82"
        stroke="var(--surface)" stroke-width="2"><title>${esc(tip)}</title></circle>
      <text x="${x}" y="${y + 4}" text-anchor="middle" class="map-bubble-value">${esc(fmt(v))}</text>
    </a>`;
  }).join("") : "";

  // Labels sit below the symbol when bubbles are on, and inside the shape otherwise.
  const labels = withData.map((c) => {
    const [x, y] = c.centroid;
    const r = bubbles ? Math.max(7, Math.sqrt(values[c.name] / max) * 34) : 0;
    const ly = bubbles ? y + r + 14 : y;
    return `<text x="${x}" y="${ly}" text-anchor="middle" class="map-label">${esc(c.name)}</text>` +
      (bubbles ? "" : `<text x="${x}" y="${ly + 13}" text-anchor="middle" class="map-sub">${esc(fmt(values[c.name]))}</text>`);
  }).join("");

  // Reserve vertical room so symbol, label and facility dots never overlap.
  const radii = {};
  if (bubbles) for (const c of withData) radii[c.name] = Math.max(7, Math.sqrt(values[c.name] / max) * 34);
  const dots = markers ? markerDots(map, markers, radii) : "";

  return `<svg class="chart map" viewBox="${map.viewBox}" role="img"
    aria-label="Map of Nevada counties shaded by ${esc(label)}">
    ${shapes}${dots}${circles}${labels}
  </svg>`;
}

/**
 * One dot per facility, packed in a small grid at the county's centroid.
 * Placement is county-level only: the underlying inventory gives a county, not
 * a street address, and inventing coordinates would imply precision we do not
 * have. This is stated in the caption wherever the map is used.
 */
function markerDots(map, facilities, radii = {}) {
  const byCounty = {};
  for (const f of facilities) (byCounty[f.county] ??= []).push(f);

  return Object.entries(byCounty).map(([county, list]) => {
    const c = map.counties.find((x) => x.name === county);
    if (!c) return "";
    const [cx, cy] = c.centroid;
    const cols = Math.ceil(Math.sqrt(list.length));
    const gap = 9;
    const w = (cols - 1) * gap;
    const rows = Math.ceil(list.length / cols);
    const h = (rows - 1) * gap;
    // Clear the graduated symbol and its label when one is drawn here.
    const offset = radii[county] ? radii[county] + 26 : 30;
    return list.map((f, i) => {
      const x = cx - w / 2 + (i % cols) * gap;
      const y = cy + offset + Math.floor(i / cols) * gap;
      const colour = f.status === "operational" ? "var(--ok)"
        : f.status === "planned" ? "var(--warn)" : "var(--text-faint)";
      return `<circle cx="${x}" cy="${y}" r="3.4" fill="${colour}" stroke="var(--bg)" stroke-width="1">
        <title>${esc(`${f.company}, ${county} County (${f.status})`)}</title></circle>`;
    }).join("");
  }).join("");
}

/** Graduated legend that mirrors scaleFor's breaks exactly. */
export function choroplethLegend(values, fmt, label) {
  const scale = scaleFor(values);
  if (!scale.breaks.length) return "";
  const swatches = scale.breaks.map((b, i) => {
    const lo = i === 0 ? 0 : scale.breaks[i - 1];
    return `<span class="lg-item">
      <span class="lg-sw" style="background:var(--accent);opacity:${scale.step(b).toFixed(3)}"></span>
      <span>${fmt(lo)}&ndash;${fmt(b)}</span></span>`;
  }).join("");
  return `<div class="map-legend"><span class="lg-title">${esc(label)}</span>${swatches}
    <span class="lg-item"><span class="lg-sw" style="background:var(--surface-2)"></span><span>none</span></span></div>`;
}

export function markerLegend() {
  return `<div class="map-legend">
    <span class="lg-title">Facilities</span>
    <span class="lg-item"><span class="lg-dot" style="background:var(--ok)"></span><span>operational</span></span>
    <span class="lg-item"><span class="lg-dot" style="background:var(--warn)"></span><span>planned or under construction</span></span>
    <span class="lg-item"><span class="lg-dot" style="background:var(--text-faint)"></span><span>status unclassified</span></span>
  </div>`;
}
