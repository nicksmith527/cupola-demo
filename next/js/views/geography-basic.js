// Geography: tickets and revenue by county, with the ZIPs behind each one.
// County isn't stored in the ticketing system; it's derived from ZIP.

import { countUp, growBars } from "../ui/animate.js";
import { int, money, moneyK, pct, esc } from "../ui/format.js";

export default {
  id: "geography",
  label: "County & ZIP",
  mount(root, source) {
    const d = source.getGeography();
    const counties = d.counties.slice().sort((a, b) => b.tickets - a.tickets);
    const total = counties.reduce((s, c) => s + c.tickets, 0);
    const totalRev = counties.reduce((s, c) => s + c.revenue, 0);
    const zipCount = counties.reduce((s, c) => s + c.zips.length, 0);
    let selected = counties[0].county;

    root.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Where the audience comes from</h1>
          <p>${esc(d.seasonLabel)} · tickets by county, then by ZIP. Select a county to see its ZIPs.</p>
        </div>
      </div>
      <section class="strip">
        <div class="stat"><div class="label">Tickets</div><div class="value" id="g-t">0</div><div class="note">${esc(d.seasonLabel.toLowerCase())}</div></div>
        <div class="stat"><div class="label">Revenue</div><div class="value" id="g-r">$0</div></div>
        <div class="stat"><div class="label">Home county share</div><div class="value" id="g-h">0%</div><div class="note">${esc(counties[0].county)}</div></div>
        <div class="stat"><div class="label">ZIP codes mapped</div><div class="value" id="g-z">0</div><div class="note">across ${counties.length - 1} counties</div></div>
      </section>
      <section class="grid two-col-even">
        <div class="card">
          <h2>Tickets by county</h2>
          <p class="sub">Share of all tickets sold</p>
          <div class="bar-list" id="counties"></div>
        </div>
        <div class="card">
          <h2 id="zip-title"></h2>
          <p class="sub">Top ZIP codes in the county</p>
          <div class="table-wrap" id="zips"></div>
        </div>
      </section>
      <p class="callout" style="margin-top:16px"><b>Why this matters:</b> ${esc(d.note)} County lines and custom setups drift over time; deriving it from ZIP keeps totals right without maintenance.</p>`;

    countUp(root.querySelector("#g-t"), total);
    countUp(root.querySelector("#g-r"), totalRev, moneyK);
    countUp(root.querySelector("#g-h"), (counties[0].tickets / total) * 100, (n) => n.toFixed(1) + "%");
    countUp(root.querySelector("#g-z"), zipCount);

    const list = root.querySelector("#counties");
    function drawCounties(animate) {
      list.innerHTML = counties
        .map((c) => {
          const share = c.tickets / total;
          const sel = c.county === selected;
          const can = c.zips.length > 0;
          return `<div class="bar-row ${can ? "clickable" : ""}" data-county="${esc(c.county)}" ${can ? 'role="button" tabindex="0"' : ""}
                    style="${sel ? "background:var(--surface-2)" : ""}">
            <div><div class="name">${sel ? "<b>" : ""}${esc(c.county)}${sel ? "</b>" : ""}</div>
            <div class="meta">${moneyK(c.revenue)}${can ? ` · ${c.zips.length} ZIPs` : ""}</div></div>
            <div class="num">${int(c.tickets)} · ${pct(share, 1)}</div>
            <div class="bar-track"><div class="bar-fill" ${animate ? `data-width="${share * 100}%"` : `style="width:${share * 100}%"`}></div></div>
          </div>`;
        })
        .join("");
      if (animate) growBars(list);
    }

    function drawZips() {
      const c = counties.find((x) => x.county === selected);
      root.querySelector("#zip-title").textContent = c.county;
      const max = Math.max(...c.zips.map((z) => z.tickets));
      const box = root.querySelector("#zips");
      box.innerHTML = `<table>
        <thead><tr><th>ZIP</th><th style="width:40%"></th><th class="r">Tickets</th><th class="r">Households</th><th class="r">Revenue</th></tr></thead>
        <tbody>${c.zips
          .map(
            (z) => `<tr><td>${esc(z.zip)}</td>
              <td><div class="bar-track" style="height:6px"><div class="bar-fill" data-width="${(z.tickets / max) * 100}%"></div></div></td>
              <td class="r">${int(z.tickets)}</td><td class="r">${int(z.households)}</td><td class="r">${money(z.revenue)}</td></tr>`
          )
          .join("")}</tbody></table>`;
      growBars(box);
    }

    const choose = (e) => {
      const row = e.target.closest("[data-county]");
      if (!row || !row.classList.contains("clickable")) return;
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      selected = row.dataset.county;
      drawCounties(false);
      drawZips();
    };
    list.addEventListener("click", choose);
    list.addEventListener("keydown", choose);

    drawCounties(true);
    drawZips();
    return { update() {} };
  },
};
