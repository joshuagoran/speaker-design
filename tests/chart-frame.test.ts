// The charts share one frame and one text style (src/components/charts/chartFrame.tsx): no chart file sets its own text
// size or weight, the frequency charts take their plot margins from the frame, and a frequency sits at the same x on the
// response, maximum output and dispersion charts.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ResponseChart } from "../src/components/charts/ResponseChart";
import { DispersionMap } from "../src/components/charts/DispersionMap";
import { dispersionGrid } from "../src/lib/acoustics/directivity";
import {
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
  HIFI_BOT,
  HIFI_TOP,
} from "../src/constants/chartScales";

const CHARTS_DIR = path.join(import.meta.dirname, "../src/components/charts");
const chartFiles = readdirSync(CHARTS_DIR)
  .filter((f) => f.endsWith(".tsx") && f !== "chartFrame.tsx")
  .map((f) => ({ name: f, source: readFileSync(path.join(CHARTS_DIR, f), "utf8") }));

test("no chart file sets its own text size or weight", () => {
  // a literal: fontSize="12", fontSize={11}, fontSize: 11, fontWeight="600", fontWeight={600}
  const literal = /font(Size|Weight)\s*(=\s*["{]\s*\d|:\s*\d)/;
  for (const { name, source } of chartFiles)
    assert.ok(!literal.test(source), `${name} sets a text size or weight; use chartFrame's`);
});

test("the frequency charts take their plot margins from the shared frame", () => {
  // a margin literal: L = 40, R: narrow ? 8 : 14, and the like
  const margin = /\b[LRTB]\s*[=:]\s*(narrow\s*\?\s*)?\d/;
  for (const { name, source } of chartFiles.filter((f) => /FrequencyAxis|plotFrame/.test(f.source)))
    assert.ok(!margin.test(source), `${name} sets a plot margin; use plotFrame`);
});

/** The x of a chart's "1k" tick label, px. */
function oneKilohertzX(html: string): number {
  const m = html.match(/<text x="([\d.]+)"[^>]*>1k<\/text>/);
  assert.ok(m, "a 1k tick label");
  return Number(m[1]);
}

test("1 kHz sits at the same x on the response and dispersion charts", () => {
  const response = renderToString(
    createElement(ResponseChart, {
      series: [],
      fmin: FREQ_AXIS_MIN_HZ,
      fmax: FREQ_AXIS_MAX_HZ,
      top: HIFI_TOP,
      bot: HIFI_BOT,
    }),
  );
  const grid = dispersionGrid();
  const dispersion = renderToString(
    createElement(DispersionMap, {
      map: { ...grid, rows: grid.angles.map(() => grid.freqs.map(() => 0)), crossovers: [1000] },
      title: "Map",
    }),
  );
  const x = oneKilohertzX(dispersion);
  assert.strictEqual(x, oneKilohertzX(response));
  // the map's own marks sit on its axis: a 1 kHz crossover line is drawn at the 1k tick
  const crossover = [...dispersion.matchAll(/<line x1="([\d.]+)" x2="\1"[^>]*stroke-width="3"/g)];
  assert.ok(crossover.length > 0, "a crossover line");
  assert.ok(
    Math.abs(Number(crossover[0][1]) - x) < 0.01,
    `crossover at ${crossover[0][1]}, tick at ${x}`,
  );
});
