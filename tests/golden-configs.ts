// Configs for the regression snapshot: the saved seeds plus synthetic ones covering the options.
import fs from "node:fs";
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES, CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import {
  subSystem,
  midSystem,
  fillSystem,
  subThroughLowpass,
  hornResponse,
  nearestPoint,
  midWeightLb,
  subWeightLb,
} from "../src/lib/pa/calc";
import { FILL_OPTIONS } from "../src/lib/data";
import type {
  Dims3,
  FillBoxType,
  FillPort,
  PaOptimizerCurrent,
  SubSystemConfig,
} from "../src/types";

/** A PA design to evaluate: a saved seed, which can lack the fields an older save didn't have. */
export type GoldenConfig = PaOptimizerCurrent & { name: string };
/** What an evaluation returns: rounded numbers, a limit name, a flag; null where the model is missing. */
export type GoldenValues = Record<string, number | string | boolean | null | undefined>;

// boundary: the seed file is saved configurations, as the planner stores them
const seeds = JSON.parse(
  fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
) as GoldenConfig[];
const base = seeds.find((c) => c.name === "lil block stack LE (optimized)")!;
const synth = (
  [
    { name: "synthetic: 1/2 walls, 1.5 inset", wall: 0.5, inset: 1.5 },
    { name: "synthetic: flush baffle", inset: 0 },
    { name: "synthetic: LR48 highpass", hpType: "LR48" },
    {
      name: "synthetic: slots",
      portStyle: "slots",
      cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 14 },
    },
    {
      name: "synthetic: folded",
      portStyle: "folded",
      cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 20 },
    },
    {
      name: "synthetic: vslots",
      portStyle: "vslots",
      cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 1.5, len: 14 },
    },
    {
      name: "synthetic: vslot1",
      portStyle: "vslot1",
      cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 14 },
    },
    {
      name: "synthetic: 4 round",
      portStyle: "round4",
      cVent: { slotH: 3, nt: 4, dia: 3, throat: 2, len: 12 },
    },
    { name: "synthetic: 15 in mid", mid: "bc15ndl76", mDim: { w: 18, h: 18, d: 16 } },
  ] satisfies (Partial<GoldenConfig> & { name: string })[]
).map((o) => ({ ...base, ...o }));

export const configs = [...seeds, ...synth];

const r2 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 100) / 100);
export function evaluate(c: GoldenConfig): GoldenValues {
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub)!,
    mid = MID_OPTIONS.find((o) => o.id === c.mid) || MID_OPTIONS[0];
  const mDim = c.mDim || (MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box;
  const cfg: SubSystemConfig & { inset: number } = {
    subBox: c.cDim,
    midDims: mDim,
    wall: c.wall ?? 0.75,
    inset: c.inset ?? 0.75,
    portStyle: c.portStyle,
    cVent: c.cVent,
    hpf: c.hpf,
    hpType: c.hpType || "BW24",
    ampW: c.ampW || 800,
    portMax: c.portMax || 20,
    layout: c.layout || "stack",
  };
  const s = subSystem(sub, mid, cfg);
  const xoLo = c.xoLo || 120;
  const ms = midSystem(mid, {
    midDims: mDim,
    wall: cfg.wall,
    inset: cfg.inset,
    xoLo,
    xoHi: c.xoHi || 900,
    mAmpW: c.mAmpW || 400,
  });
  const mm = ms.mdl;
  const sxo = s.mdl
    ? nearestPoint(subThroughLowpass(s.mdl, sub.ts, s.AMP_V, cfg.portMax, xoLo), xoLo).spl
    : null;
  const cd = CD_OPTIONS.find((o) => o.id === c.cd),
    horn = HORN_OPTIONS.find((o) => o.id === c.horn);
  const h = cd && horn ? hornResponse(cd.hf, horn.hf!, c.xoHi || 900, c.hfAmpW || 100) : null;
  return {
    netL: r2(s.netL),
    Fb: r2(s.mdl && s.mdl.Fb),
    f3: r2(s.mdl && s.mdl.f3),
    ref: r2(s.mdl && s.mdl.ref),
    firstLimit: s.lim && s.lim.who,
    limitW: r2(s.lim && s.lim.W),
    spl35: r2(s.lim && s.lim.spl35),
    spl45: r2(s.lim && s.lim.spl45),
    midFc: r2(mm && mm.Fc),
    midQtc: r2(mm && mm.Qtc),
    midF3: r2(mm && mm.f3),
    midRef: r2(mm && mm.ref),
    midMaxXo: r2(mm && nearestPoint(ms.max!, xoLo).spl),
    midMax300: r2(mm && nearestPoint(ms.max!, 300).spl),
    subAtXo: r2(sxo),
    hornFlat: r2(h && h.flat),
    subLb: r2(subWeightLb(cfg.subBox, cfg.wall, sub.lb)),
    midLb: r2(midWeightLb(mDim, cfg.wall)),
  };
}

// Fills page: each coax in its default box, vented and sealed, plus a small port that hits the speed limit.
export interface FillGoldenConfig {
  name: string;
  drv: string;
  boxType: FillBoxType;
  port?: FillPort;
  dim?: Dims3;
  hp?: number;
  ampW?: number;
  portMax?: number;
}
export const fillConfigs: FillGoldenConfig[] = [
  ...FILL_OPTIONS.filter((d) => d.ts).map((d) => ({
    name: `fill: ${d.id} vented`,
    drv: d.id,
    boxType: "vented" as const,
  })),
  ...FILL_OPTIONS.filter((d) => d.ts).map((d) => ({
    name: `fill: ${d.id} sealed`,
    drv: d.id,
    boxType: "sealed" as const,
  })),
  {
    name: "fill: bc10cxn64 small port",
    drv: "bc10cxn64",
    boxType: "vented",
    port: { n: 1, dia: 1.5, len: 2 },
  },
];
export function evaluateFill(c: FillGoldenConfig): GoldenValues {
  const drv = FILL_OPTIONS.find((d) => d.id === c.drv)!;
  const f = fillSystem(drv, {
    boxType: c.boxType,
    dim: c.dim || { w: 11.5, h: 16, d: 11 },
    port: c.port || { n: 1, dia: 3, len: 4 },
    hp: c.hp || 70,
    ampW: c.ampW || 300,
    portMax: c.portMax || 20,
  });
  return {
    net: r2(f.net),
    Fb: r2(f.vM && f.vM.Fb),
    Qtc: r2(f.sM && f.sM.Qtc),
    f3: r2(f.f3),
    sens: r2(f.sens),
    max60: r2(nearestPoint(f.max, 60).spl),
    max100: r2(nearestPoint(f.max, 100).spl),
    who100: nearestPoint(f.max, 100).who,
    pad: r2(f.pad),
    hfLimW: r2(f.hfLimW),
    lb: r2(f.lb),
    portLimited: f.portLimited,
  };
}
