import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset, errorsOf } from "../src/lib/load.ts";
import { fiscalYearOf } from "../src/lib/schema.ts";
import { toAbatement, totals, cumulativeByFiscalYear, HOURS_PER_YEAR } from "../src/lib/derive.ts";

const { tables, issues } = loadDataset();

test("the shipped dataset validates with no errors", () => {
  const errors = errorsOf(issues);
  assert.deepEqual(errors.map((e) => `${e.table}/${e.line ?? "-"}: ${e.message}`), []);
});

test("the shipped dataset has no warnings either", () => {
  assert.deepEqual(issues.filter((i) => i.level === "warn").map((i) => i.message), []);
});

test("Nevada fiscal years start in July", () => {
  assert.equal(fiscalYearOf("2015-07"), 2016);
  assert.equal(fiscalYearOf("2015-06"), 2015);
  assert.equal(fiscalYearOf("2026-08"), 2027);
});

test("every abatement resolves to a company and a source", () => {
  const companies = new Set(tables.companies.map((c) => c.company_id));
  const sources = new Set(tables.sources.map((s) => s.source_id));
  for (const a of tables.abatements) {
    assert.ok(companies.has(a.company_id), `${a.id} has an unknown company_id`);
    assert.ok(sources.has(a.primary_source_id), `${a.id} has an unknown source`);
  }
});

test("abatement components sum to the total", () => {
  const a = tables.abatements.map(toAbatement).find((x) => x.id === "fy2024-novva-reno")!;
  assert.equal(a.sut! + a.personalProperty!, a.totalAbatement);
  assert.equal(a.totalAbatement, 26_540_013);
  assert.equal(a.totalIsReported, false);
});

test("a total-only award still reports a total", () => {
  const a = tables.abatements.map(toAbatement).find((x) => x.id === "fy2027-colovore-reno-1")!;
  assert.equal(a.totalAbatement, 4_076_970);
  assert.equal(a.totalIsReported, true);
});

test("withdrawn awards are excluded from totals", () => {
  const all = tables.abatements.map(toAbatement);
  const t = totals(all);
  const withdrawn = all.filter((a) => a.status === "withdrawn");
  assert.ok(withdrawn.length > 0, "fixture expects at least one withdrawn award");
  assert.equal(t.withdrawn, withdrawn.length);
  const naive = all.reduce((s, a) => s + (a.totalAbatement ?? 0), 0);
  assert.ok(t.totalAbatement < naive, "withdrawn value must not be counted");
});

test("active totals reconcile to the sum of active components", () => {
  const all = tables.abatements.map(toAbatement);
  const expected = all
    .filter((a) => a.status === "active")
    .reduce((s, a) => s + (a.totalAbatement ?? 0), 0);
  assert.equal(totals(all).totalAbatement, expected);
});

test("implied payroll uses 2080 hours, matching GOED's own FY2016 arithmetic", () => {
  const switch2 = tables.abatements.map(toAbatement).find((a) => a.id === "fy2016-switch-2")!;
  assert.equal(switch2.annualWageBill, 50 * 28.98 * HOURS_PER_YEAR);
  // GOED printed exactly this figure for the row, which is why 2080 is the divisor.
  assert.equal(switch2.annualWageBill, 3_013_920);
});

test("cumulative series is monotonic and covers every year in range", () => {
  const series = cumulativeByFiscalYear(tables.abatements.map(toAbatement));
  for (let i = 1; i < series.length; i++) {
    assert.ok(series[i].cumulative >= series[i - 1].cumulative);
    assert.equal(series[i].fiscalYear, series[i - 1].fiscalYear + 1);
  }
});

test("every discrepancy names a real source or a computed resolution", () => {
  const known = new Set([...tables.sources.map((s) => s.source_id), "computed", "unresolved"]);
  for (const d of tables.discrepancies) {
    for (const f of ["source_a", "source_b", "resolution"] as const) {
      assert.ok(known.has(d[f]), `${d.id}.${f} = '${d[f]}' is not a known source`);
    }
  }
});

test("unverified rows always explain themselves", () => {
  for (const a of tables.abatements) {
    if (a.verification !== "primary") assert.ok(a.notes.length > 20, `${a.id} needs a note`);
  }
});
