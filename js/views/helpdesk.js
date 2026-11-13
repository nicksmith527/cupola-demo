// Help desk: one status board for the issues that touch the guest
// experience or the business, wherever they're logged: IT tickets, ticketing
// vendor cases, website monitoring and house/facilities work orders.
//
// Not every ticket: the board lists open Sev 1–2 issues, plus Sev 3 issues
// that have aged past their target. The levels and that rule are settings.
// All issues here are synthetic and placed relative to today.

const DAY = 86400000, HOUR = 3600000;
const int = (n) => Math.round(n).toLocaleString("en-US");
const pct = (n) => Math.round(n * 100) + "%";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const SEVERITY = [
  { id: 1, label: "Sev 1 · Critical", short: "Sev 1", target: 4 * HOUR, targetLabel: "4 hours", desc: "Stops sales, a show or guest safety (ticketing or website down, fire system, no power)." },
  { id: 2, label: "Sev 2 · High", short: "Sev 2", target: 24 * HOUR, targetLabel: "1 day", desc: "Affects guests or revenue at the next performance (a broken seat in a sold row, a scanner failing, checkout slow)." },
  { id: 3, label: "Sev 3 · Medium", short: "Sev 3", target: 5 * DAY, targetLabel: "5 days", desc: "Workaround exists; fix before it touches a show (back-office printer, report errors)." },
  { id: 4, label: "Sev 4 · Low", short: "Sev 4", target: 10 * DAY, targetLabel: "10 days", desc: "Requests and cosmetic issues (new-hire setup, a scuffed wall)." },
];

const AREAS = {
  house: { label: "House & facilities", src: "Facilities work orders" },
  it: { label: "IT help desk", src: "IT service desk" },
  ticketing: { label: "Ticketing system", src: "Ticketing vendor support" },
  web: { label: "Website", src: "Web monitoring" },
};

// [area, sev, title, where, loggedHoursAgo, resolvedHoursAfterLogging|null, owner, note]
const ISSUES = [
  ["house", 2, "Seat won't lower (hinge broken)", "Main Hall · Orchestra Row B, Seat 123", 15, null, "Facilities", "Seat killed in ticketing until fixed, so it can't be sold."],
  ["ticketing", 2, "Scanner #4 dropping Wi-Fi", "North lobby entrance", 40, null, "IT + ticketing", "Spare scanner deployed for tonight."],
  ["web", 2, "Checkout slow on mobile (6s average)", "Website · checkout", 62, null, "Web agency", "Vendor case open; desktop unaffected."],
  ["house", 3, "Loge elevator intermittent", "Recital Hall · Loge level", 210, null, "Facilities", "Elevator vendor visit scheduled; ushers escorting guests to the lift."],
  ["ticketing", 3, "Sales report export times out", "Ticketing system · reports", 140, null, "Ticketing vendor", "Workaround: run in two date ranges."],
  ["it", 3, "Box office receipt printer jams", "Box office · window 2", 22, null, "IT", ""],
  ["it", 4, "New hire laptop setup (2)", "Development office", 52, null, "IT", ""],
  // Resolved in the last 30 days
  ["ticketing", 1, "Ticketing system outage (vendor)", "All sales channels", 16 * 24 + 3, 2.5, "Ticketing vendor", "Vendor-wide outage; box office sold on paper backup for 2.5 hours."],
  ["web", 1, "Website down (expired certificate)", "Website", 23 * 24, 1.2, "Web agency", "Certificate renewed; auto-renewal now monitored."],
  ["house", 2, "Restroom flooding", "Main Hall · house-left restroom", 9 * 24, 3, "Facilities", ""],
  ["house", 2, "Two seats loose", "Main Hall · Mezzanine Row D, Seats 14–15", 6 * 24, 31, "Facilities", ""],
  ["ticketing", 2, "Print-at-home tickets missing barcode", "Ticketing system · email templates", 12 * 24, 9, "Ticketing vendor", ""],
  ["it", 2, "Box office phones down", "Phone system", 20 * 24, 1.5, "IT", ""],
  ["house", 2, "Stage-left exit sign out", "Studio Theater", 4 * 24, 5, "Facilities", ""],
  ["web", 2, "Event page showing wrong date", "Website · Swan Lake page", 11 * 24, 2, "Marketing", ""],
  ["it", 3, "Wi-Fi slow in green room", "Main Hall backstage", 18 * 24, 70, "IT", ""],
  ["house", 3, "HVAC too warm in balcony", "Main Hall · Balcony", 14 * 24, 30, "Facilities", ""],
  ["ticketing", 3, "Subscriber seats not carrying over", "Ticketing system · renewals", 26 * 24, 140, "Ticketing vendor", ""],
  ["it", 3, "Shared drive permissions", "Finance", 10 * 24, 20, "IT", ""],
  ["house", 3, "Lobby carpet seam lifting", "Main lobby", 8 * 24, 90, "Facilities", ""],
  ["it", 3, "Email to donors bouncing", "Email platform", 5 * 24, 8, "IT", ""],
  ["web", 3, "Search not finding new shows", "Website · search", 15 * 24, 40, "Web agency", ""],
  ["it", 4, "Monitor replacement", "Marketing office", 22 * 24, 260, "IT", ""],
  ["house", 4, "Scuffed wall touch-up", "Recital Hall lobby", 19 * 24, 150, "Facilities", ""],
  ["it", 4, "Conference room display", "Board room", 13 * 24, 30, "IT", ""],
  ["ticketing", 4, "Add new price type", "Ticketing system", 7 * 24, 26, "Ticketing", ""],
  ["it", 4, "Software license request", "Education", 3 * 24, 20, "IT", ""],
  ["house", 4, "Dressing room light out", "Studio Theater · dressing room 2", 2 * 24, 6, "Facilities", ""],
];

// Who opened each issue and who's working it. Staff names are invented.
// Open issues: [opened by, role, assigned to | null, team]. Index matches ISSUES.
const OPEN_PEOPLE = [
  ["Dana Kim", "House manager", "Marcus Tate", "Facilities"],
  ["Rosa Delgado", "Front of house supervisor", "Jordan Lee", "IT"],
  ["Priya Shah", "Digital marketing", "Web agency (Ellis Digital)", "Vendor"],
  ["Tom Becker", "Usher captain", "Elevator vendor", "Vendor"],
  ["Alana Ruiz", "Ticketing systems", null, "Ticketing vendor queue"],
  ["Keisha Johnson", "Box office lead", null, "IT queue"],
  ["Laura Chen", "HR", "Jordan Lee", "IT"],
];
const OPENERS = {
  house: [["Dana Kim", "House manager"], ["Tom Becker", "Usher captain"], ["Ben Ortiz", "Production manager"]],
  it: [["Keisha Johnson", "Box office lead"], ["Laura Chen", "HR"], ["Sam Patel", "Development"]],
  ticketing: [["Alana Ruiz", "Ticketing systems"], ["Keisha Johnson", "Box office lead"]],
  web: [["Priya Shah", "Digital marketing"], ["Alana Ruiz", "Ticketing systems"]],
};
const FIXERS = { Facilities: ["Marcus Tate", "Facilities"], IT: ["Jordan Lee", "IT"], "Ticketing vendor": ["Vendor support", "Ticketing vendor"], "Web agency": ["Ellis Digital", "Web agency"], Marketing: ["Priya Shah", "Digital marketing"], Ticketing: ["Alana Ruiz", "Ticketing systems"], "IT + ticketing": ["Jordan Lee", "IT"] };

const SYSTEMS = [
  { name: "Ticketing system", status: "ok", uptime: 0.9963, note: "One vendor outage 16 days ago" },
  { name: "Website", status: "degraded", uptime: 0.9981, note: "Mobile checkout slow" },
  { name: "Payments", status: "ok", uptime: 0.9999, note: "" },
  { name: "Scanners", status: "degraded", uptime: 0.999, note: "1 of 12 devices on a spare" },
  { name: "Phone system", status: "ok", uptime: 0.9992, note: "" },
  { name: "Email and files", status: "ok", uptime: 0.9998, note: "" },
];

export function helpdeskData(today = new Date()) {
  const now = new Date(today);
  now.setHours(10, 0, 0, 0); // as of the 10:00 AM refresh
  const items = ISSUES.map(([area, sev, title, where, ago, fix, owner, note], i) => {
    const logged = new Date(now.getTime() - ago * HOUR - ((i * 37) % 53) * 60000);
    const resolved = fix === null ? null : new Date(logged.getTime() + fix * HOUR + ((i * 17) % 41) * 60000);
    const op = OPEN_PEOPLE[i];
    const pool = OPENERS[area];
    const opener = op ? [op[0], op[1]] : pool[i % pool.length];
    const assignee = op ? (op[2] ? [op[2], op[3]] : null) : FIXERS[owner] ?? [owner, owner];
    return { id: `HD-${4180 + i * 7}`, area, sev, title, where, logged, resolved, owner, note, opener, assignee, queue: op && !op[2] ? op[3] : null };
  });
  const open = items.filter((x) => !x.resolved);
  const s = (x) => SEVERITY[x.sev - 1];
  const onBoard = open.filter((x) => x.sev <= 2 || now - x.logged > s(x).target);
  const byMs = (ms) => (ms < DAY ? `${(ms / HOUR).toFixed(ms < 10 * HOUR ? 1 : 0)} h` : `${(ms / DAY).toFixed(1)} days`);
  const resolved = items.filter((x) => x.resolved);
  const ttr = SEVERITY.map((sv) => {
    const xs = resolved.filter((x) => x.sev === sv.id);
    const avg = xs.reduce((a, x) => a + (x.resolved - x.logged), 0) / Math.max(1, xs.length);
    const met = xs.filter((x) => x.resolved - x.logged <= sv.target).length / Math.max(1, xs.length);
    return { ...sv, count: xs.length, avg, avgLabel: xs.length ? byMs(avg) : "—", met };
  });
  return { now, items, open, onBoard, resolved, ttr, byMs, rate: resolved.length / items.length };
}

const initials = (n) => esc(n.replace(/\(.*\)/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase());
const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default {
  id: "helpdesk",
  label: "Help desk",
  mount(root, source) {
    const h = helpdeskData(source.today);
    let showAll = false, onlyUn = false;
    const sevCount = (n) => h.open.filter((x) => x.sev === n).length;
    const age = (x) => h.byMs(h.now - x.logged);
    const over = (x) => h.now - x.logged > SEVERITY[x.sev - 1].target;

    root.innerHTML = `
      <div class="view-head"><div>
        <h1>Help desk</h1>
        <p>IT, ticketing, website and house issues in one place · last 30 days · as of the ${esc(source.meta().asOfLabel)} refresh</p>
      </div></div>
      <section class="strip">
        <div class="stat"><div class="label">Issues logged</div><div class="value">${h.items.length}</div><div class="note">last 30 days</div></div>
        <div class="stat"><div class="label">Resolved</div><div class="value">${h.resolved.length}</div><div class="note">${pct(h.rate)} resolve rate</div></div>
        <div class="stat"><div class="label">Open</div><div class="value">${h.open.length}</div><div class="note">${sevCount(1)} critical · ${sevCount(2)} high · ${h.open.filter((x) => !x.assignee).length} unassigned</div></div>
        <div class="stat"><div class="label">Past target</div><div class="value">${h.open.filter(over).length}</div><div class="note">open longer than their severity allows</div></div>
        <div class="stat"><div class="label">High issues fixed in a day</div><div class="value">${pct(h.ttr[1].met)}</div><div class="note">Sev 2 target: ${SEVERITY[1].targetLabel}</div></div>
      </section>

      <div class="hd-systems">${SYSTEMS.map((s) => `<div class="hd-sys ${s.status}"><i></i><div><b>${esc(s.name)}</b><span>${s.status === "ok" ? "Operational" : "Degraded"} · ${(s.uptime * 100).toFixed(2)}% up (30 days)</span>${s.note ? `<em>${esc(s.note)}</em>` : ""}</div></div>`).join("")}</div>

      <div class="cols">
        <div class="card">
          <div class="card-head"><div><h2>Open issues that need visibility</h2><p class="sub" id="hd-rule"></p></div>
            <div class="hd-toggles"><label class="toggle"><input type="checkbox" id="hd-un"> Unassigned</label><label class="toggle"><input type="checkbox" id="hd-all"> All open</label></div></div>
          <div id="hd-open"></div>
        </div>
        <div class="stack">
          <div class="card"><h2>Resolved vs. logged</h2><p class="sub">By severity, last 30 days</p><div id="hd-sev"></div></div>
          <div class="card"><h2>Time to resolve</h2><p class="sub">Average vs. target, resolved issues</p><div id="hd-ttr"></div></div>
        </div>
      </div>

      <div class="card mt"><div class="card-head"><div><h2>Recently resolved</h2><p class="sub">Last 10, newest first</p></div></div><div id="hd-done"></div></div>

      <details class="card mt hd-levels"><summary>Severity levels and what reaches this board</summary>
        <div class="hd-levtable">${SEVERITY.map((s) => `<div><span class="sev s${s.id}">${s.short}</span><div><b>${esc(s.label.split(" · ")[1])} · target ${s.targetLabel}</b><p>${esc(s.desc)}</p></div></div>`).join("")}</div>
        <p class="sub" style="margin-top:10px">Each issue shows who opened it and who's working it, so anyone who can help knows who to contact. In a live setup the names link to email or Teams. The board shows open Sev 1 and Sev 2 issues, plus Sev 3 and 4 issues that are past their target. Each organization sets its own levels, targets and rule. Issues can come from wherever they're logged today, such as ServiceNow, Jira Service Management, Zendesk, Freshservice, a facilities work-order system, vendor support portals and website monitoring.</p>
      </details>`;

    const row = (x, done) => `<div class="hd-row ${done ? "done" : ""}">
      <span class="sev s${x.sev}">${SEVERITY[x.sev - 1].short}</span>
      <div class="hd-main"><b>${esc(x.title)}</b><div class="hd-meta">${esc(x.where)}</div>
        <div class="hd-meta">${esc(AREAS[x.area].label)} · ${x.id}</div>
        <div class="hd-people">
          <span class="hd-person"><i>${initials(x.opener[0])}</i><span><em>Opened by</em> ${esc(x.opener[0])} · ${esc(x.opener[1])}</span></span>
          ${done
            ? `<span class="hd-person"><i class="w">${initials(x.assignee[0])}</i><span><em>Resolved by</em> ${esc(x.assignee[0])} · ${esc(x.assignee[1])}</span></span>`
            : x.assignee
            ? `<span class="hd-person"><i class="w">${initials(x.assignee[0])}</i><span><em>Working it</em> ${esc(x.assignee[0])} · ${esc(x.assignee[1])}</span></span>`
            : `<span class="hd-person un"><i>?</i><span><em>Unassigned</em> waiting in the ${esc(x.queue)}</span></span>`}
        </div>
        ${x.note ? `<div class="hd-note">${esc(x.note)}</div>` : ""}</div>
      <div class="hd-when">${done
        ? `<span>Logged ${fmt(x.logged)}</span><span>Resolved ${fmt(x.resolved)}</span><b>${h.byMs(x.resolved - x.logged)}</b>`
        : `<span>Logged ${fmt(x.logged)}</span><b class="${over(x) ? "late" : ""}">Open ${age(x)}${over(x) ? " · past target" : ""}</b>`}</div>
    </div>`;

    function open() {
      const list = (showAll || onlyUn ? h.open : h.onBoard).filter((x) => !onlyUn || !x.assignee).slice().sort((a, b) => a.sev - b.sev || a.logged - b.logged);
      root.querySelector("#hd-rule").textContent = onlyUn ? `${list.length} open issues with no one assigned` : showAll ? `All ${h.open.length} open issues` : `Sev 1–2, plus anything past its target · ${list.length} of ${h.open.length} open`;
      root.querySelector("#hd-open").innerHTML = list.map((x) => row(x, false)).join("") || `<p class="sub">Nothing open at this level.</p>`;
    }
    root.querySelector("#hd-all").addEventListener("change", (e) => { showAll = e.target.checked; open(); });
    root.querySelector("#hd-un").addEventListener("change", (e) => { onlyUn = e.target.checked; open(); });
    open();

    root.querySelector("#hd-sev").innerHTML = SEVERITY.map((s) => {
      const all = h.items.filter((x) => x.sev === s.id), res = all.filter((x) => x.resolved);
      return `<div class="pr-bar"><div class="pr-bar-top"><span><span class="sev s${s.id}">${s.short}</span> ${int(res.length)} of ${int(all.length)} resolved</span><b>${pct(res.length / Math.max(1, all.length))}</b></div>
        <div class="pr-track"><i style="width:${(res.length / Math.max(1, all.length)) * 100}%"></i></div></div>`;
    }).join("") + Object.entries(AREAS).map(([k, a]) => {
      const all = h.items.filter((x) => x.area === k);
      return `<div class="hd-area"><span>${esc(a.label)}</span><b>${all.filter((x) => !x.resolved).length} open · ${all.length} logged</b></div>`;
    }).join("");

    root.querySelector("#hd-ttr").innerHTML = h.ttr.map((t) => `<div class="hd-area"><span><span class="sev s${t.id}">${t.short}</span> target ${t.targetLabel}</span><b>${t.avgLabel} avg · ${pct(t.met)} on time</b></div>`).join("");
    root.querySelector("#hd-done").innerHTML = h.resolved.slice().sort((a, b) => b.resolved - a.resolved).slice(0, 10).map((x) => row(x, true)).join("");
    return { update() {} };
  },
};
