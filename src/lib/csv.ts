/**
 * RFC 4180 CSV reader/writer. No dependencies.
 *
 * The dataset is the product here, so parsing is strict: a ragged row is an
 * error rather than something to pad or truncate silently.
 */

export type Row = Record<string, string>;

/** Parse CSV text into a matrix of raw cells. */
export function parseMatrix(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  let sawAnyChar = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawAnyChar = false;
  };

  while (i < src.length) {
    const c = src[i];

    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      if (field !== "") {
        throw new CsvError(`stray quote mid-field at offset ${i}`, lineOf(src, i));
      }
      quoted = true;
      sawAnyChar = true;
      i++;
      continue;
    }
    if (c === ",") {
      endField();
      sawAnyChar = true;
      i++;
      continue;
    }
    if (c === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
      i++;
      continue;
    }
    if (c === "\n") {
      endRow();
      i++;
      continue;
    }
    field += c;
    sawAnyChar = true;
    i++;
  }

  if (quoted) throw new CsvError("unterminated quoted field", lineOf(src, src.length));
  // A trailing newline leaves an empty pending row; only keep real content.
  if (sawAnyChar || field !== "" || row.length > 0) endRow();

  return rows;
}

/** Parse CSV text into objects keyed by the header row. */
export function parseCsv(text: string, label = "<csv>"): Row[] {
  const matrix = parseMatrix(text);
  if (matrix.length === 0) throw new CsvError(`${label}: file is empty`);

  const header = matrix[0].map((h) => h.trim());
  const dupes = header.filter((h, idx) => header.indexOf(h) !== idx);
  if (dupes.length) {
    throw new CsvError(`${label}: duplicate column name(s): ${[...new Set(dupes)].join(", ")}`);
  }
  const blank = header.findIndex((h) => h === "");
  if (blank !== -1) throw new CsvError(`${label}: column ${blank + 1} has an empty name`);

  const out: Row[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    if (cells.length === 1 && cells[0].trim() === "") continue; // blank line
    if (cells.length !== header.length) {
      throw new CsvError(
        `${label}: line ${r + 1} has ${cells.length} field(s), header has ${header.length}`,
      );
    }
    const obj: Row = {};
    header.forEach((h, c) => {
      obj[h] = cells[c];
    });
    out.push(obj);
  }
  return out;
}

/** Quote a single cell only when it needs it, so diffs stay minimal. */
export function quoteCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize objects back to CSV using an explicit column order. */
export function toCsv(rows: readonly Row[], columns: readonly string[]): string {
  const lines = [columns.map(quoteCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => quoteCell(row[c] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}

export class CsvError extends Error {
  readonly line?: number;
  constructor(message: string, line?: number) {
    super(line === undefined ? message : `${message} (line ${line})`);
    this.name = "CsvError";
    this.line = line;
  }
}

function lineOf(src: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === "\n") n++;
  return n;
}
