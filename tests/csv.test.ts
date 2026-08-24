import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseMatrix, toCsv, quoteCell, CsvError } from "../src/lib/csv.ts";

test("parses quoted commas and escaped quotes", () => {
  const rows = parseCsv('a,b\n1,"x,y"\n2,"he said ""hi"""\n');
  assert.deepEqual(rows, [{ a: "1", b: "x,y" }, { a: "2", b: 'he said "hi"' }]);
});

test("parses embedded newlines inside quotes", () => {
  assert.equal(parseCsv('a,b\n1,"l1\nl2"\n')[0].b, "l1\nl2");
});

test("handles CRLF and a BOM", () => {
  assert.deepEqual(parseCsv("﻿a,b\r\n1,2\r\n"), [{ a: "1", b: "2" }]);
});

test("skips a trailing blank line but keeps empty trailing fields", () => {
  assert.deepEqual(parseCsv("a,b\n1,\n"), [{ a: "1", b: "" }]);
});

test("rejects ragged rows", () => {
  assert.throws(() => parseCsv("a,b\n1,2,3\n"), CsvError);
});

test("rejects duplicate and empty header names", () => {
  assert.throws(() => parseCsv("a,a\n1,2\n"), CsvError);
  assert.throws(() => parseCsv("a,\n1,2\n"), CsvError);
});

test("rejects an unterminated quote", () => {
  assert.throws(() => parseCsv('a\n"oops\n'), CsvError);
});

test("quotes only what needs quoting", () => {
  assert.equal(quoteCell("plain"), "plain");
  assert.equal(quoteCell("a,b"), '"a,b"');
  assert.equal(quoteCell('say "hi"'), '"say ""hi"""');
});

test("round-trips", () => {
  const text = 'a,b,c\n1,"x,y","q""z"\n2,,w\n';
  assert.equal(toCsv(parseCsv(text), ["a", "b", "c"]), text);
});

test("parseMatrix keeps the header as row zero", () => {
  assert.deepEqual(parseMatrix("a,b\n1,2\n")[0], ["a", "b"]);
});
