// Small shared pieces for the alternative look: stat strips, sparklines,
// a compact sales-curve chart and the tonight ring.

import { countUp, flash } from "./animate.js";
import { int, esc } from "./format.js";

// <div class="strip"> of stats. items: [{ id, label, note }]
export function strip(items) {
  return `<section class="strip">${items
    .map((s) => `<div class="stat" id="${s.id}"><div class="label">${esc(s.label)}</div><div class="value">0</div><div class="note">${s.note ?? ""}</div></div>`)
    .join("")}</section>`;
}

export function setStat(root, id, v, f, isRefresh) {
  const box = root.querySelector("#" + id);
  if (!box) return;
  const el = box.querySelector(".value");
  if (isRefresh && el._value !== v) flash(box);
  countUp(el, v, f);
}

// Sparkline of a cumulative curve against a benchmark (dashed).
export function spark(pts, { w = 120, h = 34, total } = {}) {
  if (!pts.length) return "";
  const max = Math.max(1, total ?? 0, ...pts.map((p) => Math.max(p.sold ?? 0, p.bench ?? 0)));
  const n = pts.length - 1 || 1;
  const X = (i) => (i / n) * (w - 2) + 1;
  const Y = (v) => h - 2 - (v / max) * (h - 4);
  const line = (k) => pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p[k]).toFixed(1)}`).join("");
  const area = `${line("sold")}L${X(n).toFixed(1)},${h}L1,${h}Z`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path class="area" d="${area}"/><path class="bench" d="${line("bench")}"/><path d="${line("sold")}"/></svg>`;
}

// Cumulative sales vs similar shows, drawn at the container's pixel width.
export function curveChart(box, curve, { capacity, height = 200 } = {}) {
  const W = Math.max(280, Math.round(box.clientWidth || 520));
  const H = height;
  const M = { l: 44, r: 12, t: 10, b: 26 };
  const all = [...curve.pts, ...curve.ahead];
  const yMax = Math.max(capacity ?? 0, ...all.map((p) => Math.max(p.sold ?? 0, p.bench ?? 0))) * 1.04;
  const x = (d) => M.l + ((curve.onSale - d) / curve.onSale) * (W - M.l - M.r);
  const y = (v) => H - M.b - (v / yMax) * (H - M.t - M.b);
  const path = (pts, k) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.daysOut).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  let g = "";
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    g += `<line class="gridline" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="${M.l - 6}" y="${y(v) + 4}" text-anchor="end">${int(v)}</text>`;
  }
  const step = curve.onSale > 150 ? 50 : curve.onSale > 60 ? 30 : 10;
  for (let d = Math.floor(curve.onSale / step) * step; d >= 0; d -= step)
    g += `<text class="axis-label" x="${x(d)}" y="${H - 8}" text-anchor="middle">${d === 0 ? "show" : d + "d"}</text>`;
  if (capacity) g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(capacity)}" y2="${y(capacity)}" stroke="var(--text-muted)" stroke-dasharray="2 3"/><text class="axis-label" x="${W - M.r}" y="${y(capacity) - 4}" text-anchor="end">capacity</text>`;
  const benchAll = [...curve.pts, ...curve.ahead];
  const last = curve.pts[curve.pts.length - 1];
  box.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sales curve">
    ${g}
    <path class="series" stroke="var(--neutral-mark)" stroke-dasharray="4 4" d="${path(benchAll, "bench")}"/>
    <path class="series primary draw" stroke="var(--series-1)" d="${path(curve.pts, "sold")}"/>
    <circle class="dot" cx="${x(last.daysOut)}" cy="${y(last.sold)}" r="4.5" fill="var(--series-1)"/>
  </svg>`;
  box.querySelectorAll("path.draw").forEach((p) => {
    const len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = `${len} ${len}`;
    p.style.setProperty("--len", len);
  });
}

export function ring(pct, label, sub) {
  const C = 2 * Math.PI * 40;
  return `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" r="40"/>
    <circle class="prog" cx="50" cy="50" r="40" transform="rotate(-90 50 50)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C * (1 - pct)).toFixed(1)}"/>
    <text x="50" y="52" text-anchor="middle">${label}</text>
    <text class="small" x="50" y="67" text-anchor="middle">${sub}</text>
  </svg>`;
}

export function animateRings(root) {
  requestAnimationFrame(() => requestAnimationFrame(() =>
    root.querySelectorAll(".ring .prog").forEach((c) => (c.style.strokeDashoffset = c.dataset.off))));
}

export function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
