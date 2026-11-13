#!/usr/bin/env node
// Generates the synthetic sample data in data/sample/.
//
// Everything here is invented: the venue, halls, titles, ZIP codes, counties
// and every number. A fixed seed means the output is identical on every run,
// so the demo tells the same story every time. Change SEED for a new story.
//
// Dates are stored RELATIVE to "today" (daysOut, yearsAgo) and turned into
// real dates by the sample source at runtime, so the demo never looks stale.
//
// Usage:  node scripts/generate-sample-data.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEED = 20261112;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "sample");
mkdirSync(OUT, { recursive: true });

// --- Seeded random helpers -------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const between = (lo, hi) => lo + rand() * (hi - lo);
const intBetween = (lo, hi) => Math.round(between(lo, hi));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

function write(name, data) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + "\n");
  console.log("wrote data/sample/" + name);
}

// --- Venue -----------------------------------------------------------------
const venue = {
  name: "Riverside Performing Arts Center",
  shortName: "Riverside PAC",
  halls: [
    {
      id: "main",
      name: "Main Hall",
      sections: [
        { name: "Orchestra", rows: 26, seatsPerRow: 40, curve: 0.022 },
        { name: "Mezzanine", rows: 10, seatsPerRow: 44, curve: 0.022 },
        { name: "Balcony", rows: 13, seatsPerRow: 40, curve: 0.022 },
      ],
    },
    {
      id: "recital",
      name: "Recital Hall",
      sections: [
        { name: "Orchestra", rows: 14, seatsPerRow: 26, curve: 0.06 },
        { name: "Rear Orchestra", rows: 6, seatsPerRow: 32, curve: 0.04 },
        { name: "Loge", rows: 4, seatsPerRow: 36, curve: 0.03 },
      ],
    },
    {
      id: "studio",
      name: "Studio Theater",
      sections: [{ name: "Floor", rows: 15, seatsPerRow: 20, curve: 0 }],
    },
  ],
};
for (const h of venue.halls) {
  h.capacity = h.sections.reduce((s, x) => s + x.rows * x.seatsPerRow, 0);
}
write("venue.json", venue);
const hallCap = Object.fromEntries(venue.halls.map((h) => [h.id, h.capacity]));

// --- Sales curve shape -----------------------------------------------------
// x = share of the on-sale window elapsed (0..1). Early announce bump,
// slow middle, steep final weeks.
const shape = (x) => 0.32 * Math.pow(x, 0.55) + 0.68 * Math.pow(x, 3.2);

function curve(finalSold, onSaleDays, upToDaysOut, wobble) {
  const pts = [];
  let last = 0;
  for (let d = onSaleDays; d >= upToDaysOut; d -= 1) {
    const x = 1 - d / onSaleDays;
    let v = finalSold * shape(x) * (1 + wobble * (rand() - 0.5) * 0.06);
    v = Math.max(last, Math.round(v));
    pts.push({ daysOut: d, sold: v });
    last = v;
  }
  return pts;
}

// --- Performances ----------------------------------------------------------
// A full season: the last few days (recap), tonight, and about six months out.
// `pace` is how this show is selling against similar shows at the same point
// (1.0 = right on pace). Most are left random; a few are set on purpose so the
// Daily sales watch list has a story to tell.
const titles = [
  // Recap: performed in the last four days
  { title: "Fall Gala: A Night at Riverside", genre: "Concert", hall: "main", price: 125, perfs: 1, start: -4, pace: 0.97 },
  { title: "Riverside Symphony: Autumn Overtures", genre: "Classical", hall: "main", price: 61, perfs: 2, start: -3, pace: 1.02 },
  { title: "Improv Night", genre: "Comedy", hall: "studio", price: 28, perfs: 1, start: -1, pace: 0.88 },
  // Tonight and the next few weeks
  { title: "Brass & Bourbon Big Band", genre: "Concert", hall: "main", price: 58, perfs: 1, start: 0 },
  { title: "Chamber Strings at Dusk", genre: "Classical", hall: "recital", price: 46, perfs: 1, start: 2 },
  { title: "Midnight at the Grand Canal", genre: "Broadway", hall: "main", price: 88, perfs: 4, start: 3 },
  { title: "Paper Moon Puppet Co.", genre: "Family", hall: "studio", price: 22, perfs: 4, start: 4 },
  { title: "Piano Masters Series", genre: "Classical", hall: "recital", price: 52, perfs: 2, start: 9 },
  { title: "An Evening of Stand-Up: Late Checkout", genre: "Comedy", hall: "main", price: 49, perfs: 2, start: 10, pace: 0.83 },
  { title: "Riverside Symphony: Winter Light", genre: "Classical", hall: "main", price: 64, perfs: 2, start: 13 },
  { title: "Songwriters in the Round", genre: "Concert", hall: "studio", price: 38, perfs: 2, start: 15 },
  { title: "Kinetic Dance Collective", genre: "Dance", hall: "main", price: 54, perfs: 2, start: 19, pace: 0.71 },
  { title: "The Last Lighthouse (a new play)", genre: "Play", hall: "studio", price: 42, perfs: 4, start: 21 },
  { title: "Holiday Pops Spectacular", genre: "Concert", hall: "main", price: 72, perfs: 3, start: 25, pace: 1.12 },
  { title: "The Lantern Keepers", genre: "Broadway", hall: "main", price: 92, perfs: 8, start: 34, pace: 0.94 },
  // Further out in the season
  { title: "Winter Jazz Weekend", genre: "Concert", hall: "recital", price: 48, perfs: 2, start: 48 },
  { title: "Swan Lake", genre: "Dance", hall: "main", price: 76, perfs: 4, start: 58, pace: 1.06 },
  { title: "Ghost Stories by Candlelight", genre: "Play", hall: "studio", price: 36, perfs: 3, start: 66, pace: 0.68 },
  { title: "The Fifth Avenue Follies", genre: "Broadway", hall: "main", price: 84, perfs: 6, start: 72 },
  { title: "Mariachi Sol de Jalisco", genre: "Concert", hall: "main", price: 56, perfs: 1, start: 81, pace: 1.18 },
  { title: "Bluegrass on the River", genre: "Concert", hall: "recital", price: 44, perfs: 1, start: 88, pace: 0.79 },
  { title: "Comedy Headliner: The Overtime Tour", genre: "Comedy", hall: "main", price: 62, perfs: 1, start: 95, pace: 0.86 },
  { title: "Spring Chamber Series", genre: "Classical", hall: "recital", price: 50, perfs: 2, start: 104 },
  { title: "Riverside Ballet: Coppélia", genre: "Dance", hall: "main", price: 68, perfs: 3, start: 118, pace: 0.61 },
  { title: "Harbor Lights (Broadway revival)", genre: "Broadway", hall: "main", price: 96, perfs: 8, start: 132, pace: 1.09 },
  { title: "Family Science Spectacular", genre: "Family", hall: "studio", price: 20, perfs: 2, start: 141 },
  { title: "Symphony Season Finale", genre: "Classical", hall: "main", price: 70, perfs: 2, start: 160 },
];

// Where similar shows typically finish, as a share of capacity.
const typicalFinal = { Broadway: 0.92, Concert: 0.85, Comedy: 0.88, Classical: 0.8, Family: 0.82, Dance: 0.78, Play: 0.75 };

const performances = [];
let id = 1;
for (const t of titles) {
  for (let p = 0; p < t.perfs; p++) {
    const daysOut = t.start + p;
    const cap = hallCap[t.hall];
    const comps = Math.round(cap * between(0.01, 0.03));
    const holds = Math.round(cap * between(0.01, 0.025));
    const sellable = cap - comps - holds;
    const typical = typicalFinal[t.genre];
    const onSaleDays = Math.max(120, Math.max(0, daysOut) + intBetween(45, 90));
    const x = 1 - Math.max(0, daysOut) / onSaleDays;
    // What similar shows have sold by this many days out.
    const benchmark = Math.round(cap * typical * shape(x));
    const pace = t.pace ?? round(between(0.92, 1.16), 2);
    const sold = Math.min(sellable, Math.round(benchmark * pace));
    // Roughly one day's worth of sales at this point in the curve.
    const dayRate = cap * typical * (shape(x) - shape(Math.max(0, x - 1 / onSaleDays))) * pace;
    const soldSinceLast = daysOut < 0 ? 0 : Math.max(0, Math.round(dayRate * between(0.5, 1.7)));
    const avgPrice = round(t.price * between(0.9, 1.12), 2);
    const perf = {
      id: "P" + String(id++).padStart(3, "0"),
      title: t.title,
      genre: t.genre,
      hallId: t.hall,
      daysOut,
      time: pick(["7:30 PM", "8:00 PM", "7:30 PM", "2:00 PM"]),
      capacity: cap,
      sold,
      comps,
      holds,
      avgPrice,
      revenueGoal: Math.round(cap * 0.85 * t.price),
      onSaleDays,
      benchmarkSold: benchmark,
      soldSinceLast,
    };
    // Past performances carry a (still settling) attendance count.
    if (daysOut < 0) perf.scanned = Math.round((sold + comps) * between(0.86, 0.95));
    performances.push(perf);
  }
}
// Make tonight's show a healthy, near-full house.
const tonight = performances.find((p) => p.daysOut === 0);
tonight.sold = Math.round(tonight.capacity * 0.86);
performances.sort((a, b) => a.daysOut - b.daysOut);
write("performances.json", performances);

// --- Return engagement pacing ---------------------------------------------
// The current run of "The Lantern Keepers" vs its two previous visits.
// Story: pacing ahead of the 7-years-ago visit, behind the 3-years-ago visit.
const RUN_CAPACITY = hallCap.main * 8; // 8 performances
const featuredDaysOut = 34;
const pacing = {
  title: "The Lantern Keepers",
  genre: "Broadway",
  hallId: "main",
  performances: 8,
  runCapacity: RUN_CAPACITY,
  onSaleDays: 120,
  current: {
    label: "This visit",
    daysOut: featuredDaysOut,
    curve: curve(Math.round(RUN_CAPACITY * 0.84), 120, featuredDaysOut, 1),
    projectedFinal: Math.round(RUN_CAPACITY * 0.84),
  },
  priorVisits: [
    { label: "Visit 3 yrs ago", yearsAgo: 3, curve: curve(Math.round(RUN_CAPACITY * 0.93), 120, 0, 1) },
    { label: "Visit 7 yrs ago", yearsAgo: 7, curve: curve(Math.round(RUN_CAPACITY * 0.71), 120, 0, 1) },
  ],
};
// Nudge the current curve so it sits between the two prior visits at today.
pacing.current.curve = pacing.current.curve.map((pt) => ({ ...pt, sold: Math.round(pt.sold * 0.97) }));
write("pacing.json", pacing);

// --- RFM (no names - segment-level only) ----------------------------------
// 5x5 grid: recency score (5 = most recent) x frequency score (5 = most often).
const rfmGrid = [];
for (let r = 1; r <= 5; r++) {
  for (let f = 1; f <= 5; f++) {
    const base = 2600 * Math.exp(-0.38 * (f - 1)) * (0.6 + 0.12 * r);
    const households = Math.round(base * between(0.75, 1.25));
    const avgSpend = round(65 + f * 48 + r * 14 + between(-15, 15), 0);
    rfmGrid.push({ r, f, households, avgSpend });
  }
}
const seg = (name, desc, action, test) => {
  const cells = rfmGrid.filter(test);
  const households = cells.reduce((s, c) => s + c.households, 0);
  const revenue = cells.reduce((s, c) => s + c.households * c.avgSpend, 0);
  return { name, description: desc, action, households, revenue: Math.round(revenue), avgSpend: Math.round(revenue / households) };
};
const rfm = {
  asOfWindowMonths: 36,
  grid: rfmGrid,
  segments: [
    seg("Champions", "Bought recently and often", "Subscription and donor ask", (c) => c.r >= 4 && c.f >= 4),
    seg("Loyal", "Steady repeat buyers", "Early access and upgrades", (c) => c.r >= 3 && c.f >= 3 && !(c.r >= 4 && c.f >= 4)),
    seg("Promising", "Recent, but only once or twice", "Second-show offer", (c) => c.r >= 4 && c.f <= 2),
    seg("Needs attention", "Used to come often, slowing down", "Win-back with a favorite genre", (c) => c.r <= 2 && c.f >= 3),
    seg("Hibernating", "Long ago and rarely", "Low-cost reminders only", (c) => c.r <= 2 && c.f <= 2),
    seg("Middle", "Everyone else", "Standard season marketing", (c) => c.r === 3 && c.f <= 2),
  ],
};
write("rfm.json", rfm);

// --- Geography (fictional counties; 00xxx ZIPs so none point at a real place)
const counties = [
  { county: "Harbor County", zipPrefix: "001", n: 7, weight: 1.0 },
  { county: "Cedar County", zipPrefix: "002", n: 5, weight: 0.62 },
  { county: "Marlow County", zipPrefix: "003", n: 4, weight: 0.4 },
  { county: "Kestrel County", zipPrefix: "004", n: 4, weight: 0.27 },
  { county: "Ashford County", zipPrefix: "005", n: 3, weight: 0.15 },
  { county: "Out of region", zipPrefix: "3xx", n: 0, weight: 0.12 },
];
const geography = {
  seasonLabel: "Season to date",
  note: "County is derived from the purchaser's ZIP code; it is not a field in the ticketing system.",
  counties: counties.map((c) => {
    const zips = [];
    for (let i = 0; i < c.n; i++) {
      const tickets = Math.round(9000 * c.weight * between(0.35, 1.0) / Math.sqrt(i + 1));
      zips.push({
        zip: c.zipPrefix + String(intBetween(10, 99)).padStart(2, "0"),
        tickets,
        revenue: Math.round(tickets * between(58, 82)),
        households: Math.round(tickets / between(2.1, 2.8)),
      });
    }
    let tickets = zips.reduce((s, z) => s + z.tickets, 0);
    if (c.n === 0) tickets = Math.round(9000 * c.weight * 1.8);
    const revenue = c.n === 0 ? Math.round(tickets * 79) : zips.reduce((s, z) => s + z.revenue, 0);
    return { county: c.county, tickets, revenue, zips: zips.sort((a, b) => b.tickets - a.tickets) };
  }),
};
write("geography.json", geography);

// --- Call center (today, by hour) -----------------------------------------
const hours = [];
const volumeShape = [0.55, 0.9, 1.0, 0.85, 0.7, 0.8, 0.95, 0.75, 0.5, 0.3, 0.2];
volumeShape.forEach((v, i) => {
  const hour = 9 + i; // 9 AM .. 7 PM
  const offered = Math.round(118 * v * between(0.85, 1.15));
  const abandonRate = between(0.03, 0.11) + (v > 0.9 ? 0.04 : 0);
  const abandoned = Math.round(offered * abandonRate);
  hours.push({
    hour,
    offered,
    answered: offered - abandoned,
    abandoned,
    avgWaitSec: Math.round(14 + v * 48 * between(0.7, 1.3)),
    avgHandleSec: Math.round(between(170, 260)),
  });
});
write("callcenter.json", {
  serviceLevelTargetSec: 60,
  agentsScheduled: 9,
  hours,
  topReasons: [
    { reason: "Buy tickets", share: 0.41 },
    { reason: "Exchange / reschedule", share: 0.19 },
    { reason: "Parking & directions", share: 0.13 },
    { reason: "Accessibility services", share: 0.09 },
    { reason: "Membership / donations", share: 0.08 },
    { reason: "Other", share: 0.1 },
  ],
});
