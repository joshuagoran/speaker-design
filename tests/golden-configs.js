// Configs for the regression snapshot: the saved seeds plus synthetic ones covering the options.
import fs from "node:fs";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES, CD_OPTIONS, HORN_OPTIONS } from "../tools/data.js";
import { subSystem, closedBox, hornResponse, ampV, nearest, midWeight, subWeight, boxL } from "../tools/calc.js";

const seeds = JSON.parse(fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url)));
const base = seeds.find((c) => c.name === "lil block stack LE (optimized)");
const synth = [
  { name: "synthetic: 1/2 walls, 1.5 inset", wall: 0.5, inset: 1.5 },
  { name: "synthetic: flush baffle", inset: 0 },
  { name: "synthetic: LR48 highpass", hpType: "LR48" },
  { name: "synthetic: slots", portStyle: "slots", cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 14 } },
  { name: "synthetic: folded", portStyle: "folded", cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 20 } },
  { name: "synthetic: vslots", portStyle: "vslots", cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 1.5, len: 14 } },
  { name: "synthetic: vslot1", portStyle: "vslot1", cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 14 } },
  { name: "synthetic: 4 round", portStyle: "round4", cVent: { slotH: 3, nt: 4, dia: 3, throat: 2, len: 12 } },
  { name: "synthetic: 15 in mid", mid: "bc15ndl76", mDim: { w: 18, h: 18, d: 16 } },
].map((o) => ({ ...base, ...o }));

export const configs = [...seeds, ...synth];

const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
export function evaluate(c) {
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub), mid = MID_OPTIONS.find((o) => o.id === c.mid) || MID_OPTIONS[0];
  const mDim = c.mDim || (MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box;
  const cfg = { subBox: c.cDim, midDims: mDim, wall: c.wall ?? 0.75, inset: c.inset ?? 0.75, portStyle: c.portStyle, cVent: c.cVent,
    hpf: c.hpf, hpType: c.hpType || "BW24", ampW: c.ampW || 800, portMax: c.portMax || 20, layout: c.layout || "stack" };
  const s = subSystem(sub, mid, cfg);
  const midGross = boxL(mDim.w, mDim.h, mDim.d, cfg.wall, cfg.inset);
  const mm = mid.ts ? closedBox(mid.ts, Math.max(5, midGross - (mid.ts.disp ?? (mid.size === 15 ? 4 : 2.5))) * 1.15, c.xoLo || 120, c.xoHi || 900, ampV(c.mAmpW || 400)) : null;
  const cd = CD_OPTIONS.find((o) => o.id === c.cd), horn = HORN_OPTIONS.find((o) => o.id === c.horn);
  const h = cd && horn ? hornResponse(cd.hf, horn.hf, c.xoHi || 900, c.hfAmpW || 100) : null;
  return {
    netL: r2(s.netL), Fb: r2(s.mdl && s.mdl.Fb), f3: r2(s.mdl && s.mdl.f3), ref: r2(s.mdl && s.mdl.ref),
    firstLimit: s.lim && s.lim.who, limitW: r2(s.lim && s.lim.W), spl35: r2(s.lim && s.lim.spl35), spl45: r2(s.lim && s.lim.spl45),
    midFc: r2(mm && mm.Fc), midQtc: r2(mm && mm.Qtc), midF3: r2(mm && mm.f3), midRef: r2(mm && mm.ref),
    hornFlat: r2(h && h.flat), subLb: r2(subWeight(cfg.subBox, cfg.wall, sub.lb)), midLb: r2(midWeight(mDim, cfg.wall)),
  };
}
