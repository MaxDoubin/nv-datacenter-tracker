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
      ? `<rect class="bar-v" style="--i:${i}" x="${x(i) - bw / 2}" y="${y(d.awarded)}" width="${bw}" height="${Math.max(1, mt + ih - y(d.awarded))}" rx="2" fill="var(--c2)" opacity=".75"><title>FY${d.fiscalYear}: ${fmt(d.awarded)} approved (${d.awards} award${d.awards === 1 ? "" : "s"})</title></rect>`
      : "").join("");

  const dots = series.map((d, i) =>
    `<circle class="dot-pop" style="--i:${i}" cx="${x(i)}" cy="${y(d.cumulative)}" r="3" fill="var(--c1)"><title>FY${d.fiscalYear}: ${fmt(d.cumulative)} cumulative</title></circle>`).join("");

  const xLabels = series.map((d, i) =>
    (series.length <= 12 || i % 2 === 0)
      ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${String(d.fiscalYear).slice(2)}</text>` : "").join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="Cumulative approved abatement value by fiscal year, with the amount approved each year">
    <g class="grid">${grid}</g>
    <path class="draw-fade" d="${area}" fill="var(--c1)" opacity=".13"/>
    <path class="line-draw" pathLength="1" d="${line}" fill="none" stroke="var(--c1)" stroke-width="2"/>
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
      <span class="bar-track"><span class="bar-fill grow-x" style="--i:${i};width:${Math.max(1, (d.value / max) * 100)}%;background:${opts.mono ? "var(--accent)" : palette(i)}"></span></span>
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
      <rect class="bar-v" style="--i:${i * 2}" x="${cx - bw - 1}" y="${y(d.a)}" width="${bw}" height="${Math.max(1, mt + ih - y(d.a))}" rx="2" fill="var(--c3)" opacity=".55"/>
      <rect class="bar-v" style="--i:${i * 2 + 1}" x="${cx + 1}" y="${y(d.b)}" width="${bw}" height="${Math.max(1, mt + ih - y(d.b))}" rx="2" fill="var(--c1)"/>
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
    <polyline class="line-draw" pathLength="1" points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
  </svg>`;
}

/* ======================================================================
   Extended chart set. Everything below is plain SVG built from the same
   theme tokens, so it inherits light and dark automatically.
   ====================================================================== */

const esc2 = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Lock-in timeline: one bar per award, spanning its approval year to the year
 * its abatement term expires. Reads the way no table can, because the point is
 * how far into the future each commitment runs.
 * rows: [{ label, start, end, value, status, href, operator }]
 */
export function gantt(rows, fmt, opts = {}) {
  if (!rows.length) return `<p class="empty">No data.</p>`;
  const now = opts.currentFy ?? null;
  const rowH = 22, ml = 168, mr = 58, mt = 26, mb = 26, W = 760;
  const H = mt + mb + rows.length * rowH;
  const iw = W - ml - mr;
  const minFy = Math.min(...rows.map((r) => r.start));
  const maxFy = Math.max(...rows.map((r) => r.end));
  const span = Math.max(1, maxFy - minFy);
  const x = (fy) => ml + ((fy - minFy) / span) * iw;

  const decades = [];
  for (let fy = Math.ceil(minFy / 5) * 5; fy <= maxFy; fy += 5) decades.push(fy);
  const grid = decades.map((fy) =>
    `<line x1="${x(fy)}" x2="${x(fy)}" y1="${mt - 8}" y2="${H - mb + 4}"/>`).join("");
  const ticks = decades.map((fy) =>
    `<text x="${x(fy)}" y="${mt - 13}" text-anchor="middle">FY${fy}</text>`).join("");

  const nowLine = now && now >= minFy && now <= maxFy
    ? `<line x1="${x(now)}" x2="${x(now)}" y1="${mt - 8}" y2="${H - mb + 4}"
         stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="3 3"/>
       <text x="${x(now)}" y="${H - mb + 17}" text-anchor="middle" fill="var(--danger)">today</text>` : "";

  const bars = rows.map((r, i) => {
    const y = mt + i * rowH;
    const w = Math.max(3, x(r.end) - x(r.start));
    const dim = r.status === "withdrawn";
    const tip = `${r.label}: FY${r.start} to FY${r.end}, ${fmt(r.value)}${dim ? " (withdrawn)" : ""}`;
    const bar = `<rect class="bar-h" style="--i:${i}" x="${x(r.start)}" y="${y + 4}" width="${w}" height="${rowH - 9}" rx="3"
        fill="${dim ? "var(--text-faint)" : palette(r.colorIndex ?? i)}"
        opacity="${dim ? 0.35 : 0.85}"><title>${esc2(tip)}</title></rect>`;
    const name = `<text class="fade-in" style="--i:${i}${dim ? ";text-decoration:line-through" : ""}"
        x="${ml - 10}" y="${y + rowH / 2 + 3}" text-anchor="end">${esc2(r.label.slice(0, 28))}</text>`;
    const amount = `<text class="fade-in label-strong" style="--i:${i}" x="${x(r.end) + 7}" y="${y + rowH / 2 + 3}">${esc2(fmt(r.value))}</text>`;
    return (r.href ? `<a href="${r.href}">${bar}${name}</a>` : bar + name) + amount;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group"
    aria-label="Abatement terms by award, from approval year to expiry">
    <g class="grid">${grid}</g><g>${ticks}</g>${nowLine}${bars}
  </svg>`;
}

/**
 * Bubble scatter. points: [{ x, y, r, label, href }]
 */
export function scatter(points, opts = {}) {
  if (!points.length) return `<p class="empty">No data.</p>`;
  const { xLabel = "x", yLabel = "y", xFmt = String, yFmt = String, rFmt = String } = opts;
  const W = 720, H = 340, ml = 66, mr = 26, mt = 18, mb = 46;
  const iw = W - ml - mr, ih = H - mt - mb;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xMax = niceMax(Math.max(...xs)), yMax = niceMax(Math.max(...ys));
  const rMax = Math.max(...points.map((p) => p.r)) || 1;
  const px = (v) => ml + (v / xMax) * iw;
  const py = (v) => mt + ih - (v / yMax) * ih;
  const pr = (v) => 5 + Math.sqrt(v / rMax) * 20;

  const xt = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const yt = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const grid = [
    ...yt.map((t) => `<line x1="${ml}" x2="${W - mr}" y1="${py(t)}" y2="${py(t)}"/>`),
    ...xt.map((t) => `<line x1="${px(t)}" x2="${px(t)}" y1="${mt}" y2="${mt + ih}"/>`),
  ].join("");

  const dots = points.map((p, i) => {
    const c = `<circle class="dot-pop" style="--i:${i}" cx="${px(p.x)}" cy="${py(p.y)}" r="${pr(p.r).toFixed(1)}"
      fill="${palette(i)}" fill-opacity=".55" stroke="${palette(i)}" stroke-width="1.5">
      <title>${esc2(`${p.label}\n${xLabel}: ${xFmt(p.x)}\n${yLabel}: ${yFmt(p.y)}\nabatement: ${rFmt(p.r)}`)}</title></circle>`;
    return p.href ? `<a href="${p.href}">${c}</a>` : c;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group"
    aria-label="${esc2(yLabel)} against ${esc2(xLabel)}, bubble area by abatement value">
    <g class="grid">${grid}</g>${dots}
    <g>${yt.map((t) => `<text x="${ml - 8}" y="${py(t) + 4}" text-anchor="end">${esc2(yFmt(t))}</text>`).join("")}
      ${xt.map((t) => `<text x="${px(t)}" y="${H - mb + 18}" text-anchor="middle">${esc2(xFmt(t))}</text>`).join("")}</g>
    <text x="${ml + iw / 2}" y="${H - 6}" text-anchor="middle" class="label-strong">${esc2(xLabel)}</text>
    <text x="14" y="${mt + ih / 2}" text-anchor="middle" class="label-strong"
      transform="rotate(-90 14 ${mt + ih / 2})">${esc2(yLabel)}</text>
  </svg>`;
}

/**
 * Dumbbell chart: two points per row joined by a line. Much clearer than paired
 * bars when the question is "how big is the gap".
 * rows: [{ label, a, b }]
 */
export function dumbbell(rows, fmt, labels = ["projected", "audited"]) {
  if (!rows.length) return `<p class="empty">No data.</p>`;
  const rowH = 26, ml = 62, mr = 90, mt = 14, mb = 14, W = 720;
  const H = mt + mb + rows.length * rowH;
  const iw = W - ml - mr;
  const max = niceMax(Math.max(...rows.flatMap((r) => [r.a, r.b])));
  const x = (v) => ml + (v / max) * iw;

  const body = rows.map((r, i) => {
    const y = mt + i * rowH + rowH / 2;
    const ratio = r.a ? r.b / r.a : null;
    const short = ratio !== null && ratio < 1;
    return `<g><title>${esc2(`FY${r.label}: ${labels[0]} ${fmt(r.a)}, ${labels[1]} ${fmt(r.b)}${
      ratio !== null ? ` (${(ratio * 100).toFixed(0)}%)` : ""}`)}</title>
      <line class="bar-h-line" style="--i:${i}" x1="${x(Math.min(r.a, r.b))}" x2="${x(Math.max(r.a, r.b))}" y1="${y}" y2="${y}"
        stroke="${short ? "var(--danger)" : "var(--ok)"}" stroke-width="2.5" opacity=".45"/>
      <circle class="dot-pop" style="--i:${i}" cx="${x(r.a)}" cy="${y}" r="5" fill="var(--c3)"/>
      <circle class="dot-pop" style="--i:${i}" cx="${x(r.b)}" cy="${y}" r="5" fill="var(--c1)"/>
      <text class="fade-in" style="--i:${i}" x="${ml - 10}" y="${y + 4}" text-anchor="end">FY${esc2(r.label)}</text>
      <text class="fade-in" style="--i:${i}" x="${W - mr + 8}" y="${y + 4}" fill="${short ? "var(--danger)" : "var(--ok)"}">${
        ratio !== null ? `${(ratio * 100).toFixed(0)}%` : ""}</text>
    </g>`;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${esc2(labels[0])} against ${esc2(labels[1])} by fiscal year">${body}</svg>
  <div class="legend">
    <span><span class="sw" style="background:var(--c3)"></span>${esc2(labels[0])}</span>
    <span><span class="sw" style="background:var(--c1)"></span>${esc2(labels[1])}</span>
    <span class="faint">percentage is delivered over projected</span>
  </div>`;
}

/** Ranked lollipop chart. items: [{ label, value, href, note }] */
export function lollipop(items, fmt, opts = {}) {
  if (!items.length) return `<p class="empty">No data.</p>`;
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const rowH = 25, ml = 190, mr = 84, mt = 10, mb = 10, W = 720;
  const H = mt + mb + sorted.length * rowH;
  const iw = W - ml - mr;
  const max = niceMax(Math.max(...sorted.map((i) => i.value)));
  const x = (v) => ml + (v / max) * iw;
  const ref = opts.reference;

  const refLine = ref
    ? `<line x1="${x(ref.value)}" x2="${x(ref.value)}" y1="${mt}" y2="${H - mb}"
        stroke="var(--danger)" stroke-width="1.4" stroke-dasharray="4 3"/>
       <text x="${x(ref.value)}" y="${mt + 2}" text-anchor="middle" fill="var(--danger)"
         style="font-size:10px">${esc2(ref.label)}</text>` : "";

  const body = sorted.map((it, i) => {
    const y = mt + i * rowH + rowH / 2;
    const tip = `${it.label}: ${fmt(it.value)}${it.note ? ` ${it.note}` : ""}`;
    const dot = `<circle class="dot-pop" style="--i:${i}" cx="${x(it.value)}" cy="${y}" r="6" fill="${palette(i)}"/>`;
    return `<g><title>${esc2(tip)}</title>
      <line class="bar-h-line" style="--i:${i}" x1="${ml}" x2="${x(it.value)}" y1="${y}" y2="${y}" stroke="var(--line-strong)" stroke-width="1.5"/>
      ${it.href ? `<a href="${it.href}" aria-label="${esc2(tip)}">${dot}</a>` : dot}
      <text class="fade-in" style="--i:${i}" x="${ml - 10}" y="${y + 4}" text-anchor="end">${esc2(it.label.slice(0, 30))}</text>
      <text class="fade-in label-strong" style="--i:${i}" x="${W - mr + 8}" y="${y + 4}">${esc2(fmt(it.value))}</text></g>`;
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group"
    aria-label="Ranked values">${refLine}${body}</svg>`;
}

/** Donut. slices: [{ label, value }] */
export function donut(slices, fmt, opts = {}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (!total) return `<p class="empty">No data.</p>`;
  const size = 220, r = 92, ri = 56, cx = size / 2, cy = size / 2;
  let angle = -Math.PI / 2;

  const arcs = slices.map((s, i) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    const large = sweep > Math.PI ? 1 : 0;
    const p = (rad, a) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
    const d = `M${p(r, a0)}A${r} ${r} 0 ${large} 1 ${p(r, a1)}L${p(ri, a1)}A${ri} ${ri} 0 ${large} 0 ${p(ri, a0)}Z`;
    return `<path class="arc-in" style="--i:${i}" d="${d}" fill="${palette(i)}" stroke="var(--surface)" stroke-width="1.5">
      <title>${esc2(`${s.label}: ${fmt(s.value)} (${((s.value / total) * 100).toFixed(0)}%)`)}</title></path>`;
  }).join("");

  return `<div class="donut-wrap">
    <svg class="chart donut" viewBox="0 0 ${size} ${size}" role="img"
      aria-label="${esc2(opts.title || "Share breakdown")}">${arcs}
      ${opts.centre ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="label-strong fade-in" style="--i:${slices.length};font-size:18px">${esc2(opts.centre)}</text>
        <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="fade-in" style="--i:${slices.length};font-size:10px">${esc2(opts.centreSub || "")}</text>` : ""}
    </svg>
    <div class="legend legend-col">${slices.map((s, i) =>
      `<span><span class="sw" style="background:${palette(i)}"></span>${esc2(s.label)}
        <span class="faint">${esc2(fmt(s.value))}</span></span>`).join("")}</div>
  </div>`;
}

/** Squarified treemap. items: [{ label, value, href }] */
export function treemap(items, fmt) {
  const data = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (!data.length) return `<p class="empty">No data.</p>`;
  const W = 720, H = 300;
  const total = data.reduce((a, d) => a + d.value, 0);
  const boxes = [];

  // Standard squarify: fill rows/columns along the shorter side.
  const layout = (list, x, y, w, h) => {
    if (!list.length) return;
    if (list.length === 1) {
      boxes.push({ ...list[0], x, y, w, h });
      return;
    }
    const sum = list.reduce((a, d) => a + d.value, 0);
    let acc = 0, split = 1;
    const half = sum / 2;
    for (let i = 0; i < list.length; i++) {
      if (acc + list[i].value > half && i > 0) break;
      acc += list[i].value;
      split = i + 1;
    }
    const frac = acc / sum;
    if (w >= h) {
      layout(list.slice(0, split), x, y, w * frac, h);
      layout(list.slice(split), x + w * frac, y, w * (1 - frac), h);
    } else {
      layout(list.slice(0, split), x, y, w, h * frac);
      layout(list.slice(split), x, y + h * frac, w, h * (1 - frac));
    }
  };
  layout(data, 0, 0, W, H);

  const cells = boxes.map((b, i) => {
    const pct = ((b.value / total) * 100).toFixed(1);
    const showText = b.w > 66 && b.h > 34;
    const rect = `<rect class="cell-in" style="--i:${i}" x="${b.x + 1}" y="${b.y + 1}" width="${Math.max(0, b.w - 2)}" height="${Math.max(0, b.h - 2)}"
      rx="4" fill="${palette(i)}" fill-opacity=".88" stroke="${palette(i)}" stroke-width="1">
      <title>${esc2(`${b.label}: ${fmt(b.value)} (${pct}% of total)`)}</title></rect>`;
    const text = showText ? `<text class="tm-label fade-in" style="--i:${i}" x="${b.x + 10}" y="${b.y + 21}">${esc2(b.label.slice(0, Math.floor(b.w / 7.4))) }</text>
      <text class="tm-value fade-in" style="--i:${i}" x="${b.x + 10}" y="${b.y + 37}">${esc2(fmt(b.value))}</text>` : "";
    return (b.href ? `<a href="${b.href}">${rect}${text}</a>` : rect + text);
  }).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group"
    aria-label="Treemap, area proportional to value">${cells}</svg>`;
}

/**
 * Horizontal stacked bars. rows: [{ label, parts: [{label, value}], href }]
 */
export function stackedBars(rows, fmt, opts = {}) {
  if (!rows.length) return `<p class="empty">No data.</p>`;
  const rowH = 26, ml = 190, mr = 84, mt = 10, mb = 10, W = 720;
  const H = mt + mb + rows.length * rowH;
  const iw = W - ml - mr;
  const max = niceMax(Math.max(...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0))));

  const body = rows.map((r, i) => {
    const y = mt + i * rowH;
    let cursor = ml;
    const total = r.parts.reduce((a, p) => a + p.value, 0);
    const segs = r.parts.map((p, j) => {
      const w = (p.value / max) * iw;
      const seg = `<rect class="bar-h" style="--i:${i}" x="${cursor.toFixed(2)}" y="${y + 5}" width="${Math.max(0, w).toFixed(2)}" height="${rowH - 11}"
        fill="${palette(j)}" fill-opacity="${j === 0 ? 0.9 : 0.6}">
        <title>${esc2(`${r.label}, ${p.label}: ${fmt(p.value)}`)}</title></rect>`;
      cursor += w;
      return seg;
    }).join("");
    const name = `<text class="fade-in" style="--i:${i}" x="${ml - 10}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc2(r.label.slice(0, 30))}</text>`;
    return `<g>${r.href ? `<a href="${r.href}">${segs}${name}</a>` : segs + name}
      <text class="fade-in label-strong" style="--i:${i}" x="${W - mr + 8}" y="${y + rowH / 2 + 4}">${esc2(fmt(total))}</text></g>`;
  }).join("");

  const legend = (opts.partLabels ?? []).map((l, j) =>
    `<span><span class="sw" style="background:${palette(j)};opacity:${j === 0 ? 0.9 : 0.6}"></span>${esc2(l)}</span>`).join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="group"
    aria-label="Stacked composition by row">${body}</svg>
    ${legend ? `<div class="legend">${legend}</div>` : ""}`;
}

/**
 * Area-proportional circles. Good for "how big is this really" comparisons
 * where a bar chart's range is too wide to read.
 * items: [{ label, value }]
 */
export function proportionalCircles(items, fmt) {
  const data = [...items].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (!data.length) return `<p class="empty">No data.</p>`;
  const W = 720, maxR = 74;
  const max = data[0].value;
  const rOf = (v) => Math.max(3, Math.sqrt(v / max) * maxR);

  let x = 12;
  const placed = data.map((d) => {
    const r = rOf(d.value);
    const cx = x + r;
    x += r * 2 + 30;
    return { ...d, r, cx };
  });
  const H = maxR * 2 + 64;
  const baseline = maxR + 12;

  const circles = placed.map((d, i) => `<g>
    <title>${esc2(`${d.label}: ${fmt(d.value)}`)}</title>
    <circle class="dot-pop" style="--i:${i}" cx="${d.cx}" cy="${baseline}" r="${d.r.toFixed(1)}" fill="${palette(i)}" fill-opacity=".5"
      stroke="${palette(i)}" stroke-width="1.5"/>
    <text class="fade-in" style="--i:${i}" x="${d.cx}" y="${baseline + maxR + 18}" text-anchor="middle">${esc2(d.label.slice(0, 20))}</text>
    <text class="fade-in label-strong" style="--i:${i}" x="${d.cx}" y="${baseline + maxR + 32}" text-anchor="middle">${esc2(fmt(d.value))}</text>
  </g>`).join("");

  return `<div class="scroll-x" tabindex="0" role="region" aria-label="Circles with area proportional to value, scrollable"><svg class="chart" viewBox="0 0 ${Math.max(W, x)} ${H}" role="img"
    aria-label="Circles with area proportional to value" style="min-width:${Math.max(W, x)}px">${circles}</svg></div>`;
}

/**
 * Heatmap grid. rowKeys x colKeys, get(row, col) returns a number or null.
 */
export function heatmap(rowKeys, colKeys, get, fmt, opts = {}) {
  if (!rowKeys.length || !colKeys.length) return `<p class="empty">No data.</p>`;
  const cell = 34, ml = 84, mt = 30, W = ml + colKeys.length * cell + 12;
  const H = mt + rowKeys.length * cell + 12;
  const vals = rowKeys.flatMap((r) => colKeys.map((c) => get(r, c))).filter((v) => v);
  const max = vals.length ? Math.max(...vals) : 1;

  const cells = rowKeys.flatMap((r, ri) => colKeys.map((c, ci) => {
    const v = get(r, c);
    const x = ml + ci * cell, y = mt + ri * cell;
    const o = v ? 0.12 + (Math.sqrt(v / max)) * 0.8 : 0;
    return `<rect class="cell-fade" style="--i:${(ri * colKeys.length + ci) % 30}" x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="3"
      fill="${v ? "var(--accent)" : "var(--surface-2)"}" fill-opacity="${v ? o.toFixed(3) : 1}">
      <title>${esc2(`${r}, ${c}: ${v ? fmt(v) : "none"}`)}</title></rect>`;
  })).join("");

  const rowLabels = rowKeys.map((r, ri) =>
    `<text x="${ml - 9}" y="${mt + ri * cell + cell / 2 + 4}" text-anchor="end">${esc2(String(r))}</text>`).join("");
  const colLabels = colKeys.map((c, ci) =>
    `<text x="${ml + ci * cell + cell / 2}" y="${mt - 10}" text-anchor="middle">${esc2(String(c).slice(-2))}</text>`).join("");

  return `<div class="scroll-x" tabindex="0" role="region" aria-label="${esc2(opts.title || "Heatmap")}, scrollable"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
    aria-label="${esc2(opts.title || "Heatmap")}" style="min-width:${W}px">
    ${cells}<g>${rowLabels}${colLabels}</g></svg></div>`;
}
