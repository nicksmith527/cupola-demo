// Extra contract methods for the alternative look (/next/).
//
// Everything here is derived from the same synthetic JSON the main demo uses,
// so both versions tell the same story. Patched onto SampleSource so the
// original file stays easy to compare.

import { SampleSource } from "./sample.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// Typical shape of a run's cumulative sales: an on-sale bump, a slow middle,
// then the late ramp. t runs 0 (on sale) .. 1 (opening).
function shape(t) {
  t = Math.min(1, Math.max(0, t));
  return 0.24 * (1 - Math.exp(-t * 14)) + 0.76 * Math.pow(t, 2.4);
}

// Shows treated as return engagements, with how the last two visits finished
// (as a share of run capacity). The Lantern Keepers uses pacing.json as-is.
const RETURNING = {
  "Harbor Lights (Broadway revival)": [0.91, 0.83],
  "Swan Lake": [0.78, 0.84],
  "Holiday Pops Spectacular": [0.96, 0.9],
};

const AGENTS = ["Maya R.", "Devon T.", "Priya K.", "Luis M.", "Hannah B.", "Andre W.", "Sofia L.", "Grant P.", "Keisha J."];

Object.assign(SampleSource.prototype, {
  // ---- Return engagements --------------------------------------------------
  returnTitles() {
    return [this.pacing.title, ...Object.keys(RETURNING)];
  },

  isReturn(title) {
    return this.returnTitles().includes(title);
  },

  // Pacing for one returning title (default: the first). Same shape as getPacing().
  getPacingFor(title = this.pacing.title) {
    if (title === this.pacing.title) return this.getPacing();
    const finals = RETURNING[title];
    const perfs = this.performances.filter((p) => p.title === title);
    const first = perfs.reduce((a, b) => (a.daysOut < b.daysOut ? a : b));
    const onSale = first.onSaleDays;
    const runCapacity = perfs.reduce((s, p) => s + p.capacity, 0);
    const sold = perfs.reduce((s, p) => s + p.sold, 0);
    const tNow = 1 - first.daysOut / onSale;
    const r = rng(hash(title));
    const curveTo = (final, upto, wobble) => {
      const pts = [];
      for (let d = onSale; d >= upto; d--) {
        const t = 1 - d / onSale;
        pts.push({ daysOut: d, sold: Math.round(final * shape(t) * (1 + (r() - 0.5) * wobble * (1 - t))) });
      }
      for (let i = 1; i < pts.length; i++) pts[i].sold = Math.max(pts[i].sold, pts[i - 1].sold);
      pts[0].sold = 0;
      return pts;
    };
    const current = curveTo(sold / shape(tNow), first.daysOut, 0.06);
    current[current.length - 1].sold = sold;
    const year = this.today.getFullYear();
    const priorVisits = finals.map((f, i) => ({
      yearsAgo: i === 0 ? 2 : 4,
      label: `${year - (i === 0 ? 2 : 4)} visit`,
      curve: curveTo(runCapacity * f, 0, 0.05),
    }));
    return {
      title,
      genre: first.genre,
      hallId: first.hallId,
      performances: perfs.length,
      runCapacity,
      onSaleDays: onSale,
      current: { label: "This visit", daysOut: first.daysOut, curve: current, today: current[current.length - 1], projectedFinal: Math.round(sold / shape(tNow)) },
      priorVisits,
      currentLabel: `${year} visit`,
      firstPerformanceDate: new Date(this.today.getTime() + first.daysOut * 86400000),
    };
  },

  // A compact summary per returning title for list views and daily-sales badges.
  getReturnSummaries() {
    return this.returnTitles().map((title) => {
      const d = this.getPacingFor(title);
      const now = d.current.today;
      const prior = d.priorVisits.map((v) => {
        const at = v.curve.find((p) => p.daysOut === now.daysOut)?.sold ?? 0;
        const final = v.curve[v.curve.length - 1].sold;
        return { label: v.label, at, final, vs: at ? now.sold / at - 1 : 0 };
      });
      return { title, d, now, prior, best: prior.reduce((a, b) => (a.vs > b.vs ? a : b)) };
    });
  },

  // ---- Per-performance sales curve ----------------------------------------
  // Cumulative tickets by days before the performance, plus what similar
  // shows (same genre) had sold on the same day.
  getPerfCurve(p) {
    const onSale = p.onSaleDays;
    const end = Math.max(0, p.daysOut);
    const tNow = 1 - end / onSale;
    const r = rng(hash(p.id));
    const pts = [];
    let last = 0;
    for (let d = onSale; d >= end; d--) {
      const t = 1 - d / onSale;
      const v = Math.max(last, Math.round((p.sold * shape(t)) / Math.max(0.02, shape(tNow)) * (1 + (r() - 0.5) * 0.05 * (1 - t))));
      pts.push({ daysOut: d, sold: v, bench: Math.round((p.benchmarkSold * shape(t)) / Math.max(0.02, shape(tNow))) });
      last = v;
    }
    pts[pts.length - 1].sold = p.sold;
    // Where similar shows usually finish, for the rest of the axis.
    const ahead = [];
    for (let d = end - 1; d >= 0; d--) {
      const t = 1 - d / onSale;
      ahead.push({ daysOut: d, bench: Math.round((p.benchmarkSold * shape(t)) / Math.max(0.02, shape(tNow))) });
    }
    return { onSale, pts, ahead };
  },

  // ---- House: load-in by zone ---------------------------------------------
  // Performances with arrival data: last night (complete) and tonight
  // (doors simulated). Each sold or comp seat gets a scan time in minutes
  // relative to curtain; some never arrive (no-shows).
  getHousePerfs() {
    return this.performances
      .filter((p) => p.daysOut === 0 || p.daysOut === -1)
      .sort((a, b) => b.daysOut - a.daysOut)
      .map((p) => this.withDate(p));
  },

  arrivalModel(p, sectionNames) {
    const r = rng(hash(p.id + "arrive"));
    const noShow = p.scanned ? 1 - p.scanned / (p.sold + p.comps) : 0.045;
    // Upper levels tend to arrive a little earlier (longer walk, bar lines).
    const lean = Object.fromEntries(sectionNames.map((n, i) => [n, i * 3]));
    return (section) => {
      if (r() < noShow) return null;
      // Mostly 35 to 5 minutes before curtain, with a few late arrivals.
      const u = r();
      const base = u < 0.08 ? -60 + r() * 25 : u < 0.9 ? -38 + Math.pow(r(), 0.7) * 36 : -2 + r() * 17;
      return Math.round(base - (lean[section] ?? 0) * r());
    };
  },

  // ---- Audience lenses ----------------------------------------------------
  audienceLenses() {
    const titles = [...new Set(this.performances.map((p) => p.title))].sort();
    const genres = [...new Set(this.performances.map((p) => p.genre))].sort();
    return [
      { id: "all", group: "Everyone", label: "All buyers · last 36 months" },
      { id: "season", group: "Everyone", label: "This season's buyers" },
      { id: "donors", group: "Contributed revenue", label: "Donors (giving instead of tickets)" },
      { id: "both", group: "Contributed revenue", label: "Ticket buyers who also give" },
      ...genres.map((g) => ({ id: "genre:" + g, group: "By genre", label: g })),
      ...titles.map((t) => ({ id: "show:" + t, group: "By show", label: t })),
    ];
  },

  getAudienceFor(lensId = "all") {
    const base = this.rfm;
    if (lensId === "all") return { ...base, lens: lensId, scale: 1, monetaryLabel: "ticket spend" };
    const r = rng(hash(lensId));
    let scale = 0.12 + r() * 0.12;
    let tilt = r() - 0.5; // >0 skews toward loyal/frequent buyers
    let spendX = 0.8 + r() * 0.5;
    let monetaryLabel = "ticket spend";
    if (lensId === "season") { scale = 0.46; tilt = 0.25; spendX = 1; }
    if (lensId === "donors") { scale = 0.09; tilt = 0.7; spendX = 3.4; monetaryLabel = "gifts"; }
    if (lensId === "both") { scale = 0.07; tilt = 0.9; spendX = 4.1; monetaryLabel = "tickets + gifts"; }
    const grid = base.grid.map((c) => {
      const w = 1 + tilt * ((c.r + c.f - 6) / 4);
      return { ...c, households: Math.max(3, Math.round(c.households * scale * w * (0.85 + r() * 0.3))), avgSpend: Math.round(c.avgSpend * spendX) };
    });
    const segments = base.segments.map((s, i) => {
      const w = 1 + tilt * (i < 2 ? 0.9 : i === 4 ? -0.7 : 0);
      const households = Math.max(3, Math.round(s.households * scale * w));
      const avgSpend = Math.round(s.avgSpend * spendX);
      return { ...s, households, avgSpend, revenue: households * avgSpend };
    });
    return { ...base, grid, segments, lens: lensId, scale, monetaryLabel };
  },

  // Rows for an export. IDs only: names and contact details come from the
  // CRM when the list is loaded there, never from Cupola.
  audienceExport(lensId, segmentName) {
    const d = this.getAudienceFor(lensId);
    const seg = d.segments.find((s) => s.name === segmentName) ?? d.segments[0];
    const r = rng(hash(lensId + segmentName));
    const rows = [];
    const n = Math.min(seg.households, 500);
    const scores = {
      Champions: [[4, 5], [4, 5]], Loyal: [[3, 5], [3, 5]], Promising: [[4, 5], [1, 2]],
      "Needs attention": [[2, 3], [3, 5]], Hibernating: [[1, 2], [1, 2]], Middle: [[2, 4], [2, 3]],
    }[seg.name] ?? [[1, 5], [1, 5]];
    const pick = ([a, b]) => a + Math.floor(r() * (b - a + 1));
    for (let i = 0; i < n; i++) {
      const R = pick(scores[0]), F = pick(scores[1]);
      const spend = Math.round(seg.avgSpend * (0.4 + r() * 1.3));
      const days = Math.round((6 - R) * 120 * (0.5 + r()));
      rows.push({ id: String(1000000 + Math.floor(r() * 8999999)), segment: seg.name, R, F, M: Math.min(5, Math.max(1, Math.round(spend / seg.avgSpend * 3))), lastPurchaseDays: days, orders: F * 2 + Math.floor(r() * 3), spend });
    }
    return { seg, rows, total: seg.households };
  },

  // ---- Geography scope -----------------------------------------------------
  geoScopes() {
    const titles = [...new Set(this.performances.map((p) => p.title))].sort();
    const genres = [...new Set(this.performances.map((p) => p.genre))].sort();
    const perfs = this.performances
      .slice()
      .sort((a, b) => a.daysOut - b.daysOut)
      .map((p) => this.withDate(p));
    return { titles, genres, perfs };
  },

  // Scale the market's county and ZIP numbers to a slice of the season.
  // Each slice leans a little differently (some shows draw from farther out).
  getGeographyFor(scope) {
    const g = this.getGeography();
    if (!scope || scope === "season") return g;
    const m = g.market ?? { ...g, states: [{ abbr: "--", home: true, tickets: g.counties.reduce((s, c) => s + c.tickets, 0) }], homeCounty: null };
    const all = m.states.reduce((s, x) => s + x.tickets, 0);
    let target;
    if (scope.startsWith("perf:")) {
      const p = this.performances.find((x) => x.id === scope.slice(5));
      target = p ? p.sold + p.comps : 500;
    } else if (scope.startsWith("show:")) {
      target = this.performances.filter((p) => p.title === scope.slice(5)).reduce((s, p) => s + p.sold + p.comps, 0);
    } else if (scope.startsWith("genre:")) {
      target = this.performances.filter((p) => p.genre === scope.slice(6)).reduce((s, p) => s + p.sold + p.comps, 0) * 2.4;
    }
    const k = Math.max(0.0005, target / all);
    const r = rng(hash(scope));
    const reach = 0.7 + r() * 0.6; // >1 = draws more from outside the home county
    const scaleN = (n, far) => {
      const v = n * k * (far ? reach : 1 / reach) * (0.75 + r() * 0.5);
      return v < 1 ? (r() < v ? 1 : 0) : Math.round(v);
    };
    const counties = m.counties
      .map((c) => {
        const far = m.homeCounty ? c.fips !== m.homeCounty : c !== m.counties[0];
        const zips = c.zips.map((z) => {
          const t = scaleN(z.tickets, far);
          return { ...z, tickets: t, revenue: Math.round((z.revenue / Math.max(1, z.tickets)) * t), households: Math.max(t ? 1 : 0, Math.round(t / 2.6)) };
        }).filter((z) => z.tickets > 0).sort((a, b) => b.tickets - a.tickets);
        const t = Math.max(zips.reduce((s, z) => s + z.tickets, 0), scaleN(c.tickets, far));
        return { ...c, zips, tickets: t, revenue: Math.round((c.revenue / Math.max(1, c.tickets)) * t), households: Math.round(t / 2.6) };
      })
      .sort((a, b) => b.tickets - a.tickets);
    const home = m.states.find((s) => s.home);
    const inState = counties.reduce((s, c) => s + c.tickets, 0);
    const states = m.states.map((s) => (s.home ? { ...s, tickets: inState, revenue: counties.reduce((a, c) => a + c.revenue, 0) } : { ...s, tickets: scaleN(s.tickets, true), revenue: Math.round(s.revenue * k * reach) }));
    if (!g.market) return { ...g, counties, seasonLabel: g.seasonLabel };
    // Keep the home county present so the hero line always reads.
    if (!counties.some((c) => c.fips === m.homeCounty)) counties.push({ ...m.counties.find((c) => c.fips === m.homeCounty), tickets: 1, zips: [] });
    return { market: { ...m, counties, states: states.filter((s) => s.home || s.tickets > 0), seasonLabel: home ? m.seasonLabel : m.seasonLabel } };
  },

  // ---- Call center: agents and phone revenue -------------------------------
  getCallCenterPlus() {
    const d = this.getCallCenter();
    const r = rng(11);
    const sales = d.topReasons.find((x) => x.reason === "Buy tickets")?.share ?? 0.4;
    // Each hour: share of answered calls that end in an order, and order value.
    const hours = d.hours.map((h) => {
      const orders = Math.round(h.answered * sales * (0.62 + r() * 0.12));
      const revenue = Math.round(orders * (118 + r() * 40));
      return { ...h, orders, revenue };
    });
    const answered = d.totals.answered;
    const weights = AGENTS.map(() => 0.6 + r() * 0.8);
    const wsum = weights.reduce((a, b) => a + b, 0);
    const totalOrders = hours.reduce((s, h) => s + h.orders, 0);
    const totalRevenue = hours.reduce((s, h) => s + h.revenue, 0);
    const agents = AGENTS.map((name, i) => {
      const calls = Math.round((answered * weights[i]) / wsum);
      const conv = (totalOrders / Math.max(1, answered)) * (0.7 + r() * 0.6);
      const orders = Math.round(calls * conv);
      const aht = Math.round(d.totals.avgWaitSec * 0 + 190 + r() * 90);
      const status = ["On a call", "On a call", "Available", "On a call", "Wrap-up", "On a call", "Break", "Available", "On a call"][i];
      return { name, calls, orders, conversion: calls ? orders / calls : 0, revenue: Math.round(orders * (120 + r() * 45)), aht, status, adherence: 0.86 + r() * 0.13 };
    }).sort((a, b) => b.revenue - a.revenue);
    return { ...d, hours, agents, phone: { orders: totalOrders, revenue: totalRevenue, conversion: totalOrders / Math.max(1, answered), avgOrder: totalRevenue / Math.max(1, totalOrders) } };
  },
});
