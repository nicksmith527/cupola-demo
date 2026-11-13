# Data contract

Every data source (the demo's `SampleSource` today, a real API-backed source later) implements these methods. Views call only these, so swapping sources never touches a view.

> **Security note for real sources:** API keys and customer data never go in this repo or in browser code. A real source calls *your own* small backend, which holds the keys and returns these already-aggregated shapes (no names, no card data).

## Lifecycle

| Method | Purpose |
|---|---|
| `async init()` | Load or connect. Called once at startup. |
| `meta()` | `{ venueName, asOf: Date, tick, synthetic: boolean }` |
| `tick()` | Pull the next refresh. The sample source simulates new activity; a real source would re-fetch. |

## `getMorning()`

```js
{
  kpis: { soldToday, revenueToday, lastBatch, tonightPct, next30Pct, callsAnswered },
  tonight: Performance,
  upcoming: Performance[],           // next ~8, soonest first
  seatMaps: Performance[]            // up to 6 to browse: tonight, then the next show of each other title
}
```

`Performance`:

```js
{ id, title, genre, hallId, hall: Hall, date: Date, daysOut, time,
  capacity, sold, comps, holds, avgPrice, revenueGoal }
```

`Hall`: `{ id, name, capacity, sections: [{ name, rows, seatsPerRow, curve? }] }` (`curve` = how much rows arc around the stage; 0 = straight)

## `getPacing()`

```js
{
  title, genre, performances, runCapacity, onSaleDays,
  firstPerformanceDate: Date,
  currentLabel,                                   // e.g. "2026 visit"
  current: { daysOut, curve: [{ daysOut, sold }], today: { daysOut, sold } },
  priorVisits: [{ label, yearsAgo, curve: [{ daysOut, sold }] }]
}
```

Curves are cumulative tickets sold, keyed by days before the first performance.

## `getAudience()`

```js
{
  asOfWindowMonths,
  grid: [{ r: 1-5, f: 1-5, households, avgSpend }],      // 25 cells
  segments: [{ name, description, action, households, revenue, avgSpend }]
}
```

Segment level only. No customer names or IDs.

## `getGeography()`

```js
{
  seasonLabel, note,
  counties: [{ county, tickets, revenue, zips: [{ zip, tickets, households, revenue }] }]
}
```

## `getCallCenter()`

```js
{
  serviceLevelTargetSec, agentsScheduled,
  allHours: number[],                 // every hour of the business day (24h clock)
  peakOffered,                        // for a stable chart scale
  hours: [{ hour, offered, answered, abandoned, avgWaitSec, avgHandleSec }],  // hours so far
  totals: { offered, answered, abandoned, abandonRate, avgWaitSec, serviceLevel },
  topReasons: [{ reason, share }]
}
```
