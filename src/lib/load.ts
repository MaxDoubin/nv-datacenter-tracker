/** Read every table out of data/, validate it, and hand back typed rows. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, type Row } from "./csv.ts";
import { TABLES, validateTable, type Issue } from "./schema.ts";

export interface Dataset {
  tables: Record<string, Row[]>;
  issues: Issue[];
}

export const DATA_DIR = new URL("../../data/", import.meta.url).pathname;

export function loadDataset(dir: string = DATA_DIR): Dataset {
  const tables: Record<string, Row[]> = {};
  const issues: Issue[] = [];

  for (const def of TABLES) {
    const path = join(dir, def.file);
    try {
      tables[def.name] = parseCsv(readFileSync(path, "utf8"), def.file);
    } catch (err) {
      tables[def.name] = [];
      issues.push({ level: "error", table: def.name, message: (err as Error).message });
    }
  }

  // Reference checks need every table present, so validate in a second pass.
  for (const def of TABLES) {
    issues.push(...validateTable(def, tables[def.name], tables));
  }

  return { tables, issues };
}

export function errorsOf(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.level === "error");
}

export function formatIssue(i: Issue): string {
  const where = [i.table, i.line ? `line ${i.line}` : null, i.field].filter(Boolean).join(" / ");
  return `${i.level === "error" ? "ERROR" : "warn "}  ${where}: ${i.message}`;
}
