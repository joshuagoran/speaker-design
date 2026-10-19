// The bracing around the hardware (no rib or window brace over a handle's, the dish's or the posts' recess, so a panel
// with a handle still takes its ribs beside it), and each bracing style giving its own braces, as the 3D view draws them.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { midBoxBracing, subBoxBracing } from "../src/lib/acoustics/boxModels";
import { DEFAULT_PA } from "../src/lib/defaults";
import { SUB_OPTIONS, MID_OPTIONS } from "../src/lib/data";
import { configs, midBoxOf } from "./pa-configs";
import type { BoxBracing, BraceStyleId } from "../src/types";

const STYLES: readonly BraceStyleId[] = ["window", "ribs", "both"];
/** Every default design: the saved seeds, the synthetic designs, and the default PA design. */
const designs = [
  ...configs,
  {
    name: "default PA",
    sub: DEFAULT_PA.sub.id,
    mid: DEFAULT_PA.mid.id,
    horn: DEFAULT_PA.horn.id,
    midBox: DEFAULT_PA.midBox.id,
    portStyle: DEFAULT_PA.portStyle,
    cDim: DEFAULT_PA.cDim,
    cVent: DEFAULT_PA.cVent,
    mDim: DEFAULT_PA.mDim,
    wall: DEFAULT_PA.wall,
    inset: DEFAULT_PA.inset,
    layout: DEFAULT_PA.layout,
  },
];
const partsOf = (c: (typeof designs)[number]) => ({
  sub: SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0],
  mid: MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0],
  mDim: midBoxOf(c),
  wall: c.wall ?? 0.75,
  inset: c.inset ?? 0.75,
  layout: c.layout ?? "stack",
});

/** The window braces and the ribs of a plan, counted. */
const windowsOf = (b: BoxBracing) => b.windows.x.length + b.windows.y.length + b.windows.z.length;

test("each bracing style gives only its own braces: ribs under Ribs, frames under Window braces", () => {
  for (const c of designs) {
    const { sub, mid, mDim, wall, inset, layout } = partsOf(c);
    for (const hw of [undefined, DEFAULT_PA.hardware]) {
      const plans = (style: BraceStyleId) => [
        subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, sub, style, hw?.sub),
        midBoxBracing(mDim, wall, inset, mid, layout, style, hw?.mid),
      ];
      const byStyle = Object.fromEntries(STYLES.map((s) => [s, plans(s)]));
      STYLES.forEach((style) =>
        byStyle[style].forEach((b, i) => {
          if (!b) return;
          const tag = `${c.name}, ${style}, ${i ? "mid" : "sub"}${hw ? ", hardware" : ""}`;
          assert.strictEqual(b.style, style, tag);
          if (style === "window") assert.deepStrictEqual(b.ribs, [], tag);
          if (style === "ribs") assert.strictEqual(windowsOf(b), 0, tag);
          if (style === "both") {
            // never leaves the baffle lower than Ribs does: it takes the frames the baffle needs before any rib
            const hz = (x: BoxBracing | null) => x?.panels.find((p) => p.id === "baffle")?.hz ?? 0;
            assert.ok(hz(b) >= hz(byStyle.ribs[i]) - 1e-6, `${tag}: baffle ${hz(b).toFixed(0)} Hz`);
          }
        }),
      );
    }
  }
});

test("the driver's weight hangs on the baffle's cutout: the rectangle sub's baffle reads far lower with it", () => {
  const c = configs.find((x) => x.name === "rectangle sub");
  assert.ok(c, "the seed is there");
  const { sub, wall, inset } = partsOf(c);
  const baffle = (lb: number, style: BraceStyleId) =>
    subBoxBracing(c.cDim, wall, inset, c.portStyle, c.cVent, { ...sub, lb }, style).panels.find(
      (p) => p.id === "baffle",
    );
  for (const style of STYLES) {
    const light = baffle(0, style),
      heavy = baffle(sub.lb, style);
    assert.ok(light && heavy, style);
    // its 19.8 lb driver: the bare baffle at about half (106 Hz against 200), and no higher braced
    assert.ok(
      heavy.bareHz < 0.6 * light.bareHz,
      `${style}: ${heavy.bareHz.toFixed(0)} Hz, ${light.bareHz.toFixed(0)} Hz without the weight`,
    );
    assert.ok(heavy.hz <= light.hz + 1e-9, `${style}: braced ${heavy.hz.toFixed(0)} Hz`);
  }
});
