// Scheduled-refresh behavior for the sample source: the header names the
// most recent scheduled refresh, the call center reports yesterday's full day,
// and last night's scans feed the House plan recap.

import { SampleSource } from "./sample.js";
import { config } from "../config.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// Most recent scheduled refresh before now (yesterday's last one before the first).
function lastScheduled(times, now = new Date()) {
  const mins = (t) => { const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t); return ((+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + +m[2]; };
  const cur = now.getHours() * 60 + now.getMinutes();
  const past = times.filter((t) => mins(t) <= cur);
  return past.length ? past.at(-1) : `yesterday ${times.at(-1)}`;
}

const baseMeta = SampleSource.prototype.meta;
const baseCalls = SampleSource.prototype.getCallCenter;

Object.assign(SampleSource.prototype, {
  meta() {
    return { ...baseMeta.call(this), asOfLabel: lastScheduled(config.refreshTimes) };
  },

  getCallCenter() {
    this.callHoursVisible = this.callcenter.hours.length;
    return baseCalls.call(this);
  },

  getHousePerfs() {
    return this.performances
      .filter((p) => p.daysOut === 0 || p.daysOut === -1)
      .sort((a, b) => b.daysOut - a.daysOut)
      .map((p) => this.withDate(p));
  },

  arrivalModel(p, sectionNames) {
    const r = rng(hash(p.id + "arrive"));
    const noShow = p.scanned ? 1 - p.scanned / (p.sold + p.comps) : 0.045;
    const lean = Object.fromEntries(sectionNames.map((n, i) => [n, i * 3]));
    return (section) => {
      if (r() < noShow) return null;
      const u = r();
      const base = u < 0.08 ? -60 + r() * 25 : u < 0.9 ? -38 + Math.pow(r(), 0.7) * 36 : -2 + r() * 17;
      return Math.round(base - (lean[section] ?? 0) * r());
    };
  },
});
