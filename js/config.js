// One place to change what the demo says about itself.
export const config = {
  // Product name shown in the header. Swap freely (e.g. "Cupola").
  brand: "Cupola",
  tagline: "Venue dashboards demo",

  // Which data source the app reads from. Only "sample" ships in this repo.
  // A real source (Tessitura, vivenu, ...) would implement the same contract;
  // see docs/DATA-CONTRACT.md.
  source: "sample",

  // Real deployments refresh on the organization's own cadence (about 3-4 times
  // a day by default). The demo speeds that up so you can watch it happen.
  demoRefreshSeconds: 45,
  realWorldCadenceLabel: "4x daily",
};
