// Snapshot: headline numbers, a seat map you can step through
// (tonight first, then upcoming shows across every hall), and how the next
// several performances are selling.

import { countUp, growBars, flash, reducedMotion } from "../ui/animate.js";
import { int, money, pct, shortDate, esc } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";
import { recapLink, bindRecap } from "../ui/period.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const PITCH = 10;
const ROW_GAP = 9;
const SECTION_GAP = 36;
const TOP = 58; // room for the stage and the first section label

// Lay out every seat in the hall and rank them from "sells first" to "sells last".
// Each section may set `curve` (how much its rows arc around the stage).
function buildSeats(hall, perf) {
  const widest = Math.max(...hall.sections.map((s) => s.seatsPerRow)) * PITCH;
  const W = Math.max(360, widest + 80);
  const seats = [];
  const labels = [];
  let y = TOP;
  hall.sections.forEach((sec, si) => {
    const width = sec.seatsPerRow * PITCH;
    const x0 = (W - width) / 2 + PITCH / 2;
    const center = (sec.seatsPerRow - 1) / 2;
    const curve = sec.curve ?? 0.022;
    labels.push({ name: sec.name, y: y - 12 });
    let maxDip = 0;
    for (let r = 0; r < sec.rows; r++) {
      for (let c = 0; c < sec.seatsPerRow; c++) {
        const dx = c - center;
        const dip = dx * dx * curve;
        maxDip = Math.max(maxDip, dip);
        seats.push({
          x: x0 + c * PITCH,
          y: y + r * ROW_GAP + dip,
          section: sec.name,
          row: r + 1,
          seat: c + 1,
          score: si * 10 + r * 0.8 + Math.abs(dx) * 0.33,
        });
      }
    }
    y += sec.rows * ROW_GAP + maxDip + SECTION_GAP;
  });
  const rand = rng(perf.id.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  seats.forEach((s) => (s.score += rand() * 7));

  // Holds and comps are scattered; sales fill the best remaining seats first.
  const shuffled = seats.slice().sort(() => rand() - 0.5);
  shuffled.slice(0, perf.holds).forEach((s) => (s.fixed = "hold"));
  shuffled.slice(perf.holds, perf.holds + perf.comps).forEach((s) => (s.fixed = "comp"));
  const saleOrder = seats.filter((s) => !s.fixed).sort((a, b) => a.score - b.score);
  return { seats, saleOrder, labels, width: W, height: y - SECTION_GAP + 10, stageWidth: Math.min(220, widest * 0.6) };
}

function seatSvg(layout, hall) {
  const labels = layout.labels
    .map((l) => `<text class="svg-label" x="${layout.width / 2}" y="${l.y}" text-anchor="middle">${esc(l.name.toUpperCase())}</text>`)
    .join("");
  const dots = layout.seats
    .map((s, i) => `<circle class="seat" data-i="${i}" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="3.4" />`)
    .join("");
  // Cap the drawn size so small halls don't balloon to fill the card.
  return `<svg class="seatmap" style="max-width:${Math.round(layout.width * 1.4)}px" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Seat map of ${esc(hall.name)}">
    <rect class="stage" x="${(layout.width - layout.stageWidth) / 2}" y="6" width="${layout.stageWidth}" height="20" rx="4" />
    <text class="svg-label" x="${layout.width / 2}" y="20" text-anchor="middle">STAGE</text>
    ${labels}${dots}</svg>`;
}

// The heading follows the clock, so the page reads right at any hour.
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return { hi: "Working late", line: "here's how the day wrapped up: sales, the house and the phones." };
  if (h < 12) return { hi: "Good morning", line: "where sales, tonight's house and the phones stand as of the latest refresh." };
  if (h < 17) return { hi: "Good afternoon", line: "where sales, tonight's house and the phones stand as of the latest refresh." };
  if (h < 22) return { hi: "Good evening", line: "where sales, tonight's house and the phones stand as of the latest refresh." };
  return { hi: "Good evening", line: "here's how the day wrapped up: sales, tonight's house and the phones." };
}

export default {
  id: "morning",
  label: "Snapshot",
  mount(root, source) {
    let data = source.getMorning();
    const t = data.tonight;
    let idx = 0; // which seat map is showing

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>${greeting().hi}</h1>
          <p>${shortDate(new Date())} · ${greeting().line}</p>
        </div>
      </div>
      <section class="grid kpis">
        <div class="card tile" id="k-sold"><div class="label">Tickets sold yesterday</div><div class="value">0</div><div class="note">all channels</div>${recapLink()}</div>
        <div class="card tile" id="k-rev"><div class="label">Revenue yesterday</div><div class="value">$0</div><div class="note">all channels</div>${recapLink()}</div>
        <div class="card tile" id="k-tonight"><div class="label">Tonight's house</div><div class="value">0%</div><div class="note">${esc(t.hall.name)} · ${int(t.capacity)} seats</div></div>
        <div class="card tile" id="k-30"><div class="label">Next 30 days sold</div><div class="value">0%</div><div class="note">of available capacity</div></div>
        <div class="card tile" id="k-calls"><div class="label">Calls answered yesterday</div><div class="value">0</div><div class="note">box office phones</div>${recapLink()}</div>
      </section>
      <section class="grid two-col">
        <div class="card" id="seat-card" tabindex="-1">
          <div class="card-head">
            <div>
              <h2 id="map-title"></h2>
              <p class="sub" id="map-sub"></p>
            </div>
            <div class="pager" aria-label="Browse seat maps">
              <button type="button" class="pager-btn" id="map-prev" aria-label="Previous seat map">‹</button>
              <span class="pager-count" id="map-count" aria-live="polite"></span>
              <button type="button" class="pager-btn" id="map-next" aria-label="Next seat map">›</button>
            </div>
          </div>
          <div id="seatmap" class="seatmap-wrap"></div>
          <div class="legend" id="seat-legend"></div>
          <div class="pips" id="map-pips"></div>
        </div>
        <div class="card">
          <h2>Coming up</h2>
          <p class="sub">Share of capacity sold, next 8 performances</p>
          <div class="bar-list" id="upcoming"></div>
        </div>
      </section>`;

    bindRecap(root, source);

    // ---- Seat map browser ----
    const wrap = root.querySelector("#seatmap");
    let map; // { perf, layout, circles, shownSold }

    const perfAt = (i) => data.seatMaps[i];

    function applySeat(s, cls, pop) {
      const c = map.circles[map.layout.seats.indexOf(s)];
      c.setAttribute("class", `seat ${cls}${pop ? " pop" : ""}`);
    }

    function fillTo(target, animate, popNew) {
      const from = map.shownSold;
      map.shownSold = Math.min(target, map.layout.saleOrder.length);
      const todo = map.layout.saleOrder.slice(from, map.shownSold);
      if (!animate || reducedMotion()) {
        todo.forEach((s) => applySeat(s, "sold", popNew));
        return;
      }
      // Fill in waves over ~1.6s, best seats first.
      const perFrame = Math.max(1, Math.ceil(todo.length / 95));
      const mine = map;
      let i = 0;
      const step = () => {
        if (mine !== map) return; // user moved on to another map
        todo.slice(i, i + perFrame).forEach((s) => applySeat(s, "sold", popNew));
        i += perFrame;
        if (i < todo.length) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function legend() {
      const p = map.perf;
      const open = p.capacity - map.shownSold - p.comps - p.holds;
      root.querySelector("#seat-legend").innerHTML = `
        <span><i style="background:var(--series-1)"></i>Sold <b>${int(map.shownSold)}</b></span>
        <span><i style="background:var(--series-3)"></i>Comps <b>${int(p.comps)}</b></span>
        <span><i style="background:var(--series-4)"></i>Holds <b>${int(p.holds)}</b></span>
        <span><i style="background:var(--surface-1);box-shadow:inset 0 0 0 1px var(--neutral-mark)"></i>Open <b>${int(open)}</b></span>
        <span style="margin-left:auto">${pct((map.shownSold + p.comps) / p.capacity)} full</span>`;
    }

    function header() {
      const p = map.perf;
      const when = p.daysOut === 0 ? "Tonight" : shortDate(p.date);
      root.querySelector("#map-title").textContent = `${when}: ${p.title}`;
      root.querySelector("#map-sub").textContent =
        `${p.hall.name} · ${int(p.capacity)} seats · ${p.time} · ${p.genre} · ${matchMedia("(hover: hover)").matches ? "hover" : "tap"} a seat for details`;
      root.querySelector("#map-count").textContent = `${idx + 1} of ${data.seatMaps.length}`;
      root.querySelector("#map-pips").innerHTML = data.seatMaps
        .map((m, i) => `<button type="button" class="pip ${i === idx ? "on" : ""}" data-i="${i}" aria-label="Seat map ${i + 1}: ${esc(m.title)}"></button>`)
        .join("");
    }

    function showMap(i, direction = 0) {
      idx = (i + data.seatMaps.length) % data.seatMaps.length;
      const perf = perfAt(idx);
      const layout = buildSeats(perf.hall, perf);
      wrap.innerHTML = seatSvg(layout, perf.hall);
      const svg = wrap.querySelector("svg");
      if (direction && !reducedMotion()) svg.classList.add(direction > 0 ? "slide-in-right" : "slide-in-left");
      map = { perf, layout, circles: svg.querySelectorAll(".seat"), shownSold: 0 };
      layout.seats.forEach((s) => s.fixed && applySeat(s, s.fixed, false));
      header();
      fillTo(perf.sold, true, false);
      legend();
    }

    const go = (step) => showMap(idx + step, step);
    root.querySelector("#map-prev").addEventListener("click", () => go(-1));
    root.querySelector("#map-next").addEventListener("click", () => go(1));
    root.querySelector("#map-pips").addEventListener("click", (e) => {
      const b = e.target.closest(".pip");
      if (b) showMap(+b.dataset.i, +b.dataset.i > idx ? 1 : -1);
    });
    root.querySelector("#seat-card").addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    });
    // Swipe on touch screens.
    let startX = null;
    wrap.addEventListener("pointerdown", (e) => (startX = e.pointerType === "touch" ? e.clientX : null));
    wrap.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      startX = null;
    });

    const seatTip = (e) => {
      const i = e.target.dataset?.i;
      if (i === undefined) return hideTip();
      const s = map.layout.seats[i];
      const status = s.fixed ?? (map.layout.saleOrder.indexOf(s) < map.shownSold ? "sold" : "open");
      const names = { sold: "Sold", comp: "Complimentary", hold: "House hold", open: "Available" };
      showTip(e, tipHtml(`${s.section} · Row ${s.row}, Seat ${s.seat}`, [["Status", names[status]]]));
    };
    wrap.addEventListener("pointermove", seatTip);
    wrap.addEventListener("click", seatTip); // tap on phones
    wrap.addEventListener("pointerleave", hideTip);

    // ---- Upcoming list ----
    function upcoming() {
      const box = root.querySelector("#upcoming");
      box.innerHTML = data.upcoming
        .map((p) => {
          const share = p.sold / p.capacity;
          return `<div class="bar-row">
            <div><div class="name">${esc(p.title)}</div><div class="meta">${shortDate(p.date)} · ${esc(p.hall.name)}</div></div>
            <div class="num">${int(p.sold)} / ${int(p.capacity)} · ${pct(share)}</div>
            <div class="bar-track"><div class="bar-fill" data-width="${share * 100}%"></div></div>
          </div>`;
        })
        .join("");
      growBars(box);
    }

    function kpis(isRefresh) {
      const k = data.kpis;
      const tiles = {
        // Full days from the overnight refresh, not a running count.
        "k-sold": [Math.round(k.soldToday * 4.2), int],
        "k-rev": [Math.round(k.revenueToday * 4.2), money],
        "k-tonight": [k.tonightPct * 100, (n) => n.toFixed(1) + "%"],
        "k-30": [k.next30Pct * 100, (n) => n.toFixed(1) + "%"],
        "k-calls": [k.callsAnswered, int],
      };
      for (const [id, [v, f]] of Object.entries(tiles)) {
        const tile = root.querySelector("#" + id);
        const valEl = tile.querySelector(".value");
        if (isRefresh && valEl._value !== v) flash(tile);
        countUp(valEl, v, f);
      }
    }

    kpis(false);
    showMap(0);
    upcoming();

    return {
      update() {
        data = source.getMorning();
        kpis(true);
        // New sales pop into whichever seat map is showing.
        map.perf = perfAt(idx);
        fillTo(map.perf.sold, true, true);
        legend();
        // Update bars in place so widths glide to their new values.
        const rows = root.querySelectorAll("#upcoming .bar-row");
        data.upcoming.forEach((p, i) => {
          const share = p.sold / p.capacity;
          rows[i].querySelector(".bar-fill").style.width = share * 100 + "%";
          rows[i].querySelector(".num").textContent = `${int(p.sold)} / ${int(p.capacity)} · ${pct(share)}`;
        });
      },
    };
  },
};
