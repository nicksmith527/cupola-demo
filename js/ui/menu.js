// App menus: a ⋯ "more" menu in the top-right corner and a ☰ menu for
// phones that holds every tab, the markets and the same extra items.

import { openRecap } from "./period.js";
import { toast } from "./export.js";

const ITEMS = [
  { id: "about", label: "About Cupola", icon: "ⓘ" },
  { id: "possible", label: "What Cupola can connect to", icon: "⇄" },
  { id: "recap", label: "Sales recap: weekend & past days", icon: "◷" },
  { id: "copy", label: "Copy link to this view", icon: "⧉" },
  { id: "print", label: "Print or save as PDF", icon: "⎙" },
];

function act(id, source) {
  if (id === "about") location.hash = "#/about";
  if (id === "possible") location.hash = "#/about#possibilities";
  if (id === "recap") openRecap(source, "weekend");
  if (id === "print") setTimeout(() => window.print(), 50);
  if (id === "copy") {
    const done = () => toast("Link copied");
    navigator.clipboard?.writeText(location.href).then(done, () => prompt("Copy this link:", location.href));
  }
}

export function installMenus({ views, source, markets }) {
  const topbar = document.querySelector(".topbar");
  const brand = document.querySelector(".brand");

  // ☰ (phones)
  const burger = document.createElement("button");
  burger.type = "button";
  burger.className = "m-burger";
  burger.setAttribute("aria-label", "Menu");
  burger.innerHTML = "<span></span><span></span><span></span>";
  brand.prepend(burger);

  // ⋯ (top right)
  const more = document.createElement("div");
  more.className = "m-more";
  more.innerHTML = `<button type="button" class="m-dots" aria-label="More" aria-haspopup="menu" aria-expanded="false">⋯</button>
    <div class="m-pop" role="menu" hidden>
      ${ITEMS.map((i) => `<button type="button" role="menuitem" data-m="${i.id}"><i>${i.icon}</i>${i.label}</button>`).join("")}
      <div class="m-note">Demo · every name and number is synthetic</div>
    </div>`;
  topbar.appendChild(more);
  const dots = more.querySelector(".m-dots");
  const pop = more.querySelector(".m-pop");
  const setPop = (open) => { pop.hidden = !open; dots.setAttribute("aria-expanded", String(open)); };
  dots.addEventListener("click", (e) => { e.stopPropagation(); setPop(pop.hidden); });
  pop.addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]");
    if (!b) return;
    setPop(false);
    act(b.dataset.m, source);
  });
  document.addEventListener("click", (e) => { if (!more.contains(e.target)) setPop(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setPop(false); closeDrawer(); } });

  // Drawer
  const drawer = document.createElement("div");
  drawer.className = "m-drawer";
  drawer.hidden = true;
  const current = new URLSearchParams(location.search).get("market") || "";
  drawer.innerHTML = `<div class="m-panel" role="dialog" aria-label="Menu">
      <div class="m-head"><img src="${brand.querySelector("img")?.getAttribute("src") ?? ""}" alt="" width="26" height="26"><b>${brand.querySelector(".brand-name")?.textContent ?? "Cupola"}</b>
        <button type="button" class="m-x" aria-label="Close menu">✕</button></div>
      <div class="m-venue">${source.meta().venueName}</div>
      <nav class="m-tabs">${views.filter((v) => !v.hidden).map((v) => `<a href="#/${v.id}" data-id="${v.id}">${v.label}</a>`).join("")}</nav>
      <div class="m-label">Market</div>
      <div class="m-markets">${markets.map((m) => `<button type="button" data-market="${m.id}" aria-pressed="${m.id === current}">${m.label}</button>`).join("")}</div>
      <div class="m-label">More</div>
      <div class="m-items">${ITEMS.map((i) => `<button type="button" data-m="${i.id}"><i>${i.icon}</i>${i.label}</button>`).join("")}</div>
      <div class="m-foot">Data as of ${source.meta().asOfLabel} · refreshes on a schedule</div>
    </div>`;
  document.body.appendChild(drawer);
  function openDrawer() {
    const id = location.hash.replace(/^#\/?/, "").split(/[?#]/)[0] || "morning";
    drawer.querySelectorAll(".m-tabs a").forEach((a) => a.toggleAttribute("aria-current", a.dataset.id === id));
    drawer.hidden = false;
    document.body.classList.add("pr-lock");
  }
  function closeDrawer() {
    drawer.hidden = true;
    document.body.classList.remove("pr-lock");
  }
  burger.addEventListener("click", openDrawer);
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer || e.target.closest(".m-x") || e.target.closest(".m-tabs a")) return closeDrawer();
    const m = e.target.closest("[data-market]");
    if (m) {
      const url = new URL(location.href);
      if (m.dataset.market) url.searchParams.set("market", m.dataset.market);
      else url.searchParams.delete("market");
      url.searchParams.delete("skin");
      location.href = url.toString();
      return;
    }
    const b = e.target.closest("[data-m]");
    if (b) { closeDrawer(); act(b.dataset.m, source); }
  });
  window.addEventListener("hashchange", closeDrawer);
}
