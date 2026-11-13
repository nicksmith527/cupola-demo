// County & ZIP, localized to a market (?market=tampa / ?market=denver).
//
// A heat map of where tickets come from: zoom from the home region out to the
// whole state, then to the nation. Counties and ZIP codes are real; every
// number is synthetic. With no market chosen, the original map-less version
// (fictional counties) is shown instead.

import basic from "./geography-basic.js";
import { countUp, growBars, reducedMotion } from "../ui/animate.js";
import { int, money, esc } from "../ui/format.js";
import { showTip, hideTip, tipHtml } from "../ui/tooltip.js";
import { exportBtn, exportHouseholds, exportSummary, slug } from "../ui/export.js";

const NS = "http://www.w3.org/2000/svg";
// Sequential blue, light = few tickets, dark = many (light theme).
// The map ramp follows the skin (Gulf Coast uses teal).
const RAMP = document.documentElement.dataset.skin === "gulf"
  ? ["#dcf0ee", "#c2e6e2", "#9fd6d0", "#7cc4bd", "#58b0a9", "#379c96", "#1d8783", "#0f7c7a", "#0b5f5e", "#073f3f"]
  : ["#dbe8fa", "#c2d8f6", "#9ec5f4", "#7fb0ee", "#5d98e8", "#3987e5", "#2a78d6", "#1c5cab", "#104281", "#0a2f5e"];
const NO_DATA = "#ebe9e3";
const OTHER_LAND = "#e4e2dc";
const HOME = document.documentElement.dataset.skin === "gulf" ? "#e8a33d" : "#eb6834"; // home state on the national map
const short = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : int(n));

// Log scale between the smallest and largest values, so small rural counties
// read light and the population centers stand out.
function logColor(v, max, min = 1) {
  if (!v) return NO_DATA;
  const t = Math.log(v / min) / Math.log(max / min);
  return RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)))];
}

function padBox([x0, y0, x1, y1], pad, aspect) {
  let w = x1 - x0, h = y1 - y0;
  x0 -= w * pad; y0 -= h * pad; w *= 1 + 2 * pad; h *= 1 + 2 * pad;
  // Grow to the target aspect ratio so the map fills its frame.
  if (w / h < aspect) { const nw = h * aspect; x0 -= (nw - w) / 2; w = nw; }
  else { const nh = w / aspect; y0 -= (nh - h) / 2; h = nh; }
  return [x0, y0, w, h];
}

export default {
  id: "geography",
  label: "County & ZIP",
  mount(root, source) {
    const g = source.getGeography();
    if (!g.market) return basic.mount(root, source);
    const m = g.market;
    const { region, states } = m.shapes;

    const byFips = new Map(m.counties.map((c) => [c.fips, c]));
    const stateTotal = m.states.find((s) => s.home).tickets;
    const allTickets = m.states.reduce((s, x) => s + x.tickets, 0);
    const home = byFips.get(m.homeCounty);
    const allZips = m.counties.flatMap((c) => c.zips.map((z) => ({ ...z, county: c.county, fips: c.fips }))).sort((a, b) => b.tickets - a.tickets);
    const topZip = allZips[0];
    const outShare = 1 - stateTotal / allTickets;
    const outStates = m.states.filter((s) => !s.home).length;
    const maxCounty = Math.max(...m.counties.map((c) => c.tickets));
    const minCounty = Math.max(1, Math.min(...m.counties.map((c) => c.tickets).filter((t) => t > 0)));
    const extents = [...m.extents, { id: "national", label: "National" }];

    let extent = m.extents[0].id;
    let selected = null; // fips of the selected county, or null for the whole region

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Where your audience lives</h1>
          <p>${esc(m.label)} · ${esc(m.seasonLabel.toLowerCase())} · every ticket mapped to a county and ZIP code</p>
        </div>
      </div>

      <section class="geo-hero">
        <div class="card hero-main">
          <div class="hero-num"><span id="h-home">0%</span></div>
          <div class="hero-text">of tickets come from <b>${esc(home.county)}</b>, home of ${esc(m.venueName)}</div>
        </div>
        <div class="card hero-stat"><div class="label">Top ZIP code</div><div class="hs-big">${esc(topZip.zip)}</div><div class="note">${esc(topZip.place)} · <span id="h-zip">0</span> tickets</div></div>
        <div class="card hero-stat"><div class="label">Counties reached</div><div class="hs-big"><span id="h-counties">0</span></div><div class="note">of ${region.features.length} in ${esc(m.stateName)}</div></div>
        <div class="card hero-stat"><div class="label">From out of state</div><div class="hs-big"><span id="h-out">0%</span></div><div class="note">${outStates} states · <span id="h-outt">0</span> tickets</div></div>
      </section>

      <div class="card map-card">
        <div class="card-head">
          <div>
            <h2 id="map-title">Tickets by county</h2>
            <p class="sub" id="map-sub">Darker = more tickets · hover for details · select a county to see its ZIP codes</p>
          </div>
          <div class="seg" role="tablist" aria-label="Map area">
            ${extents.map((e) => `<button type="button" role="tab" data-x="${e.id}" aria-selected="${e.id === extent}">${esc(e.label)}</button>`).join("")}
          </div>
        </div>
        <div class="map-frame" id="map-frame"></div>
        <div class="map-legend"><span>Fewer tickets</span><div class="ramp">${RAMP.map((c) => `<i style="background:${c}"></i>`).join("")}</div><span>More</span>
          <span class="no-data"><i style="background:${NO_DATA}"></i>No sales</span>
          <span class="no-data home-key" hidden><i style="background:${HOME}"></i>Home state</span></div>
      </div>

      <section class="grid two-col-even">
        <div class="card">
          <div class="card-head"><div><h2>Counties</h2>
          <p class="sub">Share of all tickets · select one to see its ZIP codes</p></div>
          <div class="x-group">${exportBtn("counties", "Counties")}</div></div>
          <div class="bar-list" id="county-list"></div>
        </div>
        <div class="card">
          <div class="card-head">
            <div><h2 id="zip-title">Top ZIP codes</h2><p class="sub" id="zip-sub">Across the whole region</p></div>
            <div class="x-group"><button type="button" class="link" id="zip-clear" hidden>Show all ZIPs</button>${exportBtn("zips", "ZIPs")}${exportBtn("county-hh", "Households", "hidden")}</div>
          </div>
          <div class="zip-board" id="zip-board"></div>
        </div>
      </section>
      <p class="callout" style="margin-top:16px"><b>Why this matters:</b> ${esc(m.note)} Real counties and ZIP codes; all ticket numbers in this demo are synthetic.</p>`;

    // ---- Hero numbers ----
    countUp(root.querySelector("#h-home"), (home.tickets / allTickets) * 100, (n) => Math.round(n) + "%", 1500);
    countUp(root.querySelector("#h-zip"), topZip.tickets, int, 1500);
    countUp(root.querySelector("#h-counties"), m.counties.filter((c) => c.tickets > 0).length, int, 1500);
    countUp(root.querySelector("#h-out"), outShare * 100, (n) => Math.round(n) + "%", 1500);
    countUp(root.querySelector("#h-outt"), allTickets - stateTotal, int, 1500);

    // ---- Map ----
    const frame = root.querySelector("#map-frame");
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "geo-map");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Map of tickets by county in ${m.stateName}`);
    frame.appendChild(svg);
    const aspect = () => Math.max(1.1, frame.clientWidth / Math.max(260, frame.clientHeight));

    // Layer 1: every state, for context (also the national view).
    const gStates = document.createElementNS(NS, "g");
    const others = m.states.filter((s) => !s.home).map((s) => s.tickets);
    const stateMax = Math.max(...others);
    const stateMin = Math.max(1, Math.min(...others) * 0.6);
    const stateData = new Map(m.states.map((s) => [s.abbr, s]));
    for (const f of states.features) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", f.d);
      p.setAttribute("class", "state");
      p.dataset.abbr = f.abbr;
      p.dataset.name = f.name;
      gStates.appendChild(p);
    }
    svg.appendChild(gStates);

    // Layer 2: the market state's counties.
    const gCounties = document.createElementNS(NS, "g");
    const countyEls = new Map();
    const ranked = region.features.slice().sort((a, b) => (byFips.get(b.id)?.tickets ?? 0) - (byFips.get(a.id)?.tickets ?? 0));
    for (const f of region.features) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", f.d);
      p.setAttribute("class", "county");
      p.dataset.fips = f.id;
      p.style.fill = NO_DATA;
      p.style.transitionDelay = reducedMotion() ? "0ms" : `${ranked.indexOf(f) * 14}ms`;
      gCounties.appendChild(p);
      countyEls.set(f.id, p);
    }
    svg.appendChild(gCounties);
    const gLabels = document.createElementNS(NS, "g");
    gLabels.setAttribute("class", "map-labels");
    svg.appendChild(gLabels);

    const featureById = new Map(region.features.map((f) => [f.id, f]));
    const stateFeature = new Map(states.features.map((f) => [f.abbr, f]));

    function extentBox(id) {
      if (id === "national") return padBox(states.bbox, 0.02, aspect());
      const e = m.extents.find((x) => x.id === id);
      const feats = e.counties === "all" ? region.features : e.counties.map((fips) => featureById.get(fips)).filter(Boolean);
      const b = feats.reduce((a, f) => [Math.min(a[0], f.bbox[0]), Math.min(a[1], f.bbox[1]), Math.max(a[2], f.bbox[2]), Math.max(a[3], f.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity]);
      return padBox(b, 0.06, aspect());
    }

    let box = extentBox(extent);
    const setBox = (b) => { box = b; svg.setAttribute("viewBox", b.map((n) => n.toFixed(2)).join(" ")); };
    setBox(box);

    function zoomTo(target) {
      const from = box.slice();
      if (reducedMotion()) { setBox(target); labels(); return; }
      const start = performance.now();
      const dur = 750;
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      gLabels.style.opacity = "0";
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = ease(t);
        setBox(from.map((v, i) => v + (target[i] - v) * e));
        if (t < 1) requestAnimationFrame(step);
        else { labels(); gLabels.style.opacity = "1"; }
      };
      requestAnimationFrame(step);
    }

    // Labels: biggest counties (or states) visible in the current view.
    function labels() {
      const k = box[2] / Math.max(1, svg.clientWidth || frame.clientWidth); // map units per pixel
      svg.style.setProperty("--k", k);
      const inView = ([x, y]) => x > box[0] && x < box[0] + box[2] && y > box[1] && y < box[1] + box[3];
      let items;
      if (extent === "national") {
        items = m.states.slice(0, 7).map((s) => ({ f: stateFeature.get(s.abbr), name: s.abbr, value: s.tickets })).filter((x) => x.f);
      } else {
        const visible = ranked.filter((f) => inView(f.label) && byFips.get(f.id));
        const count = 9;
        items = visible.slice(0, count).map((f) => ({ f, name: f.name, value: byFips.get(f.id).tickets }));
      }
      // Skip labels that would collide with a bigger one already placed.
      const placed = [];
      items = items.filter(({ f }) => {
        const [x, y] = f.label;
        if (placed.some(([px, py]) => Math.abs(px - x) < 74 * k && Math.abs(py - y) < 34 * k)) return false;
        placed.push([x, y]);
        return true;
      });
      const fs = 12 * k;
      gLabels.innerHTML = items
        .map(({ f, name, value }) => {
          const [x, y] = f.label;
          return `<text x="${x}" y="${y - fs * 0.15}" font-size="${fs}" text-anchor="middle">${esc(name)}</text>
            <text x="${x}" y="${y + fs * 1.05}" font-size="${fs * 1.05}" text-anchor="middle" class="v">${short(value)}</text>`;
        })
        .join("");
      gLabels.querySelectorAll("text").forEach((t) => t.setAttribute("stroke-width", 3 * k));
    }

    function paint() {
      const national = extent === "national";
      svg.classList.toggle("national", national);
      for (const p of gStates.children) {
        const s = stateData.get(p.dataset.abbr);
        if (!national) { p.style.fill = OTHER_LAND; continue; }
        p.style.fill = !s ? NO_DATA : s.home ? HOME : logColor(s.tickets, stateMax, stateMin);
      }
      gCounties.style.display = national ? "none" : "";
      root.querySelector(".home-key").hidden = !national;
      for (const [fips, p] of countyEls) {
        p.style.fill = logColor(byFips.get(fips)?.tickets ?? 0, maxCounty, minCounty);
        p.classList.toggle("selected", fips === selected);
      }
      root.querySelector("#map-title").textContent = national ? "Tickets by state" : "Tickets by county";
      root.querySelector("#map-sub").textContent = national
        ? `${m.stateName} (home state, orange) plus ${outStates} other states · darker blue = more tickets`
        : "Darker = more tickets · hover for details · select a county to see its ZIP codes";
    }

    // Fill the map after first layout so the counties cascade in by rank.
    requestAnimationFrame(() => requestAnimationFrame(() => { paint(); labels(); }));

    root.querySelector(".map-card .seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-x]");
      if (!b || b.dataset.x === extent) return;
      extent = b.dataset.x;
      root.querySelectorAll(".map-card .seg button").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.x === extent)));
      for (const p of countyEls.values()) p.style.transitionDelay = "0ms";
      paint();
      zoomTo(extentBox(extent));
    });

    svg.addEventListener("pointermove", (e) => {
      const t = e.target;
      if (t.classList?.contains("county")) {
        const c = byFips.get(t.dataset.fips);
        if (!c) return hideTip();
        showTip(e, tipHtml(esc(c.county), [
          ["Tickets", int(c.tickets)],
          ["Share of all tickets", ((c.tickets / allTickets) * 100).toFixed(1) + "%"],
          ["Revenue", money(c.revenue)],
          ["Households", int(c.households)],
        ]));
      } else if (t.classList?.contains("state") && extent === "national") {
        const s = stateData.get(t.dataset.abbr);
        showTip(e, tipHtml(esc(t.dataset.name), s ? [["Tickets", int(s.tickets)], ["Revenue", money(s.revenue)]] : [["Tickets", "none"]]));
      } else hideTip();
    });
    svg.addEventListener("pointerleave", hideTip);
    svg.addEventListener("click", (e) => {
      const t = e.target;
      if (t.classList?.contains("county") && byFips.get(t.dataset.fips)) select(t.dataset.fips, true);
    });

    // ---- County list ----
    const TOP = 12;
    function countyList(animate) {
      const top = m.counties.slice(0, TOP);
      const rest = m.counties.slice(TOP);
      const restTickets = rest.reduce((s, c) => s + c.tickets, 0);
      const list = root.querySelector("#county-list");
      list.innerHTML =
        top
          .map((c, i) => {
            const share = c.tickets / allTickets;
            return `<div class="bar-row clickable ${c.fips === selected ? "sel" : ""}" data-fips="${c.fips}" role="button" tabindex="0">
              <div><div class="name"><span class="rank">${i + 1}</span>${esc(c.county)}</div><div class="meta">$${short(c.revenue)} revenue${c.zips.length ? ` · ${c.zips.length} top ZIPs` : ""}</div></div>
              <div class="num">${int(c.tickets)} · ${(share * 100).toFixed(1)}%</div>
              <div class="bar-track"><div class="bar-fill" ${animate ? `data-width="${(c.tickets / maxCounty) * 100}%"` : `style="width:${(c.tickets / maxCounty) * 100}%"`}></div></div>
            </div>`;
          })
          .join("") +
        `<div class="bar-row"><div><div class="name meta">${rest.length} other ${esc(m.stateName)} counties</div></div>
          <div class="num">${int(restTickets)} · ${((restTickets / allTickets) * 100).toFixed(1)}%</div></div>
         <div class="bar-row"><div><div class="name meta">Out of state (${outStates} states)</div></div>
          <div class="num">${int(allTickets - stateTotal)} · ${(outShare * 100).toFixed(1)}%</div></div>`;
      if (animate) growBars(list);
    }
    const onCounty = (e) => {
      const row = e.target.closest("[data-fips]");
      if (!row) return;
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      select(row.dataset.fips, false);
    };
    root.querySelector("#county-list").addEventListener("click", onCounty);
    root.querySelector("#county-list").addEventListener("keydown", onCounty);

    // ---- ZIP leaderboard ----
    function zipBoard() {
      const c = selected ? byFips.get(selected) : null;
      const zips = (c ? c.zips.map((z) => ({ ...z, county: c.county })) : allZips).slice(0, 10);
      root.querySelector("#zip-title").textContent = c ? `${c.county} ZIP codes` : "Top ZIP codes";
      root.querySelector("#zip-sub").textContent = c
        ? `${int(c.tickets)} tickets from the county${c.zips.length ? "" : " · no ZIP detail in the demo for this county"}`
        : "Across the whole market";
      root.querySelector("#zip-clear").hidden = !c;
      const hh = root.querySelector('[data-x="county-hh"]');
      hh.hidden = !c;
      if (c) hh.textContent = `⤓ ${c.county.replace(/ County$/, "")} households`;
      const max = Math.max(1, ...zips.map((z) => z.tickets));
      const board = root.querySelector("#zip-board");
      board.innerHTML = zips.length
        ? zips
            .map(
              (z, i) => `<div class="zip-row" style="animation-delay:${i * 45}ms">
                <div class="zip-rank">${i + 1}</div>
                <div class="zip-main">
                  <div class="zip-code">${esc(z.zip)}</div>
                  <div class="meta">${esc(z.place)}${c ? "" : " · " + esc(z.county)}</div>
                  <div class="bar-track"><div class="bar-fill" data-width="${(z.tickets / max) * 100}%"></div></div>
                </div>
                <div class="zip-nums"><b class="zip-t" data-v="${z.tickets}">0</b><span class="meta">tickets</span><span class="meta">${money(z.revenue)} · ${int(z.households)} households</span>
                  <button type="button" class="x-btn x-mini" data-x="zip" data-zip="${esc(z.zip)}" aria-label="Export households in ${esc(z.zip)}">⤓ IDs</button></div>
              </div>`
            )
            .join("")
        : `<p class="sub">ZIP-level detail isn't included for this county in the demo.</p>`;
      board.querySelectorAll(".zip-t").forEach((el) => countUp(el, +el.dataset.v, int, 1100));
      growBars(board);
    }
    root.querySelector("#zip-clear").addEventListener("click", () => select(null, false));

    // ---- Exports: summaries, or the household IDs behind a county or ZIP ----
    const scopeTag = slug(source.scopeLabel || "season");
    const fname = (what) => `cupola-${slug(m.label)}-${what}-${scopeTag}.csv`;
    const zipList = (c) => (c ? c.zips.map((z) => ({ ...z, county: c.county })) : allZips);
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-x]");
      if (!b) return;
      const x = b.dataset.x;
      if (x === "counties")
        exportSummary(
          [{ key: "fips", label: "county_fips" }, { key: "county", label: "county" }, { key: "tickets", label: "tickets" }, { key: "revenue", label: "revenue" }, { key: "households", label: "households" }, { key: "share", label: "share_of_tickets" }],
          m.counties.filter((c) => c.tickets > 0).map((c) => ({ ...c, households: c.households ?? Math.round(c.tickets / 2.6), share: (c.tickets / allTickets).toFixed(4) })),
          fname("counties"), "counties");
      if (x === "zips") {
        const c = selected ? byFips.get(selected) : null;
        exportSummary(
          [{ key: "zip", label: "zip" }, { key: "place", label: "place" }, { key: "county", label: "county" }, { key: "tickets", label: "tickets" }, { key: "revenue", label: "revenue" }, { key: "households", label: "households" }],
          zipList(c), fname(c ? slug(c.county) + "-zips" : "zips"), "ZIP codes");
      }
      if (x === "county-hh" && selected) {
        const c = byFips.get(selected);
        exportHouseholds({ label: c.county + scopeTag, count: c.households ?? Math.round(c.tickets / 2.6), zips: c.zips.map((z) => ({ zip: z.zip, county: c.county, weight: z.tickets })), avgSpend: c.revenue / Math.max(1, c.households ?? c.tickets / 2.6) }, fname(slug(c.county) + "-households"));
      }
      if (x === "zip") {
        const z = allZips.find((q) => q.zip === b.dataset.zip);
        if (z) exportHouseholds({ label: z.zip + scopeTag, count: z.households, zips: [{ zip: z.zip, county: z.county }], avgSpend: z.revenue / Math.max(1, z.households) }, fname(z.zip + "-households"));
      }
    });

    function select(fips, fromMap) {
      selected = selected === fips ? null : fips;
      paint();
      countyList(false);
      zipBoard();
      if (fromMap && selected) root.querySelector("#zip-board").closest(".card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    countyList(true);
    zipBoard();

    // Keep labels sized right if the window changes size.
    const ro = new ResizeObserver(() => { setBox(extentBox(extent)); labels(); });
    ro.observe(frame);

    return { update() {} };
  },
};
