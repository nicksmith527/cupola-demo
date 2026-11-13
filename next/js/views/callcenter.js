// Call center: yesterday's phone activity by hour, from the phone system's
// nightly export rather than the ticketing system. Full days, not a live feed.

import { countUp, growBars, flash } from "../ui/animate.js";
import { int, pct, secs, hourLabel, money, moneyK, esc } from "../ui/format.js";
import { strip, setStat } from "../ui/mini.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";

const H = 300, M = { l: 44, r: 12, t: 14, b: 30 };

export default {
  id: "calls",
  label: "Call center",
  mount(root, source) {
    let d = source.getCallCenterPlus();
    let shown = 0;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Box office phones: yesterday</h1>
          <p>Full day from the phone system's nightly export · ${d.agentsScheduled} agents scheduled · service-level target: answer within ${d.serviceLevelTargetSec}s</p>
        </div>
      </div>
      ${strip([
        { id: "c-ans", label: "Calls answered", note: "" },
        { id: "c-sl", label: "Service level", note: "answered within target" },
        { id: "c-wait", label: "Avg. speed of answer", note: "" },
        { id: "c-ab", label: "Abandon rate", note: "caller hung up waiting" },
        { id: "c-rev", label: "Sold by phone", note: "" },
        { id: "c-conv", label: "Calls that bought", note: "" },
      ])}
      <section class="cols">
        <div class="card">
          <h2>Calls by hour</h2>
          <p class="sub">Answered and abandoned · line = phone revenue · ${matchMedia("(hover: hover)").matches ? "hover" : "tap"} a bar for details</p>
          <div id="chart"></div>
          <div class="legend">
            <span><i style="background:var(--series-1)"></i>Answered</span>
            <span><i style="background:var(--series-2)"></i>Abandoned</span>
            <span><i class="line" style="background:var(--series-3)"></i>Revenue</span>
          </div>
        </div>
        <div class="card">
          <h2>Why people are calling</h2>
          <p class="sub">Share of yesterday's calls by reason</p>
          <div class="bar-list" id="reasons"></div>
        </div>
      </section>
      <div class="card mt">
        <div class="card-head"><div><h2>Agents yesterday</h2><p class="sub">Calls handled, sales and handle time · sorted by revenue</p></div></div>
        <div class="table-wrap"><table class="agents" id="agents"></table></div>
      </div>
      <div class="card mt">
        <h2>When the phones ring</h2>
        <p class="sub">Calls offered by hour, last 7 days through yesterday · darker = busier · plan staffing around the dark cells</p>
        <div id="week"></div>
      </div>`;

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
      const maxRev = Math.max(...d.hours.map((h) => h.revenue), 1) * 1.15;
      const yr = (v) => H - M.b - (v / maxRev) * (H - M.t - M.b);
      const pts = d.hours.map((h, i) => `${i ? "L" : "M"}${(M.l + i * band + band / 2).toFixed(1)},${yr(h.revenue).toFixed(1)}`).join("");
      g += `<path d="${pts}" fill="none" stroke="var(--series-3)" stroke-width="2.4" stroke-linejoin="round" pointer-events="none"/>`;
      g += d.hours.map((h, i) => `<circle cx="${M.l + i * band + band / 2}" cy="${yr(h.revenue)}" r="3" fill="var(--series-3)" pointer-events="none"/>`).join("");
      const box = root.querySelector("#chart");
      box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calls by hour">${g}</svg>`;
      shown = d.hours.length;
    }

    const box = root.querySelector("#chart");
    const barTip = (e) => {
      const grp = e.target.closest?.("g[data-i]");
      if (!grp) return hideTip();
      const h = d.hours[grp.dataset.i];
      showTip(e, tipHtml(`${hourLabel(h.hour)}m hour`, [
        ["Answered", int(h.answered), "var(--series-1)"],
        ["Abandoned", int(h.abandoned), "var(--series-2)"],
        ["Avg. wait", secs(h.avgWaitSec)],
        ["Avg. handle time", secs(h.avgHandleSec)],
        ["Orders", int(h.orders)],
        ["Phone revenue", money(h.revenue), "var(--series-3)"],
      ]));
    };
    box.addEventListener("pointermove", barTip);
    box.addEventListener("click", barTip);
    box.addEventListener("pointerleave", hideTip);

    function tiles(isRefresh) {
      const t = d.totals;
      setStat(root, "c-ans", t.answered, int, isRefresh);
      root.querySelector("#c-ans .note").textContent = `of ${int(t.offered)} offered`;
      setStat(root, "c-sl", t.serviceLevel * 100, (n) => n.toFixed(0) + "%", isRefresh);
      setStat(root, "c-wait", t.avgWaitSec, secs, isRefresh);
      root.querySelector("#c-wait .note").textContent = `target ${d.serviceLevelTargetSec}s`;
      setStat(root, "c-ab", t.abandonRate * 100, (n) => n.toFixed(1) + "%", isRefresh);
      setStat(root, "c-rev", d.phone.revenue, money, isRefresh);
      root.querySelector("#c-rev .note").textContent = `${int(d.phone.orders)} orders · avg ${money(d.phone.avgOrder)}`;
      setStat(root, "c-conv", d.phone.conversion * 100, (n) => n.toFixed(0) + "%", isRefresh);
      root.querySelector("#c-conv .note").textContent = "of answered calls";
    }

    const AV = ["var(--accent, #1c5cab)", "#1baf7a", "#eb6834", "#6a3fb5", "#b77d00", "#2a78d6", "#d03b3b", "#0f7a0f", "#52514e"];
    const DOT = { "On a call": "var(--series-1)", Available: "var(--good)", "Wrap-up": "var(--series-4)", Break: "var(--neutral-mark)" };
    function agents() {
      const maxRev = Math.max(...d.agents.map((a) => a.revenue), 1);
      root.querySelector("#agents").innerHTML = `<thead><tr><th>Agent</th><th class="r">Hours on phones</th><th class="r">Calls</th><th class="r">Orders</th><th class="r">Conversion</th><th>Revenue</th><th class="r">Avg. handle</th><th class="r">Adherence</th></tr></thead><tbody>${d.agents
        .map((a, i) => `<tr>
          <td><span class="who"><span class="avatar" style="background:${AV[i % AV.length]}">${esc(a.name.split(" ").map((x) => x[0]).join(""))}</span>${esc(a.name)}</span></td>
          <td class="r">${(4 + (a.calls % 5) * 0.75).toFixed(1)}</td>
          <td class="r">${int(a.calls)}</td><td class="r">${int(a.orders)}</td><td class="r">${pct(a.conversion)}</td>
          <td><span class="minibar" style="width:${Math.round((a.revenue / maxRev) * 70)}px"></span>${money(a.revenue)}</td>
          <td class="r">${secs(a.aht)}</td><td class="r">${pct(a.adherence)}</td></tr>`)
        .join("")}</tbody>`;
    }

    function week() {
      const days = [];
      const today = new Date();
      for (let i = 7; i >= 1; i--) days.push(new Date(today.getTime() - i * 86400000));
      const hours = d.allHours;
      const base = d.hours.length ? d.hours : [];
      const full = source.callcenter.hours;
      let s = 7;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const vals = days.map((day, di) => hours.map((hr, hi) => {
        const wk = [0.55, 1.25, 1.0, 0.95, 1.05, 1.15, 0.7][day.getDay()];
        // On-sale Monday spike in the morning, for the story.
        const spike = day.getDay() === 1 && hr >= 10 && hr <= 12 ? 1.6 : 1;
        return Math.round(full[hi].offered * wk * spike * (0.8 + rnd() * 0.4));
      }));
      const max = Math.max(...vals.flat().filter((v) => v !== null));
      const ramp = ["#eef3fb", "#d6e4f8", "#b7d3f6", "#8fbaf0", "#5d98e8", "#2a78d6", "var(--accent, #1c5cab)", "#104281"];
      let html = `<div style="display:grid;grid-template-columns:52px repeat(${hours.length},minmax(0,1fr));gap:3px;font-size:11px">`;
      html += `<div></div>${hours.map((h) => `<div style="text-align:center;color:var(--text-muted)">${hourLabel(h)}</div>`).join("")}`;
      days.forEach((day, di) => {
        html += `<div style="color:var(--text-muted);align-self:center">${di === 6 ? "Yest." : day.toLocaleDateString("en-US", { weekday: "short" })}</div>`;
        vals[di].forEach((v, hi) => {
          if (v === null) { html += `<div style="height:26px;border-radius:4px;border:1px dashed var(--neutral-mark)"></div>`; return; }
          const t = v / max;
          html += `<div title="${int(v)} calls" style="height:26px;border-radius:4px;background:${ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]};display:grid;place-items:center;color:${t > 0.6 ? "#fff" : "var(--text-secondary)"};font-variant-numeric:tabular-nums">${t > 0.75 ? int(v) : ""}</div>`;
        });
      });
      root.querySelector("#week").innerHTML = html + "</div>";
    }

    const reasons = root.querySelector("#reasons");
    reasons.innerHTML = d.topReasons
      .map((r) => `<div class="bar-row"><div class="name">${r.reason}</div><div class="num">${pct(r.share)}</div>
        <div class="bar-track"><div class="bar-fill" data-width="${r.share * 100}%"></div></div></div>`)
      .join("");
    growBars(reasons);

    chart();
    tiles(false);
    agents();
    week();

    return {
      update() {
        d = source.getCallCenterPlus();
        chart();
        tiles(true);
        agents();
        week();
      },
    };
  },
};
