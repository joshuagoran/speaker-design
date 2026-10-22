// The PA designs many tests run: the saved seeds plus synthetic ones covering the options.
import { PORT_STYLE } from "../src/constants/portStyles";
import fs from "node:fs";
import { SEED_NAMES } from "./seeds";
import { B15 } from "../src/lib/data";
import type { PaOptimizerCurrent } from "../src/types";

/** A saved or synthetic PA design: a saved seed can lack the fields an older save didn't have. */
export type PaConfig = PaOptimizerCurrent & { name: string };

// boundary: the seed file is saved PA configurations, as the app stores them
const seeds = JSON.parse(
  fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
) as PaConfig[];
// the seed file always holds this seed (tests/seeds.ts names it)
const base = seeds.find((c) => c.name === SEED_NAMES.lilBlockOptimized)!;
/** The synthetic design on the 15 in mid (tests/stack-response gives its sum its own limit). */
export const FIFTEEN_MID_CASE = "synthetic: 15 in mid";
const synth = (
  [
    { name: "synthetic: 1/2 walls, 1.5 inset", wall: 0.5, inset: 1.5 },
    { name: "synthetic: flush baffle", inset: 0 },
    { name: "synthetic: LR48 highpass", hpType: "LR48" },
    {
      name: "synthetic: slots",
      portStyle: PORT_STYLE.slot,
      cVent: { slotH: 3, nt: 2, dia: 3.5, throat: 2, len: 12 },
    },
    {
      name: "synthetic: slots, folded",
      portStyle: PORT_STYLE.slot,
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
    { name: FIFTEEN_MID_CASE, mid: "bc15ndl76", mDim: { w: 18, h: 18, d: 16 } },
  ] satisfies (Partial<PaConfig> & { name: string })[]
).map((o) => ({ ...base, ...o }));

export const configs = [...seeds, ...synth];

// every seed saves the b15 mid box, so midBoxOf needs no other box
const otherBox = configs.find((c) => c.midBox && c.midBox !== B15.id);
if (otherBox) throw new Error(`${otherBox.name} saves mid box ${otherBox.midBox}`);
/** A design's mid box, outer inches: its own size, or the b15 box when an older save has none. */
export const midBoxOf = (c: Partial<Pick<PaConfig, "mDim" | "midBox">>) => c.mDim ?? B15.box;
