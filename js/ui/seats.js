// Seat-map layout, shared from the original Snapshot view.
import { esc } from "./format.js";
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const PITCH = 10;
const ROW_GAP = 9;
const SECTION_GAP = 36;
const TOP = 58; // room for the stage and the first section label

// Lay out every seat in the hall and rank them from "sells first" to "sells last".
// Each section may set `curve` (how much its rows arc around the stage).
export function buildSeats(hall, perf) {
  const widest = Math.max(...hall.sections.map((s) => s.seatsPerRow)) * PITCH;
  const W = Math.max(360, widest + 80);
  const seats = [];
  const labels = [];
  let y = TOP;
  hall.sections.forEach((sec, si) => {
    const width = sec.seatsPerRow * PITCH;
    const x0 = (W - width) / 2 + PITCH / 2;
    const center = (sec.seatsPerRow - 1) / 2;
    const curve = sec.curve ?? 0.022;
    labels.push({ name: sec.name, y: y - 12 });
    let maxDip = 0;
    for (let r = 0; r < sec.rows; r++) {
      for (let c = 0; c < sec.seatsPerRow; c++) {
        const dx = c - center;
        const dip = dx * dx * curve;
        maxDip = Math.max(maxDip, dip);
        seats.push({
          x: x0 + c * PITCH,
          y: y + r * ROW_GAP + dip,
          section: sec.name,
          row: r + 1,
          seat: c + 1,
          score: si * 10 + r * 0.8 + Math.abs(dx) * 0.33,
        });
      }
    }
    y += sec.rows * ROW_GAP + maxDip + SECTION_GAP;
  });
  const rand = rng(perf.id.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  seats.forEach((s) => (s.score += rand() * 7));

  // Holds and comps are scattered; sales fill the best remaining seats first.
  const shuffled = seats.slice().sort(() => rand() - 0.5);
  shuffled.slice(0, perf.holds).forEach((s) => (s.fixed = "hold"));
  shuffled.slice(perf.holds, perf.holds + perf.comps).forEach((s) => (s.fixed = "comp"));
  const saleOrder = seats.filter((s) => !s.fixed).sort((a, b) => a.score - b.score);
  return { seats, saleOrder, labels, width: W, height: y - SECTION_GAP + 10, stageWidth: Math.min(220, widest * 0.6) };
}

export function seatSvg(layout, hall) {
  const labels = layout.labels
    .map((l) => `<text class="svg-label" x="${layout.width / 2}" y="${l.y}" text-anchor="middle">${esc(l.name.toUpperCase())}</text>`)
    .join("");
  const dots = layout.seats
    .map((s, i) => `<circle class="seat" data-i="${i}" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="3.4" />`)
    .join("");
  // Cap the drawn size so small halls don't balloon to fill the card.
  return `<svg class="seatmap" style="max-width:${Math.round(layout.width * 1.4)}px" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Seat map of ${esc(hall.name)}">
    <rect class="stage" x="${(layout.width - layout.stageWidth) / 2}" y="6" width="${layout.stageWidth}" height="20" rx="4" />
    <text class="svg-label" x="${layout.width / 2}" y="20" text-anchor="middle">STAGE</text>
    ${labels}${dots}</svg>`;
}

