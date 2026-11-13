// Small Snapshot cards that point into the organization-wide tabs:
// Help desk and Budget. One line each, a link to drill in.
import { helpdeskData } from "../views/helpdesk.js";
import { budgetSummary } from "../views/budget.js";

const money = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);
const pct = (n) => Math.round(n * 100) + "%";

export function orgCards(source) {
  const h = helpdeskData(source.today);
  const b = budgetSummary(new Date(source.today));
  const hi = h.open.filter((x) => x.sev <= 2).length;
  const e = b.e.t;
  return `<div class="org-cards">
    <a class="org-card" href="#/helpdesk">
      <p class="eyebrow">Help desk</p>
      <b>${h.open.length} open · ${hi} high</b>
      <span>${pct(h.rate)} resolved in the last 30 days · website and scanners degraded</span>
      <em>Status board →</em>
    </a>
    <a class="org-card" href="#/budget">
      <p class="eyebrow">Budget · ${b.fy.label}</p>
      <b>${money(e.actual + e.committed + e.placeholder)} of ${money(e.budget)} accounted for</b>
      <span>${money(e.placeholder)} still in placeholders · projected net ${b.net >= 0 ? "+" : "−"}${money(Math.abs(b.net))} vs ${money(b.netBudget)} budgeted</span>
      <em>Budget workbook →</em>
    </a>
  </div>`;
}
