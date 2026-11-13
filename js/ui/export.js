// Exports: download a segment as a CSV of constituent IDs (to load as a list
// in the CRM) or a summary table. IDs only: names and contact details stay in
// the CRM and never appear in Cupola. Rows are synthetic and seeded, and a
// demo export is capped so files stay small.

const CAP = 1000;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const hash = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function cell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(cols, rows) {
  return [cols.map((c) => cell(c.label)).join(","), ...rows.map((r) => cols.map((c) => cell(r[c.key])).join(","))].join("\n");
}

export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function toast(msg) {
  const t = document.createElement("div");
  t.className = "x-toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// Households behind a segment, county or ZIP. `zips` is a list of
// { zip, county, weight } to spread the rows across (optional).
export function householdRows({ label, count, segment = "", zips = [], avgSpend = 180 }) {
  const r = rng(hash(label));
  const n = Math.min(count, CAP);
  const SEG = ["Champions", "Loyal", "Promising", "Needs attention", "Hibernating", "Middle"];
  const wsum = zips.reduce((a, z) => a + (z.weight || 1), 0);
  const pickZip = () => {
    if (!zips.length) return { zip: "", county: "" };
    let x = r() * wsum;
    for (const z of zips) if ((x -= z.weight || 1) <= 0) return z;
    return zips[0];
  };
  const rows = [];
  for (let i = 0; i < n; i++) {
    const z = pickZip();
    const R = 1 + Math.floor(r() * 5), F = 1 + Math.floor(r() * 5);
    const spend = Math.round(avgSpend * (0.35 + r() * 1.4));
    rows.push({
      id: String(1000000 + Math.floor(r() * 8999999)),
      segment: segment || SEG[Math.floor(r() * SEG.length)],
      zip: z.zip, county: z.county,
      r: R, f: F, m: Math.min(5, Math.max(1, Math.round((spend / avgSpend) * 3))),
      last: Math.round((6 - R) * 110 * (0.5 + r())),
      orders: F * 2 + Math.floor(r() * 3),
      spend,
    });
  }
  return { rows, total: count, capped: count > CAP };
}

export const HOUSEHOLD_COLS = [
  { key: "id", label: "constituent_id" },
  { key: "segment", label: "rfm_segment" },
  { key: "zip", label: "zip" },
  { key: "county", label: "county" },
  { key: "r", label: "recency_score" },
  { key: "f", label: "frequency_score" },
  { key: "m", label: "monetary_score" },
  { key: "last", label: "days_since_last_purchase" },
  { key: "orders", label: "orders" },
  { key: "spend", label: "spend" },
];

// One call for the common case: build, download and confirm.
export function exportHouseholds(opts, filename) {
  const x = householdRows(opts);
  download(filename, toCsv(HOUSEHOLD_COLS, x.rows));
  toast(`Exported ${x.rows.length.toLocaleString()} household IDs${x.capped ? ` (demo sample of ${x.total.toLocaleString()})` : ""}`);
}

export function exportSummary(cols, rows, filename, what) {
  download(filename, toCsv(cols, rows));
  toast(`Exported ${rows.length} ${what}`);
}

// A small "⤓ Export" button. data-x tells the view what to export.
export const exportBtn = (x, label = "Export", extra = "") =>
  `<button type="button" class="x-btn" data-x="${x}" ${extra}>⤓ ${label}</button>`;
