import { test } from "vite-plus/test";
import assert from "node:assert";
import { subChips, midChips, hornChips, fillChips } from "../src/lib/pa/chips";
import type {
  Chip,
  ChipId,
  ChipSeverity,
  Dims2,
  FillChipsInput,
  HornChipsInput,
  MidChipsInput,
  SubChipsInput,
  VentSpec,
} from "../src/types";
import { chipList, chipOf, findChip } from "./helpers";

const kindOf = <I extends ChipId>(F: Chip<I>[], id: NoInfer<I>) => findChip(F, id)?.[0];
/** whether the check's chip shows, at `kind` when one is given */
const has = <I extends ChipId>(
  t: unknown,
  F: Chip<I>[],
  id: NoInfer<I>,
  yes = true,
  kind?: ChipSeverity,
) => assert.equal(!!findChip(F, id, kind), yes, `${id}${kind ? ` (${kind})` : ""}: ${chipList(F)}`);

// ---- sub ----
const subBase: SubChipsInput = {
  subSize: 18,
  subBox: { w: 24, h: 30, d: 22 },
  portStyle: "slots",
  cVent: { slotH: 3, nt: 2, len: 14, throat: 2, dia: 4 }, // nt: subChips ignores it
  PT: 0.75,
  subLbLoaded: 110,
  lim: { who: "amplifier power", W: 800 },
  peakXF: 40,
  aes: 1000,
  ampW: 800,
};
type SubOverrides = Partial<Omit<SubChipsInput, "cVent">> & { cVent?: Partial<VentSpec> };
const sub = (o: SubOverrides) =>
  subChips({ ...subBase, ...o, cVent: { ...subBase.cVent, ...o.cVent } });
test("sub: 125 lb line", (t) => {
  assert.equal(kindOf(sub({ subLbLoaded: 125 }), "subWeight"), "ok");
  assert.equal(kindOf(sub({ subLbLoaded: 125.1 }), "subWeight"), "warn");
});
test("sub: driver fit needs size + 1.9 in after the vents", (t) => {
  // letterbox: clear height = h - slotH - PT; 18 + 1.9 = 19.9
  has(t, sub({ subBox: { w: 24, h: 19.9 + 3.75, d: 22 } }), "subDriverFit", false);
  has(t, sub({ subBox: { w: 24, h: 19.8 + 3.75, d: 22 } }), "subDriverFit");
  // two side ducts: clear width = w - 2 (throat + 0.43 + PT)
  const w = 19.9 + 2 * (2 + 0.43 + 0.75);
  has(t, sub({ portStyle: "vslots", subBox: { w, h: 30, d: 22 } }), "subDriverFit", false);
  has(t, sub({ portStyle: "vslots", subBox: { w: w - 0.1, h: 30, d: 22 } }), "subDriverFit");
});
test("sub: duct fit per layout, with the folded hint", (t) => {
  // straight slot holds d - PT - slotH = 22 - 0.75 - 3 = 18.25
  has(t, sub({ cVent: { len: 18.25 } }), "subDuctFit", false);
  const F = sub({ cVent: { len: 18.5 } });
  has(t, F, "subDuctFit");
  assert.ok(chipOf(F, "subDuctFit")[2].includes("Switch to Bottom, folded."));
  // side ducts hold d - PT - throat = 19.25
  has(t, sub({ portStyle: "vslots", cVent: { len: 19.25 } }), "subDuctFit", false);
  has(t, sub({ portStyle: "vslots", cVent: { len: 19.5 } }), "subDuctFit");
  // round tubes hold d - 0.75 - 2 PT - dia/2 = 22 - 0.75 - 1.5 - 2 = 17.75
  has(t, sub({ portStyle: "round2", cVent: { len: 17.75 } }), "subDuctFit", false);
  has(t, sub({ portStyle: "round2", cVent: { len: 18 } }), "subDuctFit");
});
test("sub: first-limit chip follows lim.who", (t) => {
  assert.equal(kindOf(sub({ lim: { who: "port air speed", W: 400 } }), "subPortLimited"), "warn");
  assert.equal(
    kindOf(sub({ lim: { who: "cone travel (Xmax)", W: 400 } }), "subExcursionLimited"),
    "warn",
  );
  assert.equal(kindOf(sub({ lim: { who: "amplifier power", W: 800 } }), "subAmpLimited"), "warn");
  assert.equal(
    kindOf(sub({ lim: { who: "driver program rating", W: 2000 } }), "subThermalLimited"),
    "ok",
  );
});

// ---- mid ----
const ts = { Xmax: 8, aes: 400 };
const midBase: MidChipsInput = {
  midSize: 12,
  midDims: { w: 15, h: 15, d: 15 },
  Qtc: 0.65,
  f3: 90,
  peakX: 4,
  xoLo: 120,
  ts,
  V: Math.sqrt(400 * 8),
  useV: Math.sqrt(400 * 8),
  vTherm: Math.sqrt(800 * 8),
  mAmpW: 400,
  subMusicAtXo: 120,
  tilt: 6,
  midAtXo: { spl: 115, who: "amp" },
};
const mid = (o: Partial<MidChipsInput>) => midChips({ ...midBase, ...o });
test("mid: Qtc bands 0.5 and 0.8", (t) => {
  for (const [q, k] of [
    [0.49, "warn"],
    [0.5, "ok"],
    [0.8, "ok"],
    [0.81, "warn"],
  ] as const)
    assert.equal(kindOf(mid({ Qtc: q }), "midQtc"), k, `Qtc ${q}`);
});
test("mid: driver fit needs size + 1.2 in", (t) => {
  has(t, mid({ midDims: { w: 13.2, h: 15, d: 15 } }), "midDriverFit", false);
  has(t, mid({ midDims: { w: 13.1, h: 15, d: 15 } }), "midDriverFit");
});
test("mid: rolls off above the crossover only when F3 > xoLo", (t) => {
  has(t, mid({ f3: 120 }), "midRollOff", false);
  has(t, mid({ f3: 121 }), "midRollOff");
});
test("mid: excursion at 100 % of Xmax is the line", (t) => {
  has(t, mid({ peakX: 8 }), "midExcursionLimited", false);
  has(t, mid({ peakX: 8.01 }), "midExcursionLimited");
  // below Xmax: thermal if the program rating is below the amp, else amp
  assert.equal(kindOf(mid({ vTherm: 10 }), "midThermalLimited"), "ok");
  assert.equal(kindOf(mid({}), "midAmpLimited"), "ok");
});
test("mid vs sub: -0.5 dB gap is the line; amp advice only while under 2 x AES", (t) => {
  // need = 120 - 6 = 114
  // "ok" keeps up with the sub, "warn" runs out first
  assert.equal(kindOf(mid({ midAtXo: { spl: 113.5, who: "amp" } }), "midKeepsUp"), "ok");
  const F = mid({ midAtXo: { spl: 113.4, who: "amp" } });
  assert.equal(kindOf(F, "midKeepsUp"), "warn");
  assert.match(chipOf(F, "midKeepsUp")[2], /W per mid channel would cover it/);
  const G = mid({ midAtXo: { spl: 100, who: "amp" } }); // needs far more than 800 W
  assert.equal(kindOf(G, "midKeepsUp"), "warn");
  assert.match(chipOf(G, "midKeepsUp")[2], /More amp won't get there/);
  has(t, mid({ subMusicAtXo: null }), "midKeepsUp", false);
});

// ---- horn ----
const hornBase: HornChipsInput = {
  hf: { minXo: 1000, aes: 50, aesXo: 1200 },
  hz: { minXo: 800, lowHz: 600, covH: 90 },
  horn: { name: "Test horn", size: { w: 18 } },
  xoHi: 1200,
  hornModel: { who: "amp", pAmp: 50, imp: 8, pProg: 100, derate: 1 },
  hfAmpW: 50,
  midAtXoHi: 118,
  hfTilt: 6,
  hornAtXo: 115,
  midBeam: 90,
  fK: 1000,
};
const horn = (o: Partial<HornChipsInput>) =>
  hornChips({ ...hornBase, ...o, hz: { ...hornBase.hz, ...o.hz } });
test("horn: driver and horn minimum crossovers", (t) => {
  has(t, horn({ xoHi: 1000 }), "hornDriverMinXo", false);
  has(t, horn({ xoHi: 999 }), "hornDriverMinXo");
  has(t, horn({ xoHi: 800 }), "hornMinXo", false);
  has(t, horn({ xoHi: 799 }), "hornMinXo");
});
test("horn: loading limit within 80 % of the crossover", (t) => {
  has(t, horn({ xoHi: 750 }), "hornLoading", false); // 600 = 0.8 x 750
  has(t, horn({ xoHi: 749 }), "hornLoading");
});
test("horn vs mid: -0.5 dB gap is the line", (t) => {
  // need = 118 - 6 = 112
  // "ok" keeps up with the mid, "warn" runs out first
  assert.equal(kindOf(horn({ hornAtXo: 111.5 }), "hornKeepsUp"), "ok");
  assert.equal(kindOf(horn({ hornAtXo: 111.4 }), "hornKeepsUp"), "warn");
  has(t, horn({ midAtXoHi: null }), "hornKeepsUp", false);
});
test("horn: beamwidth match bands 0.75 and 1.4, Keele limit at 0.85", (t) => {
  has(t, horn({ midBeam: 67.5 }), "hornMidNarrower", false);
  has(t, horn({ midBeam: 67.4 }), "hornMidNarrower");
  has(t, horn({ midBeam: 125.9 }), "hornMidWider", false);
  has(t, horn({ midBeam: 126.1 }), "hornMidWider");
  has(t, horn({ xoHi: 850 }), "hornWiderThanRated", false);
  has(t, horn({ xoHi: 849 }), "hornWiderThanRated");
});
test("horn: amp- or program-limited chip, derating noted", (t) => {
  assert.equal(kindOf(horn({}), "hornAmpLimited"), "ok");
  const F = horn({
    hornModel: {
      who: "program rating",
      pAmp: 200,
      imp: 8,
      pProg: 70,
      derate: 0.7,
    },
  });
  assert.equal(kindOf(F, "hornAmpLimited"), undefined);
  assert.match(chipOf(F, "hornProgramLimited")[2], /derated 1\.5 dB/);
});

// ---- fills ----
const fillBase: FillChipsInput = {
  drv: { size: 10 },
  dim: { w: 12, h: 16 },
  Fb: 60,
  Qtc: null,
  hp: 70,
  portLimited: false,
  portMax: 20,
  f3: 80,
  hf: { aes: 80 },
  hfLimW: 400,
  ampW: 300,
  pad: 6,
};
type FillOverrides = Partial<Omit<FillChipsInput, "dim">> & { dim?: Dims2 };
const fill = (o: FillOverrides) =>
  fillChips({ ...fillBase, ...o, dim: { ...fillBase.dim, ...o.dim } });
test("fills: driver fit needs size + 1 in", (t) => {
  has(t, fill({ dim: { w: 11, h: 16 } }), "fillDriverFit", false);
  has(t, fill({ dim: { w: 10.9, h: 16 } }), "fillDriverFit");
});
test("fills: tuned low below 0.6 x highpass", (t) => {
  assert.equal(kindOf(fill({ Fb: 42 }), "fillTuning"), "ok");
  assert.equal(kindOf(fill({ Fb: 41.9 }), "fillTuning"), "warn");
  has(t, fill({}), "fillPortLimited", false);
  has(t, fill({ portLimited: true }), "fillPortLimited", true, "warn");
});
test("fills sealed: Qtc bands", (t) => {
  for (const [q, k] of [
    [0.49, "warn"],
    [0.5, "ok"],
    [0.8, "ok"],
    [0.81, "warn"],
  ] as const)
    assert.equal(kindOf(fill({ Fb: null, Qtc: q }), "fillQtc"), k, `Qtc ${q}`);
});
test("fills: kick at F3 85 Hz; HF limit vs the amp", (t) => {
  // kick: "ok" some, "warn" little; HF headroom: "ok" has headroom, "warn" limits first
  assert.equal(kindOf(fill({ f3: 85 }), "fillKick"), "ok");
  assert.equal(kindOf(fill({ f3: 85.1 }), "fillKick"), "warn");
  assert.equal(kindOf(fill({ hfLimW: 300 }), "fillHfHeadroom"), "ok");
  assert.equal(kindOf(fill({ hfLimW: 299 }), "fillHfHeadroom"), "warn");
  has(t, fill({}), "fillHfUnmodelled", false);
  has(t, fill({ hf: null }), "fillHfUnmodelled", true, "warn");
  has(t, fill({ hf: null }), "fillHfHeadroom", false);
});
