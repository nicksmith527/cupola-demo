// Snapshot (alternative look): the headline numbers in one strip, what's
// coming up, and small cards for tonight, shows needing attention and the
// phones. The seat map moved to the House tab.

import { growBars } from "../ui/animate.js";
import { int, money, pct, shortDate, esc } from "../ui/format.js";
import { strip, setStat, ring, animateRings, spark } from "../ui/mini.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default {
  id: "morning",
  label: "Snapshot",
  mount(root, source) {
    let data = source.getMorning();
    let daily = source.getDailyReport();
    const t = data.tonight;
    const last = source.getHousePerfs().find((p) => p.daysOut === -1);

    root.innerHTML = `
      <div class="view-head"><div>
        <h1>${greeting()}</h1>
        <p>${shortDate(new Date())} · numbers as of the ${esc(source.meta().asOfLabel)} refresh</p>
      </div></div>
      ${strip([
        { id: "k-sold", label: "Tickets sold yesterday", note: "all channels" },
        { id: "k-rev", label: "Revenue yesterday", note: "all channels" },
        { id: "k-tonight", label: "Tonight's house", note: `${esc(t.hall.name)} · ${int(t.capacity)} seats` },
        { id: "k-30", label: "Next 30 days sold", note: "of available capacity" },
        { id: "k-calls", label: "Calls answered yesterday", note: "box office phones" },
      ])}
      <div class="cols">
        <div class="card">
          <div class="card-head"><div><h2>Coming up</h2><p class="sub">Next 8 performances · sold vs. similar shows (dashed)</p></div>
            <a class="go" href="#/daily">Daily sales →</a></div>
          <div class="mini-list" id="upcoming"></div>
        </div>
        <div class="stack">
          <div class="card">
            <p class="eyebrow">Tonight</p>
            <div class="tonight">
              <div id="ring"></div>
              <div>
                <div class="name" style="font-weight:650">${esc(t.title)}</div>
                <div class="sub" style="margin:2px 0 8px">${esc(t.hall.name)} · ${esc(t.time)}</div>
                <div class="kv" id="tonight-kv"></div>
              </div>
            </div>
            <a class="go" href="#/house">House plan: zones and triggers →</a>
          </div>
          <a class="alert-line" id="attn" href="#/daily?attn=1"></a>
          <div class="card">
            <p class="eyebrow">Phones yesterday</p>
            <div class="kv" id="phones"></div>
            <a class="go" href="#/calls">Call center →</a>
          </div>
          ${last ? `<div class="card"><p class="eyebrow">Last night</p>
            <div style="font-weight:600">${esc(last.title)}</div>
            <div class="sub" style="margin:2px 0 0">${esc(last.hall.name)} · ${int(last.scanned)} of ${int(last.sold + last.comps)} ticketed guests scanned in (${pct(last.scanned / (last.sold + last.comps))})</div></div>` : ""}
        </div>
      </div>`;

    function upcoming() {
      const box = root.querySelector("#upcoming");
      box.innerHTML = data.upcoming
        .map((p) => {
          const share = p.sold / p.capacity;
          const re = source.isReturn(p.title)
            ? `<a class="re-tag" href="#/pacing?t=${encodeURIComponent(p.title)}" title="Return engagement: compare with past visits">↺ Return</a>`
            : "";
          const c = source.getPerfCurve(p);
          return `<div class="mini-row up-row">
            <div><div class="name">${esc(p.title)}${re}</div><div class="meta">${shortDate(p.date)} · ${esc(p.time)} · ${esc(p.hall.name)}</div></div>
            <div class="up-spark">${spark(c.pts.filter((_, i) => i % 3 === 0 || i === c.pts.length - 1), { w: 110, h: 28 })}</div>
            <div class="up-bar"><div class="meta" style="text-align:right;margin-bottom:3px">${int(p.sold)} / ${int(p.capacity)}</div><div class="bar-track"><div class="bar-fill" data-width="${share * 100}%"></div></div></div>
            <div class="num">${pct(share)}</div>
          </div>`;
        })
        .join("");
      growBars(box);
    }

    function cards(isRefresh) {
      const k = data.kpis;
      // A full day from the overnight refresh, not a running count.
      setStat(root, "k-sold", Math.round(k.soldToday * 4.2), int, isRefresh);
      setStat(root, "k-rev", Math.round(k.revenueToday * 4.2), money, isRefresh);
      setStat(root, "k-tonight", k.tonightPct * 100, (n) => n.toFixed(1) + "%", isRefresh);
      setStat(root, "k-30", k.next30Pct * 100, (n) => n.toFixed(1) + "%", isRefresh);
      setStat(root, "k-calls", k.callsAnswered, int, isRefresh);

      const tn = data.tonight;
      const open = tn.capacity - tn.sold - tn.comps - tn.holds;
      root.querySelector("#ring").innerHTML = ring((tn.sold + tn.comps) / tn.capacity, pct((tn.sold + tn.comps) / tn.capacity), "full");
      animateRings(root);
      root.querySelector("#tonight-kv").innerHTML = `
        <span>Sold</span><b>${int(tn.sold)}</b><span>Comps</span><b>${int(tn.comps)}</b>
        <span>Holds</span><b>${int(tn.holds)}</b><span>Open</span><b>${int(open)}</b>`;

      const shows = new Set(daily.watch.map((p) => p.title));
      const risk = new Set(daily.watch.filter((p) => p.status === "risk").map((p) => p.title));
      root.querySelector("#attn").innerHTML = `<span style="font-size:16px">⚑</span>
        <span><b>${shows.size} shows need attention</b> · ${risk.size} at risk. See why in Daily sales.</span><span style="margin-left:auto">→</span>`;

      const c = source.getCallCenterPlus();
      root.querySelector("#phones").innerHTML = `
        <span>Answered</span><b>${int(c.totals.answered)}</b>
        <span>Service level</span><b>${pct(c.totals.serviceLevel)}</b>
        <span>Abandon rate</span><b>${pct(c.totals.abandonRate, 1)}</b>
        <span>Sold by phone</span><b>${money(c.phone.revenue)}</b>`;
    }

    cards(false);
    upcoming();

    return {
      update() {
        data = source.getMorning();
        daily = source.getDailyReport();
        cards(true);
        upcoming();
      },
    };
  },
};
