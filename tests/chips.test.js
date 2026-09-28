import test from "node:test";
import { subChips, midChips, hornChips, fillChips } from "../tools/chips.js";

const heads = (F) => F.map(([, h]) => h);
const kindOf = (F, head) => (F.find(([, h]) => h.startsWith(head)) || [])[0];
const has = (t, F, head, yes = true) => t.assert.equal(heads(F).some((h) => h.startsWith(head)), yes, `${head}: ${heads(F).join(" | ")}`);

// ---- sub ----
const subBase = { subSize: 18, subBox: { w: 24, h: 30, d: 22 }, portStyle: "slots", cVent: { slotH: 3, len: 14, throat: 2, dia: 4 },
  PT: 0.75, subLbLoaded: 110, lim: { who: "amplifier power", W: 800 }, peakXF: 40, aes: 1000, ampW: 800 };
const sub = (o) => subChips({ ...subBase, ...o, cVent: { ...subBase.cVent, ...(o.cVent || {}) } });
test("sub: 125 lb line", (t) => {
  t.assert.equal(kindOf(sub({ subLbLoaded: 125 }), "Inside 125 lb"), "ok");
  t.assert.equal(kindOf(sub({ subLbLoaded: 125.1 }), "Over 125 lb"), "warn");
});
test("sub: driver fit needs size + 1.9 in after the vents", (t) => {
  // letterbox: clear height = h - slotH - PT; 18 + 1.9 = 19.9
  has(t, sub({ subBox: { w: 24, h: 19.9 + 3.75, d: 22 } }), "Driver won't fit", false);
  has(t, sub({ subBox: { w: 24, h: 19.8 + 3.75, d: 22 } }), "Driver won't fit");
  // two side ducts: clear width = w - 2 (throat + 0.43 + PT)
  const w = 19.9 + 2 * (2 + 0.43 + 0.75);
  has(t, sub({ portStyle: "vslots", subBox: { w, h: 30, d: 22 } }), "Driver won't fit", false);
  has(t, sub({ portStyle: "vslots", subBox: { w: w - 0.1, h: 30, d: 22 } }), "Driver won't fit");
});
test("sub: duct fit per layout, with the folded hint", (t) => {
  // straight slot holds d - PT - slotH = 22 - 0.75 - 3 = 18.25
  has(t, sub({ cVent: { len: 18.25 } }), "Duct too long", false);
  const F = sub({ cVent: { len: 18.5 } });
  has(t, F, "Duct too long");
  t.assert.ok(F.find(([, h]) => h === "Duct too long")[2].includes("Switch to Bottom, folded."));
  // side ducts hold d - PT - throat = 19.25
  has(t, sub({ portStyle: "vslots", cVent: { len: 19.25 } }), "Duct too long", false);
  has(t, sub({ portStyle: "vslots", cVent: { len: 19.5 } }), "Duct too long");
  // round tubes hold d - 0.75 - 2 PT - dia/2 = 22 - 0.75 - 1.5 - 2 = 17.75
  has(t, sub({ portStyle: "round2", cVent: { len: 17.75 } }), "Duct too long", false);
  has(t, sub({ portStyle: "round2", cVent: { len: 18 } }), "Duct too long");
});
test("sub: first-limit chip follows lim.who", (t) => {
  t.assert.equal(kindOf(sub({ lim: { who: "port air speed", W: 400 } }), "Port-limited"), "warn");
  t.assert.equal(kindOf(sub({ lim: { who: "cone travel (Xmax)", W: 400 } }), "Excursion-limited"), "warn");
  t.assert.equal(kindOf(sub({ lim: { who: "amplifier power", W: 800 } }), "Amp-limited"), "warn");
  t.assert.equal(kindOf(sub({ lim: { who: "driver program rating", W: 2000 } }), "Thermally limited"), "ok");
});

// ---- mid ----
const ts = { Xmax: 8, aes: 400 };
const midBase = { midSize: 12, midDims: { w: 15, h: 15, d: 15 }, Qtc: 0.65, f3: 90, peakX: 4, xoLo: 120, ts, V: Math.sqrt(400 * 8),
  useV: Math.sqrt(400 * 8), vTherm: Math.sqrt(800 * 8), mAmpW: 400, subMusicAtXo: 120, tilt: 6, midAtXo: { spl: 115, who: "amp" } };
const mid = (o) => midChips({ ...midBase, ...o });
test("mid: Qtc bands 0.5 and 0.8", (t) => {
  for (const [q, k] of [[0.49, "warn"], [0.5, "ok"], [0.8, "ok"], [0.81, "warn"]]) t.assert.equal(kindOf(mid({ Qtc: q }), "Qtc"), k, `Qtc ${q}`);
});
test("mid: driver fit needs size + 1.2 in", (t) => {
  has(t, mid({ midDims: { w: 13.2, h: 15, d: 15 } }), "Driver won't fit", false);
  has(t, mid({ midDims: { w: 13.1, h: 15, d: 15 } }), "Driver won't fit");
});
test("mid: rolls off above the crossover only when F3 > xoLo", (t) => {
  has(t, mid({ f3: 120 }), "Rolls off above the crossover", false);
  has(t, mid({ f3: 121 }), "Rolls off above the crossover");
});
test("mid: excursion at 100 % of Xmax is the line", (t) => {
  has(t, mid({ peakX: 8 }), "Excursion-limited", false);
  has(t, mid({ peakX: 8.01 }), "Excursion-limited");
  // below Xmax: thermal if the program rating is below the amp, else amp
  t.assert.equal(kindOf(mid({ vTherm: 10 }), "Thermally limited"), "ok");
  t.assert.equal(kindOf(mid({}), "Amp-limited"), "ok");
});
test("mid vs sub: -0.5 dB gap is the line; amp advice only while under 2 x AES", (t) => {
  // need = 120 - 6 = 114
  has(t, mid({ midAtXo: { spl: 113.5, who: "amp" } }), "Keeps up with the sub");
  const F = mid({ midAtXo: { spl: 113.4, who: "amp" } });
  has(t, F, "Mid runs out first");
  t.assert.match(F.find(([, h]) => h === "Mid runs out first")[2], /W per mid channel would cover it/);
  const G = mid({ midAtXo: { spl: 100, who: "amp" } });   // needs far more than 800 W
  t.assert.match(G.find(([, h]) => h === "Mid runs out first")[2], /More amp won't get there/);
  has(t, mid({ subMusicAtXo: null }), "Mid runs out first", false);
  has(t, mid({ subMusicAtXo: null }), "Keeps up with the sub", false);
});

// ---- horn ----
const hornBase = { hf: { minXo: 1000, aes: 50, aesXo: 1200 }, hz: { minXo: 800, lowHz: 600, covH: 90 }, horn: { name: "Test horn", size: { w: 18 } },
  xoHi: 1200, hornModel: { who: "amp", pAmp: 50, imp: 8, pProg: 100, derate: 1 }, hfAmpW: 50, midAtXoHi: 118, hfTilt: 6, hornAtXo: 115, midBeam: 90, fK: 1000 };
const horn = (o) => hornChips({ ...hornBase, ...o, hz: { ...hornBase.hz, ...(o.hz || {}) } });
test("horn: driver and horn minimum crossovers", (t) => {
  has(t, horn({ xoHi: 1000 }), "Below the driver's minimum crossover", false);
  has(t, horn({ xoHi: 999 }), "Below the driver's minimum crossover");
  has(t, horn({ xoHi: 800 }), "Below the horn's crossover range", false);
  has(t, horn({ xoHi: 799 }), "Below the horn's crossover range");
});
test("horn: loading limit within 80 % of the crossover", (t) => {
  has(t, horn({ xoHi: 750 }), "Horn stops loading near the crossover", false);   // 600 = 0.8 x 750
  has(t, horn({ xoHi: 749 }), "Horn stops loading near the crossover");
});
test("horn vs mid: -0.5 dB gap is the line", (t) => {
  // need = 118 - 6 = 112
  has(t, horn({ hornAtXo: 111.5 }), "Keeps up with the mid");
  has(t, horn({ hornAtXo: 111.4 }), "Horn runs out first");
  has(t, horn({ midAtXoHi: null }), "Keeps up with the mid", false);
});
test("horn: beamwidth match bands 0.75 and 1.4, Keele limit at 0.85", (t) => {
  has(t, horn({ midBeam: 67.5 }), "Mid narrower than the horn", false);
  has(t, horn({ midBeam: 67.4 }), "Mid narrower than the horn");
  has(t, horn({ midBeam: 125.9 }), "Mid much wider than the horn", false);
  has(t, horn({ midBeam: 126.1 }), "Mid much wider than the horn");
  has(t, horn({ xoHi: 850 }), "Horn wider than rated", false);
  has(t, horn({ xoHi: 849 }), "Horn wider than rated");
});
test("horn: amp- or program-limited chip, derating noted", (t) => {
  t.assert.equal(kindOf(horn({}), "Amp-limited"), "ok");
  const F = horn({ hornModel: { who: "program rating", pAmp: 200, imp: 8, pProg: 70, derate: 0.7 } });
  t.assert.match(F.find(([, h]) => h === "Program-limited")[2], /derated 1\.5 dB/);
});

// ---- fills ----
const fillBase = { drv: { size: 10 }, dim: { w: 12, h: 16 }, Fb: 60, Qtc: null, hp: 70, portLimited: false, portMax: 20, f3: 80,
  hf: { aes: 80 }, hfLimW: 400, ampW: 300, pad: 6 };
const fill = (o) => fillChips({ ...fillBase, ...o });
test("fills: driver fit needs size + 1 in", (t) => {
  has(t, fill({ dim: { w: 11, h: 16 } }), "Driver won't fit", false);
  has(t, fill({ dim: { w: 10.9, h: 16 } }), "Driver won't fit");
});
test("fills: tuned low below 0.6 x highpass", (t) => {
  t.assert.equal(kindOf(fill({ Fb: 42 }), "Tuned to"), "ok");
  t.assert.equal(kindOf(fill({ Fb: 41.9 }), "Tuned low"), "warn");
  has(t, fill({ portLimited: true }), "Port-limited");
});
test("fills sealed: Qtc bands", (t) => {
  for (const [q, k] of [[0.49, "warn"], [0.5, "ok"], [0.8, "ok"], [0.81, "warn"]]) t.assert.equal(kindOf(fill({ Fb: null, Qtc: q }), "Qtc"), k, `Qtc ${q}`);
});
test("fills: kick at F3 85 Hz; HF limit vs the amp", (t) => {
  has(t, fill({ f3: 85 }), "Some kick");
  has(t, fill({ f3: 85.1 }), "Little kick");
  has(t, fill({ hfLimW: 300 }), "HF has headroom");
  has(t, fill({ hfLimW: 299 }), "HF limits first");
  has(t, fill({ hf: null }), "HF not modelled");
});
