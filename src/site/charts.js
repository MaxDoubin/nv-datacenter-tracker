// Hand-rolled SVG charts. No chart library: the shapes needed here are simple,
// and inline SVG inherits the theme tokens for free.

const PAL = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
export const palette = (i) => PAL[i % PAL.length];

const niceMax = (v) => {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
};

/**
 * Cumulative area + per-year columns on one frame.
 * series: [{ fiscalYear, awarded, cumulative }]
 */
export function cumulativeChart(series, fmt) {
  if (!series.length) return `<p class="empty">No data.</p>`;
  const W = 720, H = 260, ml = 62, mr = 16, mt = 14, mb = 34;
  const iw = W - ml - mr, ih = H - mt - mb;
  const max = niceMax(Math.max(...series.map((d) => d.cumulative)));
  const bw = Math.max(6, (iw / series.length) * 0.5);
  const x = (i) => ml + (iw / series.length) * (i + 0.5);
  const y = (v) => mt + ih - (v / max) * ih;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const grid = ticks.map((t) =>
    `<line x1="${ml}" x2="${W - mr}" y1="${y(t)}" y2="${y(t)}"/>`).join("");
  const tickLabels = ticks.map((t) =>
    `<text x="${ml - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("");

  const area = `M ${x(0)} ${y(0)} ` +
    series.map((d, i) => `L ${x(i)} ${y(d.cumulative)}`).join(" ") +
    ` L ${x(series.length - 1)} ${y(0)} Z`;
  const line = series.map((d, i) => `${i ? "L" : "M"} ${x(i)} ${y(d.cumulative)}`).join(" ");

  const cols = series.map((d, i) =>
    d.awarded > 0
      ? `<rect x="${x(i) - bw / 2}" y="${y(d.awarded)}" width="${bw}" height="${Math.max(1, mt + ih - y(d.awarded))}" rx="2" fill="var(--c2)" opacity=".75"><title>FY${d.fiscalYear}: ${fmt(d.awarded)} approved (${d.awards} award${d.awards === 1 ? "" : "s"})</title></rect>`
      : "").join("");

  const dots = series.map((d, i) =>
    `<circle cx="${x(i)}" cy="${y(d.cumulative)}" r="3" fill="var(--c1)"><title>FY${d.fiscalYear}: ${fmt(d.cumulative)} cumulative</title></circle>`).join("");

  const xLabels = series.map((d, i) =>
    (series.length <= 12 || i % 2 === 0)
      ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${String(d.fiscalYear).slice(2)}</text>` : "").join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Cumulative approved abatement value by fiscal year, with the amount approved each year">
    <g class="grid">${grid}</g>
    <path d="${area}" fill="var(--c1)" opacity=".13"/>
    <path d="${line}" fill="none" stroke="var(--c1)" stroke-width="2"/>
    ${cols}${dots}
    <g>${tickLabels}${xLabels}</g>
    <text x="${ml}" y="${H - 10}" text-anchor="middle" opacity="0">FY</text>
  </svg>
  <div class="legend">
    <span><span class="sw" style="background:var(--c1)"></span>Cumulative approved</span>
    <span><span class="sw" style="background:var(--c2)"></span>Approved that fiscal year</span>
    <span class="faint">x-axis: Nevada fiscal year</span>
  </div>`;
}

/** Horizontal bars from [{label, value, note}]. Pure HTML, so it reflows well. */
export function barList(items, fmt, opts = {}) {
  if (!items.length) return `<p class="empty">No data.</p>`;
  const max = Math.max(...items.map((d) => d.value)) || 1;
  return `<div class="bars">${items.map((d, i) => `
    <div class="bar-row">
      <span>${d.href ? `<a href="${d.href}">${d.label}</a>` : d.label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(1, (d.value / max) * 100)}%;background:${opts.mono ? "var(--accent)" : palette(i)}"></span></span>
      <span class="mono faint">${fmt(d.value)}${d.note ? ` <span class="faint">${d.note}</span>` : ""}</span>
    </div>`).join("")}</div>`;
}

/**
 * Paired columns for promised vs actual.
 * rows: [{ label, a, b }] where a = projected, b = audited.
 */
export function pairedColumns(rows, fmt, labels = ["Projected", "Audited"]) {
  if (!rows.length) return `<p class="empty">No data.</p>`;
  const W = 720, H = 250, ml = 62, mr = 16, mt = 14, mb = 34;
  const iw = W - ml - mr, ih = H - mt - mb;
  const max = niceMax(Math.max(...rows.flatMap((d) => [d.a, d.b])));
  const slot = iw / rows.length;
  const bw = Math.min(18, (slot - 6) / 2);
  const y = (v) => mt + ih - (v / max) * ih;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const grid = ticks.map((t) => `<line x1="${ml}" x2="${W - mr}" y1="${y(t)}" y2="${y(t)}"/>`).join("");
  const tickLabels = ticks.map((t) => `<text x="${ml - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("");

  const bars = rows.map((d, i) => {
    const cx = ml + slot * (i + 0.5);
    const ratio = d.a ? d.b / d.a : null;
    const tip = `FY${d.label}: ${labels[0]} ${fmt(d.a)}, ${labels[1]} ${fmt(d.b)}${ratio !== null ? ` (${(ratio * 100).toFixed(0)}%)` : ""}`;
    return `<g><title>${tip}</title>
      <rect x="${cx - bw - 1}" y="${y(d.a)}" width="${bw}" height="${Math.max(1, mt + ih - y(d.a))}" rx="2" fill="var(--c3)" opacity=".55"/>
      <rect x="${cx + 1}" y="${y(d.b)}" width="${bw}" height="${Math.max(1, mt + ih - y(d.b))}" rx="2" fill="var(--c1)"/>
    </g>`;
  }).join("");

  const xLabels = rows.map((d, i) =>
    `<text x="${ml + slot * (i + 0.5)}" y="${H - 10}" text-anchor="middle">${String(d.label).slice(2)}</text>`).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${labels[0]} compared with ${labels[1]} by fiscal year">
    <g class="grid">${grid}</g>${bars}
    <g>${tickLabels}${xLabels}</g>
  </svg>
  <div class="legend">
    <span><span class="sw" style="background:var(--c3);opacity:.55"></span>${labels[0]}</span>
    <span><span class="sw" style="background:var(--c1)"></span>${labels[1]}</span>
  </div>`;
}

/** Small inline sparkline for a series of numbers. */
export function sparkline(values, w = 90, h = 22) {
  if (!values.length) return "";
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) =>
    `${(i / Math.max(1, values.length - 1)) * (w - 2) + 1},${h - 1 - ((v - min) / span) * (h - 2)}`).join(" ");
  return `<svg class="chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="display:inline-block;vertical-align:middle">
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
  </svg>`;
}
