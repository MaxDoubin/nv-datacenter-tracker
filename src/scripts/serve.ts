#!/usr/bin/env node
/** Minimal static server for previewing dist/ locally. */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const DIST = new URL("../../dist/", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8787);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".sql": "text/plain; charset=utf-8",
  ".jsonl": "application/x-ndjson", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    // normalize() collapses any ../ before it can escape DIST.
    let path = join(DIST, normalize(decodeURIComponent(url.pathname)));
    if (!path.startsWith(DIST)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, "index.html");
    const body = await readFile(path);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(path)] ?? "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
    }).end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
}).listen(PORT, () => console.log(`dist/ on http://localhost:${PORT}`));
