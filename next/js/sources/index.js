// The swappable data layer (see docs/DATA-CONTRACT.md). The alternative look
// adds a few derived methods in extras.js on top of the same sample source.

import { SampleSource } from "./sample.js";
import "./extras.js";

const SOURCES = {
  sample: SampleSource,
};

export async function createSource(name) {
  const Source = SOURCES[name];
  if (!Source) throw new Error(`Unknown data source "${name}"`);
  const source = new Source();
  await source.init();
  return source;
}
