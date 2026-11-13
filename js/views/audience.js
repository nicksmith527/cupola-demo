// Audience (RFM): households scored on recency and frequency, with the
// spend that goes with them. Segment level only; no customer names.

import { countUp, growBars } from "../ui/animate.js";
import { int, money, moneyK, esc } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";
import { exportBtn, exportHouseholds, slug } from "../ui/export.js";

// Sequential blue, light end = "few" so small cells recede into the surface.
const RAMP = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#1c5cab", "#104281"];
const rampColor = (t) => RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];

export default {
  id: "audience",
  label: "Audience (RFM)",
  mount(root, source) {
    const d = source.getAudience();
    const totalHH = d.segments.reduce((s, x) => s + x.households, 0);
    const totalRev = d.segments.reduce((s, x) => s + x.revenue, 0);
    const champs = d.segments[0];

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Audience: recency, frequency, monetary</h1>
          <p>Every buying household from the last ${d.asOfWindowMonths} months, scored 1–5 on how recently and how often they buy. Segment level only; no names.</p>
        </div>
      </div>
      <section class="grid kpis">
        <div class="card tile"><div class="label">Households scored</div><div class="value" id="a-hh">0</div></div>
        <div class="card tile"><div class="label">Champions</div><div class="value" id="a-ch">0</div><div class="note">recent and frequent</div></div>
        <div class="card tile"><div class="label">Champions' share of revenue</div><div class="value" id="a-share">0%</div><div class="note">from ${((champs.households / totalHH) * 100).toFixed(0)}% of households</div></div>
        <div class="card tile"><div class="label">Promising, one show so far</div><div class="value" id="a-prom">0</div><div class="note">best second-show prospects</div></div>
      </section>
      <section class="grid two-col-even">
        <div class="card">
          <div class="card-head"><div><h2>Households by recency × frequency</h2>
          <p class="sub">Darker = more households · select a cell to export it</p></div>
          <div class="x-group">${exportBtn("cell", "Selected cell", "disabled")}</div></div>
          <div id="heat"></div>
        </div>
        <div class="card">
          <div class="card-head"><div><h2>Segments and what to do next</h2>
          <p class="sub">Bar shows each segment's share of revenue</p>
          </div><div class="x-group">${exportBtn("all", "All segments")}</div></div>
          <div class="bar-list" id="segs"></div>
        </div>
      </section>`;

    countUp(root.querySelector("#a-hh"), totalHH);
    countUp(root.querySelector("#a-ch"), champs.households);
    countUp(root.querySelector("#a-share"), (champs.revenue / totalRev) * 100, (n) => n.toFixed(1) + "%");
    countUp(root.querySelector("#a-prom"), d.segments.find((s) => s.name === "Promising").households);

    // ---- Heatmap ----
    const W = 420, H = 380, L = 70, T = 10, B = 48, cell = (W - L - 6) / 5, cellH = (H - T - B) / 5;
    const max = Math.max(...d.grid.map((g) => g.households));
    const cells = d.grid
      .map((g, i) => {
        const cx = L + (g.f - 1) * cell;
        const cy = T + (5 - g.r) * cellH;
        const t = g.households / max;
        const fill = rampColor(t);
        const ink = t > 0.5 ? "#ffffff" : "#1b1b1a";
        return `<g class="heat-cell" style="animation-delay:${(i % 5) * 60 + (5 - g.r) * 60}ms" data-i="${i}">
          <rect x="${cx + 1}" y="${cy + 1}" width="${cell - 2}" height="${cellH - 2}" rx="4" fill="${fill}" />
          <text x="${cx + cell / 2}" y="${cy + cellH / 2 + 4}" text-anchor="middle" font-size="12" fill="${ink}" font-family="var(--font)" pointer-events="none">${int(g.households)}</text>
        </g>`;
      })
      .join("");
    let axes = "";
    for (let i = 1; i <= 5; i++) {
      axes += `<text class="axis-label" x="${L + (i - 0.5) * cell}" y="${H - B + 18}" text-anchor="middle">${i}</text>`;
      axes += `<text class="axis-label" x="${L - 10}" y="${T + (5 - i + 0.5) * cellH + 4}" text-anchor="end">${i}</text>`;
    }
    axes += `<text class="axis-label" x="${L + (W - L) / 2}" y="${H - 6}" text-anchor="middle">Frequency → buys more often</text>`;
    axes += `<text class="axis-label" transform="translate(14 ${T + (H - T - B) / 2}) rotate(-90)" text-anchor="middle">Recency → bought more recently</text>`;
    const heat = root.querySelector("#heat");
    heat.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="RFM heatmap">${axes}${cells}</svg>`;
    heat.addEventListener("pointermove", (e) => {
      const g = e.target.closest?.(".heat-cell");
      if (!g) return hideTip();
      const c = d.grid[g.dataset.i];
      showTip(e, tipHtml(`Recency ${c.r} · Frequency ${c.f}`, [["Households", int(c.households)], ["Avg spend", money(c.avgSpend)]]));
    });
    heat.addEventListener("pointerleave", hideTip);

    // ---- Exports: household IDs for a segment, a grid cell, or everyone ----
    let picked = null;
    heat.addEventListener("click", (e) => {
      const g = e.target.closest?.(".heat-cell");
      if (!g) return;
      picked = +g.dataset.i;
      heat.querySelectorAll(".heat-cell rect").forEach((r, i) => r.setAttribute("stroke", i === picked ? "var(--text-primary)" : "none"));
      heat.querySelectorAll(".heat-cell rect")[picked].setAttribute("stroke-width", "2.5");
      const c = d.grid[picked];
      const b = root.querySelector('[data-x="cell"]');
      b.disabled = false;
      b.textContent = `⤓ R${c.r} · F${c.f} (${int(c.households)})`;
    });
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-x]");
      if (!b || b.disabled) return;
      if (b.dataset.x === "seg") {
        const s = d.segments.find((x) => x.name === b.dataset.seg);
        exportHouseholds({ label: "seg" + s.name, count: s.households, segment: s.name, avgSpend: s.avgSpend }, `cupola-rfm-${slug(s.name)}.csv`);
      }
      if (b.dataset.x === "all")
        exportHouseholds({ label: "all-segments", count: totalHH, avgSpend: totalRev / totalHH }, "cupola-rfm-all-segments.csv");
      if (b.dataset.x === "cell" && picked !== null) {
        const c = d.grid[picked];
        exportHouseholds({ label: `cell${c.r}${c.f}`, count: c.households, avgSpend: c.avgSpend }, `cupola-rfm-r${c.r}-f${c.f}.csv`);
      }
    });

    // ---- Segments ----
    const segs = root.querySelector("#segs");
    segs.innerHTML = d.segments
      .map((s) => {
        const share = s.revenue / totalRev;
        return `<div class="bar-row">
          <div><div class="name"><b>${esc(s.name)}</b> <span class="meta">· ${esc(s.description)}</span></div>
          <div class="meta">${int(s.households)} households · avg ${money(s.avgSpend)} · next: ${esc(s.action)}</div></div>
          <div class="num">${moneyK(s.revenue)} · ${(share * 100).toFixed(0)}% ${exportBtn("seg", "IDs", `data-seg="${esc(s.name)}" class="x-btn x-mini"`)}</div>
          <div class="bar-track"><div class="bar-fill" data-width="${share * 100}%"></div></div>
        </div>`;
      })
      .join("");
    growBars(segs);

    return { update() {} };
  },
};
