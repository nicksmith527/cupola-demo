// House plan (operations): which seating zones each performance needs.
//
// Not a live load-in feed. At set checkpoints before each show (12, 8 and 4
// weeks by default, see config.zonePlan) Cupola projects where demand will
// land and suggests opening a zone that's kept closed until needed (e.g. the
// Balcony), or keeping it closed. Last night's scans appear as a recap only.

import { config } from "../config.js";
import { int, pct, shortDate, esc } from "../ui/format.js";
import { strip, setStat } from "../ui/mini.js";
import { buildSeats, seatSvg } from "../ui/seats.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";
import { openShowReport, fromPerf } from "../ui/showreport.js";

const ZP = config.zonePlan;
const LAST_CHECK = Math.max(...ZP.checkpointsWeeks) * 7;
const ZONE_COLORS = ["var(--series-1)", "var(--series-3)", "var(--series-2)", "var(--series-4)"];

// Same sales-curve shape the rest of the demo uses (see extras.js).
const shape = (t) => { t = Math.min(1, Math.max(0, t)); return 0.24 * (1 - Math.exp(-t * 14)) + 0.76 * Math.pow(t, 2.4); };

function plan(p) {
  const closed = ZP.closedByDefault[p.hallId] ?? null;
  const layout = buildSeats(p.hall, p);
  const sellable = layout.saleOrder.length;
  const tNow = 1 - p.daysOut / p.onSaleDays;
  const projected = Math.min(sellable, Math.max(p.sold, Math.round(p.sold / Math.max(0.05, shape(tNow)))));
  const soldSet = new Set(layout.saleOrder.slice(0, p.sold));
  const projSet = new Set(layout.saleOrder.slice(p.sold, projected));
  const zones = p.hall.sections.map((sec, i) => {
    const seats = layout.seats.filter((s) => s.section === sec.name);
    return {
      name: sec.name,
      color: ZONE_COLORS[i % 4],
      seats: seats.length,
      // A closed zone only counts real sales (comps can be moved down).
      sold: seats.filter((s) => soldSet.has(s) || (s.fixed === "comp" && sec.name !== closed)).length,
      proj: seats.filter((s) => projSet.has(s)).length,
      holds: seats.filter((s) => s.fixed === "hold").length,
      closed: sec.name === closed,
    };
  });
  const cz = zones.find((z) => z.closed);
  const below = zones.filter((z) => !z.closed).reduce((s, z) => s + z.seats - z.holds, 0);
  const ratio = (projected + p.comps) / Math.max(1, below);
  let action = "none";
  if (cz) {
    if (p.daysOut > LAST_CHECK) action = "later";
    else if (cz.sold > 0) action = "open-now";
    else if (ratio >= ZP.openAbove) action = "open";
    else if (ratio >= ZP.keepClosedBelow) action = "watch";
    else action = "keep";
  }
  // The checkpoint this performance most recently passed.
  const wk = p.daysOut / 7;
  const passed = ZP.checkpointsWeeks.filter((w) => wk <= w).sort((a, b) => a - b)[0];
  const nextCheck = p.daysOut > LAST_CHECK ? new Date(p.date.getTime() - LAST_CHECK * 86400000) : null;
  return { p, layout, soldSet, projSet, zones, closed: cz, below, projected, ratio, action, passed, nextCheck };
}

const ACTIONS = {
  open: { chip: "risk", text: (z) => `Open the ${z}`, rank: 0 },
  watch: { chip: "behind", text: (z) => `Watch the ${z}`, rank: 1 },
  "open-now": { chip: "cross", text: (z) => `${z} selling`, rank: 2 },
  keep: { chip: "on", text: (z) => `Keep ${z} closed`, rank: 3 },
  later: { chip: "", text: () => `Review at ${LAST_CHECK / 7} wks`, rank: 4 },
};
const chipHtml = (x) => {
  const a = ACTIONS[x.action];
  return `<span class="chip ${a.chip}">${a.chip && a.chip !== "cross" ? "<i></i>" : ""}${esc(a.text(x.closed.name))}</span>`;
};

export default {
  id: "house",
  label: "House plan",
  mount(root, source) {
    const upcoming = source.getDailyReport().upcoming;
    const plans = upcoming.map(plan).filter((x) => x.closed);
    const ranked = plans.slice().sort((a, b) => ACTIONS[a.action].rank - ACTIONS[b.action].rank || a.p.daysOut - b.p.daysOut);
    let sel = ranked[0];
    let filter = "review";

    root.innerHTML = `
      <div class="view-head"><div>
        <h1>House plan</h1>
        <p>Which seating zones each performance needs · reviewed at ${ZP.checkpointsWeeks.join(", ")} weeks out · as of the ${esc(source.meta().asOfLabel)} refresh</p>
      </div></div>
      ${strip([
        { id: "z-open", label: "Shows to open a zone", note: "projected demand calls for it" },
        { id: "z-watch", label: "Shows to watch", note: "close to the line" },
        { id: "z-keep", label: "Shows to keep closed", note: "demand fits below" },
        { id: "z-week", label: "Performances at a checkpoint", note: "" },
      ])}
      <div class="cols">
        <div class="card">
          <div class="card-head"><div><h2>Triggers</h2><p class="sub">Select one to see its zones</p></div>
            <div class="seg" role="tablist" id="zf">
              <button type="button" role="tab" data-f="review" aria-selected="true">Needs a decision</button>
              <button type="button" role="tab" data-f="all" aria-selected="false">All</button>
            </div></div>
          <div class="mini-list" id="triggers"></div>
        </div>
        <div class="card" id="plan-card">
          <h2 id="pt"></h2><p class="sub" id="ps"></p>
          <div id="advice"></div>
          <div id="zones" style="margin-top:8px"></div>
          <div id="seatmap" class="seatmap-wrap" style="margin-top:12px"></div>
          <div class="legend">
            <span><i style="background:var(--series-1)"></i>Sold</span>
            <span><i style="background:#bcd4f3"></i>Projected by show day</span>
            <span><i style="background:var(--series-4)"></i>Hold</span>
            <span><i style="background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--neutral-mark)"></i>Not expected to sell</span>
          </div>
        </div>
      </div>
      <div class="card mt" id="recap"></div>
      <p class="callout mt">Set per venue: which zones stay closed until needed (${Object.entries(ZP.closedByDefault).map(([h, z]) => `${esc(source.hall(h)?.name ?? h)}: ${esc(z)}`).join(", ")}), the checkpoints, and the thresholds (open when projected demand reaches ${pct(ZP.openAbove)} of the seats below; keep closed under ${pct(ZP.keepClosedBelow)}). Each checkpoint's triggers could go to front of house as an email or Teams message.</p>`;

    // Counted by show, matching the trigger list.
    const worst = new Map();
    for (const x of ranked) if (!worst.has(x.p.title)) worst.set(x.p.title, x.action);
    const count = (a) => [...worst.values()].filter((v) => v === a).length;
    setStat(root, "z-open", count("open"), int);
    setStat(root, "z-watch", count("watch"), int);
    setStat(root, "z-keep", count("keep"), int);
    const thisWeekPerfs = plans.filter((x) => ZP.checkpointsWeeks.some((w) => x.p.daysOut <= w * 7 && x.p.daysOut > w * 7 - 7));
    setStat(root, "z-week", thisWeekPerfs.length, int);
    root.querySelector("#z-week .note").textContent = `at the ${ZP.checkpointsWeeks.join("/")}-week marks`;

    // One row per show: its most urgent performance sets the action.
    function groups(list) {
      const out = [];
      for (const x of list) {
        let g = out.find((o) => o.title === x.p.title && o.hall === x.p.hallId);
        if (!g) out.push((g = { title: x.p.title, hall: x.p.hallId, items: [] }));
        g.items.push(x);
      }
      return out;
    }

    function triggers() {
      const list = filter === "review" ? ranked.filter((x) => ["open", "watch"].includes(x.action)) : ranked;
      const gs = groups(list);
      root.querySelector("#triggers").innerHTML = gs.length
        ? gs
            .map((g) => {
              const x = g.items[0];
              const all = plans.filter((y) => y.p.title === g.title && y.p.hallId === g.hall);
              const first = all.reduce((a, b) => (a.p.daysOut < b.p.daysOut ? a : b)).p;
              const last = all.reduce((a, b) => (a.p.daysOut > b.p.daysOut ? a : b)).p;
              const dates = first === last ? shortDate(first.date) : `${shortDate(first.date)} – ${shortDate(last.date)}`;
              const same = all.filter((y) => y.action === x.action).length;
              const why = x.action === "later"
                ? `First review ${shortDate(x.nextCheck)}`
                : x.action === "open-now"
                ? `${int(x.closed.sold)} sold in the ${esc(x.closed.name)} already`
                : `Projected up to ${pct(Math.max(...g.items.map((y) => y.ratio)))} of the seats below the ${esc(x.closed.name)}`;
              const isSel = g.items.includes(sel) || all.includes(sel);
              return `<button type="button" class="trig ${isSel ? "sel" : ""}" data-id="${x.p.id}">
                <div class="t-main"><div class="name">${esc(g.title)}</div>
                  <div class="meta">${dates} · ${esc(x.p.hall.name)} · ${all.length > 1 ? `${same} of ${all.length} perfs` : "1 perf"} · ${Math.round(x.p.daysOut / 7)} wks out${x.passed ? ` · ${x.passed}-wk check` : ""}</div>
                  <div class="meta">${why}</div></div>
                <div class="t-chip">${chipHtml(x)}</div>
              </button>`;
            })
            .join("")
        : `<p class="sub">Nothing needs a decision right now: every reviewed performance fits below its closed zone or already has it open.</p>`;
    }

    // Within the selected show, step through its performances.
    function perfPicker(x) {
      const all = plans.filter((y) => y.p.title === x.p.title && y.p.hallId === x.p.hallId).sort((a, b) => a.p.daysOut - b.p.daysOut);
      if (all.length < 2) return "";
      return `<div class="seg" id="pp" style="margin:4px 0 10px">${all
        .map((y) => `<button type="button" data-id="${y.p.id}" aria-selected="${y === x}">${y.p.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</button>`)
        .join("")}</div>`;
    }

    function show(x) {
      sel = x;
      const { p } = x;
      root.querySelector("#pt").textContent = p.title;
      root.querySelector("#ps").textContent = `${shortDate(p.date)} · ${p.time} · ${p.hall.name} · ${int(p.sold)} sold, about ${int(x.projected)} projected by show day`;
      const z = esc(x.closed.name);
      const advice = {
        open: `Projected demand needs about ${int(x.projected + p.comps - x.below)} more seats than the zones below the ${z} hold. Opening it now puts those seats on sale while demand is still building.`,
        watch: `Demand is projected to fill ${pct(x.ratio)} of the seats below the ${z}. No change yet; it comes up again at the next checkpoint.`,
        "open-now": `The ${z} is already open and selling for this performance.`,
        keep: `Projected demand fits in the zones below with room to spare. Keeping the ${z} closed concentrates the audience and saves an usher team.`,
        later: `More than ${LAST_CHECK / 7} weeks out. The first review is ${x.nextCheck ? shortDate(x.nextCheck) : "later"}.`,
      }[x.action];
      root.querySelector("#advice").innerHTML = `${perfPicker(x)}${chipHtml(x)}<p class="sub" style="margin:8px 0 0">${advice}</p>`;
      root.querySelector("#zones").innerHTML = x.zones
        .map((zn) => `<div class="zone-row">
          <div class="name">${esc(zn.name)}${zn.closed ? ` <span class="pill">closed until needed</span>` : ""}</div>
          <div class="num"><b>${int(zn.sold)}</b> sold · ${int(zn.sold + zn.proj)} projected · ${int(zn.seats)} seats</div>
          <div class="zone-track"><i style="width:${(zn.sold / zn.seats) * 100}%;background:${zn.color}"></i><i style="width:${(zn.proj / zn.seats) * 100}%;background:${zn.color};opacity:.35"></i></div>
        </div>`)
        .join("");
      const wrap = root.querySelector("#seatmap");
      wrap.innerHTML = seatSvg(x.layout, p.hall);
      const circles = wrap.querySelectorAll(".seat");
      x.layout.seats.forEach((s, i) => {
        const cls = s.fixed === "hold" ? "hold" : s.fixed === "comp" || x.soldSet.has(s) ? "in" : x.projSet.has(s) ? "due" : "";
        circles[i].setAttribute("class", `seat ${cls}`);
      });
      triggers();
    }

    root.querySelector("#triggers").addEventListener("click", (e) => {
      const b = e.target.closest("[data-id]");
      if (!b) return;
      show(plans.find((x) => x.p.id === b.dataset.id));
      if (matchMedia("(max-width: 760px)").matches) root.querySelector("#plan-card").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    root.querySelector("#advice").addEventListener("click", (e) => {
      const b = e.target.closest("#pp button[data-id]");
      if (b) show(plans.find((x) => x.p.id === b.dataset.id));
    });
    root.querySelector("#zf").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]");
      if (!b) return;
      filter = b.dataset.f;
      root.querySelectorAll("#zf button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      triggers();
    });
    const wrap = root.querySelector("#seatmap");
    const tip = (e) => {
      const i = e.target.dataset?.i;
      if (i === undefined || !sel) return hideTip();
      const s = sel.layout.seats[i];
      const st = s.fixed === "hold" ? "House hold" : s.fixed === "comp" ? "Complimentary" : sel.soldSet.has(s) ? "Sold" : sel.projSet.has(s) ? "Projected to sell" : "Not expected to sell";
      showTip(e, tipHtml(`${esc(s.section)} · Row ${s.row}, Seat ${s.seat}`, [["Status", st]]));
    };
    wrap.addEventListener("pointermove", tip);
    wrap.addEventListener("click", tip);
    wrap.addEventListener("pointerleave", hideTip);

    // ---- Last night: a recap from scans, after the fact ----
    const last = source.getHousePerfs().find((p) => p.daysOut === -1);
    if (last) {
      const lay = buildSeats(last.hall, last);
      const sold = new Set(lay.saleOrder.slice(0, last.sold));
      const model = source.arrivalModel(last, last.hall.sections.map((s) => s.name));
      const tix = lay.seats.filter((s) => s.fixed === "comp" || sold.has(s)).map((s) => ({ ...s, arrive: model(s.section) }));
      // Match the attendance the rest of the demo reports for this show.
      const scanned = tix.filter((s) => s.arrive !== null);
      const late = scanned.filter((s) => s.arrive > 0).length;
      const bins = [];
      for (let m = -60; m < 20; m += 10) bins.push({ m, n: scanned.filter((s) => s.arrive >= m && s.arrive < m + 10).length });
      const peak = bins.reduce((a, b) => (b.n > a.n ? b : a));
      const max = peak.n || 1;
      root.querySelector("#recap").innerHTML = `
        <div class="card-head"><h2>Last night's load-in · ${esc(last.title)}</h2><button type="button" class="go" id="last-report" style="margin:0">Show report →</button></div>
        <p class="sub">${esc(last.hall.name)} · recap from ticket scans after the show, for planning door and usher staffing</p>
        <div class="cols even" style="align-items:end">
          <div><div style="display:flex;align-items:flex-end;gap:4px;height:80px">${bins.map((b) => `<div title="${int(b.n)} scans" style="flex:1;height:${(b.n / max) * 100}%;background:${b === peak ? "var(--series-1)" : "#bcd4f3"};border-radius:3px 3px 0 0"></div>`).join("")}</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:4px"><span>doors</span><span>curtain</span><span>+20 min</span></div></div>
          <div class="kv">
            <span>Scanned in</span><b>${int(last.scanned)} of ${int(last.sold + last.comps)} (${pct(last.scanned / (last.sold + last.comps))})</b>
            <span>Busiest 10 minutes</span><b>${peak.m < 0 ? `${-peak.m}–${-peak.m - 10} min before` : `${peak.m}–${peak.m + 10} min after`}</b>
            <span>After curtain</span><b>${int(late)} (${pct(late / Math.max(1, scanned.length))})</b>
            <span>No-shows</span><b>${int(last.sold + last.comps - last.scanned)}</b>
          </div>
        </div>`;
      root.querySelector("#last-report").addEventListener("click", () => openShowReport(fromPerf(last)));
    } else root.querySelector("#recap").remove();

    if (sel) show(sel);
    else triggers();
    return { update() {} };
  },
};
