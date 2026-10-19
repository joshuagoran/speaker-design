// The Hornresp reference cases (tests/hornresp): each case's record (<case>.txt, as Hornresp imported it) and its
// exported results (<case>-results.txt), read into the horn engine's design. tests/hornresp.test.ts checks the horn
// engine against them, tests/acoustic-network.test.ts the acoustic network.
import assert from "node:assert";
import path from "node:path";
import { BOX_LEAK_Q } from "../src/constants/acoustics";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { GRAMS_PER_KG } from "../src/constants/units";
import { oneSideAirMass } from "../src/lib/acoustics/hornModel";
import type { BoxModelTS, HornDesign, HornSegment, RadiationAngle } from "../src/types";

/** The folder of the reference cases: each one's record and Hornresp's results. */
export const HORNRESP_DIR = path.join(import.meta.dirname, "hornresp");
/** Hornresp gives the throat chamber in cc */
const CC_PER_LITER = 1000;

/**
 * A case and how close the engine must come: SPL in dB, Ze and excursion as a fraction of Hornresp's value.
 *
 * The direct radiator's SPL is looser: Hornresp does not radiate the leak's flow (QL as a pure loss), while the engine
 * radiates it, as the box models and Small's vented-box model do. That moves the output by up to 0.6 dB below 20 Hz and
 * near the cone and vent's cancellation notch; the circuit itself (Ze, excursion) still matches.
 */
export const CASES = [
  { name: "sub-sealed-exp", spl: 0.02, boxes: 1, drivers: 1 },
  { name: "sub-bin-vented", spl: 0.02, boxes: 1, drivers: 1 },
  { name: "sub-bin-eighth", spl: 0.02, boxes: 1, drivers: 1 },
  { name: "sub-direct-vented", spl: 0.6, boxes: 1, drivers: 1 },
  // the PA sub template's box (18NBX100 with Le, its letterbox slot): Lpt is the slot's path length plus the app's end
  // corrections (the floor-mirrored outer end and the inner slot mouth) less a round exit's own 0.85 r, which
  // Hornresp's exit load adds back (End Correction Flag 0). So Hornresp's effective length is the app's. SPL: as in
  // sub-direct-vented, Hornresp's leak does not radiate and the engine's does; the gap grows below the tuning (0.15 dB
  // at 25 Hz, 0.87 dB at 10 Hz). With a leak that does not radiate (the network) it is within 0.001 dB.
  { name: "pa-sub-box", spl: 0.9, boxes: 1, drivers: 1 },
  { name: "mid-vented", spl: 0.02, boxes: 1, drivers: 1 },
  // Hornresp's record holds two drivers as one composite driver and horn. The engine reads it two ways: two boxes
  // side by side (count 2, stacking by images), and two drivers on one throat (Hornresp's Nd)
  { name: "mid-pair", spl: 0.02, boxes: 2, drivers: 1 },
  { name: "mid-pair", spl: 0.02, boxes: 1, drivers: 2 },
  // the voice coil's inductance (Le 1.6 mH on the sub, 0.6 mH on the mid)
  { name: "sub-bin-le", spl: 0.02, boxes: 1, drivers: 1 },
  { name: "mid-le", spl: 0.02, boxes: 1, drivers: 1 },
  // two drivers with Le (0.6 mH each; the composite's 0.3 mH), read both ways
  { name: "mid-pair-le", spl: 0.02, boxes: 1, drivers: 2 },
  { name: "mid-pair-le", spl: 0.02, boxes: 2, drivers: 1 },
] as const;

/** A record's "Key = value" lines, in order (keys repeat: S2 ends one segment and starts the next). */
const recordLines = (text: string) =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => /^(.+?) = (.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ key: m[1], value: m[2] }));

/** The first value a record gives for `key`; fails the test when it has none. */
function valueOf(lines: ReturnType<typeof recordLines>, key: string) {
  const line = lines.find((l) => l.key === key);
  assert.ok(line, `record has no ${key}`);
  return line.value;
}

/** Hornresp's segment profile keys, as the record names a segment's length. */
const PROFILE_KEYS = {
  Con: HORN_PROFILE.conical,
  Exp: HORN_PROFILE.exponential,
  Par: HORN_PROFILE.parabolic,
} as const;

/** The horn's segments: four rows of (start area, end area, profile = length, flare cutoff); length 0 ends the horn. */
function segmentsOf(lines: ReturnType<typeof recordLines>): HornSegment[] {
  const start = lines.findIndex((l) => l.key === "S1");
  const segments: HornSegment[] = [];
  for (let row = 0; row < 4; row++) {
    const [s1, s2, lengthLine] = lines.slice(start + row * 4, start + row * 4 + 3);
    const length = Number(lengthLine.value);
    if (length === 0) break;
    assert.ok(lengthLine.key in PROFILE_KEYS, `unsupported segment profile ${lengthLine.key}`);
    const profile = PROFILE_KEYS[lengthLine.key as keyof typeof PROFILE_KEYS]; // checked just above
    segments.push({ profile, s1: Number(s1.value), s2: Number(s2.value), length });
  }
  return segments;
}

/**
 * The engine's design, drive and losses for a Hornresp record, as `boxes` identical boxes side by side with `drivers`
 * alike drivers on each throat. Hornresp holds them as one composite: its drivers in parallel (Sd, Mmd and Rms add,
 * Cms, Re and Le divide) and its areas and volumes added. Each cone takes 1/(boxes·drivers) of the driver, and each box
 * 1/boxes of the areas and volumes.
 */
export function designOf(text: string, boxes: number, drivers: number) {
  const lines = recordLines(text);
  const num = (key: string) => Number(valueOf(lines, key));
  assert.strictEqual(
    num("End Correction Flag"),
    0,
    "the vent's length must leave out Hornresp's end correction",
  );
  assert.strictEqual(
    num("Acoustic Path Length"),
    0,
    "Hornresp's path length is not the engine's portOffset",
  );
  const angle = Number(valueOf(lines, "Ang").replace(" x Pi", ""));
  assert.ok(angle === 2 || angle === 1 || angle === 0.5, `unsupported angle ${angle}`);
  // the driver: Hornresp's mechanical values to the box models' Thiele/Small set
  /** cones in all */
  const cones = boxes * drivers;
  const Sd = num("Sd") / cones,
    Cms = num("Cms") * cones,
    Rms = num("Rms") / cones;
  /** one side's air load on the cone, kg: 8/3·ρa³, which the engine takes back off its Mms */
  const frontAirMass = oneSideAirMass(Sd);
  const Mms = num("Mmd") / cones / GRAMS_PER_KG + frontAirMass;
  /** the driver's free-air resonance, Hz */
  const Fs = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));
  const driver: BoxModelTS = {
    Sd,
    Bl: num("Bl"),
    Re: num("Re") * cones,
    // the record's first Le is the plain inductance (a later one belongs to the semi-inductance model)
    Le: num("Le") * cones,
    Mms: Mms * GRAMS_PER_KG,
    Fs,
    Qms: (2 * Math.PI * Fs * Mms) / Rms,
    Xmax: 0,
  };
  const segments = segmentsOf(lines);
  const vented = lines.some((l) => l.key === "Ap");
  const design: HornDesign = {
    driver,
    count: boxes,
    drivers,
    throatChamber: num("Vtc") / CC_PER_LITER / boxes,
    segments: segments.map((s) => ({ ...s, s1: s.s1 / boxes, s2: s.s2 / boxes })),
    rear: {
      liters: num("Vrc") / boxes,
      port: vented ? { area: num("Ap") / boxes, length: num("Lpt") } : null,
    },
    angle: angle as RadiationAngle, // checked just above
    portOffset: 0,
  };
  // Hornresp's direct-radiator vented box takes QL = 7, the box models' default
  const losses = { QL: segments.length ? Infinity : BOX_LEAK_Q, Qp: Infinity };
  return { design, volts: num("Eg"), losses };
}

/** Hornresp's results: frequency (Hz), SPL (dB), Ze (ohms) and peak excursion (mm), one row per frequency. */
export function resultsOf(text: string) {
  return text
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const [f, spl, ze, xmm] = line.split("\t").map(Number);
      return { f, spl, ze, xmm };
    });
}
