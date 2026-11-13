// Call center: yesterday's phone activity by hour, from the phone system's
// nightly export rather than the ticketing system. Full days, not a live feed.

import { countUp, growBars, flash } from "../ui/animate.js";
import { int, pct, secs, hourLabel } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";

const H = 300, M = { l: 44, r: 12, t: 14, b: 30 };

export default {
  id: "calls",
  label: "Call center",
  mount(root, source) {
    let d = source.getCallCenter();
    let shown = 0;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Box office phones: yesterday</h1>
          <p>Full day from the phone system's nightly export · ${d.agentsScheduled} agents scheduled · service-level target: answer within ${d.serviceLevelTargetSec}s</p>
        </div>
      </div>
      <section class="grid kpis">
        <div class="card tile" id="c-off"><div class="label">Calls offered</div><div class="value">0</div></div>
        <div class="card tile" id="c-ans"><div class="label">Answered</div><div class="value">0</div></div>
        <div class="card tile" id="c-ab"><div class="label">Abandon rate</div><div class="value">0%</div><div class="note">caller hung up waiting</div></div>
        <div class="card tile" id="c-wait"><div class="label">Avg. speed of answer</div><div class="value">0s</div></div>
        <div class="card tile" id="c-sl"><div class="label">Service level</div><div class="value">0%</div><div class="note">answered within target</div></div>
      </section>
      <section class="grid two-col">
        <div class="card">
          <h2>Calls by hour</h2>
          <p class="sub">Answered and abandoned · hover a bar for wait times</p>
          <div id="chart"></div>
          <div class="legend">
            <span><i style="background:var(--series-1)"></i>Answered</span>
            <span><i style="background:var(--series-2)"></i>Abandoned</span>
          </div>
        </div>
        <div class="card">
          <h2>Why people are calling</h2>
          <p class="sub">Share of yesterday's calls by reason</p>
          <div class="bar-list" id="reasons"></div>
        </div>
      </section>`;

    const chartBox = root.querySelector("#chart");
    const W = Math.max(320, Math.round(chartBox.clientWidth)); // true pixel width keeps text crisp
    const maxOffered = Math.ceil((d.peakOffered * 1.08) / 25) * 25;
    const y = (v) => H - M.b - (v / maxOffered) * (H - M.t - M.b);
    const slots = d.allHours.length;
    const band = (W - M.l - M.r) / slots;
    const bw = band * 0.62;

    function chart() {
      let g = "";
      for (let i = 0; i <= 4; i++) {
        const v = Math.round((maxOffered / 4) * i);
        g += `<line class="gridline" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" />
          <text class="axis-label" x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
      }
      d.allHours.forEach((hr, i) => {
        const x = M.l + i * band + (band - bw) / 2;
        g += `<text class="axis-label" x="${x + bw / 2}" y="${H - M.b + 18}" text-anchor="middle">${hourLabel(hr)}</text>`;
        const h = d.hours[i];
        if (!h) {
          g += `<rect x="${x}" y="${M.t + 40}" width="${bw}" height="${H - M.b - M.t - 40}" rx="4" fill="none" stroke="var(--neutral-mark)" stroke-dasharray="3 4" />`;
          return;
        }
        const isNew = i >= shown;
        const yA = y(h.answered);
        const yT = y(h.offered);
        // Answered sits on the baseline; abandoned stacks on top with a 2px gap.
        g += `<g class="${isNew ? "grow" : ""}" data-i="${i}" style="animation-delay:${isNew && shown === 0 ? i * 70 : 0}ms">
          <rect x="${x}" y="${yA}" width="${bw}" height="${H - M.b - yA}" fill="var(--series-1)" />
          <rect x="${x}" y="${yT}" width="${bw}" height="${Math.max(0, yA - yT - 2)}" rx="3" fill="var(--series-2)" />
          <rect x="${x - (band - bw) / 2}" y="${M.t}" width="${band}" height="${H - M.t - M.b}" fill="transparent" />
        </g>`;
      });
      const box = root.querySelector("#chart");
      box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calls by hour">${g}</svg>`;
      shown = d.hours.length;
    }

    const box = root.querySelector("#chart");
    box.addEventListener("pointermove", (e) => {
      const grp = e.target.closest?.("g[data-i]");
      if (!grp) return hideTip();
      const h = d.hours[grp.dataset.i];
      showTip(e, tipHtml(`${hourLabel(h.hour)}m hour`, [
        ["Answered", int(h.answered), "var(--series-1)"],
        ["Abandoned", int(h.abandoned), "var(--series-2)"],
        ["Avg. wait", secs(h.avgWaitSec)],
        ["Avg. handle time", secs(h.avgHandleSec)],
      ]));
    });
    box.addEventListener("pointerleave", hideTip);

    function tiles(isRefresh) {
      const t = d.totals;
      const set = (id, v, f) => {
        const tile = root.querySelector("#" + id);
        const el = tile.querySelector(".value");
        if (isRefresh && el._value !== v) flash(tile);
        countUp(el, v, f);
      };
      set("c-off", t.offered, int);
      set("c-ans", t.answered, int);
      set("c-ab", t.abandonRate * 100, (n) => n.toFixed(1) + "%");
      set("c-wait", t.avgWaitSec, secs);
      set("c-sl", t.serviceLevel * 100, (n) => n.toFixed(0) + "%");
    }

    const reasons = root.querySelector("#reasons");
    reasons.innerHTML = d.topReasons
      .map((r) => `<div class="bar-row"><div class="name">${r.reason}</div><div class="num">${pct(r.share)}</div>
        <div class="bar-track"><div class="bar-fill" data-width="${r.share * 100}%"></div></div></div>`)
      .join("");
    growBars(reasons);

    chart();
    tiles(false);

    return {
      update() {
        d = source.getCallCenter();
        chart();
        tiles(true);
      },
    };
  },
};
