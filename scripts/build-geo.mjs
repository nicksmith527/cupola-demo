#!/usr/bin/env node
// Turns the US county/state boundary file (data/geo/counties-albers-10m.json,
// fetched by .github/workflows/fetch-map-data.yml) into small, ready-to-draw
// SVG path files, so the browser never has to decode or project anything:
//
//   data/geo/state-12.json   Florida counties
//   data/geo/state-08.json   Colorado counties
//   data/geo/states.json     every state (national view)
//
// Usage:  node scripts/build-geo.mjs [stateFips ...]   (default: 12 08)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GEO = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "geo");
const topo = JSON.parse(readFileSync(join(GEO, "counties-albers-10m.json"), "utf8"));
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["12", "08"];

// --- TopoJSON decoding -------------------------------------------------------
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});

function ring(indexes) {
  const pts = [];
  for (const i of indexes) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    a.forEach((p, k) => { if (k > 0 || pts.length === 0) pts.push(p); });
  }
  return pts;
}

function polygons(geom) {
  if (geom.type === "Polygon") return [geom.arcs.map(ring)];
  if (geom.type === "MultiPolygon") return geom.arcs.map((poly) => poly.map(ring));
  return [];
}

// Counties are drawn zoomed in, so they keep more precision than states.
let PREC = 10;
const r1 = (n) => Math.round(n * PREC) / PREC;

function feature(geom) {
  const polys = polygons(geom);
  let d = "";
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let best = { area: 0, cx: 0, cy: 0 };
  for (const poly of polys) {
    poly.forEach((pts, ri) => {
      // Drop consecutive points that round to the same spot.
      let last = "";
      const parts = [];
      for (const [x, y] of pts) {
        const key = `${r1(x)},${r1(y)}`;
        if (key === last) continue;
        parts.push(key);
        last = key;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      if (parts.length > 2) d += "M" + parts.join("L") + "Z";
      // Label point: area centroid of the largest outer ring.
      if (ri === 0) {
        let a = 0, cx = 0, cy = 0;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
          a += f; cx += (pts[j][0] + pts[i][0]) * f; cy += (pts[j][1] + pts[i][1]) * f;
        }
        a /= 2;
        if (Math.abs(a) > best.area) best = { area: Math.abs(a), cx: cx / (6 * a), cy: cy / (6 * a) };
      }
    });
  }
  return {
    id: geom.id,
    name: geom.properties?.name ?? "",
    d,
    bbox: [r1(minX), r1(minY), r1(maxX), r1(maxY)],
    label: [r1(best.cx), r1(best.cy)],
  };
}

const STATE_ABBR = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC",
  "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT",
  "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

function bboxOf(features) {
  return features.reduce(
    (b, f) => [Math.min(b[0], f.bbox[0]), Math.min(b[1], f.bbox[1]), Math.max(b[2], f.bbox[2]), Math.max(b[3], f.bbox[3])],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
}

// --- States (national view) --------------------------------------------------
const states = topo.objects.states.geometries.map((g) => ({ ...feature(g), abbr: STATE_ABBR[g.id] }));
writeFileSync(join(GEO, "states.json"), JSON.stringify({ bbox: bboxOf(states), features: states }));
console.log(`wrote data/geo/states.json (${states.length} states)`);

// --- Counties for each wanted state -----------------------------------------
PREC = 100;
for (const fips of wanted) {
  const counties = topo.objects.counties.geometries.filter((g) => g.id.startsWith(fips)).map(feature);
  const outline = states.find((s) => s.id === fips);
  writeFileSync(
    join(GEO, `state-${fips}.json`),
    JSON.stringify({ state: outline.name, abbr: outline.abbr, bbox: bboxOf(counties), outline: outline.d, features: counties })
  );
  console.log(`wrote data/geo/state-${fips}.json (${outline.name}, ${counties.length} counties)`);
}
