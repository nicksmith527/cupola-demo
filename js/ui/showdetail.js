// Show pop-up from the Snapshot's "Coming up" list: the last 15 days of
// sales for one performance, where it stands, and how it's selling.
// The daily numbers are synthetic but agree with the performance's own
// "last 14 days" figure, so the pop-up and Daily sales tell the same story.

import { exportSummary, slug } from "./export.js";

const DAY = 86400000;
const int = (n) => Math.round(n).toLocaleString("en-US");
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const pct = (n) => Math.round(n * 100) + "%";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hash = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Daily tickets for the 15 days before today. The last 14 sum to p.sold14.
export function last15(p, today) {
  const r = rng(hash(p.id + "15"));
  const dowW = [0.75, 1.35, 1.1, 1.0, 0.95, 0.9, 0.8]; // Sun..Sat
  // A show behind its expected pace tapers; one ahead picks up.
  const trend = (p.sold14 || 1) / Math.max(1, p.expected14 || p.sold14 || 1);
  const days = [];
  for (let k = 15; k >= 1; k--) {
    const date = new Date(today.getTime() - k * DAY);
    const slope = 1 + (trend - 1) * ((15 - k) / 14) * 0.9;
    days.push({ date, w: dowW[date.getDay()] * (0.6 + r() * 0.8) * Math.max(0.2, slope) });
  }
  const last14 = days.slice(1);
  const wsum = last14.reduce((a, d) => a + d.w, 0);
  let left = p.sold14 || 0;
  last14.forEach((d, i) => {
    d.tickets = i === last14.length - 1 ? left : Math.round(((p.sold14 || 0) * d.w) / wsum);
    left -= d.tickets;
  });
  if (left < 0) last14.at(-1).tickets = Math.max(0, last14.at(-1).tickets + left);
  days[0].tickets = Math.round(((p.sold14 || 0) / 14) * days[0].w);
  return days.map((d) => ({ date: d.date, tickets: Math.max(0, d.tickets) }));
}

function bars(days, expectedPerDay) {
  const W = 620, H = 170, M = { l: 34, r: 8, t: 16, b: 24 };
  const max = Math.max(...days.map((d) => d.tickets), expectedPerDay, 1) * 1.12;
  const bw = (W - M.l - M.r) / days.length;
  const y = (v) => H - M.b - (v / max) * (H - M.t - M.b);
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const v = (max / 3) * i;
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid, #eee)"/><text x="${M.l - 6}" y="${y(v) + 4}" text-anchor="end" class="pr-ax">${int(v)}</text>`;
  }
  days.forEach((d, i) => {
    const x = M.l + i * bw;
    const wk = [0, 5, 6].includes(d.date.getDay());
    g += `<rect x="${x + bw * 0.15}" y="${y(d.tickets)}" width="${bw * 0.7}" height="${H - M.b - y(d.tickets)}" rx="3" fill="${wk ? "var(--accent, #1c5cab)" : "var(--accent-light, #7fb0ee)"}"><title>${d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}: ${int(d.tickets)} tickets</title></rect>`;
    if (i % 2 === 0 || days.length <= 8) g += `<text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle" class="pr-ax">${d.date.getDate()}</text>`;
  });
  g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(expectedPerDay)}" y2="${y(expectedPerDay)}" stroke="var(--text-muted)" stroke-dasharray="4 4"/>
    <text x="${W - M.r}" y="${y(expectedPerDay) - 5}" text-anchor="end" class="pr-ax">expected ${int(expectedPerDay)}/day</text>`;
  return `<svg class="pr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tickets per day, last 15 days">${g}</svg>`;
}

// Trend projection to show day. Not a promise: the recent daily rate,
// stepped up for the usual late ramp (the final weeks sell faster), with a
// range from the slower and faster of the last two weeks. Capped at the
// seats still available.
export function projection(p, days) {
  const D = Math.max(0, p.daysOut);
  const avail = Math.max(0, p.capacity - p.sold - (p.comps || 0) - (p.holds || 0));
  const last7 = days.slice(-7).reduce((a, d) => a + d.tickets, 0) / 7;
  const prior7 = days.slice(1, 8).reduce((a, d) => a + d.tickets, 0) / 7;
  const mid = (last7 * 2 + prior7) / 3;
  const ramp = (d) => 1 + 1.6 * Math.exp(-d / 6); // last week runs ~2.5x
  const path = (rate, k) => {
    const pts = [];
    let cum = p.sold;
    for (let d = D; d >= 0; d--) {
      if (d < D) cum = Math.min(p.sold + avail, cum + rate * ramp(d) * k);
      pts.push({ d, v: cum });
    }
    if (D === 0) pts.push({ d: -0.01, v: Math.min(p.sold + avail, p.sold + avail * 0.25 * k) }); // tonight: walk-up
    return pts;
  };
  const mk = path(mid, 1), lo = path(Math.min(last7, prior7), 0.85), hi = path(Math.max(last7, prior7), 1.15);
  const fin = (x) => Math.round(x.at(-1).v);
  const soldOut = mk.find((x) => x.v >= p.sold + avail - 0.5 && avail > 0);
  return { D, avail, mid, mk, lo, hi, final: fin(mk), low: fin(lo), high: fin(hi), soldOutDay: soldOut ? soldOut.d : null };
}

function trendChart(p, days, f, today) {
  const W = 620, H = 200, M = { l: 44, r: 12, t: 14, b: 26 };
  // Past 15 days of cumulative sales, ending at today's total.
  let cum = p.sold;
  const past = [];
  for (let i = days.length - 1; i >= 0; i--) { past.unshift({ x: -(days.length - 1 - i) - 1, v: cum }); cum -= days[i].tickets; }
  past.unshift({ x: -days.length - 1, v: cum });
  past.push({ x: 0, v: p.sold });
  const xMin = -days.length - 1, xMax = Math.max(1, f.D);
  const yMin = Math.max(0, Math.min(...past.map((q) => q.v)) * 0.9);
  const yMax = p.capacity * 1.03;
  const X = (x) => M.l + ((x - xMin) / (xMax - xMin)) * (W - M.l - M.r);
  const Y = (v) => H - M.b - ((v - yMin) / (yMax - yMin)) * (H - M.t - M.b);
  const line = (pts) => pts.map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)},${Y(q.v).toFixed(1)}`).join("");
  const fx = (arr) => arr.map((q) => ({ x: f.D === 0 ? (q.d < 0 ? 1 : 0) : f.D - q.d, v: q.v }));
  const lo = fx(f.lo), hi = fx(f.hi), mk = fx(f.mk);
  const band = `${line(hi)}L${[...lo].reverse().map((q) => `${X(q.x).toFixed(1)},${Y(q.v).toFixed(1)}`).join("L")}Z`;
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const v = yMin + ((yMax - yMin) / 3) * i;
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid, #eee)"/><text x="${M.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="pr-ax">${int(v)}</text>`;
  }
  g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(p.capacity)}" y2="${Y(p.capacity)}" stroke="var(--text-muted)" stroke-dasharray="2 3"/><text x="${M.l + 4}" y="${Y(p.capacity) - 4}" class="pr-ax">capacity ${int(p.capacity)}</text>`;
  g += `<line x1="${X(0)}" x2="${X(0)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--border)" stroke-width="2"/>`;
  g += `<text x="${X(xMin)}" y="${H - 8}" class="pr-ax">15 days ago</text>${X(xMax) - X(0) < 70 ? `<text x="${X(0) - 6}" y="${M.t + 10}" text-anchor="end" class="pr-ax">today</text>` : `<text x="${X(0)}" y="${H - 8}" text-anchor="middle" class="pr-ax">today</text>`}<text x="${X(xMax)}" y="${H - 8}" text-anchor="end" class="pr-ax">${f.D === 0 ? "curtain" : "show day"}</text>`;
  g += `<path d="${band}" fill="color-mix(in srgb, var(--accent, #1c5cab) 14%, transparent)" stroke="none"/>`;
  g += `<path d="${line(mk)}" fill="none" stroke="var(--accent, #1c5cab)" stroke-width="2.2" stroke-dasharray="6 5"/>`;
  g += `<path d="${line(past)}" fill="none" stroke="var(--accent, #1c5cab)" stroke-width="2.6" stroke-linejoin="round"/>`;
  g += `<circle cx="${X(0)}" cy="${Y(p.sold)}" r="4.5" fill="var(--accent, #1c5cab)"/>`;
  const end = mk.at(-1);
  g += `<circle cx="${X(end.x)}" cy="${Y(end.v)}" r="4" fill="var(--surface-1)" stroke="var(--accent, #1c5cab)" stroke-width="2"/>`;
  return `<svg class="pr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales so far and projected to show day">${g}</svg>`;
}

export function openShowDetail(p, { today = new Date(), dailyHref = "#/daily" } = {}) {
  const days = last15(p, today);
  const r = rng(hash(p.id + "mix"));
  const share = p.sold / p.capacity;
  const last14 = days.slice(1).reduce((a, d) => a + d.tickets, 0);
  const exp14 = p.expected14 || last14;
  const vs = last14 / Math.max(1, exp14) - 1;
  const best = days.reduce((a, b) => (b.tickets > a.tickets ? b : a));
  const recent7 = days.slice(-7).reduce((a, d) => a + d.tickets, 0);
  const prior7 = days.slice(1, 8).reduce((a, d) => a + d.tickets, 0);
  const left = p.capacity - p.sold - (p.comps || 0) - (p.holds || 0);
  const perDayNeeded = p.daysOut > 0 ? left / p.daysOut : 0;
  const web = 0.6 + r() * 0.15, phone = 0.12 + r() * 0.08;
  const mix = [
    ["Single tickets", 0.55 + r() * 0.15],
    ["Subscribers / members", 0.12 + r() * 0.15],
    ["Groups", 0.04 + r() * 0.06],
    ["Discounts and promos", 0.05 + r() * 0.07],
  ];
  const mixSum = mix.reduce((a, m) => a + m[1], 0);
  const goalShare = (p.sold * p.avgPrice) / p.revenueGoal;
  const f = projection(p, days);
  const finRev = f.final * p.avgPrice;
  const pace = p.status === "risk" ? ["risk", "At risk"] : p.status === "behind" ? ["behind", "Behind"] : vs >= 0 ? ["ahead", "On pace"] : ["behind", "Slowing"];

  const wrap = document.createElement("div");
  wrap.className = "pr-backdrop";
  wrap.innerHTML = `
    <div class="pr-modal" role="dialog" aria-modal="true" aria-labelledby="sd-title">
      <div class="pr-head">
        <div><p class="sr-kicker">${esc(p.genre || "Performance")}</p><h2 id="sd-title">${esc(p.title)}</h2>
          <p class="pr-sub">${p.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · ${esc(p.time)} · ${esc(p.hall.name)} · ${p.daysOut === 0 ? "tonight" : p.daysOut + " days out"}</p></div>
        <div class="sr-head-r"><span class="chip ${pace[0]}"><i></i>${pace[1]}</span><button type="button" class="pr-close" aria-label="Close">✕</button></div>
      </div>
      <div class="pr-body">
        <div class="pr-stats">
          <div><span>Sold</span><b>${int(p.sold)}</b><span class="pr-vs">${pct(share)} of ${int(p.capacity)}</span></div>
          <div><span>Last 14 days</span><b>${int(last14)}</b><span class="pr-vs ${vs >= 0 ? "up" : "down"}">${vs >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(vs * 100))}% vs expected ${int(exp14)}</span></div>
          <div><span>Last 7 vs prior 7</span><b>${int(recent7)}</b><span class="pr-vs ${recent7 >= prior7 ? "up" : "down"}">${recent7 >= prior7 ? "▲" : "▼"} from ${int(prior7)}</span></div>
          <div><span>Revenue</span><b>${money(p.sold * p.avgPrice)}</b><span class="pr-vs">${pct(goalShare)} of goal · avg ${money(p.avgPrice)}</span></div>
          <div><span>Still available</span><b>${int(Math.max(0, left))}</b><span class="pr-vs">${p.daysOut > 0 ? `${int(perDayNeeded)}/day to sell out` : "tonight"}</span></div>
        </div>
        <div class="pr-card"><h3>Tickets per day, last 15 days <span class="pr-note">darker = Fri–Sun · best day ${best.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} (${int(best.tickets)})</span></h3>${bars(days, exp14 / 14)}</div>
        <div class="pr-card"><h3>Where it's trending <span class="pr-note">solid = sold so far · dashed = projected · shaded = likely range</span></h3>
          <div class="sd-trend">
            <div class="sd-proj">
              <div><span>Projected finish</span><b>${int(f.final)}</b><em>${pct(f.final / p.capacity)} of capacity</em></div>
              <div><span>Likely range</span><b>${int(f.low)}–${int(f.high)}</b><em>${pct(f.low / p.capacity)}–${pct(f.high / p.capacity)}</em></div>
              <div><span>Projected revenue</span><b>${money(finRev)}</b><em class="${finRev >= p.revenueGoal ? "up" : "down"}">${pct(finRev / p.revenueGoal)} of ${money(p.revenueGoal)} goal</em></div>
              <div><span>${f.soldOutDay !== null && f.D > 0 ? "Sells out" : "Seats left at curtain"}</span><b>${f.soldOutDay !== null && f.D > 0 ? (f.soldOutDay === 0 ? "show day" : `~${f.soldOutDay} days before`) : int(Math.max(0, p.sold + f.avail - f.final))}</b><em>${f.soldOutDay !== null && f.D > 0 ? "every seat on sale, at this pace" : "at the projected pace"}</em></div>
            </div>
            ${trendChart(p, days, f, today)}
          </div>
          <p class="pr-muted" style="margin:8px 0 0">A trend, not a promise: the last two weeks' daily pace (weighted toward the last 7 days), stepped up for the usual late ramp before a show, capped at the seats still available. Marketing pushes, reviews and weather can move it either way.</p>
        </div>
        <div class="pr-cols">
          <div class="pr-card"><h3>How it's selling</h3>
            ${mix.map(([k, v]) => `<div class="pr-bar"><div class="pr-bar-top"><span>${k}</span><b>${pct(v / mixSum)}</b></div><div class="pr-track"><i style="width:${(v / mixSum) * 100}%"></i></div></div>`).join("")}
            <p class="pr-muted" style="margin:8px 0 0">Channels: web ${pct(web)} · phone ${pct(phone)} · box office ${pct(1 - web - phone)}</p>
          </div>
          <div class="pr-card"><h3>Worth knowing</h3>
            <ul class="sd-notes">
              <li>${vs >= 0.05 ? `Selling ${Math.round(vs * 100)}% faster than expected over the last two weeks.` : vs <= -0.05 ? `Selling ${Math.round(-vs * 100)}% slower than expected over the last two weeks; a targeted email to past ${esc((p.genre || "").toLowerCase())} buyers usually moves this.` : "Selling about as expected over the last two weeks."}</li>
              <li>${share >= 0.9 ? "Close to sold out: consider releasing holds or adding a performance." : p.daysOut > 0 ? `Needs about ${int(perDayNeeded)} tickets a day to sell out; the last 7 days averaged ${int(recent7 / 7)}.` : "Plays tonight."}</li>
              <li>${f.final >= p.capacity * 0.97 ? "On this trend it sells out; worth holding back discounts." : f.final / p.capacity < 0.75 ? `On this trend it finishes near ${pct(f.final / p.capacity)}; the gap to 85% is about ${int(Math.max(0, p.capacity * 0.85 - f.final))} tickets.` : `On this trend it finishes near ${pct(f.final / p.capacity)} of capacity.`}</li>
              <li>${int(p.comps || 0)} comps and ${int(p.holds || 0)} house holds on this performance.</li>
            </ul>
          </div>
        </div>
        <div class="sd-actions">
          <a class="go" href="${dailyHref}">Full sales curve in Daily sales →</a>
          <button type="button" class="x-btn" data-x="days">⤓ Last 15 days (CSV)</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("pr-lock");
  const close = () => {
    wrap.remove();
    if (!document.querySelector(".pr-backdrop")) document.body.classList.remove("pr-lock");
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", close);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", close);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap || e.target.closest(".pr-close")) return close();
    if (e.target.closest('[data-x="days"]'))
      exportSummary([{ key: "d", label: "date" }, { key: "tickets", label: "tickets" }],
        days.map((d) => ({ d: d.date.toISOString().slice(0, 10), tickets: d.tickets })),
        `cupola-${slug(p.title)}-${p.date.toISOString().slice(0, 10)}-last-15-days.csv`, "days");
  });
  wrap.querySelector(".pr-close").focus();
}
