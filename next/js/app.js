// App shell: picks the data source, draws the nav, routes between views and
// runs the simulated refresh loop.

import { config } from "./config.js";
import { createSource } from "./sources/index.js";
import { time } from "./ui/format.js";
import { hideTip } from "./ui/tooltip.js";

import morning from "./views/morning.js";
import daily from "./views/daily.js";
import pacing from "./views/pacing.js";
import audience from "./views/audience.js";
import geography from "./views/geography.js";
import callcenter from "./views/callcenter.js";
import house from "./views/house.js";
import returns from "./views/returns.js";
import geoScoped from "./views/geography-scoped.js";

// Snapshot and Daily sales lead; House is the front-of-house (operations) view.
const VIEWS = [morning, daily, returns, house, audience, geoScoped, callcenter];

const $ = (id) => document.getElementById(id);
let source;
let active; // { view, handle }
let secondsLeft = config.demoRefreshSeconds;

function renderNav() {
  $("nav").innerHTML = VIEWS.map((v) => `<a href="#/${v.id}" data-id="${v.id}">${v.label}</a>`).join("");
}

function route() {
  // Routes look like #/daily or #/returns?t=Swan%20Lake
  const [id0, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const id = id0 || VIEWS[0].id;
  const params = new URLSearchParams(query);
  const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
  document.querySelectorAll("#nav a").forEach((a) => {
    if (a.dataset.id === view.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  hideTip();
  const root = $("view");
  root.innerHTML = "";
  active = { view, handle: view.mount(root, source, params) };
  document.querySelector(`#nav a[data-id="${view.id}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  document.title = `${view.label} · ${config.brand}`;
  window.scrollTo({ top: 0 });
}

// Cupola refreshes on a schedule, not live. The header shows which scheduled
// refresh the numbers come from.
function updateStatus() {
  const m = source.meta();
  $("as-of").innerHTML = `<span class="hide-sm">Data as of </span>${m.asOfLabel}<span class="hide-sm"> · refreshes ${config.realWorldCadenceLabel}</span>`;
}

function refresh() {
  source.tick();
  secondsLeft = config.demoRefreshSeconds;
  active?.handle?.update?.();
  updateStatus();
}

async function start() {
  $("brand-name").textContent = config.brand;
  try {
    source = await createSource(config.source);
  } catch (err) {
    $("view").innerHTML = `<div class="card"><h2>Couldn't load the demo data</h2>
      <p class="sub">${err.message}. If you opened index.html straight from disk, run a local server instead
      (see README): <code>python3 -m http.server</code></p></div>`;
    return;
  }
  $("venue-name").textContent = source.meta().venueName;
  // Market switcher: reloads with ?market=… so each market has its own link.
  const picker = $("market");
  picker.innerHTML = config.markets.map((m) => `<option value="${m.id}">${m.label}</option>`).join("");
  picker.value = source.meta().marketId;
  picker.addEventListener("change", () => {
    const url = new URL(location.href);
    if (picker.value) url.searchParams.set("market", picker.value);
    else url.searchParams.delete("market");
    location.href = url.toString();
  });
  // Look switcher: the same app in a different skin and layout.
  const skin = $("skin");
  skin.value = document.documentElement.dataset.skin;
  skin.addEventListener("change", () => {
    const url = new URL(location.href);
    url.searchParams.set("skin", skin.value);
    location.href = url.toString();
  });

  $("footer").textContent =
    `${config.brand} demo · all names and numbers are synthetic · ` +
    `refreshes on a schedule (${config.refreshTimes.join(", ")}), not live`;

  renderNav();
  window.addEventListener("hashchange", route);
  route();
  updateStatus();

}

start();

// Lets the site install like an app and open offline (see sw.js).
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
