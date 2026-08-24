#!/usr/bin/env node
/**
 * Verify every source URL still resolves. Government PDFs get moved and
 * silently 404 constantly, which is exactly how a citation-based dataset rots.
 *
 * A 403 or 429 is reported but does not fail the run: those mean "we could not
 * check" (bot protection, rate limiting), not "the document is gone". Only a
 * real miss or a network failure is treated as rot.
 */

import { loadDataset } from "../lib/load.ts";

const { tables } = loadDataset();
const TIMEOUT_MS = 25_000;

type Verdict = "ok" | "blocked" | "missing";
interface Result { id: string; url: string; status: number | string; verdict: Verdict }

async function probe(id: string, url: string): Promise<Result> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    // Some hosts reject HEAD outright; fall back to a small ranged GET.
    let res = await fetch(url, { method: "HEAD", signal, redirect: "follow" });
    if (res.status === 405 || res.status === 501 || res.status === 403) {
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-2047", "User-Agent": "nv-datacenter-tracker source checker" },
        signal, redirect: "follow",
      });
    }
    const verdict: Verdict = res.ok || res.status === 206 ? "ok"
      : res.status === 403 || res.status === 429 ? "blocked"
      : "missing";
    return { id, url, status: res.status, verdict };
  } catch (err) {
    return { id, url, status: (err as Error).name || "error", verdict: "missing" };
  }
}

const results = await Promise.all(tables.sources.map((s) => probe(s.source_id, s.url)));
const rank = { missing: 0, blocked: 1, ok: 2 } as const;
const label = { ok: "ok     ", blocked: "BLOCKED", missing: "MISSING" } as const;

for (const r of results.sort((a, b) => rank[a.verdict] - rank[b.verdict])) {
  console.log(`${label[r.verdict]}  ${String(r.status).padEnd(8)} ${r.id.padEnd(28)} ${r.url}`);
}

const missing = results.filter((r) => r.verdict === "missing");
const blocked = results.filter((r) => r.verdict === "blocked");

console.log(`\n${results.length - missing.length - blocked.length}/${results.length} verified reachable.`);
if (blocked.length) {
  console.log(`${blocked.length} could not be checked (403/429, bot protection or rate limiting). ` +
    `Confirm by hand; these are not treated as failures.`);
}
if (missing.length) {
  console.log(`${missing.length} unreachable. Each needs a replacement URL or a web.archive.org snapshot in data/sources.csv.`);
  process.exit(1);
}
