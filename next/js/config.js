// One place to change what the demo says about itself.
export const config = {
  // Product name shown in the header. Swap freely (e.g. "Cupola").
  brand: "Cupola",
  tagline: "Venue dashboards demo",

  // Which data source the app reads from. Only "sample" ships in this repo.
  // A real source (Tessitura, vivenu, ...) would implement the same contract;
  // see docs/DATA-CONTRACT.md.
  source: "sample",

  // Markets localize the County & ZIP view (real counties and ZIPs, synthetic
  // numbers). Pick one with ?market=tampa in the URL or the switcher in the header.
  markets: [
    { id: "", label: "Demo venue" },
    { id: "tampa", label: "Tampa Bay" },
    { id: "denver", label: "Denver" },
  ],

  // Real deployments refresh on the organization's own cadence (about 3-4 times
  // a day by default). The demo speeds that up so you can watch it happen.
  // Scheduled refreshes (the organization picks these). Cupola is not a live
  // feed: every view says which refresh its numbers came from.
  refreshTimes: ["6:00 AM", "10:00 AM", "2:00 PM", "6:00 PM"],
  realWorldCadenceLabel: "4x daily",
  demoRefreshSeconds: 45, // unused in this version

  // House plan: when to suggest opening or keeping closed an upper zone.
  // Checked at set points before each performance, not continuously.
  zonePlan: {
    checkpointsWeeks: [12, 8, 4],
    // Zones kept closed until demand calls for them, per hall.
    closedByDefault: { main: "Balcony", recital: "Loge" },
    // Open when projected demand fills this share of the seats below it.
    openAbove: 0.98,
    // Comfortably keep closed below this share.
    keepClosedBelow: 0.85,
  },

  // What counts as "in trouble" on the Daily sales report. Each venue sets its
  // own rules; turn one off with enabled: false or adjust its thresholds.
  flagRules: {
    // Sold to date vs. what similar shows (same genre) had sold by this many days out.
    pace: { enabled: true, behindBelow: 0.9, atRiskBelow: 0.8 },
    // Sales over the last 14 days vs. what similar shows usually sell in that window.
    recentSales: { enabled: true, days: 14, behindBelow: 0.75, atRiskBelow: 0.6, minExpected: 25 },
    // Shows entering the 12-week window while already flagged.
    crossing: { enabled: true, fromDays: 84, toDays: 98 },
    // Planned: media plan check (behind, with no marketing scheduled or no lift after it ran).
  },
};
