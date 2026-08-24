#!/usr/bin/env node
/** Terminal summary of the dataset. Useful in CI logs and for a quick sanity check. */

import { loadDataset } from "../lib/load.ts";
import { toAbatement, totals, groupBy, usd, gallons } from "../lib/derive.ts";
import { num } from "../lib/schema.ts";

const { tables } = loadDataset();
const abatements = tables.abatements.map(toAbatement);
const active = abatements.filter((a) => a.status === "active");
const t = totals(abatements);

const rule = (s = "") => console.log(s ? `\n── ${s} ${"─".repeat(Math.max(0, 58 - s.length))}` : "─".repeat(62));
const row = (k: string, v: string) => console.log(`  ${k.padEnd(34)} ${v.padStart(24)}`);

console.log("\nNevada Data Center Tax Abatement Tracker");
rule();
row("Awards on record", String(t.awards));
row("Active", String(t.active));
row("Withdrawn", String(t.withdrawn));
row("Approved abatement value (active)", usd(t.totalAbatement));
row("Promised capital investment", usd(t.capitalInvestment));
row("Promised permanent jobs", String(t.jobsPromised));
row("Abatement per promised job", usd(t.abatementPerJob));
row("Implied annual payroll", usd(t.annualWageBill));

rule("By county");
for (const g of groupBy(active, (a) => a.county).sort((a, b) => b.totals.totalAbatement - a.totals.totalAbatement)) {
  row(`${g.key} (${g.rows.length})`, usd(g.totals.totalAbatement));
}

rule("By operator");
const name = (id: string) => tables.companies.find((c) => c.company_id === id)?.display_name ?? id;
for (const g of groupBy(active, (a) => a.companyId).sort((a, b) => b.totals.totalAbatement - a.totals.totalAbatement)) {
  row(`${name(g.key)} (${g.rows.length})`, usd(g.totals.totalAbatement));
}

rule("Promised vs audited, all GOED programs FY2010-FY2019");
const complete = tables.program_audit_summary.filter((r) => r.audit_state === "complete");
const s = (f: string) => complete.reduce((a, r) => a + (num(r[f]) ?? 0), 0);
row("Projected capital investment", usd(s("projected_capex_usd")));
row("Found at audit", `${usd(s("audited_capex_usd"))}`);
row("Delivery ratio", `${((s("audited_capex_usd") / s("projected_capex_usd")) * 100).toFixed(0)}%`);
row("Projected jobs", String(s("projected_jobs")));
row("Found at audit", String(s("audited_jobs")));

rule("Data quality");
for (const sev of ["high", "medium", "low"]) {
  row(`${sev} severity conflicts`, String(tables.discrepancies.filter((d) => d.severity === sev).length));
}
row("Awards without a primary source", String(abatements.filter((a) => a.verification !== "primary").length));
row("Unconfirmed parent attributions", String(tables.companies.filter((c) => c.parent_confidence !== "confirmed").length));

rule("Water");
for (const w of tables.water.filter((x) => x.subject_type === "facility" && x.metric !== "planned_annual")) {
  row(`${w.subject} ${w.year} ${w.metric}`, gallons(Number(w.gallons)));
}
rule();
console.log(`  ${tables.sources.length} source documents. Run \`npm run check-sources\` to verify they still resolve.\n`);
