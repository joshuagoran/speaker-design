import { test } from "vite-plus/test";
import assert from "node:assert";
import { closedBox, subSystem } from "../src/lib/acoustics/boxModels";
import { MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import type { SubSystemConfig } from "../src/types";
import { LR24_ORDERS } from "./helpers";

const mid = MID_OPTIONS.find((o) => o.id === "bc12ndl76") || MID_OPTIONS.find((o) => o.ts)!;

test("running a curve on past fmax leaves the usual points exactly where they were", () => {
  const a = closedBox(mid.ts, 40, 120, 2000, 20, LR24_ORDERS)!,
    b = closedBox(mid.ts, 40, 120, 2000, 20, { ...LR24_ORDERS, fTop: 5000 })!;
  assert.equal(a.curve.length, 420);
  assert.ok(b.curve.length > a.curve.length && b.curve[b.curve.length - 1].f >= 5000);
  a.curve.forEach((o, i) => assert.deepStrictEqual(b.curve[i], o));
  assert.equal(b.peakX, a.peakX);
  assert.equal(b.f3, a.f3);
});
test("sub: a crossover above 120 Hz runs the curve past 300 Hz for the skirt; limits unchanged", () => {
  const sub = SUB_OPTIONS.find((o) => o.id === "f18fh500")!;
  const sc: SubSystemConfig = {
    subBox: { w: 24, h: 30, d: 26 },
    midDims: { w: 15, h: 15, d: 15 },
    wall: 0.75,
    inset: 0.75,
    portStyle: "round2",
    cVent: { slotH: 3, nt: 2, dia: 4, throat: 2, len: 12 },
    hpf: 30,
    hpType: "BW24",
    ampW: 800,
    portMax: 20,
    layout: "stack",
  };
  const a = subSystem(sub, mid, sc),
    b = subSystem(sub, mid, { ...sc, xoLo: 250 }),
    c = subSystem(sub, mid, { ...sc, xoLo: 120 });
  assert.ok(a.mdl && b.mdl && c.mdl);
  assert.equal(a.mdl.curve.length, 420);
  assert.equal(c.mdl.curve.length, 420, "120 Hz and below: as before");
  assert.ok(b.mdl.curve[b.mdl.curve.length - 1].f >= 625);
  a.mdl.curve.forEach((o, i) => assert.deepStrictEqual(b.mdl?.curve[i], o));
  assert.deepStrictEqual(b.lim, a.lim);
});
