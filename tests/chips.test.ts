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
import { crossoverSlopeName } from "../src/constants/crossovers";
import { qtcFloorAt } from "../src/constants/qtcText";

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
  subDepthIn: undefined,
  subBox: { w: 24, h: 30, d: 22 },
  portStyle: "slots",
  cVent: { slotH: 3, nt: 2, len: 14, throat: 2, dia: 4 }, // nt: subChips ignores it
  PT: 0.75,
  inset: 0.75,
  subLbLoaded: 110,
  lim: { who: "amp", W: 800 },
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
test("sub: duct fit per layout; a bottom slot folds past the straight run", (t) => {
  // straight slot holds d - PT - slotH = 22 - 0.75 - 3 = 18.25; past that it folds up the back wall, which holds
  // (d - PT) + (h - 2 PT - 2 slotH) = 21.25 + 22.5 = 43.75 (a slot height left under the lid), and is never shorter
  // than its centerline at the least rise, d - PT + 1 = 22.25; the lengths between fit neither way
  has(t, sub({ cVent: { len: 18.25 } }), "subDuctFit", false);
  has(t, sub({ cVent: { len: 18.5 } }), "subDuctFit", true, "bad");
  has(t, sub({ cVent: { len: 22 } }), "subDuctFit", true, "bad");
  assert.ok(chipOf(sub({ cVent: { len: 22 } }), "subDuctFit")[2].includes("short of the 22.3″"));
  has(t, sub({ cVent: { len: 22.25 } }), "subDuctFit", false);
  has(t, sub({ cVent: { len: 43.75 } }), "subDuctFit", false);
  const F = sub({ cVent: { len: 44 } });
  has(t, F, "subDuctFit");
  assert.ok(chipOf(F, "subDuctFit")[2].includes("folded up the back wall"));
  // side ducts hold d - PT - throat = 19.25
  has(t, sub({ portStyle: "vslots", cVent: { len: 19.25 } }), "subDuctFit", false);
  has(t, sub({ portStyle: "vslots", cVent: { len: 19.5 } }), "subDuctFit");
});
test("sub: round tubes run straight, then take an elbow up the back wall, then one under the lid", (t) => {
  // 2 × 4″ in 24 × 30 × 22 behind an 18″ with no published depth (9.5″): from the baffle front (3/4″ in) to the back
  // wall is 22 - 0.75 - 0.75 = 20.5. Straight: a diameter short of it, 16.5. One elbow: the riser behind the driver
  // (9.5 + r + a diameter = 15.5 at the shortest), its axis a radius and a flare (2 + 0.75) off the back wall, up to a
  // diameter under the lid: the row's axis sits a flare and a quarter inch up (2 + 0.75 + 0.25 = 3), so
  // 20.5 - 2.75 + (28.5 - 3) - 4 = 39.25. Two elbows: the riser (a radius off the back wall, 18.5; no mouth on it)
  // up to the return leg a radius and a flare under the lid (22.75), the return leg's mouth a diameter behind the
  // driver: 9.5 + 4 + 2 × 4 + 22.75 = 44.25 to 2 × 18.5 + 22.75 - 9.5 - 4 = 46.25.
  const tube = (len: number) => sub({ portStyle: "round2", cVent: { len } });
  has(t, tube(16.5), "subDuctFit", false);
  has(t, tube(39.25), "subDuctFit", false);
  has(t, tube(42), "subDuctFit", true, "bad");
  assert.ok(chipOf(tube(42), "subDuctFit")[2].includes("short of the 44.3″"), chipList(tube(42)));
  has(t, tube(46.25), "subDuctFit", false);
  has(t, tube(46.5), "subDuctFit", true, "bad");
  assert.ok(chipOf(tube(46.5), "subDuctFit")[2].includes("two elbows"));
  // the tubes' flares fit the baffle beside the driver, or the chip says they don't
  has(t, tube(20), "subTubeFit", false);
  has(
    t,
    sub({ portStyle: "round2", cVent: { nt: 4, dia: 6, len: 20 } }),
    "subTubeFit",
    true,
    "bad",
  );
});
test("sub: first-limit chip follows lim.who", (t) => {
  assert.equal(kindOf(sub({ lim: { who: "port", W: 400 } }), "subPortLimited"), "warn");
  assert.equal(kindOf(sub({ lim: { who: "Xmax", W: 400 } }), "subExcursionLimited"), "warn");
  assert.equal(kindOf(sub({ lim: { who: "amp", W: 800 } }), "subAmpLimited"), "warn");
  assert.equal(kindOf(sub({ lim: { who: "thermal", W: 2000 } }), "subThermalLimited"), "ok");
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
  smallerBoxNetL: null,
  isTower: false,
  ts,
  V: Math.sqrt(400 * 8),
  useV: Math.sqrt(400 * 8),
  vTherm: Math.sqrt(800 * 8),
  mAmpW: 400,
  subMusicAtXo: 120,
  midBelowSubDb: 6,
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
    assert.equal(kindOf(mid({ Qtc: q, f3: 150 }), "midQtc"), k, `Qtc ${q}`);
});
test("mid: a low Qtc is ok while the box is flat to the crossover", (t) => {
  // flat to xoLo: the highpass sets the low end
  const ok = mid({ Qtc: 0.3, f3: 120 });
  assert.equal(kindOf(ok, "midQtc"), "ok");
  assert.match(chipOf(ok, "midQtc")[2], /Fine above the 120 Hz crossover/);
  // rolls off above it: a smaller box only where one the driver fits reaches Qtc 0.5
  const fits = mid({ Qtc: 0.3, f3: 200, smallerBoxNetL: 11 });
  assert.equal(kindOf(fits, "midQtc"), "warn");
  assert.ok(chipOf(fits, "midQtc")[2].endsWith(qtcFloorAt(11)));
  const none = mid({ Qtc: 0.3, f3: 200, smallerBoxNetL: null });
  assert.equal(kindOf(none, "midQtc"), "warn");
  assert.doesNotMatch(chipOf(none, "midQtc")[2], /smaller box works/);
  // the tower's chamber follows the sub: no smaller box to name
  const tower = mid({ Qtc: 0.3, f3: 200, smallerBoxNetL: null, isTower: true });
  assert.equal(kindOf(tower, "midQtc"), "warn");
  assert.match(chipOf(tower, "midQtc")[2], /sub's footprint/);
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
  // "ok" keeps up with the sub, "warn" reaches its limit first
  assert.equal(kindOf(mid({ midAtXo: { spl: 113.5, who: "amp" } }), "midKeepsUp"), "ok");
  const F = mid({ midAtXo: { spl: 113.4, who: "amp" } });
  assert.equal(kindOf(F, "midKeepsUp"), "warn");
  assert.match(chipOf(F, "midKeepsUp")[2], /W per mid channel is enough/);
  const G = mid({ midAtXo: { spl: 100, who: "amp" } }); // needs far more than 800 W
  assert.equal(kindOf(G, "midKeepsUp"), "warn");
  assert.match(chipOf(G, "midKeepsUp")[2], /More amp does not help/);
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
  hornBelowMidDb: 6,
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
  // "ok" keeps up with the mid, "warn" reaches its limit first
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
      who: "thermal",
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
  hpOrder: 4,
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
test("fills: the tuning chip names the highpass slope", () => {
  for (const hpOrder of [4, 8] as const)
    assert.ok(
      findChip(fill({ hpOrder }), "fillTuning")?.[2].includes(
        `${crossoverSlopeName(hpOrder)} highpass`,
      ),
    );
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
  has(t, fill({}), "fillHfUnmodeled", false);
  has(t, fill({ hf: null }), "fillHfUnmodeled", true, "warn");
  has(t, fill({ hf: null }), "fillHfHeadroom", false);
});
