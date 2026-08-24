#!/usr/bin/env node
/**
 * Build dist/: the static site, a versioned JSON API, bulk exports, JSON Schema
 * and a generated data dictionary. Fails if the dataset does not validate.
 */

import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadDataset, errorsOf, formatIssue, DATA_DIR } from "../lib/load.ts";
import { TABLES, num, type Field } from "../lib/schema.ts";
import {
  toAbatement, totals, groupBy, cumulativeByFiscalYear, deliveryRatios, round4,
} from "../lib/derive.ts";
import { projectNevada } from "../lib/geo.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const SITE = join(ROOT, "src/site");
const DIST = join(ROOT, "dist");
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version as string;
const GENERATED = process.env.BUILD_TIME || new Date().toISOString();

const { tables, issues } = loadDataset();
const errors = errorsOf(issues);
if (errors.length) {
  console.error("Refusing to build, dataset has errors:\n");
  for (const e of errors) console.error(formatIssue(e));
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
const dir = (...p: string[]) => {
  const d = join(DIST, ...p);
  mkdirSync(d, { recursive: true });
  return d;
};
const write = (path: string, body: string) => writeFileSync(join(DIST, path), body);
const json = (path: string, data: unknown) => write(path, JSON.stringify(data, null, 2) + "\n");

dir("api/v1/award");
dir("data/geo");
dir("exports");
dir("schema");

/* --------------------------------------------------------------- derived --- */
const abatements = tables.abatements.map(toAbatement);
const active = abatements.filter((a) => a.status === "active");
const audit = tables.program_audit_summary;
const complete = audit.filter((r) => r.audit_state === "complete");

const sumOf = (field: string) => complete.reduce((a, r) => a + (num(r[field]) ?? 0), 0);
const jobsWeighted = (wage: string, jobs: string) =>
  complete.reduce((a, r) => a + (num(r[wage]) ?? 0) * (num(r[jobs]) ?? 0), 0);

const summary = {
  totals: totals(abatements),
  byCounty: groupBy(active, (a) => a.county),
  byCompany: groupBy(active, (a) => a.companyId),
  byFiscalYear: groupBy(active, (a) => a.fiscalYear),
  cumulative: cumulativeByFiscalYear(abatements),
  deliveryRatios: deliveryRatios(audit),
  deliveryTotals: {
    capexRatio: round4(sumOf("audited_capex_usd") / sumOf("projected_capex_usd")),
    jobsRatio: round4(sumOf("audited_jobs") / sumOf("projected_jobs")),
    wageRatio: round4(
      jobsWeighted("audited_wage_usd", "audited_jobs") / sumOf("audited_jobs") /
      (jobsWeighted("projected_wage_usd", "projected_jobs") / sumOf("projected_jobs")),
    ),
    scope: "All GOED abatement programs (standard, aviation and data center), FY2010-FY2019 completed audits.",
  },
  waterGrowth: (() => {
    const a = tables.water.find((w) => w.id === "google-storey-2023-withdrawn");
    const b = tables.water.find((w) => w.id === "google-storey-2024-withdrawn");
    return a && b ? round4(Number(b.gallons) / Number(a.gallons)) : null;
  })(),
};

// 460px wide keeps Nevada's tall aspect ratio readable beside a stats panel.
const geo = projectNevada(join(DATA_DIR, "geo/nv-counties.geojson"), 460);

const rowCounts = Object.fromEntries(TABLES.map((t) => [t.name, tables[t.name].length]));
const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
const meta = { version: VERSION, generated: GENERATED, rowCounts, totalRows, license: { data: "CC-BY-4.0", code: "MIT" } };

const camel: Record<string, string> = {
  statewide_wage: "statewideWage",
  program_audit_summary: "programAudit",
  compliance_rates: "complianceRates",
  policy_timeline: "policyTimeline",
  accountability_findings: "accountabilityFindings",
};
const payload: Record<string, unknown> = { meta, summary, geo, abatements };
for (const t of TABLES) {
  if (t.name === "abatements") continue;
  payload[camel[t.name] ?? t.name] = tables[t.name];
}

/* ------------------------------------------------------------------- API --- */
json("api/v1/all.json", payload);
json("api/v1/summary.json", { meta, ...summary });
json("api/v1/geo.json", { meta, ...geo });
json("api/v1/abatements.json", { meta, abatements });
for (const t of TABLES) {
  if (t.name === "abatements") continue;
  json(`api/v1/${t.name}.json`, { meta, [t.name]: tables[t.name] });
}
for (const a of abatements) {
  json(`api/v1/award/${a.id}.json`, {
    meta,
    award: a,
    company: tables.companies.find((c) => c.company_id === a.companyId) ?? null,
    source: tables.sources.find((s) => s.source_id === a.sourceId) ?? null,
    discrepancies: tables.discrepancies.filter((d) => d.subject_id === a.id),
  });
}
json("api/v1/index.json", {
  meta,
  endpoints: [
    "/api/v1/all.json", "/api/v1/summary.json", "/api/v1/abatements.json",
    "/api/v1/geo.json",
    ...TABLES.filter((t) => t.name !== "abatements").map((t) => `/api/v1/${t.name}.json`),
    ...abatements.map((a) => `/api/v1/award/${a.id}.json`),
  ],
});

/* --------------------------------------------------------------- exports --- */
for (const t of TABLES) cpSync(join(DATA_DIR, t.file), join(DIST, "data", t.file));
cpSync(join(DATA_DIR, "geo/nv-counties.geojson"), join(DIST, "data/geo/nv-counties.geojson"));

json("exports/nv-datacenter-tracker.json", payload);
write("exports/abatements.jsonl", abatements.map((a) => JSON.stringify(a)).join("\n") + "\n");

const sqlType = (f: Field) =>
  f.kind === "int" || f.kind === "money" || f.kind === "year" ? "INTEGER"
    : f.kind === "decimal" ? "REAL" : "TEXT";
const sqlLit = (v: string, f: Field) => {
  if (v === "") return "NULL";
  if (sqlType(f) !== "TEXT") return num(v) === null ? "NULL" : v;
  return `'${v.replace(/'/g, "''")}'`;
};
const sql = [
  "-- Nevada Data Center Tax Abatement Tracker",
  `-- version ${VERSION}, generated ${GENERATED}`,
  "-- Load with: sqlite3 tracker.db < nv-datacenter-tracker.sql",
  "BEGIN;",
  ...TABLES.flatMap((t) => [
    `DROP TABLE IF EXISTS ${t.name};`,
    `CREATE TABLE ${t.name} (\n${t.fields.map((f) =>
      `  ${f.name} ${sqlType(f)}${f.name === t.primaryKey ? " PRIMARY KEY" : ""}`).join(",\n")}\n);`,
    ...tables[t.name].map((row) =>
      `INSERT INTO ${t.name} (${t.fields.map((f) => f.name).join(", ")}) VALUES (${
        t.fields.map((f) => sqlLit((row[f.name] ?? "").trim(), f)).join(", ")});`),
    "",
  ]),
  "COMMIT;",
].join("\n");
write("exports/nv-datacenter-tracker.sql", sql + "\n");

/* ---------------------------------------------------- schema & datapackage */
const jsonSchemaType = (f: Field) =>
  f.kind === "int" || f.kind === "money" || f.kind === "year" ? "integer"
    : f.kind === "decimal" ? "number" : "string";

for (const t of TABLES) {
  json(`schema/${t.name}.schema.json`, {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://nv-datacenter-tracker.pages.dev/schema/${t.name}.schema.json`,
    title: t.name,
    description: t.doc,
    type: "array",
    items: {
      type: "object",
      required: t.fields.filter((f) => f.required).map((f) => f.name),
      additionalProperties: false,
      properties: Object.fromEntries(t.fields.map((f) => [f.name, {
        type: f.required ? jsonSchemaType(f) : [jsonSchemaType(f), "null"],
        description: f.doc,
        ...(f.values ? { enum: [...f.values] } : {}),
        ...(f.unit ? { unit: f.unit } : {}),
        ...(f.min !== undefined ? { minimum: f.min } : {}),
        ...(f.max !== undefined ? { maximum: f.max } : {}),
      }])),
    },
  });
}

json("datapackage.json", {
  $schema: "https://datapackage.org/profiles/2.0/datapackage.json",
  name: "nv-datacenter-tracker",
  title: "Nevada Data Center Tax Abatement Tracker",
  description: "Nevada data center tax abatements approved under NRS 360.754: what was promised, what it cost, and what was delivered.",
  version: VERSION,
  created: GENERATED,
  licenses: [
    { name: "CC-BY-4.0", path: "https://creativecommons.org/licenses/by/4.0/", title: "Creative Commons Attribution 4.0" },
  ],
  resources: TABLES.map((t) => ({
    name: t.name,
    path: `data/${t.file}`,
    format: "csv",
    mediatype: "text/csv",
    encoding: "utf-8",
    description: t.doc,
    schema: {
      primaryKey: t.primaryKey,
      fields: t.fields.map((f) => ({
        name: f.name,
        type: jsonSchemaType(f) === "integer" ? "integer" : jsonSchemaType(f) === "number" ? "number" : "string",
        title: f.name,
        description: f.doc,
        ...(f.unit ? { unit: f.unit } : {}),
        ...(f.values ? { constraints: { enum: [...f.values] } } : {}),
      })),
    },
  })),
});

/* ------------------------------------------------------------------ site --- */
for (const f of readdirSync(SITE)) cpSync(join(SITE, f), join(DIST, f));

// CORS + caching for Cloudflare and Netlify-style hosts.
write("_headers", [
  "/api/*", "  Access-Control-Allow-Origin: *", "  Cache-Control: public, max-age=300",
  "/exports/*", "  Access-Control-Allow-Origin: *",
  "/data/*", "  Access-Control-Allow-Origin: *",
  "/schema/*", "  Access-Control-Allow-Origin: *",
  "/*", "  X-Content-Type-Options: nosniff", "  Referrer-Policy: strict-origin-when-cross-origin",
].join("\n") + "\n");

write("robots.txt", "User-agent: *\nAllow: /\n");
write(".nojekyll", "");

/* -------------------------------------------------------- data dictionary --- */
const dict = [
  "# Data dictionary",
  "",
  "<!-- Generated by `npm run build`. Edit src/lib/schema.ts, not this file. -->",
  "",
  `Dataset version ${VERSION}. ${totalRows} rows across ${TABLES.length} tables.`,
  "",
  "| Table | Rows | Description |",
  "| --- | --: | --- |",
  ...TABLES.map((t) => `| [\`${t.file}\`](../data/${t.file}) | ${rowCounts[t.name]} | ${t.doc} |`),
  "",
  ...TABLES.flatMap((t) => [
    `## \`${t.file}\``,
    "",
    t.doc,
    "",
    t.primaryKey ? `Primary key: \`${t.primaryKey}\`` : "_No single-column primary key._",
    "",
    "| Column | Type | Required | Unit | Description |",
    "| --- | --- | --- | --- | --- |",
    ...t.fields.map((f) => {
      const type = f.values ? `enum: ${f.values.map((v) => `\`${v}\``).join(", ")}`
        : f.ref ? `ref → \`${f.ref.table}.${f.ref.field}\`` : `\`${f.kind}\``;
      return `| \`${f.name}\` | ${type} | ${f.required ? "yes" : "" } | ${f.unit ?? ""} | ${f.doc} |`;
    }),
    "",
  ]),
].join("\n");
mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(join(ROOT, "docs/DATA_DICTIONARY.md"), dict + "\n");

/* ---------------------------------------------------------------- report --- */
const count = (p: string) => readdirSync(join(DIST, p)).length;
console.log(`Built dist/ for dataset ${VERSION}`);
console.log(`  ${totalRows} rows, ${TABLES.length} tables`);
console.log(`  api/v1: ${count("api/v1")} files + ${count("api/v1/award")} award records`);
console.log(`  exports: ${count("exports")} files, schema: ${count("schema")} files`);
console.log(`  map: ${geo.counties.length} counties projected to ${geo.viewBox}`);
console.log(`  active awards: ${active.length}, total abatement: $${summary.totals.totalAbatement.toLocaleString("en-US")}`);
console.log(`  docs/DATA_DICTIONARY.md regenerated`);
