import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  directivityAt,
  directivityGain,
  type CoveragePattern,
} from "../src/lib/acoustics/coverage";
import { close } from "./helpers";

const db = (x: number) => 20 * Math.log10(x);
/** A pattern's level at `th` radians off its axis across, at `f`, from a 20 in wide box. */
const gainAt = (pattern: CoveragePattern, f: number, th: number) =>
  directivityGain(directivityAt(pattern, f, 20), th, 0);
const horn90x60 = { horn: { covH: 90, covV: 60, wIn: 10, hIn: 7 } };

test("directivity: pistons and waveguides are 0 dB on axis and fall off-axis as frequency rises", (t) => {
  close(t, gainAt({ a: 0.065 }, 3000, 0), 1, 1e-9);
  assert.ok(
    gainAt({ a: 0.065 }, 3000, 0.5) < gainAt({ a: 0.065 }, 1000, 0.5),
    'a 6.5" narrows with frequency',
  );
  close(
    t,
    db(gainAt(horn90x60, 10000, Math.PI / 4)),
    -6,
    0.1,
    "−6 dB at the edge of a 90° waveguide",
  );
});
