# Cupola: Venue Dashboards Demo

An interactive, animated demo of Cupola venue analytics dashboards. It's plain HTML, CSS and JavaScript, with no build step and no dependencies, and it runs on GitHub Pages.

> **All data is synthetic.** The venue, halls, titles, ZIP codes, counties and every number are invented by a seeded generator. No real organization's data is in this repo.

## What's in the demo

| View | What it shows |
|---|---|
| **Morning snapshot** | Today's sales and revenue, a seat map you can page through (tonight, then upcoming shows in three different halls) filling in seat by seat, and how the next shows are selling |
| **Daily sales** | A short recap of the last few days (marked as settling), then today forward: the next 30 rows by default, or 14 days, 30 days, or the whole season. Any show that trips a flag rule is pinned in **Needs attention** however far out it is, with the reason shown (pace vs. similar shows, last-14-day sales vs. expected), and flagged shows crossing the 12-week mark are tagged. The rules and thresholds live in `flagRules` in `js/config.js`. |
| **Return engagement** | A returning title's sales pace laid over its two previous visits, lined up by days before opening |
| **Audience (RFM)** | Households scored on recency and frequency, with segments and suggested next actions. No names. |
| **County & ZIP** | Tickets and revenue by county (derived from ZIP), drilling into the ZIPs behind each county |
| **Call center** | Today's phone activity by hour: answered, abandoned, wait times, and why people call |

Two things make it feel live:

- **Relative dates.** The data stores "days out" rather than calendar dates, so whenever you open it, tonight is tonight.
- **Simulated refreshes.** Real deployments refresh on the organization's own schedule (about 4 times a day). The demo speeds that up to every 45 seconds: new sales arrive, tiles count up, seats pop in, and another hour of calls fills in. **Refresh now** triggers one on demand.

## Run it locally

Browsers block `fetch()` from a file opened straight from disk, so serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(`npx serve` or the VS Code "Live Server" extension work too.)

## Publish on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, **Branch** to `main`, and folder to `/ (root)`. Save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

The repo can stay **private** and the site can still be public on paid GitHub plans. On a free plan, Pages needs a public repo.

## Install it like an app

The site is an installable web app (it has a manifest, app icons and an offline fallback):

- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).
- **Mac / Windows (Chrome or Edge):** the install icon at the right end of the address bar, or menu → **Install Cupola**.
- **Mac (Safari):** File → **Add to Dock**.

It then opens full-screen with the Cupola icon and no browser bars. When the link is texted or emailed, `og-image.png` is the preview card people see.

## How it's put together

```
index.html                 app shell (icons, manifest and link-preview tags live here)
manifest.webmanifest       app name, icon and colors for "install" / "add to home screen"
sw.js                      offline fallback for the installed app
icons/                     app icon (SVG source + PNG sizes)
og-image.png               link-preview image
css/styles.css             all styling and animation
js/
  config.js                brand name, data source, refresh speed
  app.js                   nav, routing, refresh loop
  sources/
    index.js               picks the data source
    sample.js              reads data/sample/*.json, applies dates, simulates refreshes
  views/                   one file per dashboard
  ui/                      count-up, tooltips, formatting
data/sample/*.json         synthetic data (generated)
scripts/
  generate-sample-data.mjs builds the synthetic data from a fixed seed
docs/DATA-CONTRACT.md      the shapes every data source must return
```

**The important seam is `js/sources/`.** Views never fetch data. They ask the active source for a ready-to-draw object. The demo's source reads JSON files. A real source (Tessitura, vivenu, ...) would return the same shapes from an API, and no view would need to change. See [docs/DATA-CONTRACT.md](docs/DATA-CONTRACT.md).

## Common changes

- **Rename the product:** edit `brand` in `js/config.js`.
- **Change the refresh speed:** `demoRefreshSeconds` in `js/config.js`.
- **New story / new numbers:** edit `scripts/generate-sample-data.mjs` (or just change `SEED`), then run
  `node scripts/generate-sample-data.mjs` and commit the regenerated `data/sample/` files.
- **Add a view:** copy a file in `js/views/`, add any data it needs to the source and the contract, and register it in `VIEWS` in `js/app.js`.

## Notes

- Colors come from a palette checked for color-vision deficiency on a light background. Every chart has a legend or direct labels, so color never carries meaning alone.
- Animations respect the operating system's "reduce motion" setting.
- Layouts adapt to phone screens.
