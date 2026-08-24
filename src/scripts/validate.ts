#!/usr/bin/env node
/** CI gate: fail on any error-level issue in data/. */

import { loadDataset, errorsOf, formatIssue } from "../lib/load.ts";
import { TABLES } from "../lib/schema.ts";

const strict = process.argv.includes("--strict");
const { tables, issues } = loadDataset();

for (const def of TABLES) {
  const n = tables[def.name]?.length ?? 0;
  console.log(`  ${String(n).padStart(4)}  ${def.name}`);
}

const errors = errorsOf(issues);
const warnings = issues.filter((i) => i.level === "warn");

if (issues.length) {
  console.log("");
  for (const i of [...errors, ...warnings]) console.log(formatIssue(i));
}

const rows = Object.values(tables).reduce((a, t) => a + t.length, 0);
console.log(`\n${rows} rows across ${TABLES.length} tables, ${errors.length} error(s), ${warnings.length} warning(s)`);

if (errors.length || (strict && warnings.length)) process.exit(1);
