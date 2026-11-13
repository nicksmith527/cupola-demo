// Return engagements as a report: every returning title on one page, each
// compared with its past visits at the same point. Select one for the full
// pacing chart, a projected finish and how each performance of the run sells.

import pacing from "./pacing.js";
import { int, pct, shortDate, esc } from "../ui/format.js";
import { growBars } from "../ui/animate.js";
import { exportBtn, exportHouseholds, slug } from "../ui/export.js";

const signed = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(0) + "%";
const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

function overlay(d, w = 300, h = 90) {
  const X0 = d.onSaleDays;
  const max = Math.max(d.runCapacity * 0.2, ...d.priorVisits.map((v) => v.curve.at(-1).sold), d.current.today.sold) * 1.05;
  const x = (dd) => 2 + ((X0 - dd) / X0) * (w - 4);
  const y = (v) => h - 2 - (v / max) * (h - 6);
  const path = (c) => c.filter((_, i) => i % 2 === 0 || i === c.length - 1).map((p, i) => `${i ? "L" : "M"}${x(p.daysOut).toFixed(1)},${y(p.sold).toFixed(1)}`).join("");
  const lines = [...d.priorVisits].reverse().map((v, i) => `<path d="${path(v.curve)}" fill="none" stroke="${COLORS[d.priorVisits.length - i]}" stroke-width="1.4" opacity=".75" vector-effect="non-scaling-stroke"/>`).join("");
  const now = d.current.today;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block;overflow:visible" aria-hidden="true">
    <line x1="${x(now.daysOut)}" x2="${x(now.daysOut)}" y1="0" y2="${h}" stroke="var(--grid)" stroke-width="2" vector-effect="non-scaling-stroke"/>
    ${lines}<path d="${path(d.current.curve)}" fill="none" stroke="${COLORS[0]}" stroke-width="2.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function projection(s) {
  const ratios = s.prior.filter((v) => v.at > 0).map((v) => v.final / v.at);
  const r = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
  return Math.min(s.d.runCapacity, Math.round(s.now.sold * r));
}

export default {
  id: "pacing",
  label: "Return engagements",
  mount(root, source, params) {
    const t = params?.get("t");
    if (t && source.isReturn(t)) return detail(root, source, t);
    return list(root, source);
  },
};

function list(root, source) {
  const items = source.getReturnSummaries().sort((a, b) => a.now.daysOut - b.now.daysOut);
  root.innerHTML = `
    <div class="view-head"><div>
      <h1>Return engagements</h1>
      <p>Titles that have played here before · this visit (bold) against past visits at the same number of days out</p>
    </div></div>
    <div class="re-grid">${items
      .map((s) => {
        const proj = projection(s);
        return `<a class="card re-card" href="#/pacing?t=${encodeURIComponent(s.title)}">
          <div class="top"><div><h2>${esc(s.title)}</h2><div class="meta">${esc(s.d.genre)} · ${s.d.performances} perfs · opens ${shortDate(s.d.firstPerformanceDate)} (${s.now.daysOut} days)</div></div>
            <span class="chip ${s.prior[0].vs >= 0 ? "ahead" : s.prior[0].vs > -0.15 ? "behind" : "risk"}" title="Compared with the most recent visit at the same point"><i></i>${s.prior[0].vs >= 0 ? "Ahead of" : "Behind"} last visit</span></div>
          <div style="display:flex;gap:18px;align-items:baseline;margin:10px 0 6px">
            <div><div class="big">${int(s.now.sold)}</div><div class="meta">sold · ${pct(s.now.sold / s.d.runCapacity)} of run</div></div>
            <div><div class="big" style="color:var(--text-secondary)">${pct(proj / s.d.runCapacity)}</div><div class="meta">projected finish</div></div>
          </div>
          ${overlay(s.d)}
          <div class="vs">${s.prior.map((v, i) => `<span><i style="display:inline-block;width:10px;height:3px;border-radius:2px;background:${COLORS[i + 1]};vertical-align:3px;margin-right:5px"></i>${esc(v.label)} <b class="${v.vs >= 0 ? "pos" : "neg"}">${signed(v.vs)}</b></span>`).join("")}</div>
        </a>`;
      })
      .join("")}</div>
    <p class="callout" style="margin-top:var(--gap)">Return-engagement titles are also tagged <span class="re-tag" style="margin:0">↺ Return</span> in Daily sales and the Snapshot, so you can jump here from any performance.</p>`;
  return { update() {} };
}

function detail(root, source, title) {
  const s = source.getReturnSummaries().find((x) => x.title === title);
  root.innerHTML = `<a class="back" href="#/pacing">‹ All return engagements</a><div id="pace"></div>
    <div class="cols mt">
      <div class="card"><h2>Each performance in the run</h2><p class="sub">Sold so far and share of capacity</p><div class="mini-list" id="run"></div></div>
      <div class="card"><h2>What it's telling you</h2><p class="sub">Generated from this visit vs. past visits</p><ul class="insights" id="ins"></ul>
        <div class="x-group" style="margin-top:14px">${exportBtn("lapsed", "Past buyers who haven't bought yet")}</div></div>
    </div>`;
  // The full chart is the original pacing view, pointed at this title.
  const scoped = Object.create(source);
  scoped.getPacing = () => source.getPacingFor(title);
  const handle = pacing.mount(root.querySelector("#pace"), scoped);

  function lower() {
    const d = source.getDailyReport();
    const perfs = d.upcoming.filter((p) => p.title === title);
    const box = root.querySelector("#run");
    box.innerHTML = perfs
      .map((p) => {
        const share = p.sold / p.capacity;
        return `<div class="mini-row"><div><div class="name">${shortDate(p.date)} · ${esc(p.time)}</div><div class="meta">${esc(p.hall.name)}</div></div>
          <div class="bar-track"><div class="bar-fill" data-width="${share * 100}%"></div></div><div class="num">${pct(share)}</div></div>`;
      })
      .join("");
    growBars(box);
    const cur = source.getReturnSummaries().find((x) => x.title === title);
    const proj = projection(cur);
    const weakest = perfs.reduce((a, b) => (a.sold / a.capacity < b.sold / b.capacity ? a : b));
    const strongest = perfs.reduce((a, b) => (a.sold / a.capacity > b.sold / b.capacity ? a : b));
    const v1 = cur.prior[0];
    const weekend = perfs.filter((p) => [0, 5, 6].includes(p.date.getDay()));
    const wkShare = weekend.length ? weekend.reduce((a, p) => a + p.sold / p.capacity, 0) / weekend.length : null;
    const wdShare = perfs.length > weekend.length ? perfs.filter((p) => !weekend.includes(p)).reduce((a, p) => a + p.sold / p.capacity, 0) / (perfs.length - weekend.length) : null;
    root.querySelector("#ins").innerHTML = [
      `At this rate the run finishes near <b>${int(proj)}</b> tickets (${pct(proj / cur.d.runCapacity)} of capacity), based on how past visits sold from this point on.`,
      `Compared with the ${esc(v1.label)}, this visit is <b class="${v1.vs >= 0 ? "pos" : "neg"}">${signed(v1.vs)}</b> at ${cur.now.daysOut} days out; that visit finished at ${pct(v1.final / cur.d.runCapacity)}.`,
      `Softest performance: <b>${shortDate(weakest.date)} ${esc(weakest.time)}</b> at ${pct(weakest.sold / weakest.capacity)}. Strongest: ${shortDate(strongest.date)} at ${pct(strongest.sold / strongest.capacity)}. A targeted offer on the soft dates usually beats a run-wide discount.`,
      wkShare !== null && wdShare !== null ? `Weekend performances average ${pct(wkShare)} sold vs. ${pct(wdShare)} on weeknights.` : "",
      `Past audiences for this title are a ready list: export last visit's buyers who haven't bought yet (below) and load it into your CRM for a targeted offer.`,
    ].filter(Boolean).map((x) => `<li>${x}</li>`).join("");
  }
  lower();
  root.addEventListener("click", (e) => {
    if (!e.target.closest('[data-x="lapsed"]')) return;
    const cur = source.getReturnSummaries().find((x) => x.title === title);
    const prev = cur.prior[0];
    const count = Math.max(0, Math.round(prev.final / 2.3 - cur.now.sold / 2.3 * 0.6));
    exportHouseholds({ label: "lapsed" + title, count, segment: `Bought ${prev.label}, not this visit` }, `cupola-${slug(title)}-past-buyers-not-yet.csv`);
  });
  return { update() { handle?.update?.(); lower(); } };
}
