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
import { strip, setStat, spark, curveChart } from "../ui/mini.js";
import { bindRecap } from "../ui/period.js";

const HORIZONS = [
  { id: "rows", label: "Next 30 rows", test: (p, i) => i < 30 },
  { id: "14", label: "14 days", test: (p) => p.daysOut <= 14 },
  { id: "30", label: "30 days", test: (p) => p.daysOut <= 30 },
  { id: "season", label: "Season", test: () => true },
];

const weeksOut = (d) =>
  d === 0 ? "today" : d === 1 ? "tomorrow" : d < 7 ? `${d} days` : d < 14 ? "1 wk out" : `${Math.floor(d / 7)} wks out`;
const signedPct = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(0) + "%";

// Status label: the worst level any enabled rule produced.
function chip(p) {
  if (p.status === "risk") return `<span class="chip risk"><i></i>At risk</span>`;
  if (p.status === "behind") return `<span class="chip behind"><i></i>Behind</span>`;
  if (p.pace > 1.05) return `<span class="chip ahead"><i></i>Ahead ${signedPct(p.pace - 1)}</span>`;
  return `<span class="chip on"><i></i>On pace</span>`;
}

// Plain-language reasons, so every flag shows why it fired.
function why(p) {
  return p.reasons
    .map((r) =>
      r.rule === "pace"
        ? `Pace ${signedPct(r.ratio - 1)} vs similar shows`
        : `Last 14 days ${signedPct(r.ratio - 1)} vs expected`
    )
    .join(" · ");
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
  mount(root, source, params) {
    let d = source.getDailyReport();
    let horizon = "rows";
    let flaggedOnly = false;
    let lastSold = new Map(d.upcoming.map((p) => [p.id, p.sold]));
    const today = new Date();

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Daily sales report</h1>
          <p>${shortDate(today)} · as of the ${esc(source.meta().asOfLabel)} refresh · a short look back, then today forward · select any row for its sales curve</p>
        </div>
        <button type="button" class="pr-link btn" data-preset="weekend" style="margin:0">Weekend &amp; past days ›</button>
      </div>
      ${strip([
        { id: "d-24", label: "Sold in the last 24 hrs", note: "through the latest refresh" },
        { id: "d-rev", label: "Revenue booked to date", note: "today through end of season" },
        { id: "d-watch", label: "Shows needing attention", note: "" },
        { id: "d-perfs", label: "Performances ahead", note: "today through end of season" },
      ])}
      <button type="button" class="attn-bar" id="attn-bar" aria-expanded="false" aria-controls="watch-card">
        <span class="count" id="attn-count">0</span><b>Need attention</b><span class="why-line" id="attn-why"></span><span class="caret">▸</span>
      </button>
      <div class="card watch" id="watch-card" hidden>
        <div id="watch"></div>
        <div class="rules" id="rules"></div>
      </div>

      <div class="card report-card">
        <div class="report-controls">
          <div class="seg" role="tablist" aria-label="How far ahead to show">
            ${HORIZONS.map((h) => `<button type="button" role="tab" data-h="${h.id}" aria-selected="${h.id === horizon}">${h.label}</button>`).join("")}
          </div>
          <label class="toggle"><input type="checkbox" id="flagged-only" /> Flagged only</label>
        </div>
        <div class="dr" id="report" role="table" aria-label="Daily sales report"></div>
        <div class="report-foot" id="report-foot"></div>
      </div>`;

    let openId = null;
    bindRecap(root, source);

    // ---- Tiles ----
    function tiles(isRefresh) {
      const last24 = d.upcoming.reduce((s, p) => s + p.soldSinceLast, 0);
      const rev = d.upcoming.reduce((s, p) => s + p.revenue, 0);
      const titles = new Set(d.watch.map((p) => p.title));
      setStat(root, "d-24", last24, int, isRefresh);
      setStat(root, "d-rev", rev, moneyK, isRefresh);
      setStat(root, "d-watch", titles.size, int, isRefresh);
      setStat(root, "d-perfs", d.upcoming.length, int, isRefresh);
      const far = d.watch.filter((p) => p.daysOut > 30);
      root.querySelector("#d-watch .note").textContent = `${new Set(far.map((p) => p.title)).size} more than 30 days out`;
      const risk = new Set(d.watch.filter((p) => p.status === "risk").map((p) => p.title));
      root.querySelector("#attn-count").textContent = titles.size;
      root.querySelector("#attn-why").textContent = `${risk.size} at risk · ${[...titles].slice(0, 3).join(", ")}${titles.size > 3 ? "…" : ""}`;
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
          const gapText = gap > 0 ? `${int(gap)} behind similar shows` : `${int(-gap)} ahead of similar shows`;
          const dates = first === last ? shortDate(first.date) : `${shortDate(first.date)} – ${shortDate(last.date)}`;
          const crossing = g.perfs.some((p) => p.crossing);
          return `<button type="button" class="watch-row" data-id="${first.id}">
            <div class="w-status">${chip(g.worst)}</div>
            <div class="w-main">
              <div class="name">${esc(g.title)}</div>
              <div class="meta">${dates} · ${esc(first.hall.name)} · ${g.perfs.length} perf${g.perfs.length > 1 ? "s" : ""}</div>
              <div class="why">${why(g.worst)}</div>
            </div>
            <div class="w-when">${weeksOut(first.daysOut)}${crossing ? `<span class="chip cross" title="Entering the 12-week window while behind pace">⏱ Crossing 12 wks</span>` : ""}</div>
            <div class="w-nums">${int(sold)} / ${int(cap)} sold<br><span class="meta">${gapText}</span></div>
          </button>`;
        })
        .join("");
    }

    // ---- Report ----
    const head = `<div class="dr-row dr-head" role="row">
      <div role="columnheader">Date</div><div role="columnheader">Performance</div>
      <div role="columnheader">Sold</div><div role="columnheader" class="c-trend">Trend vs similar</div>
      <div role="columnheader" class="r">24 hrs</div><div role="columnheader" class="r">Revenue</div><div role="columnheader">Status</div></div>`;

    const reTag = (title) =>
      source.isReturn(title)
        ? `<a class="re-tag" href="#/pacing?t=${encodeURIComponent(title)}" title="Return engagement: compare with past visits">↺ Return</a>`
        : "";

    function rowHtml(p, opts = {}) {
      const share = p.sold / p.capacity;
      const goalShare = (p.sold * p.avgPrice) / p.revenueGoal;
      const past = p.daysOut < 0;
      const when = `${shortDate(p.date)}<div class="meta">${esc(p.time)}${past ? "" : " · " + weeksOut(p.daysOut)}</div>`;
      const sold = `<div class="sold-line"><span>${int(p.sold)} / ${int(p.capacity)}</span><span class="meta">${pct(share)}</span></div>
        <div class="bar-track"><div class="bar-fill" ${opts.animate ? `data-width="${share * 100}%"` : `style="width:${share * 100}%"`}></div></div>`;
      const c = source.getPerfCurve(p);
      const trend = spark(c.pts.filter((_, i) => i % 3 === 0 || i === c.pts.length - 1), { w: 120, h: 28 });
      const last = past
        ? `<span class="meta" title="Attendance from scans; still settling">${int(p.scanned)} in</span>`
        : `<span class="${opts.bumped ? "bump" : ""}">${p.soldSinceLast ? "+" + int(p.soldSinceLast) : "—"}</span>`;
      const rev = `${moneyK(p.sold * p.avgPrice)}<div class="meta">${pct(goalShare)} of goal</div>`;
      const status = past ? `<span class="pill">Settling</span>` : chip(p) + (p.crossing ? ` <span class="chip cross" title="Entering the 12-week window while behind">⏱</span>` : "");
      const flagged = !past && p.status && p.status !== "on" ? `flagged ${p.status}` : "";
      return `<div class="dr-row ${past ? "past" : ""} ${flagged} ${openId === p.id ? "open" : ""}" role="row" data-id="${p.id}" ${opts.style || ""}>
        <div class="c-date" role="cell">${when}</div>
        <div class="c-show" role="cell"><div class="name">${esc(p.title)}${reTag(p.title)}</div><div class="meta">${esc(p.hall.name)} · ${esc(p.genre)}${p.reasons?.length ? " · " + why(p) : ""}</div></div>
        <div class="c-sold" role="cell">${sold}</div>
        <div class="c-trend" role="cell">${trend}</div>
        <div class="c-24 r" role="cell">${last}</div>
        <div class="c-rev r" role="cell">${rev}</div>
        <div class="c-status" role="cell">${status}</div>
      </div>${openId === p.id ? detailHtml(p) : ""}`;
    }

    function detailHtml(p) {
      const past = p.daysOut < 0;
      const re = source.isReturn(p.title) ? source.getReturnSummaries().find((x) => x.title === p.title) : null;
      const reLine = re
        ? `<p style="margin:10px 0 0;font-size:12.5px">↺ <b>Return engagement.</b> The run is ${re.prior.map((v) => `<b class="${v.vs >= 0 ? "pos" : "neg"}">${signedPct(v.vs)}</b> vs. the ${esc(v.label)}`).join(" and ")} at the same point. <a class="go" style="margin:0" href="#/pacing?t=${encodeURIComponent(p.title)}">Compare visits →</a></p>`
        : "";
      return `<div class="dr-detail" role="row"><div class="cols">
        <div><h3>Cumulative tickets by days before the show <span class="meta" style="font-weight:400">· dashed = similar ${esc(p.genre.toLowerCase())} shows</span></h3><div class="detail-chart" data-id="${p.id}"></div></div>
        <div><h3>${past ? "How it finished" : "Where it stands"}</h3><div class="kv">
          <span>Sold</span><b>${int(p.sold)}</b>
          <span>Comps / holds</span><b>${int(p.comps)} / ${int(p.holds)}</b>
          <span>Average ticket</span><b>${money(p.avgPrice)}</b>
          <span>Revenue vs goal</span><b>${moneyK(p.sold * p.avgPrice)} / ${moneyK(p.revenueGoal)}</b>
          ${past ? `<span>Scanned in</span><b>${int(p.scanned)}</b>` : `<span>Similar shows by now</span><b>${int(p.benchmarkSold)}</b>
          <span>Last 14 days</span><b>${int(p.sold14)} <span class="meta">(expected ${int(p.expected14)})</span></b>`}
        </div>${reLine}</div>
      </div></div>`;
    }

    function drawDetail() {
      const box = root.querySelector(".detail-chart");
      if (!box) return;
      const p = [...d.recap, ...d.upcoming].find((x) => x.id === box.dataset.id);
      curveChart(box, source.getPerfCurve(p), { capacity: p.capacity, height: 190 });
    }

    function report({ animate = false, bumped = new Set() } = {}) {
      const h = HORIZONS.find((x) => x.id === horizon);
      let rows = d.upcoming.filter((p, i) => h.test(p, i));
      if (flaggedOnly) rows = d.upcoming.filter((p) => p.status !== "on");
      let html = head;
      if (!flaggedOnly) {
        html += `<div class="dr-band">Recap · last ${d.recap.length} performances <span class="pill">Settling, not final</span></div>`;
        html += d.recap.map((p, i) => rowHtml(p, { animate, style: animate ? `style="animation-delay:${i * 25}ms"` : "" })).join("");
      }
      html += `<div class="dr-band today">Today · ${shortDate(today)}</div>`;
      let week = weekLabel(today, today);
      rows.forEach((p, i) => {
        const w = weekLabel(p.date, today);
        if (w !== week) {
          html += `<div class="dr-week">${w}</div>`;
          week = w;
        }
        html += rowHtml(p, { animate, bumped: bumped.has(p.id), style: animate ? `style="animation-delay:${Math.min(i, 20) * 25}ms"` : "" });
      });
      const box = root.querySelector("#report");
      box.classList.toggle("enter", animate);
      box.innerHTML = html;
      if (animate) growBars(box);
      drawDetail();
      const hidden = d.upcoming.length - rows.length;
      const hiddenFlagged = d.upcoming.filter((p) => !rows.includes(p) && p.status !== "on").length;
      root.querySelector("#report-foot").innerHTML = hidden > 0
        ? `Showing ${rows.length} of ${d.upcoming.length} upcoming performances.` +
          (hiddenFlagged ? ` ${hiddenFlagged} flagged performance${hiddenFlagged > 1 ? "s are" : " is"} further out (see Need attention).` : "") +
          ` <button type="button" class="link" id="show-all">Show the whole season</button>`
        : `Showing all ${rows.length} ${flaggedOnly ? "flagged" : "upcoming"} performances.`;
      root.querySelector("#show-all")?.addEventListener("click", () => setHorizon("season"));
    }

    // Select a row to open its sales curve; select again to close.
    root.querySelector("#report").addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const row = e.target.closest(".dr-row:not(.dr-head)");
      if (!row) return;
      openId = openId === row.dataset.id ? null : row.dataset.id;
      report();
    });

    // Needs attention opens and closes.
    const bar = root.querySelector("#attn-bar");
    function setAttn(open) {
      bar.setAttribute("aria-expanded", String(open));
      root.querySelector("#watch-card").hidden = !open;
    }
    bar.addEventListener("click", () => setAttn(bar.getAttribute("aria-expanded") !== "true"));
    if (params?.get("attn")) setAttn(true);

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
      openId = id;
      if (!root.querySelector(`#report [data-id="${id}"]`)) setHorizon("season");
      else report();
      requestAnimationFrame(() => {
        const row = root.querySelector(`#report [data-id="${id}"]`);
        if (!row) return;
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.remove("found");
        void row.offsetWidth;
        row.classList.add("found");
      });
    });

    // Show which rules are on, so the flags are never a black box.
    const R = d.rules;
    const pctOf = (x) => Math.round(x * 100) + "%";
    root.querySelector("#rules").innerHTML =
      `<b>Flag rules</b> (set per venue): ` +
      [
        R.pace.enabled && `sold to date below ${pctOf(R.pace.behindBelow)} of similar shows (at risk below ${pctOf(R.pace.atRiskBelow)})`,
        R.recentSales.enabled && `last ${R.recentSales.days} days' sales below ${pctOf(R.recentSales.behindBelow)} of expected (at risk below ${pctOf(R.recentSales.atRiskBelow)})`,
        R.crossing.enabled && `⏱ tag when a flagged show is ${R.crossing.fromDays / 7}–${R.crossing.toDays / 7} weeks out`,
        `media plan check coming next`,
      ].filter(Boolean).join(" · ");

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
