/**
 * Everything computed rather than sourced lives here, so the CSVs stay a record
 * of what documents actually say.
 */

import type { Row } from "./csv.ts";
import { num } from "./schema.ts";

/**
 * Full-time hours per year. Not arbitrary: GOED's own FY2016 rows satisfy
 * jobs x hourly wage x 2080 exactly, so this reproduces the state's arithmetic.
 * (Later rows do not - see discrepancies.csv, disc-annual-wages-column.)
 */
export const HOURS_PER_YEAR = 2080;

export interface Abatement {
  id: string;
  fiscalYear: number;
  approvedDate: string;
  entityName: string;
  companyId: string;
  county: string;
  awardType: string;
  status: string;
  verification: string;
  program: string;
  capitalInvestment: number | null;
  jobsPromised: number | null;
  avgWage: number | null;
  statutoryWage: number | null;
  sut: number | null;
  sutYears: number | null;
  personalProperty: number | null;
  ppYears: number | null;
  /** sut + personal property when both are known, else the published total. */
  totalAbatement: number | null;
  /** True when totalAbatement came from a published total rather than components. */
  totalIsReported: boolean;
  annualWageBill: number | null;
  abatementPerJob: number | null;
  abatementPerCapexDollar: number | null;
  wagePremium: number | null;
  termEndsFiscalYear: number | null;
  sourceId: string;
  sourcePage: string;
  notes: string;
}

export function toAbatement(r: Row): Abatement {
  const sut = num(r.sut_abatement_usd);
  const pp = num(r.personal_property_abatement_usd);
  const reported = num(r.total_abatement_reported_usd);
  const components = sut !== null && pp !== null ? sut + pp : null;
  const total = components ?? reported;

  const jobs = num(r.jobs_promised);
  const wage = num(r.avg_wage_promised_usd);
  const statutory = num(r.statutory_wage_usd);
  const capex = num(r.capital_investment_usd);
  const fy = Number(r.fiscal_year);
  const term = num(r.sut_years) ?? num(r.pp_years);

  return {
    id: r.id,
    fiscalYear: fy,
    approvedDate: r.approved_date,
    entityName: r.entity_name,
    companyId: r.company_id,
    county: r.county,
    awardType: r.award_type,
    status: r.status,
    verification: r.verification,
    program: r.program,
    capitalInvestment: capex,
    jobsPromised: jobs,
    avgWage: wage,
    statutoryWage: statutory,
    sut,
    sutYears: num(r.sut_years),
    personalProperty: pp,
    ppYears: num(r.pp_years),
    totalAbatement: total,
    totalIsReported: components === null && reported !== null,
    annualWageBill: jobs !== null && wage !== null ? round2(jobs * wage * HOURS_PER_YEAR) : null,
    abatementPerJob: total !== null && jobs ? Math.round(total / jobs) : null,
    abatementPerCapexDollar: total !== null && capex ? round4(total / capex) : null,
    wagePremium: wage !== null && statutory ? round4(wage / statutory) : null,
    termEndsFiscalYear: term !== null && Number.isFinite(fy) ? fy + term : null,
    sourceId: r.primary_source_id,
    sourcePage: r.source_page,
    notes: r.notes,
  };
}

export interface Totals {
  awards: number;
  active: number;
  withdrawn: number;
  totalAbatement: number;
  capitalInvestment: number;
  jobsPromised: number;
  annualWageBill: number;
  abatementPerJob: number | null;
}

export function totals(rows: Abatement[]): Totals {
  const active = rows.filter((r) => r.status === "active");
  const sum = (pick: (a: Abatement) => number | null, from = active) =>
    from.reduce((acc, r) => acc + (pick(r) ?? 0), 0);

  const abatement = sum((r) => r.totalAbatement);
  const jobs = sum((r) => r.jobsPromised);

  return {
    awards: rows.length,
    active: active.length,
    withdrawn: rows.filter((r) => r.status === "withdrawn").length,
    totalAbatement: abatement,
    capitalInvestment: sum((r) => r.capitalInvestment),
    jobsPromised: jobs,
    annualWageBill: round2(sum((r) => r.annualWageBill)),
    abatementPerJob: jobs > 0 ? Math.round(abatement / jobs) : null,
  };
}

export function groupBy<K extends string | number>(
  rows: Abatement[],
  key: (a: Abatement) => K,
): Array<{ key: K; rows: Abatement[]; totals: Totals }> {
  const map = new Map<K, Abatement[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return [...map.entries()]
    .map(([key, rows]) => ({ key, rows, totals: totals(rows) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Running total of approved abatement value by fiscal year, active awards only. */
export function cumulativeByFiscalYear(
  rows: Abatement[],
): Array<{ fiscalYear: number; awarded: number; cumulative: number; awards: number }> {
  const active = rows.filter((r) => r.status === "active");
  if (active.length === 0) return [];
  const years = active.map((r) => r.fiscalYear);
  const out: Array<{ fiscalYear: number; awarded: number; cumulative: number; awards: number }> = [];
  let running = 0;
  for (let fy = Math.min(...years); fy <= Math.max(...years); fy++) {
    const inYear = active.filter((r) => r.fiscalYear === fy);
    const awarded = inYear.reduce((a, r) => a + (r.totalAbatement ?? 0), 0);
    running += awarded;
    out.push({ fiscalYear: fy, awarded, cumulative: running, awards: inYear.length });
  }
  return out;
}

/** How much of what companies projected actually showed up at audit. */
export function deliveryRatios(auditRows: Row[]): Array<{
  fiscalYear: number;
  capexRatio: number | null;
  jobsRatio: number | null;
  wageRatio: number | null;
}> {
  return auditRows
    .filter((r) => r.audit_state === "complete")
    .map((r) => {
      const ratio = (a: string, b: string) => {
        const x = num(r[a]);
        const y = num(r[b]);
        return x !== null && y ? round4(x / y) : null;
      };
      return {
        fiscalYear: Number(r.fiscal_year),
        capexRatio: ratio("audited_capex_usd", "projected_capex_usd"),
        jobsRatio: ratio("audited_jobs", "projected_jobs"),
        wageRatio: ratio("audited_wage_usd", "projected_wage_usd"),
      };
    });
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function usd(n: number | null, opts: { compact?: boolean } = {}): string {
  if (n === null) return "n/a";
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${round2(n / 1e9)}B`;
    if (abs >= 1e6) return `$${round2(n / 1e6)}M`;
    if (abs >= 1e3) return `$${Math.round(n / 1e3)}K`;
  }
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function gallons(n: number): string {
  if (n >= 1e9) return `${round2(n / 1e9)}B gal`;
  if (n >= 1e6) return `${round2(n / 1e6)}M gal`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K gal`;
  return `${n} gal`;
}
