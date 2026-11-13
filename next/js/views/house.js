// House (operations): load-in by zone. How full the house is at any moment
// from doors to curtain, by section, from ticket scans. Built for front of
// house and the box office rather than as a sales view.

import { int, pct, esc } from "../ui/format.js";
import { strip, setStat } from "../ui/mini.js";
import { buildSeats, seatSvg } from "../ui/seats.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";
import { reducedMotion } from "../ui/animate.js";

const FROM = -75, TO = 20, BIN = 5;
const ZONE_COLORS = ["var(--series-1)", "var(--series-3)", "var(--series-2)", "var(--series-4)"];

function curtainMinutes(time) {
  const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(time);
  if (!m) return 19 * 60 + 30;
  return ((+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + +m[2];
}
const clock = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const rel = (m) => (m === 0 ? "curtain" : m < 0 ? `${-m} min before curtain` : `${m} min after curtain`);

export default {
  id: "house",
  label: "House",
  mount(root, source) {
    const perfs = source.getHousePerfs();
    let idx = 0;
    let at = -20;
    let timer = null;
    let st; // state for the current performance

    root.innerHTML = `
      <div class="view-head"><div>
        <h1>Load-in by zone</h1>
        <p>Front of house · how full the house is at any moment, from doors to curtain, by section</p>
      </div>
      <div class="seg" role="tablist" aria-label="Performance" id="perf-seg">
        ${perfs.map((p, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="${i === idx}">${p.daysOut === 0 ? "Tonight" : "Last night"} · ${esc(p.title)}</button>`).join("")}
      </div></div>
      ${strip([
        { id: "h-in", label: "In the house", note: "of ticketed guests" },
        { id: "h-scanned", label: "Scanned in", note: "" },
        { id: "h-due", label: "Still to arrive", note: "" },
        { id: "h-rate", label: "Arrivals, last 5 min", note: "scans" },
        { id: "h-peak", label: "Busiest 5 minutes", note: "" },
      ])}
      <div class="card" style="margin-bottom:var(--gap)">
        <div class="house-top">
          <div class="scrub">
            <button type="button" class="play" id="play" aria-label="Play doors to curtain">▶</button>
            <span class="clock" id="clock"></span>
            <input type="range" id="t" min="${FROM}" max="${TO}" step="1" value="${at}" aria-label="Time relative to curtain" />
          </div>
          <span class="sub" id="rel" style="margin:0"></span>
        </div>
        <div id="hist"></div>
      </div>
      <div class="cols">
        <div class="card">
          <div class="card-head"><div><h2 id="map-title"></h2><p class="sub" id="map-sub"></p></div></div>
          <div id="seatmap" class="seatmap-wrap"></div>
          <div class="legend">
            <span><i style="background:var(--series-1)"></i>In the house</span>
            <span><i style="background:#bcd4f3"></i>Ticketed, not here yet</span>
            <span><i style="background:var(--series-4)"></i>Hold</span>
            <span><i style="background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--neutral-mark)"></i>Unsold</span>
          </div>
        </div>
        <div class="stack">
          <div class="card"><h2>By zone</h2><p class="sub">Share of each section's ticketed guests already scanned in</p><div id="zones"></div></div>
          <p class="callout" style="margin:0">Built for front of house and the box office: when to open more scan lanes, which entrance is lagging, whether to hold the curtain. It updates as scans come in; it isn't meant as a real-time feed for everyone.</p>
        </div>
      </div>`;

    function load(i) {
      idx = i;
      const p = perfs[i];
      const layout = buildSeats(p.hall, p);
      const sold = new Set(layout.saleOrder.slice(0, p.sold));
      const model = source.arrivalModel(p, p.hall.sections.map((s) => s.name));
      layout.seats.forEach((s) => {
        s.ticketed = s.fixed === "comp" || sold.has(s);
        s.arrive = s.ticketed ? model(s.section) : undefined;
      });
      const wrap = root.querySelector("#seatmap");
      wrap.innerHTML = seatSvg(layout, p.hall);
      const circles = wrap.querySelectorAll(".seat");
      const ticketed = layout.seats.filter((s) => s.ticketed);
      const bins = [];
      for (let m = FROM; m < TO; m += BIN) bins.push({ m, n: ticketed.filter((s) => s.arrive !== null && s.arrive >= m && s.arrive < m + BIN).length });
      const peak = bins.reduce((a, b) => (b.n > a.n ? b : a));
      st = { p, layout, circles, ticketed, bins, peak, curtain: curtainMinutes(p.time) };
      root.querySelector("#map-title").textContent = `${p.daysOut === 0 ? "Tonight" : "Last night"}: ${p.title}`;
      root.querySelector("#map-sub").textContent = `${p.hall.name} · curtain ${p.time} · doors open 1 hour before · ${matchMedia("(hover: hover)").matches ? "hover" : "tap"} a seat for its scan time`;
      root.querySelectorAll("#perf-seg button").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.i === i)));
      at = p.daysOut === 0 ? -20 : TO;
      root.querySelector("#t").value = at;
      paint(false);
    }

    function hist() {
      const box = root.querySelector("#hist");
      const W = Math.max(300, Math.round(box.clientWidth || 700)), H = 110, M = { l: 6, r: 6, t: 6, b: 20 };
      const max = Math.max(...st.bins.map((b) => b.n), 1);
      const bw = (W - M.l - M.r) / st.bins.length;
      const x = (m) => M.l + ((m - FROM) / (TO - FROM)) * (W - M.l - M.r);
      let g = "";
      st.bins.forEach((b, i) => {
        const h = (b.n / max) * (H - M.t - M.b);
        const past = b.m + BIN <= at;
        g += `<rect x="${M.l + i * bw + 2}" y="${H - M.b - h}" width="${bw - 4}" height="${h}" rx="3" fill="${past ? "var(--series-1)" : b.m <= at ? "#7fb0ee" : "#dfe7f3"}"><title>${clock(st.curtain + b.m)}: ${b.n} scans</title></rect>`;
      });
      for (const m of [-60, -30, 0, 15]) g += `<text class="axis-label" x="${x(m)}" y="${H - 4}" text-anchor="middle">${m === -60 ? "doors" : m === 0 ? "curtain" : clock(st.curtain + m)}</text>`;
      g += `<line x1="${x(0)}" x2="${x(0)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--text-muted)" stroke-dasharray="3 3"/>`;
      g += `<line x1="${x(at)}" x2="${x(at)}" y1="0" y2="${H - M.b}" stroke="var(--navy)" stroke-width="2"/>`;
      box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scans per 5 minutes">${g}</svg>`;
    }

    function paint(isRefresh) {
      const { layout, circles, ticketed, p } = st;
      let inCount = 0;
      layout.seats.forEach((s, i) => {
        let cls = "seat";
        if (s.fixed === "hold") cls += " hold";
        else if (s.ticketed) {
          const here = s.arrive !== null && s.arrive <= at;
          if (here) inCount++;
          cls += here ? " in" : " due";
        }
        circles[i].setAttribute("class", cls);
      });
      const total = ticketed.length;
      const recent = ticketed.filter((s) => s.arrive !== null && s.arrive > at - 5 && s.arrive <= at).length;
      setStat(root, "h-in", (inCount / total) * 100, (n) => n.toFixed(0) + "%", isRefresh);
      setStat(root, "h-scanned", inCount, int, isRefresh);
      root.querySelector("#h-scanned .note").textContent = `of ${int(total)} ticketed`;
      setStat(root, "h-due", total - inCount, int, isRefresh);
      root.querySelector("#h-due .note").textContent = at >= TO ? "no-shows" : "ticketed, not scanned";
      setStat(root, "h-rate", recent, int, isRefresh);
      setStat(root, "h-peak", st.peak.n, int, isRefresh);
      root.querySelector("#h-peak .note").textContent = `scans from ${clock(st.curtain + st.peak.m)}`;
      root.querySelector("#clock").textContent = clock(st.curtain + at);
      root.querySelector("#rel").textContent = rel(at);

      root.querySelector("#zones").innerHTML = p.hall.sections
        .map((sec, i) => {
          const zs = ticketed.filter((s) => s.section === sec.name);
          const zin = zs.filter((s) => s.arrive !== null && s.arrive <= at).length;
          const share = zs.length ? zin / zs.length : 0;
          const lag = share < (inCount / total) - 0.08 && at < 0 && at > -45;
          return `<div class="zone-row">
            <div class="name">${esc(sec.name)}${lag ? ` <span class="chip behind" style="font-size:11px"><i></i>Lagging</span>` : ""}</div>
            <div class="num"><b>${pct(share)}</b> · ${int(zin)} of ${int(zs.length)}</div>
            <div class="zone-track"><i style="width:${share * 100}%;background:${ZONE_COLORS[i % 4]}"></i></div>
          </div>`;
        })
        .join("");
      hist();
    }

    // ---- Controls ----
    root.querySelector("#t").addEventListener("input", (e) => {
      at = +e.target.value;
      paint(false);
    });
    function stop() {
      clearInterval(timer);
      timer = null;
      const btn = root.querySelector("#play");
      if (btn) btn.textContent = "▶";
    }
    root.querySelector("#play").addEventListener("click", () => {
      if (timer) return stop();
      if (at >= TO) at = FROM;
      root.querySelector("#play").textContent = "❚❚";
      timer = setInterval(() => {
        at = Math.min(TO, at + 1);
        root.querySelector("#t").value = at;
        paint(false);
        if (at >= TO) stop();
      }, reducedMotion() ? 300 : 110);
    });
    root.querySelector("#perf-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (b) { stop(); load(+b.dataset.i); }
    });
    const wrap = root.querySelector("#seatmap");
    const seatTip = (e) => {
      const i = e.target.dataset?.i;
      if (i === undefined) return hideTip();
      const s = st.layout.seats[i];
      const status = s.fixed === "hold" ? "House hold" : !s.ticketed ? "Unsold" : s.arrive === null ? "No scan (no-show so far)" : s.arrive <= at ? `Scanned ${clock(st.curtain + s.arrive)}` : "Not here yet";
      showTip(e, tipHtml(`${esc(s.section)} · Row ${s.row}, Seat ${s.seat}`, [["Status", status]]));
    };
    wrap.addEventListener("pointermove", seatTip);
    wrap.addEventListener("click", seatTip);
    wrap.addEventListener("pointerleave", hideTip);

    load(0);
    // Stop the play timer when the user leaves the tab.
    const onHash = () => { stop(); window.removeEventListener("hashchange", onHash); };
    window.addEventListener("hashchange", onHash);

    return { update() {} };
  },
};
