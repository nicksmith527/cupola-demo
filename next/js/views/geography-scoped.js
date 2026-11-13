// County & ZIP with a scope: the whole season, one genre, one show, or a
// single performance. The map and lists are the original view, re-drawn
// against the chosen slice.

import geography from "./geography.js";
import { shortDate, esc } from "../ui/format.js";

const KINDS = [
  { id: "season", label: "Season" },
  { id: "genre", label: "Genre" },
  { id: "show", label: "Show" },
  { id: "perf", label: "Performance" },
];

export default {
  id: "geography",
  label: "County & ZIP",
  mount(root, source, params) {
    const { titles, genres, perfs } = source.geoScopes();
    let kind = params?.get("k") || "season";
    let value = params?.get("v") || "";

    root.innerHTML = `
      <div class="scope-bar">
        <span class="label">Scope</span>
        <div class="seg" role="tablist" aria-label="Scope" id="kind">
          ${KINDS.map((k) => `<button type="button" role="tab" data-k="${k.id}" aria-selected="${k.id === kind}">${k.label}</button>`).join("")}
        </div>
        <select id="value" aria-label="Choose" hidden></select>
        <span class="hint" id="hint"></span>
      </div>
      <div id="geo"></div>`;

    const sel = root.querySelector("#value");
    function options() {
      sel.hidden = kind === "season";
      if (kind === "genre") sel.innerHTML = genres.map((g) => `<option value="genre:${esc(g)}">${esc(g)}</option>`).join("");
      if (kind === "show") sel.innerHTML = titles.map((t) => `<option value="show:${esc(t)}">${esc(t)}</option>`).join("");
      if (kind === "perf")
        sel.innerHTML = perfs
          .map((p) => `<option value="perf:${p.id}">${shortDate(p.date)} · ${esc(p.time)} · ${esc(p.title)}${p.daysOut < 0 ? " (played)" : p.daysOut === 0 ? " (tonight)" : ""}</option>`)
          .join("");
      if (kind !== "season") {
        if (![...sel.options].some((o) => o.value === value)) {
          // Default a performance to tonight; otherwise the first option.
          value = kind === "perf" ? `perf:${(perfs.find((p) => p.daysOut === 0) ?? perfs[0]).id}` : sel.options[0].value;
        }
        sel.value = value;
      } else value = "season";
      root.querySelectorAll("#kind button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.k === kind)));
    }

    function draw() {
      const scoped = Object.create(source);
      scoped.getGeography = () => source.getGeographyFor(value);
      const box = root.querySelector("#geo");
      box.innerHTML = "";
      geography.mount(box, scoped);
      const label = kind === "season" ? "Whole season to date" : sel.options[sel.selectedIndex]?.text;
      root.querySelector("#hint").textContent = kind === "season" ? "Narrow to a genre, a show or one performance" : `Showing buyers for: ${label}`;
      const p = box.querySelector(".view-head p");
      if (p && kind !== "season") p.textContent = `${label} · every ticket mapped to a county and ZIP code`;
    }

    root.querySelector("#kind").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]");
      if (!b) return;
      kind = b.dataset.k;
      options();
      draw();
    });
    sel.addEventListener("change", () => {
      value = sel.value;
      draw();
    });

    options();
    draw();
    return { update() {} };
  },
};
