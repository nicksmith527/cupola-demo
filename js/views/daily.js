// Daily sales report.
//
// The traditional report runs every performance in the season top to bottom.
// This one is short by default, without letting anything hide:
//   1. Recap: the last few days, marked as settling (not final).
//   2. Today, then forward: the next 30 rows by default (or 14 / 30 days, or the season).
//   3. Needs attention: any show in the season selling behind similar shows is
//      pinned above the list, however far out it is, plus shows that are
//      crossing the 12-week mark while already behind.

import { countUp, growBars, flash } from "../ui/animate.js";
import { int, money, moneyK, pct, shortDate, esc } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";

const HORIZONS = [
  { id: "rows", label: "Next 30 rows", test: (p, i) => i < 30 },
  { id: "14", label: "14 days", test: (p) => p.daysOut <= 14 },
  { id: "30", label: "30 days", test: (p) => p.daysOut <= 30 },
  { id: "season", label: "Season", test: () => true },
];

const weeksOut = (d) =>
  d === 0 ? "today" : d === 1 ? "tomorrow" : d < 7 ? `${d} days` : d < 14 ? "1 wk out" : `${Math.floor(d / 7)} wks out`;
const signedPct = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(0) + "%";

function chip(p) {
  const diff = p.pace - 1;
  if (p.status === "risk") return `<span class="chip risk"><i></i>At risk ${signedPct(diff)}</span>`;
  if (p.status === "behind") return `<span class="chip behind"><i></i>Behind ${signedPct(diff)}</span>`;
  if (diff > 0.05) return `<span class="chip ahead"><i></i>Ahead ${signedPct(diff)}</span>`;
  return `<span class="chip on"><i></i>On pace</span>`;
}

function weekLabel(date, today) {
  const start = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
  const diff = Math.round((start(date) - start(today)) / 86400000 / 7);
  if (diff === 0) return "This week";
  if (diff === 1) return "Next week";
  return "Week of " + start(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default {
  id: "daily",
  label: "Daily sales",
  mount(root, source) {
    let d = source.getDailyReport();
    let horizon = "rows";
    let flaggedOnly = false;
    let lastSold = new Map(d.upcoming.map((p) => [p.id, p.sold]));
    const today = new Date();

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Daily sales report</h1>
          <p>${shortDate(today)} · a short look back, then today forward. Anything selling behind similar shows is pinned to the top, however far out it is.</p>
        </div>
      </div>
      <section class="grid kpis">
        <div class="card tile" id="d-24"><div class="label">Sold in the last 24 hrs</div><div class="value">0</div><div class="note">all upcoming performances</div></div>
        <div class="card tile" id="d-rev"><div class="label">Revenue booked to date</div><div class="value">$0</div><div class="note">today through end of season</div></div>
        <div class="card tile" id="d-watch"><div class="label">Shows needing attention</div><div class="value">0</div><div class="note" id="d-watch-note"></div></div>
        <div class="card tile" id="d-perfs"><div class="label">Performances ahead</div><div class="value">0</div><div class="note">today through end of season</div></div>
      </section>

      <div class="card watch" id="watch-card">
        <div class="card-head">
          <div>
            <h2>Needs attention</h2>
            <p class="sub">Selling behind similar shows at the same point, or crossing the 12-week mark while behind. Select one to find it in the report.</p>
          </div>
        </div>
        <div id="watch"></div>
      </div>

      <div class="card report-card">
        <div class="report-controls">
          <div class="seg" role="tablist" aria-label="How far ahead to show">
            ${HORIZONS.map((h) => `<button type="button" role="tab" data-h="${h.id}" aria-selected="${h.id === horizon}">${h.label}</button>`).join("")}
          </div>
          <label class="toggle"><input type="checkbox" id="flagged-only" /> Flagged only</label>
        </div>
        <div class="report" id="report" role="table" aria-label="Daily sales report"></div>
        <div class="report-foot" id="report-foot"></div>
      </div>`;

    // ---- Tiles ----
    function tiles(isRefresh) {
      const last24 = d.upcoming.reduce((s, p) => s + p.soldSinceLast, 0);
      const rev = d.upcoming.reduce((s, p) => s + p.revenue, 0);
      const titles = new Set(d.watch.map((p) => p.title));
      const set = (id, v, f) => {
        const tile = root.querySelector("#" + id);
        const el = tile.querySelector(".value");
        if (isRefresh && el._value !== v) flash(tile);
        countUp(el, v, f);
      };
      set("d-24", last24, int);
      set("d-rev", rev, moneyK);
      set("d-watch", titles.size, int);
      set("d-perfs", d.upcoming.length, int);
      const far = d.watch.filter((p) => p.daysOut > 30);
      root.querySelector("#d-watch-note").textContent =
        `${new Set(far.map((p) => p.title)).size} of them more than 30 days out`;
    }

    // ---- Needs attention (grouped by show) ----
    function watch() {
      const groups = [];
      for (const p of d.watch) {
        let g = groups.find((x) => x.title === p.title);
        if (!g) groups.push((g = { title: p.title, perfs: [], worst: p }));
        g.perfs.push(p);
      }
      const box = root.querySelector("#watch");
      if (!groups.length) {
        box.innerHTML = `<p class="sub">Everything is on pace.</p>`;
        return;
      }
      box.innerHTML = groups
        .map((g) => {
          const first = g.perfs.reduce((a, b) => (a.daysOut < b.daysOut ? a : b));
          const last = g.perfs.reduce((a, b) => (a.daysOut > b.daysOut ? a : b));
          const sold = g.perfs.reduce((s, p) => s + p.sold, 0);
          const cap = g.perfs.reduce((s, p) => s + p.capacity, 0);
          const bench = g.perfs.reduce((s, p) => s + p.benchmarkSold, 0);
          const gap = bench - sold;
          const dates = first === last ? shortDate(first.date) : `${shortDate(first.date)} – ${shortDate(last.date)}`;
          const crossing = g.perfs.some((p) => p.crossing);
          return `<button type="button" class="watch-row" data-id="${first.id}">
            <div class="w-status">${chip(g.worst)}</div>
            <div class="w-main">
              <div class="name">${esc(g.title)}</div>
              <div class="meta">${dates} · ${esc(first.hall.name)} · ${g.perfs.length} perf${g.perfs.length > 1 ? "s" : ""}</div>
            </div>
            <div class="w-when">${weeksOut(first.daysOut)}${crossing ? `<span class="chip cross" title="Entering the 12-week window while behind pace">⏱ Crossing 12 wks</span>` : ""}</div>
            <div class="w-nums">${int(sold)} / ${int(cap)} sold<br><span class="meta">${int(gap)} behind similar shows</span></div>
          </button>`;
        })
        .join("");
    }

    // ---- Report ----
    const head = `<div class="r-row r-head" role="row">
      <div role="columnheader">Date</div><div role="columnheader">Performance</div>
      <div role="columnheader">Sold</div><div role="columnheader" class="r">Last 24 hrs</div>
      <div role="columnheader" class="r">Revenue</div><div role="columnheader">Pace vs similar shows</div></div>`;

    function rowHtml(p, opts = {}) {
      const share = p.sold / p.capacity;
      const goalShare = (p.sold * p.avgPrice) / p.revenueGoal;
      const past = p.daysOut < 0;
      const when = `${shortDate(p.date)}<div class="meta">${esc(p.time)}${past ? "" : " · " + weeksOut(p.daysOut)}</div>`;
      const sold = `<div class="r-sold"><span>${int(p.sold)} / ${int(p.capacity)}</span><span class="meta">${pct(share)}</span></div>
        <div class="bar-track"><div class="bar-fill" ${opts.animate ? `data-width="${share * 100}%"` : `style="width:${share * 100}%"`}></div></div>`;
      const last = past
        ? `<span class="meta" title="Attendance from scans; still settling">${int(p.scanned)} attended</span>`
        : `<span class="${opts.bumped ? "bump" : ""}">${p.soldSinceLast ? "+" + int(p.soldSinceLast) : "—"}</span>`;
      const rev = `${moneyK(p.sold * p.avgPrice)}<div class="meta">${pct(goalShare)} of goal</div>`;
      const paceCell = past ? `<span class="pill">Settling</span>` : chip(p) + (p.crossing ? ` <span class="chip cross">⏱ 12 wks</span>` : "");
      return `<div class="r-row ${past ? "past" : ""} ${p.status && p.status !== "on" ? "flagged" : ""}" role="row" data-id="${p.id}" ${opts.style || ""}>
        <div class="c-date" role="cell">${when}</div>
        <div class="c-show" role="cell"><div class="name">${esc(p.title)}</div><div class="meta">${esc(p.hall.name)} · ${esc(p.genre)}</div></div>
        <div class="c-sold" role="cell">${sold}</div>
        <div class="c-24 r" role="cell">${last}</div>
        <div class="c-rev r" role="cell">${rev}</div>
        <div class="c-pace" role="cell">${paceCell}</div>
      </div>`;
    }

    function report({ animate = false, bumped = new Set() } = {}) {
      const h = HORIZONS.find((x) => x.id === horizon);
      let rows = d.upcoming.filter((p, i) => h.test(p, i));
      if (flaggedOnly) rows = d.upcoming.filter((p) => p.status !== "on" || p.crossing);
      let html = head;
      if (!flaggedOnly) {
        html += `<div class="r-section">Recap · last ${d.recap.length} performances <span class="pill">Settling, not final</span></div>`;
        html += d.recap.map((p, i) => rowHtml(p, { animate, style: animate ? `style="animation-delay:${i * 25}ms"` : "" })).join("");
      }
      html += `<div class="r-today"><span>Today · ${shortDate(today)}</span></div>`;
      let week = "";
      rows.forEach((p, i) => {
        const w = weekLabel(p.date, today);
        if (w !== week && p.daysOut > 0) {
          html += `<div class="r-week">${w}</div>`;
          week = w;
        }
        if (p.daysOut === 0) week = weekLabel(p.date, today);
        html += rowHtml(p, { animate, bumped: bumped.has(p.id), style: animate ? `style="animation-delay:${Math.min(i, 20) * 25}ms"` : "" });
      });
      const box = root.querySelector("#report");
      box.classList.toggle("enter", animate);
      box.innerHTML = html;
      if (animate) growBars(box);
      const hidden = d.upcoming.length - rows.length;
      const hiddenFlagged = d.upcoming.filter((p) => !rows.includes(p) && (p.status !== "on" || p.crossing)).length;
      root.querySelector("#report-foot").innerHTML = hidden > 0
        ? `Showing ${rows.length} of ${d.upcoming.length} upcoming performances.` +
          (hiddenFlagged ? ` ${hiddenFlagged} flagged performance${hiddenFlagged > 1 ? "s are" : " is"} further out and pinned in Needs attention.` : "") +
          ` <button type="button" class="link" id="show-all">Show the whole season</button>`
        : `Showing all ${rows.length} ${flaggedOnly ? "flagged" : "upcoming"} performances.`;
      root.querySelector("#show-all")?.addEventListener("click", () => setHorizon("season"));
    }

    function setHorizon(h) {
      horizon = h;
      flaggedOnly = false;
      root.querySelector("#flagged-only").checked = false;
      root.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.h === h)));
      report({ animate: true });
    }

    root.querySelector(".seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-h]");
      if (b) setHorizon(b.dataset.h);
    });
    root.querySelector("#flagged-only").addEventListener("change", (e) => {
      flaggedOnly = e.target.checked;
      report({ animate: true });
    });

    // Selecting a show in Needs attention finds it in the report (widening the view if needed).
    root.querySelector("#watch").addEventListener("click", (e) => {
      const b = e.target.closest(".watch-row");
      if (!b) return;
      const id = b.dataset.id;
      if (!root.querySelector(`#report [data-id="${id}"]`)) setHorizon("season");
      requestAnimationFrame(() => {
        const row = root.querySelector(`#report [data-id="${id}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.remove("found");
        void row.offsetWidth;
        row.classList.add("found");
      });
    });

    // Pace explanation on hover.
    root.querySelector("#report").addEventListener("pointermove", (e) => {
      const c = e.target.closest(".c-pace");
      const row = e.target.closest(".r-row");
      if (!c || !row || row.classList.contains("past") || row.classList.contains("r-head")) return hideTip();
      const p = d.upcoming.find((x) => x.id === row.dataset.id);
      if (!p) return hideTip();
      showTip(e, tipHtml(esc(p.title), [
        ["Sold now", int(p.sold)],
        [`Similar shows at ${p.daysOut} days out`, int(p.benchmarkSold)],
        ["Pace", signedPct(p.pace - 1)],
      ]));
    });
    root.querySelector("#report").addEventListener("pointerleave", hideTip);

    tiles(false);
    watch();
    report({ animate: true });

    return {
      update() {
        d = source.getDailyReport();
        const bumped = new Set(d.upcoming.filter((p) => p.sold !== lastSold.get(p.id)).map((p) => p.id));
        lastSold = new Map(d.upcoming.map((p) => [p.id, p.sold]));
        tiles(true);
        watch();
        report({ bumped });
      },
    };
  },
};
