// Return-engagement pacing: this visit's cumulative sales laid over the
// same title's previous visits, aligned by days before opening.

import { countUp, drawPaths, flash } from "../ui/animate.js";
import { int, pct, shortDate, esc } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";

const H = 340;
const M = { l: 58, r: 96, t: 18, b: 40 };
const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

function niceMax(v) {
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / step) * step;
}

export default {
  id: "pacing",
  label: "Return engagement",
  mount(root, source) {
    let d = source.getPacing();
    let W = 760; // replaced with the real container width once the card exists
    const X0 = d.onSaleDays;
    const yMax = niceMax(Math.max(...d.priorVisits.map((v) => v.curve[v.curve.length - 1].sold)) * 1.05);
    const x = (daysOut) => M.l + ((X0 - daysOut) / X0) * (W - M.l - M.r);
    const y = (sold) => H - M.b - (sold / yMax) * (H - M.t - M.b);
    const path = (curve) => curve.map((p, i) => `${i ? "L" : "M"}${x(p.daysOut).toFixed(1)},${y(p.sold).toFixed(1)}`).join("");
    const at = (curve, daysOut) => curve.find((p) => p.daysOut === daysOut)?.sold;

    const series = () => [
      { label: d.currentLabel, curve: d.current.curve, color: COLORS[0], primary: true },
      ...d.priorVisits.map((v, i) => ({ label: v.label, curve: v.curve, color: COLORS[i + 1] })),
    ];

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>${esc(d.title)}: return engagement pacing</h1>
          <p>${d.performances} performances · opens ${shortDate(d.firstPerformanceDate)} · this visit vs. the same title's last two visits</p>
        </div>
      </div>
      <section class="strip">
        <div class="stat" id="t-sold"><div class="label">Sold to date</div><div class="value">0</div><div class="note">${d.current.daysOut} days before opening</div></div>
        <div class="stat" id="t-v1"><div class="label">vs. ${esc(d.priorVisits[0].label)}</div><div class="value">0%</div><div class="note">at the same point</div></div>
        <div class="stat" id="t-v2"><div class="label">vs. ${esc(d.priorVisits[1].label)}</div><div class="value">0%</div><div class="note">at the same point</div></div>
        <div class="stat" id="t-cap"><div class="label">Run capacity sold</div><div class="value">0%</div><div class="note">${int(d.runCapacity)} seats across the run</div></div>
      </section>
      <div class="card">
        <h2>Cumulative tickets sold by days before opening</h2>
        <p class="sub">Hover the chart to compare visits on any day</p>
        <div id="chart"></div>
        <div class="legend" id="legend"></div>
      </div>
      <p class="callout" style="margin-top:16px" id="read"></p>`;

    // ---- Chart ----
    // Draw at the container's real pixel width so text stays its true size.
    const chart = root.querySelector("#chart");
    W = Math.max(320, Math.round(chart.clientWidth));
    const ticks = 5;
    let grid = "";
    for (let i = 0; i <= ticks; i++) {
      const v = (yMax / ticks) * i;
      grid += `<line class="gridline" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" />
        <text class="axis-label" x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end">${int(v)}</text>`;
    }
    for (let dd = X0; dd >= 0; dd -= W < 520 ? 40 : 20) {
      grid += `<text class="axis-label" x="${x(dd)}" y="${H - M.b + 18}" text-anchor="middle">${dd}</text>`;
    }
    grid += `<text class="axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 2}" text-anchor="middle">days before opening</text>`;

    const s = series();
    const lines = s
      .slice()
      .reverse()
      .map((ser) => `<path class="series draw ${ser.primary ? "primary" : ""}" data-label="${esc(ser.label)}" stroke="${ser.color}" d="${path(ser.curve)}" />`)
      .join("");
    const today = d.current.daysOut;

    chart.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pacing chart">
      ${grid}
      <line class="today-line" x1="${x(today)}" x2="${x(today)}" y1="${M.t}" y2="${H - M.b}" />
      <text class="axis-label" x="${x(today) + 6}" y="${M.t + 10}">today</text>
      ${lines}
      <g id="labels"></g>
      <g id="hover" style="display:none">
        <line class="crosshair" y1="${M.t}" y2="${H - M.b}" />
        ${s.map((ser) => `<circle class="dot" r="5" fill="${ser.color}" />`).join("")}
      </g>
      <rect id="hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent" />
    </svg>`;
    const svg = chart.querySelector("svg");
    drawPaths(svg);

    function labels() {
      // Direct labels at each line's end, nudged apart so they never collide.
      const ends = series().map((ser) => {
        const last = ser.curve[ser.curve.length - 1];
        return { ser, px: x(last.daysOut), py: y(last.sold) };
      });
      const sorted = ends.slice().sort((a, b) => a.py - b.py);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].py - sorted[i - 1].py < 16) sorted[i].py = sorted[i - 1].py + 16;
      }
      svg.querySelector("#labels").innerHTML = ends
        .map(({ ser, px, py }) => `<text class="direct-label" x="${px + 8}" y="${py + 4}">${esc(ser.label)}</text>`)
        .join("");
    }
    labels();

    root.querySelector("#legend").innerHTML = s
      .map((ser) => `<span><i class="line" style="background:${ser.color}"></i>${esc(ser.label)}</span>`)
      .join("");

    // Hover layer: crosshair, a dot on each line, one tooltip.
    const hover = svg.querySelector("#hover");
    const hit = svg.querySelector("#hit");
    hit.addEventListener("pointermove", (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
      const daysOut = Math.max(0, Math.min(X0, Math.round(X0 - ((loc.x - M.l) / (W - M.l - M.r)) * X0)));
      const cx = x(daysOut);
      hover.style.display = "";
      hover.querySelector("line").setAttribute("x1", cx);
      hover.querySelector("line").setAttribute("x2", cx);
      const rows = [];
      series().forEach((ser, i) => {
        const v = at(ser.curve, daysOut);
        const dot = hover.querySelectorAll("circle")[i];
        if (v === undefined) { dot.style.display = "none"; return; }
        dot.style.display = "";
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", y(v));
        rows.push([ser.label, int(v), ser.color]);
      });
      showTip(e, tipHtml(`${daysOut} days before opening`, rows));
    });
    hit.addEventListener("pointerleave", () => { hover.style.display = "none"; hideTip(); });

    function stats(isRefresh) {
      const now = d.current.today;
      const v1 = at(d.priorVisits[0].curve, now.daysOut);
      const v2 = at(d.priorVisits[1].curve, now.daysOut);
      const diff1 = now.sold / v1 - 1;
      const diff2 = now.sold / v2 - 1;
      const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1) + "%";
      const set = (id, val, fmt) => {
        const tile = root.querySelector("#" + id);
        const el = tile.querySelector(".value");
        if (isRefresh && el._value !== val) flash(tile);
        countUp(el, val, fmt);
      };
      set("t-sold", now.sold, int);
      set("t-v1", diff1 * 100, signed);
      set("t-v2", diff2 * 100, signed);
      set("t-cap", (now.sold / d.runCapacity) * 100, (n) => n.toFixed(1) + "%");
      root.querySelector("#read").innerHTML =
        `<b>Read:</b> this visit is ${diff1 < 0 ? "behind" : "ahead of"} the ${esc(d.priorVisits[0].label)} by ${int(Math.abs(now.sold - v1))} tickets ` +
        `and ${diff2 < 0 ? "behind" : "ahead of"} the ${esc(d.priorVisits[1].label)} by ${int(Math.abs(now.sold - v2))} at ${now.daysOut} days out. ` +
        `The last visit finished at ${pct(d.priorVisits[0].curve.at(-1).sold / d.runCapacity)} of capacity.`;
    }
    stats(false);

    return {
      update() {
        d = source.getPacing();
        const p = svg.querySelector(`path[data-label="${CSS.escape(d.currentLabel)}"]`);
        p.setAttribute("d", path(d.current.curve));
        p.style.strokeDasharray = "none";
        labels();
        stats(true);
      },
    };
  },
};
