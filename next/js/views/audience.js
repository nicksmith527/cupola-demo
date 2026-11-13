// Audience (RFM), alternative look: explained in plain words, viewable
// through different lenses (season, genre, show, donors), with an export
// of household IDs per segment. IDs only: names stay in the CRM.

import { int, money, moneyK, esc } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";
import { strip, setStat, toast } from "../ui/mini.js";

const RAMP = ["#e3eefc", "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#1c5cab"];
const rampColor = (t) => RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
const SEG_COLORS = { Champions: "#1c5cab", Loyal: "#3987e5", Promising: "#1baf7a", "Needs attention": "#eda100", Hibernating: "#9aa3b2", Middle: "#c6ccd7" };

function csv(rows) {
  const cols = ["constituent_id", "segment", "recency_score", "frequency_score", "monetary_score", "days_since_last_purchase", "orders", "spend"];
  const lines = rows.map((r) => [r.id, r.segment, r.R, r.F, r.M, r.lastPurchaseDays, r.orders, r.spend].join(","));
  return [cols.join(","), ...lines].join("\n");
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default {
  id: "audience",
  label: "Audience (RFM)",
  mount(root, source) {
    const lenses = source.audienceLenses();
    let lens = "all";
    const groups = [...new Set(lenses.map((l) => l.group))];

    root.innerHTML = `
      <div class="view-head"><div>
        <h1>Audience: who to talk to next</h1>
        <p>Households scored on how recently they bought, how often, and how much they spend. Segment level only; no names on screen.</p>
      </div></div>

      <details class="card what" id="what">
        <summary>What is RFM, and how do I use it?</summary>
        <div class="body">
          <div class="explain">
            <div><b><span class="letter">R</span>Recency</b>How long since the household last bought. Scored 1 (years ago) to 5 (in the last few months). Recent buyers are the easiest to bring back.</div>
            <div><b><span class="letter">F</span>Frequency</b>How many separate purchases in the window. Scored 1 (once) to 5 (many times). Frequency is the best predictor of a subscriber or donor.</div>
            <div><b><span class="letter">M</span>Monetary</b>How much they spend: tickets, or gifts when you switch the lens to contributed revenue. Shown as average spend per household.</div>
          </div>
          <p class="sub" style="margin:12px 0 0">Every household lands in one cell of the grid, and the cells roll up into segments with a suggested next step. Change the lens to score a single season, genre or show, or your donors, then export a segment as a list of constituent IDs to load into your CRM for an email, mailing or call campaign.</p>
        </div>
      </details>

      <div class="lens-bar">
        <span class="label">Lens</span>
        <select id="lens" aria-label="Audience lens">
          ${groups.map((g) => `<optgroup label="${esc(g)}">${lenses.filter((l) => l.group === g).map((l) => `<option value="${esc(l.id)}">${esc(l.label)}</option>`).join("")}</optgroup>`).join("")}
        </select>
        <span class="sub" id="lens-note" style="margin:0"></span>
        <button type="button" class="btn primary" id="export-all" style="margin-left:auto">⤓ Export all segments</button>
      </div>

      <div id="strip"></div>

      <div class="cols">
        <div class="card">
          <h2>Segments and what to do next</h2>
          <p class="sub">Export any segment as constituent IDs (CSV) to load as a list in your CRM</p>
          <div class="table-wrap"><table class="seg-table" id="segs"></table></div>
        </div>
        <div class="card">
          <h2>Households by recency × frequency</h2>
          <p class="sub">Darker = more households · ${matchMedia("(hover: hover)").matches ? "hover" : "tap"} a cell for average spend</p>
          <div id="heat"></div>
        </div>
      </div>`;

    if (!sessionStorage.getItem("rfm-seen")) {
      root.querySelector("#what").open = true;
      try { sessionStorage.setItem("rfm-seen", "1"); } catch {}
    }

    let d;
    function render() {
      d = source.getAudienceFor(lens);
      const totalHH = d.segments.reduce((s, x) => s + x.households, 0);
      const totalRev = d.segments.reduce((s, x) => s + x.revenue, 0);
      const champs = d.segments[0];
      const prom = d.segments.find((s) => s.name === "Promising");
      const label = lenses.find((l) => l.id === lens).label;
      root.querySelector("#lens-note").textContent = lens === "all" ? "" : `Scoring only: ${label}`;

      root.querySelector("#strip").innerHTML = strip([
        { id: "a-hh", label: "Households scored", note: lens === "all" ? `last ${d.asOfWindowMonths} months` : esc(label) },
        { id: "a-ch", label: "Champions", note: "recent and frequent" },
        { id: "a-share", label: "Champions' share of " + (d.monetaryLabel === "gifts" ? "giving" : "revenue"), note: `from ${((champs.households / totalHH) * 100).toFixed(0)}% of households` },
        { id: "a-prom", label: "Promising", note: "best second-visit prospects" },
        { id: "a-rev", label: d.monetaryLabel === "gifts" ? "Giving in window" : "Spend in window", note: d.monetaryLabel },
      ]);
      setStat(root, "a-hh", totalHH, int);
      setStat(root, "a-ch", champs.households, int);
      setStat(root, "a-share", (champs.revenue / totalRev) * 100, (n) => n.toFixed(1) + "%");
      setStat(root, "a-prom", prom.households, int);
      setStat(root, "a-rev", totalRev, moneyK);

      root.querySelector("#segs").innerHTML = `<thead><tr><th>Segment</th><th class="r">Households</th><th class="r">Avg ${d.monetaryLabel === "gifts" ? "gift" : "spend"}</th><th class="r">Share</th><th></th></tr></thead><tbody>${d.segments
        .map((s) => `<tr>
          <td><div class="name"><span class="seg-dot" style="background:${SEG_COLORS[s.name]}"></span>${esc(s.name)}</div><div class="meta">${esc(s.description)} · next: ${esc(s.action)}</div></td>
          <td class="r">${int(s.households)}</td><td class="r">${money(s.avgSpend)}</td><td class="r">${((s.revenue / totalRev) * 100).toFixed(0)}%</td>
          <td class="r"><button type="button" class="btn" data-seg="${esc(s.name)}" aria-label="Export ${esc(s.name)}">⤓ Export</button></td></tr>`)
        .join("")}</tbody>`;

      // Heat grid (HTML so it scales cleanly on any screen).
      const max = Math.max(...d.grid.map((g) => g.households));
      let html = "";
      for (let r = 5; r >= 1; r--) {
        html += `<div class="ax">${r}</div>`;
        for (let f = 1; f <= 5; f++) {
          const i = d.grid.findIndex((g) => g.r === r && g.f === f);
          const g = d.grid[i];
          const t = g.households / max;
          html += `<div class="cell" data-i="${i}" style="background:${rampColor(t)};color:${t > 0.55 ? "#fff" : "#131a26"}">${int(g.households)}</div>`;
        }
      }
      html += `<div></div>${[1, 2, 3, 4, 5].map((f) => `<div class="ax">${f}</div>`).join("")}`;
      root.querySelector("#heat").innerHTML = `<div style="display:flex;gap:8px"><div class="ax" style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:11px;color:var(--text-muted);text-align:center">Recency → more recent</div>
        <div style="flex:1"><div class="rfm-grid">${html}</div><div style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:4px">Frequency → buys more often</div></div></div>`;
    }

    const heat = root.querySelector("#heat");
    const cellTip = (e) => {
      const c = e.target.closest?.(".cell");
      if (!c) return hideTip();
      const g = d.grid[c.dataset.i];
      showTip(e, tipHtml(`Recency ${g.r} · Frequency ${g.f}`, [["Households", int(g.households)], [`Avg ${d.monetaryLabel}`, money(g.avgSpend)]]));
    };
    heat.addEventListener("pointermove", cellTip);
    heat.addEventListener("click", cellTip);
    heat.addEventListener("pointerleave", hideTip);

    root.querySelector("#lens").addEventListener("change", (e) => {
      lens = e.target.value;
      render();
    });
    root.querySelector("#segs").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-seg]");
      if (!b) return;
      const x = source.audienceExport(lens, b.dataset.seg);
      download(`cupola-${slug(b.dataset.seg)}-${slug(lens)}.csv`, csv(x.rows));
      toast(`Exported ${int(x.rows.length)} ${x.seg.name} households${x.total > x.rows.length ? ` (demo sample of ${int(x.total)})` : ""}`);
    });
    root.querySelector("#export-all").addEventListener("click", () => {
      const all = d.segments.flatMap((s) => source.audienceExport(lens, s.name).rows);
      download(`cupola-rfm-${slug(lens)}.csv`, csv(all));
      toast(`Exported ${int(all.length)} households across ${d.segments.length} segments (demo sample)`);
    });

    render();
    return { update() {} };
  },
};
