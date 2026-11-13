// Compact stat strip used by the House plan.
import { countUp, flash } from "./animate.js";
import { esc } from "./format.js";

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
