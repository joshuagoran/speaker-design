// Parity of the Hi-fi engine's coaxials (lib/data coaxParts) with the Fills page's model (lib/pa/calc fillSystem): every
// coaxial in the fill catalogue, in the Fills page's default box (vented and sealed), run through both with the same
// inputs. This is the reference for P5, when the Fills page moves onto the Hi-fi engine and its goldens are rebased.
//
// The two share the box circuits (boxModel, closedBox), the high-pass, the limits (Xmax, port air speed, AES voltage,
// amp) and the passive HF pad's convention (1 W/1 m into the HF impedance, moved to 2.83 V). Where they differ, on
// purpose, and what each does to the numbers:
// - net volume: Hi-fi takes 3% of the gross for bracing and damping and, where the maker gives no displacement, a
//   displacement grown with the cube of the size ((size / 6.5)³ × 0.6 L, at least 0.2 L); Fills takes the whole gross and
//   1 L (8″) or 1.5 L (10″ and up). Matched below by giving Fills the Hi-fi net: the tuning and Qtc then agree exactly.
// - stuffing: a sealed Hi-fi box gains 10% of its net from light stuffing, a Fills box 15%.
// - the frequency grids: Hi-fi 196 points 15 Hz–2 kHz, Fills 420 points 12–300 Hz (sealed: 20 Hz–2 kHz). F3 is the first
//   grid point within 3 dB, so the two read it up to a grid step apart (Hi-fi's is 2.5%).
// - the pad: Fills pads the HF to the maker's LF sensitivity (`lfSens`), Hi-fi to the woofer's modeled passband
//   sensitivity at 2.83 V (`refW`, which is Fills' modeled `sens`). The HF limit (the amp power that brings the HF to its
//   program rating, Fills' `hfLimW`) follows the pad: 10^(Δpad / 10).
// - weight: none. Hi-fi weighs the panels at the catalogue's ½″ ply, which is Fills' fixed 1.6 lb/ft²; both add the
//   coaxial once and a pound of hardware.
// - the room: Hi-fi adds the baffle step, placement and EQ (`HifiWooferPrep.gDb`); Fills has none, so the levels compare
//   on the box's own curve (Hi-fi's `hifiBox`), before them.
import { describe, expect, test } from "vite-plus/test";
import { fillSystem, ampVoltage, STUFFING_VOLUME_GAIN } from "../src/lib/pa/calc";
import {
  HIFI_STUFFING_GAIN,
  hifiBox,
  hifiGridTop,
  hifiSystem,
  hifiWooferPrep,
  panelWeightLb,
} from "../src/lib/hifi/hifi";
import { FILL_OPTIONS, coaxParts, ownGuideCfg } from "../src/lib/data";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { HIFI_COAX_DRIVE } from "../src/constants/hifiEngine";
import { COAX_GAP } from "../src/constants/coax";
import type {
  FillBoxType,
  FillDriver,
  FillSystemConfig,
  HifiConfig,
  HifiTweeter,
} from "../src/types";

/** The Fills page's default design with box `boxType`. */
const fillCfg = (boxType: FillBoxType): FillSystemConfig => ({
  boxType,
  dim: DEFAULT_FILL.boxDims,
  port: DEFAULT_FILL.portSpec,
  hp: DEFAULT_FILL.highpassHz,
  hpOrder: DEFAULT_FILL.highpassOrder,
  ampW: DEFAULT_FILL.ampWatts,
  portMax: DEFAULT_FILL.maxPortAirSpeedMs,
});
/** Fills' walls, inches: the gross volume is the outside less an inch each way. */
const FILL_WALL_IN = 0.5;
/** Fills' panel weight, lb/ft² (lib/pa/calc fillSystem: ½″ birch). */
const FILL_PANEL_LB_PER_SQFT = 1.6;
/** The crossover a coaxial is run at: its recommended minimum, else the Hi-fi page's default. */
const XO_FALLBACK_HZ = 2000;

/** The same design in the Hi-fi engine: ½″ ply, the Fills high-pass, amp and port limit, passive, no EQ or room. */
function hifiCfg(f: FillSystemConfig, t: HifiTweeter | null): HifiConfig {
  return {
    box: f.boxType,
    dim: f.dim,
    wall: FILL_WALL_IN,
    mat: "ply",
    port: { shape: "round", ...f.port },
    xo: t?.hf.minXo ?? XO_FALLBACK_HZ,
    order: 4,
    wAmpW: f.ampW,
    bsc: 0,
    place: "free",
    portMax: f.portMax,
    guide: ownGuideCfg(t),
    hp: { hz: f.hp, order: f.hpOrder },
    drive: HIFI_COAX_DRIVE,
  };
}

/** A curve's level at `f`, read linearly in log frequency between its two nearest points. */
function levelAt(curve: readonly { f: number; spl: number }[], f: number) {
  const i = curve.findIndex((o) => o.f >= f);
  if (i <= 0) return curve[Math.max(0, i)].spl;
  const a = curve[i - 1],
    b = curve[i];
  return a.spl + ((b.spl - a.spl) * Math.log(f / a.f)) / Math.log(b.f / a.f);
}

/** What the comparison reads off the Hi-fi engine: the box, its F3 and clean maximum on the box's own curve. */
function hifiBoxReadings(d: FillDriver, f: FillSystemConfig) {
  const { woofer, tweeter } = coaxParts(d);
  const cfg = hifiCfg(f, tweeter);
  const b = hifiBox(woofer, cfg, hifiGridTop(cfg.xo));
  if (!b) throw new Error(`${d.id}: no Hi-fi box`);
  const prep = hifiWooferPrep(b, woofer, cfg);
  // the clean maximum before the room: the box's level at the lowest of the driver's limits and the amp's (no EQ, so
  // the amp's scale is 1), as Fills' maxOutputCurve reads it
  const max = b.m.curve.map((o, i) => ({
    f: o.f,
    spl: o.spl + 20 * Math.log10(Math.min(prep.sDrv[i], prep.sAmp[i])),
  }));
  // F3 as Fills reads it for both boxes: the first point within 3 dB of the passband, the high-pass included
  const f3 = (b.m.curve.find((o) => o.spl >= b.m.ref - 3) ?? b.m.curve[b.m.curve.length - 1]).f;
  return { woofer, tweeter, cfg, b, max, f3 };
}

const BOXES: FillBoxType[] = ["vented", "sealed"];

/** One row of the parity table: both engines' numbers for a coaxial in a box. */
function parityRow(d: FillDriver, boxType: FillBoxType) {
  const f = fillCfg(boxType);
  const fill = fillSystem(d, f);
  if (!fill) throw new Error(`${d.id}: no Fills model`);
  const h = hifiBoxReadings(d, f);
  const sys = h.tweeter && hifiSystem(h.woofer, h.tweeter, h.cfg);
  // the Hi-fi pad and HF limit: the passive network's pad (the level match, clamped as Fills clamps it) and the amp
  // power that brings the HF to its program rating through it
  const hifiPad = sys ? Math.max(0, -sys.trim) : null;
  const hf = h.tweeter?.hf;
  const hifiHfLimW =
    hf && hifiPad != null ? ((2 * hf.aes * hf.imp) / 8) * Math.pow(10, hifiPad / 10) : null;
  return { d, f, fill, h, sys, hifiPad, hifiHfLimW };
}

const rows = FILL_OPTIONS.flatMap((d) => BOXES.map((box) => parityRow(d, box)));

// Tolerances, as designed (no matching), from the differences above. The widest today: F3 2.8% (B&C 10CXN64 vented,
// 1.4 L less net), the maximum 1.3 dB at 60 Hz (Celestion FTX1225 vented: its unpublished 12″ displacement is 3.8 L in
// Hi-fi, 1.5 L in Fills), the pad 2.6 dB (FaitalPRO 10HX240: its T/S model 2.6 dB more sensitive than its LF rating).
/** F3: the volume rule, the stuffing and the grids; at most this share of the Fills F3 */
const F3_TOL = 0.05;
/** the clean maximum at 60 and 100 Hz, dB: the volume rule moves the tuning and so the port's and the cone's limits */
const MAX_TOL_DB = 1.5;
/** the pad, dB: the maker's LF sensitivity against the modeled one */
const PAD_TOL_DB = 3;
/** with the volumes matched: F3 within a step of Hi-fi's grid (2.5%), the maximum to the grids' interpolation, dB */
const GRID_F3_TOL = 0.026;
const GRID_MAX_TOL_DB = 0.15;

describe("coaxials: the Hi-fi engine against the Fills model", () => {
  test("the parity table (PARITY_TABLE=1 prints it)", () => {
    const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);
    const table = rows.map(({ d, f, fill, h, sys, hifiPad, hifiHfLimW }) => ({
      coax: d.id,
      box: f.boxType,
      "net L F/H": `${r1(fill.net)}/${r1(h.b.net)}`,
      "F3 Hz F/H": `${r1(fill.f3)}/${r1(h.f3)}`,
      "max60 F/H": `${r1(levelAt(fill.max, 60))}/${r1(levelAt(h.max, 60))}`,
      "max100 F/H": `${r1(levelAt(fill.max, 100))}/${r1(levelAt(h.max, 100))}`,
      "pad dB F/H": `${r1(fill.pad)}/${r1(hifiPad)}`,
      "HF lim W F/H": `${r1(fill.hfLimW)}/${r1(hifiHfLimW)}`,
      "lb F/H": `${r1(fill.lb)}/${r1(sys?.lb ?? null)}`,
    }));
    if (process.env.PARITY_TABLE) {
      console.table(table);
      // the widest differences, as designed
      const widest = (of: (r: (typeof rows)[number]) => number | null) =>
        Math.max(...rows.map((r) => Math.abs(of(r) ?? 0)));
      console.table({
        "F3 %": widest((r) => 100 * (r.h.f3 / r.fill.f3 - 1)),
        "max60 dB": widest((r) => levelAt(r.h.max, 60) - levelAt(r.fill.max, 60)),
        "max100 dB": widest((r) => levelAt(r.h.max, 100) - levelAt(r.fill.max, 100)),
        "pad dB": widest((r) => (r.hifiPad == null ? null : r.hifiPad - r.fill.pad)),
        lb: widest((r) => (r.sys ? r.sys.lb - r.fill.lb : null)),
      });
    }
    expect(table.length).toBe(FILL_OPTIONS.length * BOXES.length);
  });

  test("the same box: the gross volume, the vent's end correction and the high-pass in place of the subsonic", () => {
    for (const { fill, h } of rows) {
      expect(h.b.gross).toBeCloseTo(fill.gross, 9);
      expect(h.b.pA).toBeCloseTo(fill.pArea, 9);
      // the Fills high-pass sits above the automatic subsonic, so it takes its place, as Fills runs it
      expect(h.b.hpf).toBeNull();
      expect(h.b.hp).toEqual({ hz: DEFAULT_FILL.highpassHz, order: DEFAULT_FILL.highpassOrder });
    }
  });

  test("the net volume differs by the 3% allowance and the displacement rule, exactly", () => {
    for (const { d, f, fill, h } of rows) {
      const pVol = f.boxType === "vented" ? h.b.pVol : 0;
      expect(fill.net).toBeCloseTo(fill.gross - fill.disp - pVol, 9);
      expect(h.b.net).toBeCloseTo(fill.gross * 0.97 - h.b.disp - h.b.pVol, 9);
      // a published displacement is the same in both
      if (d.ts.disp != null) expect(h.b.disp).toBe(fill.disp);
    }
  });

  test("with Fills given the Hi-fi net volume, the box models agree: tuning and Qtc exactly, F3 and maximum to the grid", () => {
    for (const { d, f, h } of rows) {
      // Fills' net is its gross less the displacement and the port; its sealed box gains 15% from stuffing, Hi-fi's 10%
      const targetNet =
        f.boxType === "vented" ? h.b.net : (h.b.net * HIFI_STUFFING_GAIN) / STUFFING_VOLUME_GAIN;
      const disp = h.b.gross - targetNet - (f.boxType === "vented" ? h.b.pVol : 0);
      const fill = fillSystem({ ...d, ts: { ...d.ts, disp } }, f);
      if (!fill) throw new Error(`${d.id}: no Fills model`);
      const label = `${d.id} ${f.boxType}`;
      if (fill.vM && h.b.vM) expect(h.b.vM.Fb, label).toBeCloseTo(fill.vM.Fb, 9);
      if (fill.sM && h.b.sM) expect(h.b.sM.Qtc, label).toBeCloseTo(fill.sM.Qtc, 9);
      expect(Math.abs(h.f3 / fill.f3 - 1), label).toBeLessThan(GRID_F3_TOL);
      for (const at of [60, 100])
        expect(
          Math.abs(levelAt(h.max, at) - levelAt(fill.max, at)),
          `${label} ${at} Hz`,
        ).toBeLessThan(GRID_MAX_TOL_DB);
    }
  });

  test("as designed, F3 and the maximum stay within the volume rule's reach", () => {
    for (const { d, f, fill, h } of rows) {
      const label = `${d.id} ${f.boxType}`;
      expect(Math.abs(h.f3 / fill.f3 - 1), label).toBeLessThan(F3_TOL);
      for (const at of [60, 100])
        expect(
          Math.abs(levelAt(h.max, at) - levelAt(fill.max, at)),
          `${label} ${at} Hz`,
        ).toBeLessThan(MAX_TOL_DB);
    }
  });

  test("the pad: the same convention, to the woofer's modeled sensitivity instead of the maker's", () => {
    for (const { d, fill, sys, hifiPad } of rows) {
      if (!d.hf || !sys || hifiPad == null) continue;
      const hfAt283 = d.hf.sens + 10 * Math.log10(8 / d.hf.imp);
      // Hi-fi's level match is Fills' modeled sensitivity, which doesn't depend on the box
      expect(sys.refW).toBeCloseTo(fill.sens, 9);
      expect(hifiPad).toBeCloseTo(Math.max(0, hfAt283 - fill.sens), 9);
      expect(fill.pad).toBeCloseTo(Math.max(0, hfAt283 - d.lfSens), 9);
      expect(Math.abs(hifiPad - fill.pad), d.id).toBeLessThan(PAD_TOL_DB);
    }
  });

  test("the HF limit: the amp power that brings the HF to its program rating, through the pad", () => {
    for (const { d, f, fill, h, hifiPad, hifiHfLimW } of rows) {
      if (!d.hf || !h.tweeter || hifiPad == null || hifiHfLimW == null || fill.hfLimW == null)
        continue;
      // the engine at that power: the HF at its program rating (2 × AES), its level the rated maximum
      const at = hifiSystem(h.woofer, h.tweeter, { ...h.cfg, wAmpW: hifiHfLimW });
      if (!at) throw new Error(`${d.id}: no Hi-fi model`);
      expect(at.pMax).toBeCloseTo(2 * d.hf.aes, 6);
      const below = hifiSystem(h.woofer, h.tweeter, { ...h.cfg, wAmpW: hifiHfLimW * 0.9 });
      expect(below && below.pMax).toBeLessThan(2 * d.hf.aes);
      // and against Fills: the pads' difference, in power
      expect(hifiHfLimW / fill.hfLimW).toBeCloseTo(Math.pow(10, (hifiPad - fill.pad) / 10), 9);
      expect(f.ampW).toBe(DEFAULT_FILL.ampWatts);
    }
  });

  test("weight: the coaxial once, a pound of hardware, the panels at the catalogue's ½″ ply", () => {
    for (const { d, f, fill, sys } of rows) {
      if (!sys) continue;
      const { w, h, d: dd } = f.dim;
      const ft2 = (2 * (w * h + w * dd + h * dd)) / 144;
      expect(fill.lb).toBeCloseTo(ft2 * FILL_PANEL_LB_PER_SQFT + d.lb + 1, 9);
      expect(sys.lb).toBeCloseTo(ft2 * panelWeightLb(FILL_WALL_IN, "ply") + d.lb + 1, 9);
      expect(sys.lb).toBeCloseTo(fill.lb, 9);
    }
  });

  test("a coaxial without HF data is modeled as its woofer alone, its gap marked", () => {
    const bare = rows.filter(({ d }) => !d.hf);
    expect(bare.length).toBeGreaterThan(0);
    for (const { d, fill, h } of bare) {
      expect(h.tweeter).toBeNull();
      expect(coaxParts(d).gaps).toEqual([COAX_GAP.hf]);
      expect(fill.hfLimW).toBeNull();
      expect(h.b.V).toBeCloseTo(ampVoltage(DEFAULT_FILL.ampWatts), 9);
    }
  });
});
