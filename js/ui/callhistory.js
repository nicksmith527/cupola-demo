// Call center monthly history: a pop-up grid of the last 13 months from the
// phone system, with the option to show change vs. the same month last year.
// The current month is month-to-date. Figures are synthetic and seeded, with
// the seasonality a box office sees (on-sale months and the holidays run hot).

import { exportSummary } from "./export.js";

const int = (n) => Math.round(n).toLocaleString("en-US");
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Busy-ness by calendar month (Jan..Dec): season on-sale in Aug/Sep,
// subscriptions renewing in spring, holiday shows in Nov/Dec.
const SEASON = [0.85, 0.8, 0.95, 1.0, 0.9, 0.7, 0.75, 1.25, 1.35, 1.05, 1.1, 1.2];

function month(date, r, partial, growth) {
  const s = SEASON[date.getMonth()];
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const frac = partial ?? 1;
  const offered = Math.round(820 * s * days * frac * growth * (0.93 + r() * 0.14));
  // Busier months strain staffing: lower service level, higher abandons.
  const strain = Math.max(0, s - 1);
  const abandon = Math.min(0.2, 0.045 + strain * 0.16 + r() * 0.025);
  const answered = Math.round(offered * (1 - abandon));
  const sl = Math.max(0.55, 0.9 - strain * 0.45 - r() * 0.05);
  const asa = Math.round(22 + strain * 110 + r() * 14);
  const aht = Math.round(205 + strain * 40 + r() * 25);
  const conv = 0.36 + r() * 0.06 + (date.getMonth() === 7 || date.getMonth() === 8 ? 0.05 : 0);
  const orders = Math.round(answered * conv);
  const avgOrder = 128 + r() * 30 + (date.getMonth() >= 10 ? 12 : 0);
  return { date, partial: partial !== undefined, offered, answered, abandon, sl, asa, aht, orders, revenue: orders * avgOrder, conv: orders / answered };
}

export function callHistory(today) {
  const r = rng(52741);
  const rows = [];
  // 25 months: 13 to show, plus 12 before them for year-over-year.
  for (let k = 24; k >= 0; k--) {
    const d = new Date(today.getFullYear(), today.getMonth() - k, 1);
    const growth = 1 + (24 - k) * 0.004;
    const partial = k === 0 ? (today.getDate() - 1) / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() : undefined;
    rows.push(month(d, r, partial, growth));
  }
  return rows;
}

const COLS = [
  { key: "offered", label: "Calls offered", f: int, good: null },
  { key: "answered", label: "Answered", f: int, good: null },
  { key: "abandon", label: "Abandon rate", f: (v) => (v * 100).toFixed(1) + "%", good: "low", pts: true },
  { key: "sl", label: "Service level", f: (v) => Math.round(v * 100) + "%", good: "high", pts: true },
  { key: "asa", label: "Avg. speed of answer", f: (v) => (v >= 60 ? `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, "0")}s` : v + "s"), good: "low" },
  { key: "aht", label: "Avg. handle time", f: (v) => `${Math.floor(v / 60)}m ${String(v % 60).padStart(2, "0")}s`, good: null },
  { key: "orders", label: "Phone orders", f: int, good: "high" },
  { key: "revenue", label: "Phone revenue", f: money, good: "high" },
  { key: "conv", label: "Calls that bought", f: (v) => Math.round(v * 100) + "%", good: "high", pts: true },
];

export function openCallHistory(source) {
  const today = new Date(source.today);
  const all = callHistory(today);
  const shown = all.slice(-13);
  let mode = "values";

  const wrap = document.createElement("div");
  wrap.className = "pr-backdrop";
  wrap.innerHTML = `
    <div class="pr-modal ch-modal" role="dialog" aria-modal="true" aria-labelledby="ch-title">
      <div class="pr-head">
        <div><p class="sr-kicker">Call center</p><h2 id="ch-title">Monthly history</h2>
          <p class="pr-sub">Last 13 months from the phone system · ${today.toLocaleDateString("en-US", { month: "long" })} is month-to-date</p></div>
        <button type="button" class="pr-close" aria-label="Close">✕</button>
      </div>
      <div class="pr-tabs" role="tablist">
        <button type="button" data-m="values" aria-selected="true">Monthly totals</button>
        <button type="button" data-m="yoy" aria-selected="false">vs. same month last year</button>
      </div>
      <div class="pr-body">
        <div class="pr-card ch-card"><div class="ch-wrap" id="ch-grid"></div>
          <p class="pr-muted" style="margin:10px 0 0" id="ch-note"></p></div>
        <div class="sd-actions"><span class="pr-muted">Shading: darker = busier month (calls offered)</span>
          <button type="button" class="x-btn" data-x="ch">⤓ Monthly history (CSV)</button></div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("pr-lock");

  const maxOffered = Math.max(...shown.filter((m) => !m.partial).map((m) => m.offered));
  const prior = (m) => all.find((x) => x.date.getFullYear() === m.date.getFullYear() - 1 && x.date.getMonth() === m.date.getMonth());

  function cell(m, c) {
    if (mode === "values") return c.f(m[c.key]);
    const p = prior(m);
    if (!p) return "—";
    // For a partial month, compare against the same share of last year's month.
    const scale = m.partial && !c.pts && !["asa", "aht"].includes(c.key) ? (today.getDate() - 1) / new Date(p.date.getFullYear(), p.date.getMonth() + 1, 0).getDate() : 1;
    const a = m[c.key], b = p[c.key] * scale;
    const delta = c.pts ? (a - b) * 100 : (a / b - 1) * 100;
    const up = delta >= 0;
    const flat = Math.abs(delta) < (c.pts ? 0.05 : 0.5);
    const cls = !c.good || flat ? "" : (c.good === "high") === up ? "pos" : "neg";
    return `<span class="${cls}">${up ? "+" : "−"}${Math.abs(delta).toFixed(c.pts ? 1 : 0)}${c.pts ? " pts" : "%"}</span>`;
  }

  function render() {
    wrap.querySelectorAll(".pr-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.m === mode)));
    const full = shown.filter((m) => !m.partial);
    const sum = (k) => full.reduce((a, m) => a + m[k], 0);
    const tot = {
      offered: sum("offered"), answered: sum("answered"), orders: sum("orders"), revenue: sum("revenue"),
      abandon: 1 - sum("answered") / sum("offered"),
      sl: full.reduce((a, m) => a + m.sl * m.offered, 0) / sum("offered"),
      asa: Math.round(full.reduce((a, m) => a + m.asa * m.answered, 0) / sum("answered")),
      aht: Math.round(full.reduce((a, m) => a + m.aht * m.answered, 0) / sum("answered")),
      conv: sum("orders") / sum("answered"),
    };
    wrap.querySelector("#ch-grid").innerHTML = `<table class="ch-table">
      <thead><tr><th>Month</th>${COLS.map((c) => `<th class="r">${c.label}</th>`).join("")}</tr></thead>
      <tbody>${shown.slice().reverse().map((m) => {
        const t = m.partial ? 0 : m.offered / maxOffered;
        return `<tr class="${m.partial ? "mtd" : ""}">
          <td><b>${m.date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</b>${m.partial ? ' <span class="pr-pill">to date</span>' : ""}</td>
          ${COLS.map((c, i) => `<td class="r" ${i === 0 && mode === "values" && !m.partial ? `style="background:color-mix(in srgb, var(--accent, #1c5cab) ${Math.round(t * 30)}%, transparent)"` : ""}>${cell(m, c)}</td>`).join("")}</tr>`;
      }).join("")}</tbody>
      ${mode === "values" ? `<tfoot><tr><td>Last 12 full months</td>${COLS.map((c) => `<td class="r">${c.f(tot[c.key])}</td>`).join("")}</tr></tfoot>` : ""}
    </table>`;
    const busiest = full.reduce((a, b) => (b.offered > a.offered ? b : a));
    const worst = full.reduce((a, b) => (b.sl < a.sl ? b : a));
    wrap.querySelector("#ch-note").textContent = mode === "values"
      ? `Busiest month: ${busiest.date.toLocaleDateString("en-US", { month: "long" })} (${int(busiest.offered)} calls). Lowest service level: ${worst.date.toLocaleDateString("en-US", { month: "long" })} at ${Math.round(worst.sl * 100)}%. Busy months strain staffing, so the abandon rate rises with them.`
      : `Rates show the change in percentage points; counts show percent change. The month to date is compared with the same share of last year's month. Green is better, red is worse.`;
  }

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
    const t = e.target.closest(".pr-tabs button");
    if (t) { mode = t.dataset.m; render(); }
    if (e.target.closest('[data-x="ch"]'))
      exportSummary(
        [{ key: "month", label: "month" }, { key: "mtd", label: "month_to_date" }, ...COLS.map((c) => ({ key: c.key, label: c.key }))],
        shown.map((m) => ({ ...m, month: `${m.date.getFullYear()}-${String(m.date.getMonth() + 1).padStart(2, "0")}`, mtd: m.partial ? "yes" : "", abandon: m.abandon.toFixed(4), sl: m.sl.toFixed(4), conv: m.conv.toFixed(4), revenue: Math.round(m.revenue) })),
        "cupola-call-center-monthly.csv", "months");
  });
  render();
  wrap.querySelector(".pr-close").focus();
}
