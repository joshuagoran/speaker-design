import { test } from "vite-plus/test";
import assert from "node:assert";
import { pistonDirectivity, waveguideDirectivity } from "../src/lib/acoustics/directivity";
import { close } from "./helpers";

const db = (x: number) => 20 * Math.log10(x);

test("directivity: pistons and waveguides are 0 dB on axis and fall off-axis as frequency rises", (t) => {
  close(t, pistonDirectivity(3000, 0.065, 0), 1, 1e-9);
  assert.ok(
    pistonDirectivity(3000, 0.065, 0.5) < pistonDirectivity(1000, 0.065, 0.5),
    'a 6.5" narrows with frequency',
  );
  close(
    t,
    db(waveguideDirectivity(10000, 90, 60, 10, 7, Math.PI / 4, 0)),
    -6,
    0.1,
    "−6 dB at the edge of a 90° waveguide",
  );
});
