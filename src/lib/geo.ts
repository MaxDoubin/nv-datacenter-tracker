/**
 * Project the committed Nevada county geometry into SVG path data at build
 * time, so the browser never has to do trigonometry or ship a mapping library.
 *
 * Albers equal-area conic, standard parallels chosen for Nevada. Equal-area
 * matters for a choropleth: an equirectangular projection would stretch Elko
 * and Humboldt relative to Clark and misrepresent how much of the state each
 * shaded county covers.
 */

import { readFileSync } from "node:fs";

const PHI1 = (36 * Math.PI) / 180;
const PHI2 = (41 * Math.PI) / 180;
const PHI0 = (38.5 * Math.PI) / 180;
const LAM0 = (-117 * Math.PI) / 180;

const N = (Math.sin(PHI1) + Math.sin(PHI2)) / 2;
const C = Math.cos(PHI1) ** 2 + 2 * N * Math.sin(PHI1);
const RHO0 = Math.sqrt(C - 2 * N * Math.sin(PHI0)) / N;

function albers(lon: number, lat: number): [number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  const rho = Math.sqrt(Math.max(0, C - 2 * N * Math.sin(phi))) / N;
  const theta = N * (lam - LAM0);
  // Negate y so north is up once we are in SVG's y-down coordinate space.
  return [rho * Math.sin(theta), -(RHO0 - rho * Math.cos(theta))];
}

export interface ProjectedCounty {
  name: string;
  fips: string;
  path: string;
  /** Visual centre of the largest ring, for label placement. */
  centroid: [number, number];
  landSqMi: number;
}

export interface ProjectedMap {
  width: number;
  height: number;
  viewBox: string;
  counties: ProjectedCounty[];
  attribution: string;
  processing: string;
}

/** Area-weighted centroid of a closed ring, via the shoelace formula. */
function ringCentroid(ring: Array<[number, number]>): { c: [number, number]; area: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  a /= 2;
  // A degenerate ring has no meaningful centroid; fall back to its first point.
  if (Math.abs(a) < 1e-12) return { c: ring[0], area: 0 };
  return { c: [cx / (6 * a), cy / (6 * a)], area: Math.abs(a) };
}

export function projectNevada(geojsonPath: string, width = 760, pad = 12): ProjectedMap {
  const fc = JSON.parse(readFileSync(geojsonPath, "utf8"));

  // First pass: project everything and find the bounding box.
  const projected = fc.features.map((f: any) => ({
    name: f.properties.name as string,
    fips: f.id as string,
    landSqMi: f.properties.land_sq_mi as number,
    polys: (f.geometry.coordinates as number[][][][]).map((poly) =>
      poly.map((ring) => ring.map(([lon, lat]) => albers(lon, lat)))),
  }));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of projected) {
    for (const poly of f.polys) for (const ring of poly) for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const scale = (width - pad * 2) / (maxX - minX);
  const height = Math.round((maxY - minY) * scale + pad * 2);
  const tx = (x: number) => (x - minX) * scale + pad;
  const ty = (y: number) => (y - minY) * scale + pad;
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const counties: ProjectedCounty[] = projected.map((f) => {
    const parts: string[] = [];
    let best: { c: [number, number]; area: number } = { c: [0, 0], area: -1 };
    for (const poly of f.polys) {
      for (const ring of poly) {
        const pts = ring.map(([x, y]) => [tx(x), ty(y)] as [number, number]);
        parts.push("M" + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join("L") + "Z");
        const cen = ringCentroid(pts);
        if (cen.area > best.area) best = cen;
      }
    }
    return {
      name: f.name,
      fips: f.fips,
      path: parts.join(""),
      centroid: [r2(best.c[0]), r2(best.c[1])],
      landSqMi: f.landSqMi,
    };
  });

  return {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    counties: counties.sort((a, b) => a.name.localeCompare(b.name)),
    attribution: fc.metadata.source,
    processing: fc.metadata.processing,
  };
}
