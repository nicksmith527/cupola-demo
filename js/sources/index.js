// The swappable data layer.
//
// Views never fetch data themselves. They ask the active source for a
// ready-to-draw object (see docs/DATA-CONTRACT.md). Today the only source is
// "sample", which reads synthetic JSON from data/sample/. A future real source
// returns the same shapes, and no view has to change.

import { SampleSource } from "./sample.js";

const SOURCES = {
  sample: SampleSource,
  // tessitura: TessituraSource,   // future: lives behind a server, never in the browser
  // vivenu: VivenuSource,
};

export async function createSource(name) {
  const Source = SOURCES[name];
  if (!Source) throw new Error(`Unknown data source "${name}"`);
  const source = new Source();
  await source.init();
  return source;
}
