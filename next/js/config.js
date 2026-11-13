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
  demoRefreshSeconds: 45,
  realWorldCadenceLabel: "4x daily",

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
