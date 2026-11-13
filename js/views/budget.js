// Budget: where the operating budget stands, for senior staff. Not line-item
// accounting: categories, with every dollar in one of four states.
//
//   Actual       posted in the finance system
//   Committed    signed contracts, POs, pledges and advance sales
//   Placeholder  held in the budget for something not yet confirmed
//                (show TBA, dates empty, bid pending)
//   Open         budget not yet tied to anything
//
// Placeholders are the hard part: they're real intentions without real
// numbers. Cupola tracks each one until it's replaced by a contract, then
// uses how past placeholders came in to give the year-end forecast a range.
// All figures are synthetic.

const M = 1e6;
const money = (n) => (Math.abs(n) >= M ? `$${(n / M).toFixed(Math.abs(n) >= 10 * M ? 1 : 2)}M` : `$${Math.round(n / 1e3)}K`);
const pct = (n) => Math.round(n * 100) + "%";
const signed = (n) => (n >= 0 ? "+" : "−") + money(Math.abs(n));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
import { exportSummary } from "../ui/export.js";

// [category, budget, actual, committed, expected use of the open remainder]
const EXPENSE = [
  ["Personnel", 19.5, 7.12, 3.8, 0.98],
  ["Artist fees & production", 16.0, 5.24, 5.6, 0.9],
  ["Marketing", 4.2, 1.48, 0.9, 0.95],
  ["Facilities & operations", 5.8, 2.02, 1.4, 1.0],
  ["Technology", 1.6, 0.55, 0.5, 0.92],
  ["Administration", 2.9, 1.01, 0.88, 0.95],
];
const REVENUE = [
  ["Ticket sales", 31.0, 13.9, 9.4, 0.85],
  ["Contributed", 13.5, 4.2, 3.6, 0.8],
  ["Rentals", 3.2, 1.1, 1.3, 0.75],
  ["Food, beverage & merchandise", 2.2, 0.85, 0, 0.95],
  ["Investment & other", 1.3, 0.42, 0, 1.0],
];

// Open placeholders: [side, category, name, amount ($M), confirm-by (days from today), detail]
const PLACEHOLDERS = [
  ["exp", "Artist fees & production", "Broadway week 3 (title TBA)", 1.2, 63, "Dates not set; guarantee held at last season's average"],
  ["exp", "Artist fees & production", "Summer family series (4 shows)", 0.45, 105, "Artists not booked"],
  ["exp", "Artist fees & production", "Spring gala production", 0.38, 45, "Concept approved, no vendor yet"],
  ["exp", "Artist fees & production", "Jazz series: two headliners", 0.24, -6, "Offers out; confirm-by date passed"],
  ["exp", "Artist fees & production", "Education residency artists", 0.16, 30, ""],
  ["exp", "Artist fees & production", "Holiday Pops guest artist", 0.095, 9, "Verbal yes, contract pending"],
  ["exp", "Facilities & operations", "HVAC chiller replacement", 0.75, 40, "Two bids in, third pending"],
  ["exp", "Facilities & operations", "Insurance renewal increase", 0.14, 48, "Broker estimate"],
  ["exp", "Marketing", "Spring season campaign", 0.6, 70, "Season not yet announced"],
  ["exp", "Personnel", "Three open positions", 0.42, 20, "Held at budgeted salary, hire dates TBD"],
  ["exp", "Technology", "Ticketing platform renewal", 0.21, 75, "Quote pending"],
  ["rev", "Ticket sales", "Broadway week 3 (title TBA)", 2.1, 63, "Held at 85% of a typical week"],
  ["rev", "Ticket sales", "Spring shows not yet on sale", 1.0, 70, ""],
  ["rev", "Contributed", "Spring gala", 1.1, 45, "Table sales open in January"],
  ["rev", "Contributed", "Major gift (in conversation)", 0.5, 120, "Ask planned for spring"],
  ["rev", "Rentals", "Two rental weekends (holds)", 0.4, 30, "Holds on the calendar, no contract"],
];

// Placeholders already replaced this fiscal year: [side, category, name, budgeted, final, days ago, by]
const REPLACED = [
  ["exp", "Artist fees & production", "Broadway week 1 (Harbor Lights)", 1.15, 1.08, 120, "Contract signed"],
  ["exp", "Artist fees & production", "Broadway week 2 (title TBA → Midnight at the Grand Canal)", 1.2, 1.31, 75, "Contract signed"],
  ["exp", "Marketing", "Fall season campaign", 0.55, 0.52, 110, "Media plan approved"],
  ["exp", "Artist fees & production", "Holiday production design", 0.12, 0.135, 40, "PO issued"],
  ["exp", "Personnel", "Box office seasonal staff", 0.09, 0.082, 60, "Hires made"],
  ["exp", "Facilities & operations", "Roof repair (section C)", 0.3, 0.355, 25, "Contract signed"],
  ["rev", "Contributed", "Fall appeal", 0.8, 0.86, 14, "Gifts received"],
  ["rev", "Rentals", "Corporate holiday event", 0.18, 0.21, 33, "Contract signed"],
];

const FY_START_MONTH = 6; // July

function fiscal(today) {
  const y = today.getMonth() >= FY_START_MONTH ? today.getFullYear() : today.getFullYear() - 1;
  const start = new Date(y, FY_START_MONTH, 1), end = new Date(y + 1, FY_START_MONTH, 1);
  return { label: `FY${String(y + 1).slice(2)}`, start, end, elapsed: (today - start) / (end - start), year: y };
}

function build(side) {
  const rows = side === "exp" ? EXPENSE : REVENUE;
  const ph = PLACEHOLDERS.filter((p) => p[0] === side);
  const rep = REPLACED.filter((p) => p[0] === side);
  // How replaced placeholders came in: final / budgeted.
  const ratios = rep.map((r) => r[4] / r[3]);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const lo = Math.min(...ratios), hi = Math.max(...ratios);
  const cats = rows.map(([name, budget, actual, committed, use]) => {
    const placeholder = ph.filter((p) => p[1] === name).reduce((a, p) => a + p[3], 0);
    const open = Math.max(0, budget - actual - committed - placeholder);
    const projected = actual + committed + placeholder * mean + open * use;
    return { name, budget: budget * M, actual: actual * M, committed: committed * M, placeholder: placeholder * M, open: open * M, projected: projected * M, phLo: (actual + committed + placeholder * lo + open * use) * M, phHi: (actual + committed + placeholder * hi + open * use) * M };
  });
  const sum = (k) => cats.reduce((a, c) => a + c[k], 0);
  return { side, cats, ph, rep, mean, lo, hi, t: { budget: sum("budget"), actual: sum("actual"), committed: sum("committed"), placeholder: sum("placeholder"), open: sum("open"), projected: sum("projected"), phLo: sum("phLo"), phHi: sum("phHi") } };
}

export function budgetSummary(today = new Date()) {
  const e = build("exp"), r = build("rev");
  return { fy: fiscal(today), e, r, net: r.t.projected - e.t.projected, netBudget: r.t.budget - e.t.budget };
}

export default {
  id: "budget",
  label: "Budget",
  mount(root, source) {
    const today = new Date(source.today);
    const B = budgetSummary(today);
    const fy = B.fy;
    let side = "exp";

    root.innerHTML = `
      <div class="view-head"><div>
        <h1>Budget · ${fy.label}</h1>
        <p>Operating budget, ${fy.start.toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(fy.end - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" })} · ${pct(fy.elapsed)} of the year gone · from the finance system and the budget workbook</p>
      </div>
      <div class="seg" role="tablist" id="b-side">
        <button type="button" data-s="exp" aria-selected="true">Expenses</button>
        <button type="button" data-s="rev" aria-selected="false">Revenue</button>
      </div></div>
      <div id="b-strip"></div>
      <div class="card">
        <div class="card-head"><div><h2 id="b-title"></h2><p class="sub">Every budget dollar is actual, committed, a placeholder, or still open. The line marks how far through the year we are.</p></div>
          <button type="button" class="x-btn" data-x="wb">⤓ Workbook (CSV)</button></div>
        <div class="b-legend"><span><i class="a"></i>Actual</span><span><i class="c"></i>Committed</span><span><i class="p"></i>Placeholder</span><span><i class="o"></i>Open</span></div>
        <div id="b-table"></div>
      </div>
      <div class="cols mt">
        <div class="card"><div class="card-head"><div><h2>Placeholders still open</h2><p class="sub" id="b-ph-sub"></p></div></div><div id="b-ph"></div></div>
        <div class="stack">
          <div class="card"><h2>Reading the year with placeholders in it</h2><p class="sub">Three ways to see the same year-end</p><div id="b-range"></div></div>
          <div class="card"><h2>How placeholders have resolved</h2><p class="sub" id="b-rep-sub"></p><div id="b-rep"></div></div>
        </div>
      </div>
      <p class="callout mt">Actuals and commitments come from the finance system (for example Blackbaud Financial Edge, NetSuite, Great Plains or Sage Intacct). Placeholders come from the budget workbook the finance team already keeps. When a contract is signed, its placeholder is marked replaced and the variance is recorded, so the forecast range tightens as the year fills in.</p>`;

    function render() {
      const D = side === "exp" ? B.e : B.r;
      const t = D.t;
      const noun = side === "exp" ? "expense" : "revenue";
      const accounted = t.actual + t.committed + t.placeholder;
      root.querySelectorAll("#b-side button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.s === side)));
      root.querySelector("#b-strip").innerHTML = `<section class="strip">
        <div class="stat"><div class="label">${side === "exp" ? "Expense" : "Revenue"} budget</div><div class="value">${money(t.budget)}</div><div class="note">${fy.label} operating</div></div>
        <div class="stat"><div class="label">${side === "exp" ? "Spent" : "Booked"} to date</div><div class="value">${money(t.actual)}</div><div class="note">${pct(t.actual / t.budget)} of budget · ${pct(fy.elapsed)} of year</div></div>
        <div class="stat"><div class="label">Accounted for</div><div class="value">${money(accounted)}</div><div class="note">actual + committed + placeholders (${pct(accounted / t.budget)})</div></div>
        <div class="stat"><div class="label">Placeholders open</div><div class="value">${money(t.placeholder)}</div><div class="note">${D.ph.length} items not yet confirmed</div></div>
        <div class="stat"><div class="label">Projected net</div><div class="value">${signed(B.net)}</div><div class="note">budget ${signed(B.netBudget)} · ${B.net >= B.netBudget ? "ahead" : "behind"} by ${money(Math.abs(B.net - B.netBudget))}</div></div>
      </section>`;
      root.querySelector("#b-title").textContent = `${side === "exp" ? "Expenses" : "Revenue"} by category`;

      const max = Math.max(...D.cats.map((c) => c.budget));
      root.querySelector("#b-table").innerHTML = `<div class="b-row b-head"><span>Category</span><span class="r">Budget</span><span class="r">Actual</span><span class="r">Committed</span><span class="r">Placeholder</span><span class="r">Projected</span><span class="r">vs budget</span></div>` +
        [...D.cats, { name: "Total", ...t, total: true }].map((c) => {
          const w = (k) => (c[k] / c.budget) * 100;
          const v = side === "exp" ? c.budget - c.projected : c.projected - c.budget;
          return `<div class="b-row ${c.total ? "b-total" : ""}">
            <span class="b-name">${esc(c.name)}</span>
            <span class="r">${money(c.budget)}</span><span class="r">${money(c.actual)}</span><span class="r">${money(c.committed)}</span>
            <span class="r">${c.placeholder ? money(c.placeholder) : "—"}</span><span class="r">${money(c.projected)}</span>
            <span class="r ${v >= 0 ? "pos" : "neg"}">${signed(v)}</span>
            <div class="b-bar" style="width:${c.total ? 100 : (c.budget / max) * 100}%"><i class="a" style="width:${w("actual")}%"></i><i class="c" style="width:${w("committed")}%"></i><i class="p" style="width:${w("placeholder")}%"></i><b style="left:${fy.elapsed * 100}%"></b></div>
          </div>`;
        }).join("");

      const today0 = today.getTime();
      const phs = D.ph.slice().sort((a, b) => a[4] - b[4]);
      root.querySelector("#b-ph-sub").textContent = `${money(t.placeholder)} across ${phs.length} items · soonest confirm-by first`;
      root.querySelector("#b-ph").innerHTML = phs.map((p) => {
        const due = new Date(today0 + p[4] * 86400000);
        const late = p[4] < 0, soon = p[4] >= 0 && p[4] <= 14;
        return `<div class="b-ph"><div><b>${esc(p[2])}</b><div class="hd-meta">${esc(p[1])}${p[5] ? " · " + esc(p[5]) : ""}</div></div>
          <div class="r"><b>${money(p[3] * M)}</b><div class="hd-meta ${late ? "late" : soon ? "soon" : ""}">${late ? `confirm-by passed ${-p[4]}d ago` : `confirm by ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</div></div></div>`;
      }).join("");

      // Three readings of the year-end.
      const confirmed = t.actual + t.committed;
      const lo = side === "exp" ? t.phLo : t.phLo, hi = t.phHi;
      const scaleMax = Math.max(t.budget, hi) * 1.04;
      const X = (v) => (v / scaleMax) * 100;
      root.querySelector("#b-range").innerHTML = `
        <div class="b-reads">
          <div><span>Confirmed only</span><b>${money(confirmed)}</b><em>actual + committed. A floor: assumes no placeholder happens.</em></div>
          <div><span>Budget basis</span><b>${money(t.actual + t.committed + t.placeholder)}</b><em>placeholders at their budgeted amounts</em></div>
          <div><span>Expected year-end</span><b>${money(t.projected)}</b><em>range ${money(lo)}–${money(hi)}, from how past placeholders came in (${pct(D.lo)}–${pct(D.hi)} of budgeted)</em></div>
        </div>
        <div class="b-scale"><div class="b-band" style="left:${X(lo)}%;width:${X(hi) - X(lo)}%"></div><i style="left:${X(confirmed)}%" title="Confirmed"></i><i class="exp" style="left:${X(t.projected)}%" title="Expected"></i><b style="left:${X(t.budget)}%"></b></div>
        <div class="b-scale-key"><span><i></i>confirmed</span><span><i class="exp"></i>expected</span><span><i class="band"></i>range</span><span><i class="bud"></i>budget ${money(t.budget)}</span></div>`;

      const diff = D.rep.reduce((a, r) => a + (r[4] - r[3]), 0);
      root.querySelector("#b-rep-sub").textContent = `${D.rep.length} replaced this year · net ${signed(diff * M)} vs. what was held (${diff >= 0 ? "+" : ""}${Math.round((D.mean - 1) * 100)}% on average)`;
      root.querySelector("#b-rep").innerHTML = D.rep.slice().sort((a, b) => a[5] - b[5]).map((r) => {
        const v = r[4] / r[3] - 1;
        const bad = side === "exp" ? v > 0 : v < 0;
        return `<div class="b-ph"><div><b>${esc(r[2])}</b><div class="hd-meta">${esc(r[6])} · ${r[5]} days ago · held ${money(r[3] * M)}</div></div>
          <div class="r"><b>${money(r[4] * M)}</b><div class="hd-meta ${bad ? "late" : "good"}">${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}%</div></div></div>`;
      }).join("");
    }

    root.querySelector("#b-side").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-s]");
      if (b) { side = b.dataset.s; render(); }
    });
    root.addEventListener("click", (e) => {
      if (!e.target.closest('[data-x="wb"]')) return;
      const rows = [];
      for (const D of [B.e, B.r]) {
        for (const c of D.cats) rows.push({ side: D.side === "exp" ? "Expense" : "Revenue", type: "Category", name: c.name, budget: Math.round(c.budget), actual: Math.round(c.actual), committed: Math.round(c.committed), placeholder: Math.round(c.placeholder), open: Math.round(c.open), projected: Math.round(c.projected), confirm_by: "" });
        for (const p of D.ph) rows.push({ side: D.side === "exp" ? "Expense" : "Revenue", type: "Placeholder", name: `${p[1]}: ${p[2]}`, budget: "", actual: "", committed: "", placeholder: Math.round(p[3] * M), open: "", projected: "", confirm_by: new Date(today.getTime() + p[4] * 86400000).toISOString().slice(0, 10) });
      }
      const cols = ["side", "type", "name", "budget", "actual", "committed", "placeholder", "open", "projected", "confirm_by"].map((k) => ({ key: k, label: k }));
      exportSummary(cols, rows, `cupola-budget-${fy.label.toLowerCase()}.csv`, "budget rows");
    });

    render();
    return { update() {} };
  },
};
