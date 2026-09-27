import test from "node:test";
import { fillSystem, boxModel, closedBox, ampV, thermalV, STUFF, nearest } from "../tools/calc.js";
import { FILL_OPTIONS } from "../tools/data.js";
import { close, rel, massLineSPL, db } from "./helpers.js";

const drv = FILL_OPTIONS.find((o) => o.id === "bc10cxn64");
const base = { boxType: "vented", dim: { w: 11.5, h: 16, d: 11 }, port: { n: 1, dia: 3, len: 4 }, hp: 70, ampW: 300, portMax: 20 };

test("fills volume: 1/2 in walls, less driver and port, sealed stuffed", (t) => {
  const v = fillSystem(drv, base);
  close(t, v.gross, (10.5 * 15 * 10 * 16.387) / 1000, 1e-9);
  const pVol = (Math.PI * 1.5 ** 2 * 4 * 16.387) / 1000;
  close(t, v.net, v.gross - 1.5 - pVol, 1e-9);   // 10 in driver, disp unpublished -> 1.5 L
  close(t, v.eff, v.net, 1e-12);
  const s = fillSystem(drv, { ...base, boxType: "sealed" });
  close(t, s.net, s.gross - 1.5, 1e-9);
  close(t, s.eff, s.net * STUFF, 1e-9);
});
test("fills sensitivity at 2.83 V = mass line (independent), both box types", (t) => {
  for (const boxType of ["vented", "sealed"]) close(t, fillSystem(drv, { ...base, boxType }).sens, massLineSPL(drv.ts, 2.83), 0.01, boxType);
});
test("fills sensitivity does not depend on the highpass or the amp", (t) => {
  const a = fillSystem(drv, base).sens;
  close(t, fillSystem(drv, { ...base, hp: 100 }).sens, a, 1e-9);
  close(t, fillSystem(drv, { ...base, ampW: 1000 }).sens, a, 1e-9);
});
test("fills f3 includes the highpass: raising the highpass raises f3", (t) => {
  for (const boxType of ["vented", "sealed"]) {
    const lo = fillSystem(drv, { ...base, boxType, hp: 40 }).f3, hi = fillSystem(drv, { ...base, boxType, hp: 120 }).f3;
    t.assert.ok(hi > lo && hi >= 110, `${boxType}: ${lo} -> ${hi}`);
  }
});
test("fills model calls match the planner's box models", (t) => {
  const v = fillSystem(drv, base), V = ampV(300);
  const m = boxModel(drv.ts, v.eff, v.pArea, 4, 70, V, "LR24", { nPorts: 1 });
  close(t, v.vM.Fb, m.Fb, 1e-12);
  const s = fillSystem(drv, { ...base, boxType: "sealed" });
  close(t, s.sM.Qtc, closedBox(drv.ts, s.eff, 70, null, V).Qtc, 1e-12);
});
test("fills max curve stops at 300 Hz and respects every limit", (t) => {
  const v = fillSystem(drv, base);
  t.assert.ok(v.max.every((o) => o.f <= 300));
  for (const o of v.max) {
    const c = nearest(v.vM.curve, o.f), s = 10 ** ((o.spl - c.spl) / 20);
    t.assert.ok(c.xmm * s <= drv.ts.Xmax * (1 + 1e-9) && c.vel * s <= 20 * (1 + 1e-9) && v.V * s <= thermalV(drv.ts.aes) * (1 + 1e-9));
  }
});
test("fills: a small port is port-limited, a big one isn't", (t) => {
  t.assert.equal(fillSystem(drv, { ...base, port: { n: 1, dia: 1.5, len: 2 }, ampW: 1000 }).portLimited, true);
  t.assert.equal(fillSystem(drv, { ...base, boxType: "sealed" }).portLimited, false);
});
test("fills HF: limit through the pad = 2 x AES x (Z/8) x 10^(pad/10); pad from lfSens", (t) => {
  const v = fillSystem(drv, base);
  close(t, v.pad, drv.hf.sens - drv.lfSens, 1e-12);
  close(t, v.hfLimW, 2 * drv.hf.aes * (drv.hf.imp / 8) * 10 ** (v.pad / 10), 1e-9);
  // behaviour: at that amp power the HF sees exactly its program rating
  const hfW = (v.hfLimW * 8 / drv.hf.imp) * 10 ** (-v.pad / 10);
  close(t, hfW, 2 * drv.hf.aes, 1e-9);
});
test("fills weight: 1/2 in birch shell at 1.6 lb/ft2 + driver + 1 lb", (t) => {
  const v = fillSystem(drv, base);
  close(t, v.lb, (2 * (11.5 * 16 + 11.5 * 11 + 16 * 11) / 144) * 1.6 + drv.lb + 1, 1e-9);
});
