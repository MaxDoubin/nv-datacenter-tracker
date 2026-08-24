// Formatting helpers shared by every view.

export const fmtUsd = (n, compact = false) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  if (compact) {
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `$${Math.round(n / 1e3)}K`;
  }
  return `$${Math.round(n).toLocaleString("en-US")}`;
};

export const fmtNum = (n) =>
  n === null || n === undefined || Number.isNaN(n) ? "n/a" : n.toLocaleString("en-US");

export const fmtWage = (n) => (n === null || n === undefined ? "n/a" : `$${Number(n).toFixed(2)}`);

export const fmtPct = (n, digits = 0) =>
  n === null || n === undefined ? "n/a" : `${(n * 100).toFixed(digits)}%`;

export const fmtGallons = (n) => {
  if (n === null || n === undefined) return "n/a";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B gal`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M gal`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K gal`;
  return `${n} gal`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const fmtMonth = (ym) => {
  if (!ym) return "n/a";
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const fmtDate = (d) => {
  if (!d) return "n/a";
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
};

/** Escape for interpolation into HTML text or attribute values. */
export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const badge = (text, kind = "neutral") =>
  `<span class="badge b-${kind}">${esc(text)}</span>`;

export const statusBadge = (s) =>
  badge(s, s === "active" ? "ok" : s === "withdrawn" ? "danger" : "neutral");

export const verificationBadge = (v) =>
  badge(v, v === "primary" ? "ok" : v === "secondary" ? "warn" : "danger");

export const severityBadge = (s) =>
  badge(s, s === "high" ? "danger" : s === "medium" ? "warn" : "neutral");

/** Turn rows + column order into a CSV download blob URL. */
export function csvBlobUrl(rows, columns) {
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
  return URL.createObjectURL(new Blob([body + "\n"], { type: "text/csv" }));
}
