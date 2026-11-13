// Sample source: synthetic data from data/sample/*.json.
//
// Two things make it feel live:
//   1. Dates are relative. The JSON stores "daysOut" / "yearsAgo"; this file
//      turns them into real dates based on today, so the demo never goes stale.
//   2. Simulated refreshes. Each tick() adds a small, seeded batch of new
//      sales and reveals another hour of call-center activity, the way a
//      scheduled refresh would.

const DATA_DIR = new URL("../../data/sample/", import.meta.url);

async function load(name) {
  const res = await fetch(new URL(name, DATA_DIR));
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return res.json();
}

// Small seeded random generator so every demo run plays out the same way.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86400000;
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const addDays = (date, n) => new Date(date.getTime() + n * DAY_MS);

export class SampleSource {
  async init() {
    const [venue, performances, pacing, rfm, geography, callcenter] = await Promise.all([
      load("venue.json"),
      load("performances.json"),
      load("pacing.json"),
      load("rfm.json"),
      load("geography.json"),
      load("callcenter.json"),
    ]);
    this.venue = venue;
    this.performances = performances.map((p) => ({ ...p }));
    this.pacing = structuredClone(pacing);
    this.rfm = rfm;
    this.geography = geography;
    this.callcenter = callcenter;

    this.rand = mulberry32(7);
    this.tickCount = 0;
    this.asOf = new Date();
    this.today = startOfToday();
    // Sales already booked "today" before the demo opened.
    this.todaySold = 384;
    this.todayRevenue = 27841;
    this.lastBatch = 0;
    // Call-center hours visible so far (9 AM .. 2 PM to start).
    this.callHoursVisible = 6;
  }

  meta() {
    return {
      venueName: this.venue.name,
      asOf: this.asOf,
      tick: this.tickCount,
      synthetic: true,
    };
  }

  // Simulate one scheduled refresh.
  tick() {
    this.tickCount += 1;
    this.asOf = new Date();
    let batch = 0;
    let revenue = 0;
    for (const p of this.performances) {
      const open = p.capacity - p.sold - p.comps - p.holds;
      if (open <= 0) continue;
      // Nearer shows sell faster.
      const heat = Math.max(0.15, 1 - p.daysOut / 45);
      const n = Math.min(open, Math.round(this.rand() * 14 * heat));
      p.sold += n;
      batch += n;
      revenue += n * p.avgPrice;
    }
    const cur = this.pacing.current.curve;
    const add = Math.round(8 + this.rand() * 30);
    cur[cur.length - 1] = { ...cur[cur.length - 1], sold: cur[cur.length - 1].sold + add };
    batch += add;
    revenue += add * 92;

    this.todaySold += batch;
    this.todayRevenue += Math.round(revenue);
    this.lastBatch = batch;
    this.callHoursVisible = Math.min(this.callcenter.hours.length, this.callHoursVisible + 1);
  }

  hall(id) {
    return this.venue.halls.find((h) => h.id === id);
  }

  withDate(p) {
    return { ...p, date: addDays(this.today, p.daysOut), hall: this.hall(p.hallId) };
  }

  // ---- Contract methods (see docs/DATA-CONTRACT.md) -----------------------

  getMorning() {
    const upcoming = this.performances.map((p) => this.withDate(p));
    const tonight = upcoming.find((p) => p.daysOut === 0);
    const next30 = upcoming.filter((p) => p.daysOut <= 30);
    const cap30 = next30.reduce((s, p) => s + p.capacity, 0);
    const sold30 = next30.reduce((s, p) => s + p.sold, 0);
    const calls = this.getCallCenter();
    // Seat maps to browse: tonight first, then the next performance of each
    // other title, soonest first.
    const seen = new Set();
    const seatMaps = [];
    for (const p of upcoming) {
      if (seen.has(p.title)) continue;
      seen.add(p.title);
      seatMaps.push(p);
      if (seatMaps.length === 6) break;
    }
    return {
      seatMaps,
      kpis: {
        soldToday: this.todaySold,
        revenueToday: this.todayRevenue,
        lastBatch: this.lastBatch,
        tonightPct: tonight.sold / tonight.capacity,
        next30Pct: sold30 / cap30,
        callsAnswered: calls.totals.answered,
      },
      tonight,
      upcoming: upcoming.filter((p) => p.daysOut > 0).slice(0, 8),
    };
  }

  getPacing() {
    const p = this.pacing;
    const year = this.today.getFullYear();
    return {
      ...p,
      current: { ...p.current, today: p.current.curve[p.current.curve.length - 1] },
      priorVisits: p.priorVisits.map((v) => ({ ...v, label: `${year - v.yearsAgo} visit` })),
      currentLabel: `${year} visit`,
      firstPerformanceDate: addDays(this.today, p.current.daysOut),
    };
  }

  getAudience() {
    return this.rfm;
  }

  getGeography() {
    return this.geography;
  }

  getCallCenter() {
    const hours = this.callcenter.hours.slice(0, this.callHoursVisible);
    const sum = (k) => hours.reduce((s, h) => s + h[k], 0);
    const offered = sum("offered");
    const answered = sum("answered");
    const weightedWait = hours.reduce((s, h) => s + h.avgWaitSec * h.answered, 0) / answered;
    const withinTarget = hours.reduce(
      (s, h) => s + (h.avgWaitSec <= this.callcenter.serviceLevelTargetSec ? h.answered : h.answered * 0.55),
      0
    );
    return {
      ...this.callcenter,
      hours,
      allHours: this.callcenter.hours.map((h) => h.hour),
      peakOffered: Math.max(...this.callcenter.hours.map((h) => h.offered)),
      totals: {
        offered,
        answered,
        abandoned: sum("abandoned"),
        abandonRate: sum("abandoned") / offered,
        avgWaitSec: Math.round(weightedWait),
        serviceLevel: withinTarget / answered,
      },
    };
  }
}
