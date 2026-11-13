// House manager's show report, as a pop-up. Opens from the Snapshot's
// "Last night" card, the Sales recap and the House plan. Every detail is
// synthetic and seeded by the performance, so the same show always reads
// the same. In a real deployment this is the house manager's filed report
// joined to ticketing and scan data.

const int = (n) => Math.round(n).toLocaleString("en-US");
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const pct = (n) => Math.round(n * 100) + "%";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hash = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const mins = (t) => { const m = /(\d+):(\d+)\s*(AM|PM)/i.exec(t || "7:30 PM"); return ((+m[1] % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + +m[2]; };
const clock = (m) => { const h = Math.floor(m / 60) % 24, mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

const NOTES = [
  { kind: "Guest services", text: "Late seating held at the back of house until the first scene change ({late} guests)." },
  { kind: "Guest services", text: "Two seating conflicts (duplicate seats) resolved by the box office; guests moved to equal or better seats." },
  { kind: "Accessibility", text: "{ald} assistive listening devices issued, all returned. {wc} wheelchair transfers assisted." },
  { kind: "Concessions", text: "Bar line ran long at intermission. Consider opening the second station for shows this size." },
  { kind: "Facilities", text: "House-left restroom sink reported dripping; work order submitted." },
  { kind: "Lost and found", text: "{lost} items logged (glasses, a scarf). Held at the box office." },
  { kind: "Medical", text: "One guest felt faint during the first act; assisted by staff, declined EMS, left with family." },
  { kind: "Production", text: "Sound check ran over; doors opened {doorLate} minutes late." },
  { kind: "Security", text: "Bag check ran smoothly; no prohibited items held." },
];

export function openShowReport(p) {
  const r = rng(hash(p.title + (p.date?.toDateString?.() ?? "")));
  const ticketed = p.sold + (p.comps || 0);
  const scanned = p.scanned ?? Math.round(ticketed * 0.9);
  const curtain = mins(p.time);
  const doorLate = r() < 0.3 ? 4 + Math.floor(r() * 6) : 0;
  const hold = Math.floor(r() * 7);
  const hasInt = !/studio/i.test(p.hall) || r() < 0.3;
  const act1 = 48 + Math.floor(r() * 22);
  const intLen = hasInt ? 18 + Math.floor(r() * 6) : 0;
  const act2 = hasInt ? 38 + Math.floor(r() * 20) : 0;
  const up = curtain + hold;
  const down = up + act1 + intLen + act2;
  const late = Math.round(scanned * (0.04 + r() * 0.05));
  const fill = { late, ald: 2 + Math.floor(r() * 6), wc: Math.floor(r() * 4), lost: 2 + Math.floor(r() * 3), doorLate };
  const notes = NOTES.filter((n) => (n.text.includes("{doorLate}") ? doorLate > 0 : true))
    .map((n) => ({ ...n, s: r() }))
    .sort((a, b) => a.s - b.s)
    .slice(0, 3 + Math.floor(r() * 2))
    .map((n) => ({ ...n, text: n.text.replace(/\{(\w+)\}/g, (_, k) => fill[k]) }));
  const ushers = Math.max(4, Math.round(ticketed / 110));
  const fbPerCap = 6 + r() * 9;
  const merch = /Broadway|Concert|Family/.test(p.genre || "") ? Math.round(scanned * (1 + r() * 2.5)) : Math.round(scanned * r() * 0.6);
  const doorOpen = curtain - 60 + doorLate;

  const wrap = document.createElement("div");
  wrap.className = "pr-backdrop";
  wrap.innerHTML = `
    <div class="pr-modal sr-modal" role="dialog" aria-modal="true" aria-labelledby="sr-title">
      <div class="pr-head">
        <div><p class="sr-kicker">House manager's report</p><h2 id="sr-title">${esc(p.title)}</h2>
          <p class="pr-sub">${p.date ? p.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : ""} · ${esc(p.time)} · ${esc(p.hall)}</p></div>
        <div class="sr-head-r"><span class="pr-pill ${p.settling ? "" : "final"}">${p.settling ? "filed · settling" : "final"}</span>
          <button type="button" class="pr-close" aria-label="Close">✕</button></div>
      </div>
      <div class="pr-body">
        <div class="pr-stats">
          <div><span>Ticketed</span><b>${int(ticketed)}</b><span class="pr-vs">${int(p.sold)} sold · ${int(p.comps || 0)} comps</span></div>
          <div><span>Scanned in</span><b>${int(scanned)}</b><span class="pr-vs">${pct(scanned / Math.max(1, ticketed))} of ticketed</span></div>
          <div><span>No-shows</span><b>${int(ticketed - scanned)}</b><span class="pr-vs">${pct(1 - scanned / Math.max(1, ticketed))}</span></div>
          <div><span>Late seating</span><b>${int(late)}</b><span class="pr-vs">after curtain</span></div>
          <div><span>Run time</span><b>${Math.floor((down - up) / 60)}h ${String((down - up) % 60).padStart(2, "0")}m</b><span class="pr-vs">${hasInt ? "with intermission" : "no intermission"}</span></div>
        </div>

        <div class="pr-cols">
          <div class="pr-card"><h3>Running times</h3>
            <div class="sr-times">
              <div><span>House open</span><b>${clock(doorOpen)}</b>${doorLate ? `<em>${doorLate} min late</em>` : ""}</div>
              <div><span>Curtain up</span><b>${clock(up)}</b>${hold ? `<em>${hold} min hold</em>` : `<em class="ok">on time</em>`}</div>
              ${hasInt ? `<div><span>Intermission</span><b>${clock(up + act1)} – ${clock(up + act1 + intLen)}</b><em>${intLen} min</em></div>` : ""}
              <div><span>Curtain down</span><b>${clock(down)}</b></div>
              <div><span>House clear</span><b>${clock(down + 22 + Math.floor(r() * 10))}</b></div>
            </div>
          </div>
          <div class="pr-card"><h3>Front of house</h3>
            <div class="pr-kv">
              <span>Ushers</span><b>${ushers} scheduled · ${ushers - (r() < 0.3 ? 1 : 0)} worked</b>
              <span>Assistive listening</span><b>${fill.ald} issued</b>
              <span>Wheelchair assists</span><b>${fill.wc}</b>
              <span>Food &amp; beverage</span><b>${money(scanned * fbPerCap)} · ${money(fbPerCap)} per guest</b>
              <span>Merchandise</span><b>${money(merch)}</b>
              <span>Ticket revenue</span><b>${money(p.revenue)}${p.goal ? ` · ${pct(p.revenue / p.goal)} of goal` : ""}</b>
            </div>
          </div>
        </div>

        <div class="pr-card"><h3>Incidents and notes</h3>
          <div class="sr-notes">${notes.map((n) => `<div><span class="sr-tag">${esc(n.kind)}</span><p>${esc(n.text)}</p></div>`).join("")}</div>
        </div>
        <p class="pr-foot">Filed by the house manager after the show and combined with ticketing and scan data. In this demo every detail is synthetic.</p>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("pr-lock");
  const close = () => {
    wrap.remove();
    if (!document.querySelector(".pr-backdrop")) document.body.classList.remove("pr-lock");
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.querySelector(".pr-close").addEventListener("click", close);
  wrap.querySelector(".pr-close").focus();
}

// Turn a sample-source performance into the report's shape.
export function fromPerf(p, hallName) {
  return {
    title: p.title, genre: p.genre, hall: hallName ?? p.hall?.name ?? "", time: p.time, date: p.date,
    sold: p.sold, comps: p.comps, scanned: p.scanned, revenue: p.sold * p.avgPrice, goal: p.revenueGoal,
    settling: p.daysOut > -4,
  };
}
