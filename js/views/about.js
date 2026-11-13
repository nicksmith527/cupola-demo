// About Cupola: what it is, what this demo shows, and what else it can do.
// Reached from the ⋯ menu (#/about); not one of the dashboard tabs.

const WINDOWS = [
  { name: "Ticketing", demo: ["Snapshot", "Daily sales and the weekend recap", "Return-engagement pacing"], more: ["Exchanges and refunds", "Subscription renewals", "Inventory and holds by zone"] },
  { name: "Marketing", demo: ["County and ZIP from purchaser ZIP", "Audience (RFM) with list exports"], more: ["Campaign and email results next to sales", "Why people look but don't buy (web and cart data)", "Survey results by show"] },
  { name: "Development", demo: ["RFM lens for donors and ticket buyers who give"], more: ["Contributed revenue vs. goal by campaign", "Prospect lists from giving and buying patterns"] },
  { name: "Sponsorship sales", demo: [], more: ["Pipeline and fulfillment by sponsor", "Sponsor reach by show and audience"] },
  { name: "Operations · front of house", demo: ["House plan: zone triggers at 12, 8 and 4 weeks", "Last night's load-in from scans"], more: ["Parking, food and beverage per show", "Staffing against expected attendance"] },
  { name: "Box office · call center", demo: ["Calls by hour, agents, revenue by phone"], more: ["Staffing plans from call patterns", "Service-level alerts"] },
  { name: "Finance", demo: ["Budget: actual, committed and placeholders, with a forecast range"], more: ["Department-level budget owners", "Cash flow and reserves"] },
  { name: "Technology", demo: ["Help desk status board: IT, ticketing, website, house issues"], more: ["Vendor uptime and contract renewals", "Device inventory for scanners and box office"] },
];

const SOURCES = [
  ["Ticketing", "Tessitura, Ticketmaster, Paciolan, AudienceView, Spektrix, vivenu, PatronManager, OvationTix, Etix, Eventbrite, ShoWare and other ticketing platforms"],
  ["CRM and fundraising", "Salesforce, Raiser's Edge, SponsorCX"],
  ["Finance", "Blackbaud, NetSuite, Great Plains, Sage"],
  ["Web and surveys", "Google Analytics, Cloudflare, Qualtrics"],
  ["Phones", "Your phone system's call reports"],
  ["Help desk and facilities", "ServiceNow, Jira Service Management, Zendesk, Freshservice, work-order systems"],
  ["Everything else", "Spreadsheets and exports on shared drives"],
];

export default {
  id: "about",
  label: "About Cupola",
  hidden: true,
  mount(root) {
    root.innerHTML = `
      <div class="about">
        <section class="about-hero">
          <p class="about-kicker">About Cupola</p>
          <h1>See the whole venue from one vantage point.</h1>
          <p class="about-lede">Cupola puts the numbers every department checks in one place, from the systems you already run, refreshed on your schedule. It isn't a template. It's set up around how your organization works, one window at a time.</p>
          <p class="about-by">Cupola, powered by Smith DataWorks</p>
        </section>

        <section class="about-sec">
          <h2>Windows</h2>
          <p class="about-sub">Views grouped by the team that uses them. <span class="about-key demo">In this demo</span> <span class="about-key more">Possible next</span></p>
          <div class="about-grid">
            ${WINDOWS.map((w) => `<div class="about-card">
              <h3>${w.name}</h3>
              <ul>${w.demo.map((x) => `<li class="demo">${x}</li>`).join("")}${w.more.map((x) => `<li class="more">${x}</li>`).join("")}</ul>
            </div>`).join("")}
          </div>
        </section>

        <section class="about-sec" id="possibilities">
          <h2>Built on the systems you already have</h2>
          <p class="about-sub">Cupola pulls from any source with an API key or a data export, and combines them. Connections are set up per organization during discovery.</p>
          <div class="about-sources">${SOURCES.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join("")}</div>
        </section>

        <section class="about-sec">
          <h2>How it works</h2>
          <ol class="about-steps">
            <li><b>Discovery.</b> What each team needs to see, where that data lives today, and how fresh it has to be.</li>
            <li><b>Connect.</b> Cupola connects to your systems. Keys stay on the server, never in the browser.</li>
            <li><b>Refresh on your cadence.</b> Four times a day by default, fresher for the views that need it. Every screen says which refresh its numbers came from.</li>
            <li><b>Act on it.</b> Rules you set (a show falling behind, a zone that should open) can go to the right people by email or Teams at each checkpoint.</li>
          </ol>
        </section>

        <section class="about-sec">
          <h2>Privacy by design</h2>
          <p class="about-p">No customer names on screen. Segments, counties and ZIP codes export as constituent IDs, ready to load as a list in your CRM, where names and contact details already live.</p>
        </section>

        <section class="about-sec about-demo">
          <h2>About this demo</h2>
          <p class="about-p">Every venue, show, person and number here is invented. The Tampa Bay and Denver markets use real counties and ZIP codes with synthetic ticket counts. Exports download sample CSVs of made-up IDs.</p>
          <a class="about-cta" href="#/morning">Back to the dashboards →</a>
        </section>
      </div>`;
    const hash = location.hash.split("#").slice(2).join("");
    // The app scrolls to the top after mounting; jump to the anchor after that.
    if (hash) setTimeout(() => root.querySelector("#" + hash)?.scrollIntoView({ block: "start" }), 60);
    return { update() {} };
  },
};
