// Sales recap: a pop-up for looking past "yesterday". Pick yesterday, the
// last weekend (Fri–Sun), 7 or 14 days, or any range up to 8 weeks, and see
// what each day finished at, the show reports for performances in the range,
// what sold, and how it compares with the period before.
//
// The daily history is synthetic and seeded, so it's the same on every visit.
// Yesterday matches the Snapshot tiles. In a real deployment these rows come
// from the ticketing system's daily close.

const DAY = 86400000;
const HISTORY_DAYS = 56;
const SETTLE_DAYS = 3; // the last few days can still move (exchanges, late scans)

const int = (n) => Math.round(n).toLocaleString("en-US");
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const moneyK = (n) => (n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e4 ? "$" + Math.round(n / 1e3) + "K" : money(n));
const pct = (n) => Math.round(n * 100) + "%";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dShort = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const dTiny = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const signed = (x) => (x >= 0 ? "▲ " : "▼ ") + Math.abs(x * 100).toFixed(0) + "%";

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Shows that played before the season sample starts, for older days.
const PAST = [
  { title: "Riverside Symphony: Opening Night", genre: "Classical", hallId: "main", cap: 2000, price: 68 },
  { title: "Jazz at the Riverfront", genre: "Concert", hallId: "recital", cap: 700, price: 52 },
  { title: "Comedy Night: Open Tab", genre: "Comedy", hallId: "studio", cap: 300, price: 35 },
  { title: "Autumn Dance Showcase", genre: "Dance", hallId: "main", cap: 2000, price: 58 },
  { title: "Family Matinee: Robots!", genre: "Family", hallId: "recital", cap: 700, price: 24 },
  { title: "The Glass Orchard (a new play)", genre: "Play", hallId: "studio", cap: 300, price: 42 },
  { title: "Big Band Halloween Bash", genre: "Concert", hallId: "main", cap: 2000, price: 61 },
];

function buildHistory(source) {
  if (source._recap) return source._recap;
  const r = rng(20261113);
  const today = new Date(source.today);
  const yesterdayTickets = Math.round(source.todaySold * 4.2);
  const yesterdayRevenue = Math.round(source.todayRevenue * 4.2);
  const calls = source.getCallCenter().totals.answered;
  const dowF = [0.72, 1.28, 1.1, 1.0, 0.96, 0.9, 0.78]; // Sun..Sat (Monday on-sales)
  const real = source.performances.filter((p) => p.daysOut < 0);
  const hall = (id) => source.venue.halls.find((h) => h.id === id);

  const days = [];
  for (let k = HISTORY_DAYS; k >= 1; k--) {
    const date = new Date(today.getTime() - k * DAY);
    const dow = date.getDay();
    let tickets = Math.round(1380 * dowF[dow] * (0.82 + r() * 0.36) * (1 + (HISTORY_DAYS - k) * 0.004));
    let revenue = Math.round(tickets * (66 + r() * 14));
    let callsAns = Math.round(calls * dowF[dow] * (0.85 + r() * 0.3) * (dow === 0 ? 0.35 : dow === 6 ? 0.6 : 1));
    if (k === 1) { tickets = yesterdayTickets; revenue = yesterdayRevenue; callsAns = calls; }
    const web = Math.round(tickets * (0.62 + r() * 0.1));
    const phone = Math.round(tickets * (0.14 + r() * 0.05));
    // Performances that played this day: the real recap rows, older ones invented.
    let perfs = real.filter((p) => p.daysOut === -k).map((p) => ({
      title: p.title, genre: p.genre, hall: hall(p.hallId).name, time: p.time, cap: p.capacity,
      sold: p.sold, comps: p.comps, scanned: p.scanned, revenue: p.sold * p.avgPrice, goal: p.revenueGoal,
    }));
    if (k > 4) {
      const n = dow === 5 || dow === 6 ? 2 : dow === 4 || dow === 0 ? 1 : r() < 0.3 ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const s = PAST[Math.floor(r() * PAST.length)];
        const sold = Math.round(s.cap * (0.58 + r() * 0.38));
        const comps = Math.round(s.cap * 0.02);
        perfs.push({
          title: s.title, genre: s.genre, hall: hall(s.hallId).name, time: dow === 0 && i === 0 ? "2:00 PM" : i ? "8:00 PM" : "7:30 PM",
          cap: s.cap, sold, comps, scanned: Math.round((sold + comps) * (0.88 + r() * 0.08)),
          revenue: sold * s.price, goal: s.cap * 0.85 * s.price,
        });
      }
    }
    days.push({ date, k, tickets, revenue, web, phone, box: tickets - web - phone, calls: callsAns, perfs, settling: k <= SETTLE_DAYS });
  }

  // Where period sales went: upcoming titles weighted by recent selling.
  const titles = new Map();
  for (const p of source.performances.filter((p) => p.daysOut >= 0)) {
    const t = titles.get(p.title) ?? { title: p.title, genre: p.genre, w: 0, price: p.avgPrice };
    t.w += Math.max(4, p.sold14);
    titles.set(p.title, t);
  }
  source._recap = { days, titles: [...titles.values()], today };
  return source._recap;
}

function presets(today) {
  const y = new Date(today.getTime() - DAY);
  // Most recent completed Fri–Sun.
  const back = (today.getDay() + 7) % 7 || 7; // days back to last Sunday (if today is Sunday, the one before)
  const sun = new Date(today.getTime() - back * DAY);
  const fri = new Date(sun.getTime() - 2 * DAY);
  return [
    { id: "yesterday", label: "Yesterday", from: y, to: y },
    { id: "weekend", label: `Weekend · ${dTiny(fri)}–${dTiny(sun)}`, from: fri, to: sun },
    { id: "7", label: "Last 7 days", from: new Date(today.getTime() - 7 * DAY), to: y },
    { id: "14", label: "Last 14 days", from: new Date(today.getTime() - 14 * DAY), to: y },
    { id: "custom", label: "Custom" },
  ];
}

function sum(days) {
  const s = { tickets: 0, revenue: 0, web: 0, phone: 0, box: 0, calls: 0, perfs: [] };
  for (const d of days) {
    for (const k of ["tickets", "revenue", "web", "phone", "box", "calls"]) s[k] += d[k];
    s.perfs.push(...d.perfs.map((p) => ({ ...p, date: d.date, settling: d.settling })));
  }
  return s;
}

function chart(days) {
  const W = 640, H = 150, M = { l: 8, r: 8, t: 18, b: 22 };
  const max = Math.max(...days.map((d) => d.tickets), 1);
  const bw = (W - M.l - M.r) / days.length;
  const bars = days
    .map((d, i) => {
      const h = (d.tickets / max) * (H - M.t - M.b);
      const x = M.l + i * bw;
      const wk = d.date.getDay() === 5 || d.date.getDay() === 6 || d.date.getDay() === 0;
      const lab = days.length <= 16 ? `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="pr-ax">${days.length <= 8 ? d.date.toLocaleDateString("en-US", { weekday: "short" }) : d.date.getDate()}</text>` : "";
      const val = days.length <= 8 ? `<text x="${x + bw / 2}" y="${H - M.b - h - 5}" text-anchor="middle" class="pr-val">${int(d.tickets)}</text>` : "";
      const bwid = Math.min(bw * 0.72, 64);
      return `<rect x="${x + (bw - bwid) / 2}" y="${H - M.b - h}" width="${bwid}" height="${h}" rx="3" fill="${wk ? "#1c5cab" : "#7fb0ee"}" ${d.settling ? 'fill-opacity=".55"' : ""}><title>${dShort(d.date)}: ${int(d.tickets)} tickets, ${money(d.revenue)}</title></rect>${val}${lab}`;
    })
    .join("");
  return `<svg class="pr-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tickets by day">${bars}</svg>`;
}

let open = null;

export function openRecap(source, presetId) {
  if (open) open.remove();
  const h = buildHistory(source);
  const P = presets(h.today);
  const minDate = h.days[0].date, maxDate = h.days.at(-1).date;
  let sel = P.find((p) => p.id === presetId) ?? (h.today.getDay() === 1 ? P[1] : P[0]);
  let custom = { from: P[2].from, to: P[2].to };

  const wrap = document.createElement("div");
  wrap.className = "pr-backdrop";
  wrap.innerHTML = `
    <div class="pr-modal" role="dialog" aria-modal="true" aria-labelledby="pr-title">
      <div class="pr-head">
        <div><h2 id="pr-title">Sales recap</h2><p class="pr-sub" id="pr-sub"></p></div>
        <button type="button" class="pr-close" aria-label="Close">✕</button>
      </div>
      <div class="pr-tabs" role="tablist">${P.map((p) => `<button type="button" role="tab" data-p="${p.id}">${esc(p.label)}</button>`).join("")}</div>
      <div class="pr-custom" hidden>
        <label>From <input type="date" id="pr-from" min="${iso(minDate)}" max="${iso(maxDate)}"></label>
        <label>To <input type="date" id="pr-to" min="${iso(minDate)}" max="${iso(maxDate)}"></label>
      </div>
      <div class="pr-body" id="pr-body"></div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("pr-lock");
  open = wrap;

  const close = () => {
    wrap.remove();
    document.body.classList.remove("pr-lock");
    open = null;
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("hashchange", close);
  };
  const onKey = (e) => e.key === "Escape" && close();
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", close);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  wrap.querySelector(".pr-close").addEventListener("click", close);

  const $ = (s) => wrap.querySelector(s);
  $("#pr-from").value = iso(custom.from);
  $("#pr-to").value = iso(custom.to);

  function render() {
    wrap.querySelectorAll(".pr-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.p === sel.id)));
    $(".pr-custom").hidden = sel.id !== "custom";
    const from = sel.id === "custom" ? custom.from : sel.from;
    const to = sel.id === "custom" ? custom.to : sel.to;
    const inRange = (d) => d.date >= from && d.date <= to;
    const days = h.days.filter(inRange);
    if (!days.length) { $("#pr-body").innerHTML = `<p class="pr-sub">No days in that range.</p>`; return; }
    const n = days.length;
    const prevDays = h.days.filter((d) => d.date < from).slice(-n);
    const s = sum(days), pv = prevDays.length === n ? sum(prevDays) : null;
    const settling = days.some((d) => d.settling);
    $("#pr-sub").textContent = `${n === 1 ? dShort(from) : `${dShort(from)} – ${dShort(to)} · ${n} days`}${settling ? " · last 3 days still settling" : " · final"}`;

    // What sold: split the period's tickets across upcoming titles.
    const r = rng(from.getTime() / DAY + n);
    const wsum = h.titles.reduce((a, t) => a + t.w, 0);
    const sold = h.titles
      .map((t) => { const q = Math.round((s.tickets * 0.82 * t.w * (0.7 + r() * 0.6)) / wsum); return { ...t, q, rev: q * t.price }; })
      .sort((a, b) => b.q - a.q)
      .slice(0, 8);
    const maxQ = Math.max(...sold.map((t) => t.q), 1);

    const vs = (a, b) => (pv ? `<span class="pr-vs ${a >= b ? "up" : "down"}">${signed(a / Math.max(1, b) - 1)} vs prior ${n === 1 ? "day" : n + " days"}</span>` : "");
    const playedCap = s.perfs.reduce((a, p) => a + p.sold + p.comps, 0);
    const playedIn = s.perfs.reduce((a, p) => a + p.scanned, 0);

    $("#pr-body").innerHTML = `
      <div class="pr-stats">
        <div><span>Tickets sold</span><b>${int(s.tickets)}</b>${vs(s.tickets, pv?.tickets)}</div>
        <div><span>Revenue</span><b>${moneyK(s.revenue)}</b>${vs(s.revenue, pv?.revenue)}</div>
        <div><span>${n === 1 ? "Average ticket" : "Per day"}</span><b>${n === 1 ? money(s.revenue / Math.max(1, s.tickets)) : int(s.tickets / n)}</b><span class="pr-vs">${n === 1 ? "all channels" : moneyK(s.revenue / n) + " a day"}</span></div>
        <div><span>Calls answered</span><b>${int(s.calls)}</b>${vs(s.calls, pv?.calls)}</div>
        <div><span>Performances</span><b>${s.perfs.length}</b><span class="pr-vs">${s.perfs.length ? `${int(playedIn)} guests · ${pct(playedIn / Math.max(1, playedCap))} attended` : "none played"}</span></div>
      </div>

      ${n > 1 ? `<div class="pr-card"><h3>Tickets by day <span class="pr-note">darker = Fri–Sun${settling ? " · faded = still settling" : ""}</span></h3>${chart(days)}</div>` : ""}

      <div class="pr-card"><h3>${n === 1 ? "How the day finished" : "What each day finished at"}</h3>
        <div class="pr-table-wrap"><table class="pr-table">
          <thead><tr><th>Day</th><th class="r">Tickets</th><th class="r">Revenue</th><th class="r pr-ch">Web</th><th class="r pr-ch">Phone</th><th class="r pr-ch">Box office</th><th class="r">Calls</th><th>On stage</th></tr></thead>
          <tbody>${days.slice().reverse().map((d) => `<tr>
            <td><b>${dShort(d.date)}</b>${d.settling ? ` <span class="pr-pill">settling</span>` : ""}</td>
            <td class="r">${int(d.tickets)}</td><td class="r">${money(d.revenue)}</td>
            <td class="r pr-ch">${int(d.web)}</td><td class="r pr-ch">${int(d.phone)}</td><td class="r pr-ch">${int(d.box)}</td>
            <td class="r">${int(d.calls)}</td>
            <td class="pr-stage">${d.perfs.length ? d.perfs.map((p) => esc(p.title)).join("<br>") : '<span class="pr-muted">dark</span>'}</td></tr>`).join("")}
          </tbody>
          ${n > 1 ? `<tfoot><tr><td>Total</td><td class="r">${int(s.tickets)}</td><td class="r">${money(s.revenue)}</td><td class="r pr-ch">${int(s.web)}</td><td class="r pr-ch">${int(s.phone)}</td><td class="r pr-ch">${int(s.box)}</td><td class="r">${int(s.calls)}</td><td></td></tr></tfoot>` : ""}
        </table></div>
      </div>

      <div class="pr-cols">
        <div class="pr-card"><h3>Show reports <span class="pr-note">performances in this range</span></h3>
          ${s.perfs.length ? s.perfs.slice().reverse().map((p) => `<div class="pr-show">
            <div class="pr-show-top"><div><b>${esc(p.title)}</b><div class="pr-muted">${dShort(p.date)} · ${esc(p.time)} · ${esc(p.hall)}</div></div>
              <span class="pr-pill ${p.settling ? "" : "final"}">${p.settling ? "settling" : "final"}</span></div>
            <div class="pr-kv">
              <span>Sold</span><b>${int(p.sold)} / ${int(p.cap)} (${pct(p.sold / p.cap)})</b>
              <span>Attended</span><b>${int(p.scanned)} (${pct(p.scanned / (p.sold + p.comps))} of ticketed)</b>
              <span>Revenue</span><b>${money(p.revenue)} · ${pct(p.revenue / p.goal)} of goal</b>
            </div></div>`).join("") : `<p class="pr-muted">No performances in this range.</p>`}
        </div>
        <div class="pr-card"><h3>What sold <span class="pr-note">tickets bought in this range, by show</span></h3>
          ${sold.map((t) => `<div class="pr-bar"><div class="pr-bar-top"><span>${esc(t.title)}</span><b>${int(t.q)}</b></div><div class="pr-track"><i style="width:${(t.q / maxQ) * 100}%"></i></div></div>`).join("")}
        </div>
      </div>
      <p class="pr-foot">Each day's totals are the ticketing system's close for that day. The most recent ${SETTLE_DAYS} days can still change with exchanges, refunds and late scans. All numbers in this demo are synthetic.</p>`;
  }

  wrap.querySelector(".pr-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-p]");
    if (!b) return;
    sel = P.find((p) => p.id === b.dataset.p);
    render();
  });
  wrap.querySelector(".pr-custom").addEventListener("change", () => {
    const f = new Date($("#pr-from").value + "T00:00:00"), t = new Date($("#pr-to").value + "T00:00:00");
    if (!isNaN(f) && !isNaN(t)) custom = f <= t ? { from: f, to: t } : { from: t, to: f };
    render();
  });

  render();
  wrap.querySelector(".pr-close").focus();
}

// A small link for a tile or card: "Weekend & more ›" (on Mondays, "Weekend recap ›").
export function recapLink(today = new Date()) {
  const monday = today.getDay() === 1;
  return `<button type="button" class="pr-link" data-recap="weekend">${monday ? "Weekend recap ›" : "Weekend & more ›"}</button>`;
}

// Wire every recap link inside root.
export function bindRecap(root, source) {
  root.addEventListener("click", (e) => {
    const b = e.target.closest(".pr-link");
    if (b) openRecap(source, b.dataset.recap || b.dataset.preset || undefined);
  });
}
