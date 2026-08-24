/**
 * Declarative table schemas plus the validation engine that guards them.
 *
 * Every column in data/ is described here. `npm run validate` fails CI on any
 * error-level issue, which is what keeps a community-editable CSV dataset
 * trustworthy.
 */

import type { Row } from "./csv.ts";

export type FieldKind =
  | "string"
  | "text"
  | "int"
  | "money"
  | "decimal"
  | "year"
  | "yearmonth"
  | "date"
  | "url"
  | "enum"
  | "ref"
  | "slug";

export interface Field {
  name: string;
  kind: FieldKind;
  required?: boolean;
  values?: readonly string[];
  ref?: { table: string; field: string };
  min?: number;
  max?: number;
  /** Human description, surfaced in the generated data dictionary. */
  doc: string;
  unit?: string;
}

export interface TableDef {
  name: string;
  file: string;
  primaryKey?: string;
  doc: string;
  fields: Field[];
  checks?: Array<(rows: Row[], all: Record<string, Row[]>) => Issue[]>;
}

export interface Issue {
  level: "error" | "warn";
  table: string;
  line?: number;
  field?: string;
  message: string;
}

const COUNTIES = [
  "Carson City", "Churchill", "Clark", "Douglas", "Elko", "Esmeralda", "Eureka",
  "Humboldt", "Lander", "Lincoln", "Lyon", "Mineral", "Nye", "Pershing",
  "Storey", "Washoe", "White Pine",
] as const;

const VERIFICATION = ["primary", "secondary", "unverified"] as const;
const CONFIDENCE = ["confirmed", "reported", "unknown"] as const;

/** Nevada's fiscal year runs 1 July - 30 June; FY2016 ends 30 June 2016. */
export function fiscalYearOf(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  return m >= 7 ? y + 1 : y;
}

export const TABLES: TableDef[] = [
  {
    name: "abatements",
    file: "abatements.csv",
    primaryKey: "id",
    doc: "One row per data center tax abatement award approved by the GOED board under NRS 360.754.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier. Never reuse or renumber." },
      { name: "fiscal_year", kind: "year", required: true, min: 2010, max: 2040, doc: "Nevada fiscal year of board approval." },
      { name: "approved_date", kind: "yearmonth", required: true, doc: "Month the GOED board approved the award." },
      { name: "program", kind: "enum", required: true, values: ["nrs-360-754", "pre-2015-standard"], doc: "Statutory program the award was made under." },
      { name: "entity_name", kind: "string", required: true, doc: "Legal applicant entity, as verified against the most authoritative source." },
      { name: "company_id", kind: "ref", required: true, ref: { table: "companies", field: "company_id" }, doc: "Operator this entity belongs to." },
      { name: "county", kind: "enum", required: true, values: COUNTIES, doc: "Nevada county of the facility." },
      { name: "award_type", kind: "enum", required: true, values: ["new", "expansion"], doc: "New facility or expansion of an existing one." },
      { name: "capital_investment_usd", kind: "money", doc: "Capital investment the applicant committed to over five years.", unit: "USD" },
      { name: "jobs_promised", kind: "int", min: 0, doc: "Full-time Nevada-resident jobs committed within five years." },
      { name: "avg_wage_promised_usd", kind: "decimal", min: 0, doc: "Average hourly wage the applicant committed to.", unit: "USD/hour" },
      { name: "statutory_wage_usd", kind: "decimal", min: 0, doc: "Statewide average wage the applicant had to meet, where the source states it.", unit: "USD/hour" },
      { name: "sut_abatement_usd", kind: "money", doc: "Approved partial sales and use tax abatement.", unit: "USD" },
      { name: "sut_years", kind: "int", min: 1, max: 20, doc: "Term of the sales and use tax abatement." },
      { name: "personal_property_abatement_usd", kind: "money", doc: "Approved partial personal property tax abatement.", unit: "USD" },
      { name: "pp_years", kind: "int", min: 1, max: 20, doc: "Term of the personal property tax abatement." },
      { name: "total_abatement_reported_usd", kind: "money", doc: "Total abatement as published, where a source gives a total directly.", unit: "USD" },
      { name: "status", kind: "enum", required: true, values: ["active", "withdrawn", "expired", "rescinded"], doc: "Current state of the award." },
      { name: "verification", kind: "enum", required: true, values: VERIFICATION, doc: "Strength of the best available source." },
      { name: "primary_source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Best source for this row." },
      { name: "source_page", kind: "string", doc: "Page number within the source document." },
      { name: "notes", kind: "text", doc: "Caveats and provenance detail." },
    ],
    checks: [
      (rows) =>
        rows.flatMap((r, i) => {
          const out: Issue[] = [];
          const expected = fiscalYearOf(r.approved_date);
          if (r.fiscal_year && String(expected) !== r.fiscal_year) {
            out.push({
              level: "error", table: "abatements", line: i + 2, field: "fiscal_year",
              message: `approved_date ${r.approved_date} falls in FY${expected}, but fiscal_year is ${r.fiscal_year}`,
            });
          }
          const sut = num(r.sut_abatement_usd);
          const pp = num(r.personal_property_abatement_usd);
          const total = num(r.total_abatement_reported_usd);
          if (sut !== null && pp !== null && total !== null && sut + pp !== total) {
            out.push({
              level: "error", table: "abatements", line: i + 2, field: "total_abatement_reported_usd",
              message: `reported total ${total} does not equal sut ${sut} + personal property ${pp} = ${sut + pp}`,
            });
          }
          if (sut === null && pp === null && total === null) {
            out.push({
              level: "error", table: "abatements", line: i + 2,
              message: "row has no abatement value at all (needs a component or a reported total)",
            });
          }
          // NRS 360.754 tiers: the 20-year term requires 50 jobs and $100M capex.
          const jobs = num(r.jobs_promised);
          const capex = num(r.capital_investment_usd);
          if (num(r.sut_years) === 20) {
            if (jobs !== null && jobs < 50) {
              out.push({ level: "warn", table: "abatements", line: i + 2, field: "jobs_promised",
                message: `20-year term requires 50 jobs under NRS 360.754 but row promises ${jobs}` });
            }
            if (capex !== null && capex < 100_000_000) {
              out.push({ level: "warn", table: "abatements", line: i + 2, field: "capital_investment_usd",
                message: `20-year term requires $100M capital investment but row shows ${capex}` });
            }
          }
          if (num(r.sut_years) === 10 && jobs !== null && jobs < 10) {
            out.push({ level: "warn", table: "abatements", line: i + 2, field: "jobs_promised",
              message: `10-year term requires 10 jobs but row promises ${jobs}` });
          }
          if (r.verification !== "primary" && !r.notes) {
            out.push({ level: "warn", table: "abatements", line: i + 2, field: "notes",
              message: "non-primary rows should explain what still needs verification" });
          }
          return out;
        }),
    ],
  },
  {
    name: "companies",
    file: "companies.csv",
    primaryKey: "company_id",
    doc: "Operators behind the applicant entities, including parent-company attribution and how confident we are in it.",
    fields: [
      { name: "company_id", kind: "slug", required: true, doc: "Stable operator identifier." },
      { name: "display_name", kind: "string", required: true, doc: "Name to show in the interface." },
      { name: "parent_company", kind: "string", doc: "Ultimate parent, where known." },
      { name: "parent_confidence", kind: "enum", required: true, values: CONFIDENCE, doc: "How well the parent attribution is established." },
      { name: "hq_city", kind: "string", doc: "Headquarters city." },
      { name: "hq_state", kind: "string", doc: "Headquarters state." },
      { name: "website", kind: "url", doc: "Official website." },
      { name: "ownership_note", kind: "text", doc: "Ownership and corporate-structure detail." },
      { name: "source_ids", kind: "string", doc: "Space- or comma-separated source ids." },
    ],
  },
  {
    name: "sources",
    file: "sources.csv",
    primaryKey: "source_id",
    doc: "Every document the dataset draws on, with a retrieval date.",
    fields: [
      { name: "source_id", kind: "slug", required: true, doc: "Stable source identifier." },
      { name: "title", kind: "string", required: true, doc: "Document title." },
      { name: "publisher", kind: "string", required: true, doc: "Issuing body." },
      { name: "doc_type", kind: "enum", required: true,
        values: ["report", "board-packet", "press-release", "program-summary", "legislative-memo", "municipal-memo", "news", "news-investigation", "research-report", "statute", "dataset"],
        doc: "Kind of document, which drives how much weight it carries." },
      { name: "published", kind: "date", doc: "Publication date." },
      { name: "retrieved", kind: "date", required: true, doc: "Date this project last fetched it." },
      { name: "url", kind: "url", required: true, doc: "Canonical URL." },
      { name: "notes", kind: "text", doc: "What the document contains and where in it." },
    ],
  },
  {
    name: "discrepancies",
    file: "discrepancies.csv",
    primaryKey: "id",
    doc: "Documented conflicts between sources, and which value this dataset uses.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier." },
      { name: "severity", kind: "enum", required: true, values: ["high", "medium", "low"], doc: "How much the conflict matters to a user of the data." },
      { name: "subject_id", kind: "string", doc: "Affected abatement id, if row-specific." },
      { name: "field", kind: "string", required: true, doc: "Field or figure in dispute." },
      { name: "value_a", kind: "string", required: true, doc: "First value." },
      { name: "source_a", kind: "string", required: true, doc: "Source of the first value." },
      { name: "value_b", kind: "string", required: true, doc: "Second value." },
      { name: "source_b", kind: "string", required: true, doc: "Source of the second value." },
      { name: "resolution", kind: "string", required: true, doc: "Which source this dataset follows, or 'unresolved'." },
      { name: "notes", kind: "text", required: true, doc: "The reasoning, including any arithmetic that settles it." },
    ],
  },
  {
    name: "facilities",
    file: "facilities.csv",
    primaryKey: "id",
    doc: "Nevada data center locations, operational or announced. Presence here does not imply an abatement.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier." },
      { name: "company", kind: "string", required: true, doc: "Operator name as listed in the source inventory." },
      { name: "county", kind: "enum", required: true, values: COUNTIES, doc: "Nevada county." },
      { name: "status", kind: "enum", required: true, values: ["operational", "planned", "unknown"], doc: "Operational, under construction/planned, or undetermined." },
      { name: "status_confidence", kind: "enum", required: true, values: ["high", "low"], doc: "Low where the source's two-column layout could not be separated reliably." },
      { name: "note", kind: "text", doc: "Qualifications." },
      { name: "source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Source inventory." },
    ],
  },
  {
    name: "water",
    file: "water.csv",
    primaryKey: "id",
    doc: "Water observations for Nevada data centers, plus local benchmarks for scale.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier." },
      { name: "subject", kind: "string", required: true, doc: "Facility, aggregate, or benchmark described." },
      { name: "subject_type", kind: "enum", required: true, values: ["facility", "aggregate", "benchmark"], doc: "What kind of thing the row measures." },
      { name: "county", kind: "enum", values: COUNTIES, doc: "County, where applicable." },
      { name: "year", kind: "year", required: true, min: 2000, max: 2040, doc: "Year of the observation." },
      { name: "metric", kind: "enum", required: true, values: ["withdrawn", "consumed", "used", "planned_annual"], doc: "Withdrawal, consumption, unspecified use, or a planning estimate." },
      { name: "gallons", kind: "money", required: true, doc: "Volume in US gallons.", unit: "gallons" },
      { name: "source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Source." },
      { name: "notes", kind: "text", doc: "Caveats, including unit conversions done by the source." },
    ],
  },
  {
    name: "energy",
    file: "energy.csv",
    primaryKey: "id",
    doc: "Energy figures for Nevada data centers and national context.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier." },
      { name: "subject", kind: "string", required: true, doc: "What is measured." },
      { name: "scope", kind: "string", required: true, doc: "Geography the figure covers." },
      { name: "year", kind: "year", required: true, min: 2000, max: 2040, doc: "Year." },
      { name: "metric", kind: "string", required: true, doc: "Metric name." },
      { name: "value", kind: "decimal", required: true, doc: "Value." },
      { name: "unit", kind: "string", required: true, doc: "Unit of measure." },
      { name: "source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Source." },
      { name: "notes", kind: "text", doc: "Detail and attribution chain." },
    ],
  },
  {
    name: "redemptions",
    file: "redemptions.csv",
    doc: "Abatements actually redeemed against a local government's revenue, from audited financial statements.",
    fields: [
      { name: "jurisdiction", kind: "string", required: true, doc: "Local government reporting the impact." },
      { name: "fiscal_year", kind: "year", required: true, min: 2010, max: 2040, doc: "Fiscal year." },
      { name: "program", kind: "enum", required: true, values: ["data-center", "aviation", "standard", "large-scale"], doc: "Abatement program." },
      { name: "amount_usd", kind: "money", required: true, doc: "Amount redeemed.", unit: "USD" },
      { name: "source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Source." },
      { name: "notes", kind: "text", doc: "Caveats." },
    ],
  },
  {
    name: "statewide_wage",
    file: "statewide_wage.csv",
    primaryKey: "fiscal_year",
    doc: "Statewide average hourly wage an applicant must meet, by fiscal year.",
    fields: [
      { name: "fiscal_year", kind: "year", required: true, min: 2010, max: 2040, doc: "Nevada fiscal year." },
      { name: "statewide_avg_wage_usd", kind: "decimal", required: true, min: 0, doc: "Statutory threshold wage.", unit: "USD/hour" },
      { name: "source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Source." },
      { name: "notes", kind: "text", doc: "Caveats." },
    ],
  },
  {
    name: "program_audit_summary",
    file: "program_audit_summary.csv",
    primaryKey: "fiscal_year",
    doc: "GOED's own promised-versus-audited totals. Program-wide (standard, aviation and data center), not data-center-only.",
    fields: [
      { name: "fiscal_year", kind: "year", required: true, min: 2010, max: 2040, doc: "Fiscal year." },
      { name: "scope", kind: "string", required: true, doc: "Population the row covers." },
      { name: "statutory_capex_usd", kind: "money", doc: "Statutory minimum capital investment.", unit: "USD" },
      { name: "statutory_jobs", kind: "int", min: 0, doc: "Statutory minimum jobs." },
      { name: "statutory_wage_usd", kind: "decimal", min: 0, doc: "Statutory wage.", unit: "USD/hour" },
      { name: "projected_capex_usd", kind: "money", doc: "Capital investment companies projected.", unit: "USD" },
      { name: "projected_jobs", kind: "int", min: 0, doc: "Jobs companies projected." },
      { name: "projected_wage_usd", kind: "decimal", min: 0, doc: "Wage companies projected.", unit: "USD/hour" },
      { name: "audited_capex_usd", kind: "money", doc: "Capital investment found at audit.", unit: "USD" },
      { name: "audited_jobs", kind: "int", min: 0, doc: "Jobs found at audit." },
      { name: "audited_wage_usd", kind: "decimal", min: 0, doc: "Wage found at audit.", unit: "USD/hour" },
      { name: "total_partial_abatements_usd", kind: "money", doc: "Abatements for audited companies.", unit: "USD" },
      { name: "audit_state", kind: "enum", required: true, values: ["complete", "pending"], doc: "Whether audits for the year are done." },
    ],
  },
  {
    name: "compliance_rates",
    file: "compliance_rates.csv",
    primaryKey: "fiscal_year",
    doc: "Approval, withdrawal and compliance counts across all GOED abatement programs.",
    fields: [
      { name: "fiscal_year", kind: "year", required: true, min: 2010, max: 2040, doc: "Fiscal year." },
      { name: "approved", kind: "int", required: true, min: 0, doc: "Businesses approved." },
      { name: "withdrew", kind: "int", required: true, min: 0, doc: "Businesses that withdrew." },
      { name: "use_percentage", kind: "decimal", min: 0, max: 100, doc: "Share that used their abatement.", unit: "percent" },
      { name: "noncompliant", kind: "int", min: 0, doc: "Businesses found non-compliant." },
      { name: "noncompliance_rate", kind: "decimal", min: 0, max: 100, doc: "Non-compliance rate.", unit: "percent" },
      { name: "participating_and_compliant", kind: "int", min: 0, doc: "Businesses participating and compliant." },
      { name: "compliance_rate", kind: "decimal", min: 0, max: 100, doc: "Compliance rate.", unit: "percent" },
    ],
  },
  {
    name: "policy_timeline",
    file: "policy_timeline.csv",
    primaryKey: "id",
    doc: "Statutes, standards and local-government actions that shape the program.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier." },
      { name: "date", kind: "date", required: true, doc: "Date of the event." },
      { name: "title", kind: "string", required: true, doc: "What happened." },
      { name: "category", kind: "enum", required: true, values: ["statute", "accounting-standard", "local-government", "legislative", "goed-board", "report"], doc: "Kind of event." },
      { name: "citation", kind: "string", doc: "Statute or document citation." },
      { name: "verification", kind: "enum", required: true, values: VERIFICATION, doc: "Strength of sourcing." },
      { name: "source_id", kind: "string", doc: "Source id, blank where the event is still unverified." },
      { name: "notes", kind: "text", doc: "Detail." },
    ],
  },
  {
    name: "accountability_findings",
    file: "accountability_findings.csv",
    primaryKey: "id",
    doc: "Published findings about oversight gaps in the program.",
    fields: [
      { name: "id", kind: "slug", required: true, doc: "Stable identifier." },
      { name: "finding", kind: "string", required: true, doc: "The finding." },
      { name: "as_of", kind: "string", required: true, doc: "Period the finding describes." },
      { name: "metric", kind: "string", required: true, doc: "Metric name." },
      { name: "value", kind: "decimal", required: true, doc: "Value." },
      { name: "unit", kind: "string", required: true, doc: "Unit." },
      { name: "source_id", kind: "ref", required: true, ref: { table: "sources", field: "source_id" }, doc: "Source." },
      { name: "notes", kind: "text", doc: "Detail." },
    ],
  },
];

export function num(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const PATTERNS: Partial<Record<FieldKind, RegExp>> = {
  slug: /^[a-z0-9][a-z0-9-]*$/,
  year: /^\d{4}$/,
  yearmonth: /^\d{4}-(0[1-9]|1[0-2])$/,
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  int: /^-?\d+$/,
  money: /^-?\d+$/,
  decimal: /^-?\d+(\.\d+)?$/,
  url: /^https?:\/\/\S+$/,
};

/** Validate one table's rows against its schema, including reference integrity. */
export function validateTable(def: TableDef, rows: Row[], all: Record<string, Row[]>): Issue[] {
  const issues: Issue[] = [];
  const declared = new Set(def.fields.map((f) => f.name));

  if (rows.length > 0) {
    for (const key of Object.keys(rows[0])) {
      if (!declared.has(key)) {
        issues.push({ level: "error", table: def.name, field: key, message: `undeclared column '${key}'` });
      }
    }
    for (const f of def.fields) {
      if (!(f.name in rows[0])) {
        issues.push({ level: "error", table: def.name, field: f.name, message: `missing column '${f.name}'` });
      }
    }
  }

  const seenPk = new Map<string, number>();

  rows.forEach((row, idx) => {
    const line = idx + 2;

    if (def.primaryKey) {
      const pk = row[def.primaryKey];
      if (seenPk.has(pk)) {
        issues.push({ level: "error", table: def.name, line, field: def.primaryKey,
          message: `duplicate key '${pk}' (also on line ${seenPk.get(pk)})` });
      } else seenPk.set(pk, line);
    }

    for (const f of def.fields) {
      const raw = row[f.name];
      if (raw === undefined) continue;
      const v = raw.trim();

      if (v === "") {
        if (f.required) {
          issues.push({ level: "error", table: def.name, line, field: f.name, message: "required value is empty" });
        }
        continue;
      }
      if (raw !== v) {
        issues.push({ level: "warn", table: def.name, line, field: f.name, message: "value has leading or trailing whitespace" });
      }

      const pat = PATTERNS[f.kind];
      if (pat && !pat.test(v)) {
        issues.push({ level: "error", table: def.name, line, field: f.name,
          message: `'${v}' is not a valid ${f.kind}` });
        continue;
      }
      if (f.kind === "enum" && f.values && !f.values.includes(v)) {
        issues.push({ level: "error", table: def.name, line, field: f.name,
          message: `'${v}' not in {${f.values.join(", ")}}` });
      }
      if (f.kind === "ref" && f.ref) {
        const target = all[f.ref.table] ?? [];
        if (!target.some((t) => t[f.ref!.field] === v)) {
          issues.push({ level: "error", table: def.name, line, field: f.name,
            message: `'${v}' not found in ${f.ref.table}.${f.ref.field}` });
        }
      }
      const n = num(v);
      if (n !== null) {
        if (f.min !== undefined && n < f.min) {
          issues.push({ level: "error", table: def.name, line, field: f.name, message: `${n} is below minimum ${f.min}` });
        }
        if (f.max !== undefined && n > f.max) {
          issues.push({ level: "error", table: def.name, line, field: f.name, message: `${n} is above maximum ${f.max}` });
        }
      }
    }
  });

  for (const check of def.checks ?? []) issues.push(...check(rows, all));
  return issues;
}
