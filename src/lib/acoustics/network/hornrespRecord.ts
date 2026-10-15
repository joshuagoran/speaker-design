// Reads a Hornresp record (the text Hornresp exports and imports: "Key = value" lines in sections) onto the network
// presets (lib/acoustics/network/presets). It takes front-loaded horns, direct radiators, offset-driver horns
// (Hornresp's OD) and tapped horns (TH); any value it cannot model yet gives a reason that starts "not supported yet: ".
//
// Hornresp's conventions the reader follows (as tests/hornresp.test.ts does):
// - Units: areas cm², lengths cm, Vrc in L, Vtc in cc, Le in mH, Mmd in g; Eg is the drive in V RMS.
// - The driver: Mmd is the moving mass without its air load, with Cms and Rms. The planner's Thiele/Small set carries
//   one side's air load in Mms, which the presets take back off with the radiation load on; so Mms = Mmd + 8/3·ρa³.
// - Several drivers are one composite driver (Sd, Mmd and Rms added; Cms, Re and Le divided): read as one driver.
// - A horn's rear chamber is lossless. A direct radiator's vented box has QL = 7, and its leak does not radiate.
// - The chambers are lumped (Hornresp's masked chamber resonances): Lrc and Atc are not used.
// - The horn rows: S1 to S5, each row's length keyed by its flare (Con, Exp, Par; L12 to L45 when unused). A row of
//   zero length ends the path.
// - The layouts: front-loaded (or direct, with no horn) by default. OD: the path starts closed at S1 and the fronts tap
//   it at S2, the rears in the rear chamber. TH: the path starts closed at S1, the fronts tap it at S2 (through Vtc)
//   and the rears at S3 (through Vrc). A record names its layout with an OD or TH flag, or the caller gives it.
//
// Words used below: a "row" is one horn section's four lines (start area, end area, length, cutoff).
import type {
  BoxModelTS,
  HornDesign,
  HornLayout,
  HornLayoutDesign,
  HornProfile,
  HornrespReading,
  HornSegment,
  RadiationAngle,
} from "../../../types";
import { AIR_DENSITY, BOX_LEAK_Q } from "../../../constants/acoustics";
import {
  HORN_LAYOUT,
  HORNRESP_LAYOUT_KEY,
  MISSING_VALUE,
  NOT_SUPPORTED_YET,
} from "../../../constants/acousticNetwork";
import { HORN_PROFILE } from "../../../constants/hornEngine";
import { CM3_PER_LITER, GRAMS_PER_KG, SQ_CM_PER_SQ_M } from "../../../constants/units";
import { hornLayoutNetwork } from "./presets";

/** Hornresp's flare keys, as a row names its length, and the profile each is. */
const PROFILE_KEYS: Record<string, HornProfile> = {
  Con: HORN_PROFILE.conical,
  Exp: HORN_PROFILE.exponential,
  Par: HORN_PROFILE.parabolic,
};
/** The keys a row's length takes when the row is unused (zero length), by row. */
const UNUSED_LENGTH_KEYS = ["L12", "L23", "L34", "L45"];
/** The solid angles the radiation impedance models, in units of π (free air, 4π, is not modeled). */
const RADIATION_ANGLES: readonly RadiationAngle[] = [2, 1, 0.5];

/**
 * Values that must be zero (or absent) for the reader to model a record, and what each one is. A nonzero value gives
 * "not supported yet: " and its name.
 */
const MUST_BE_ZERO: Record<string, string> = {
  Rg: "a source resistance (Rg)",
  "Added Mass": "a passive radiator (Added Mass)",
  "Acoustic Path Length": "an acoustic path length",
  "Lossy Inductance Model Flag": "the lossy inductance model",
  "Semi-Inductance Model Flag": "the semi-inductance model",
  "Damping Model Flag": "the frequency-dependent damping model",
  "Closed Mouth Flag": "a closed mouth",
  "End Correction Flag": "Hornresp's vent end correction (End Correction Flag 1)",
  Fr: "a filled rear chamber (Fr)",
  Tal: "a filled rear chamber (Tal)",
  Fr1: "absorbent filling in the horn (Fr1)",
  Fr2: "absorbent filling in the horn (Fr2)",
  Fr3: "absorbent filling in the horn (Fr3)",
  Fr4: "absorbent filling in the horn (Fr4)",
  "High Pass Frequency": "an active high-pass filter",
  "Low Pass Frequency": "an active low-pass filter",
};
/** Equalizer bands: any band with a frequency is not modeled yet. */
const EQ_BAND_FREQUENCY = /^Band \d+ Frequency$/;

/** A problem that stops the reading: its reason, given back as the result. */
interface RecordProblem {
  reason: string;
}
/** Stops the reading with `reason`. */
const fail = (reason: string): never => {
  const problem: RecordProblem = { reason };
  throw problem;
};
/** Whether a thrown value is the reader's own problem (anything else is a bug and goes on up). */
const isProblem = (value: unknown): value is RecordProblem =>
  typeof value === "object" &&
  value !== null &&
  "reason" in value &&
  typeof value.reason === "string";

/** A record's "Key = value" lines, in order (keys repeat: S2 ends one row and starts the next; Le and Rms recur). */
const recordLines = (text: string) =>
  text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => /^(.+?) = (.*)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ key: match[1].trim(), value: match[2].trim() }));
type RecordLines = ReturnType<typeof recordLines>;

/** The first number a record gives for `key`, or null when it has no such line; a value that is not a number fails. */
function optionalNumber(lines: RecordLines, key: string): number | null {
  const line = lines.find((l) => l.key === key);
  if (!line) return null;
  const value = Number(line.value);
  if (!Number.isFinite(value)) fail(`${NOT_SUPPORTED_YET}${key} = ${line.value}`);
  return value;
}
/** The first number a record gives for `key`; a record without it fails. */
function requiredNumber(lines: RecordLines, key: string): number {
  return optionalNumber(lines, key) ?? fail(`${MISSING_VALUE}${key}`);
}

/** The solid angle: "Ang = 2.0 x Pi" is half space. */
function angleOf(lines: RecordLines): RadiationAngle {
  const line = lines.find((l) => l.key === "Ang") ?? fail(`${MISSING_VALUE}Ang`);
  const units = Number(line.value.replace(/x\s*Pi/i, "").trim());
  return (
    RADIATION_ANGLES.find((angle) => angle === units) ??
    fail(`${NOT_SUPPORTED_YET}a solid angle of ${line.value} (2π, π and π/2 only)`)
  );
}

/** The horn rows, S1 first, up to the first of zero length. */
function segmentsOf(lines: RecordLines): HornSegment[] {
  const start = lines.findIndex((l) => l.key === "S1");
  if (start < 0) fail(`${MISSING_VALUE}S1`);
  const segments: HornSegment[] = [];
  for (let row = 0; row < UNUSED_LENGTH_KEYS.length; row++) {
    const [startArea, endArea, lengthLine] = lines.slice(start + row * 4, start + row * 4 + 3);
    if (!startArea || !endArea || !lengthLine) break;
    const length = Number(lengthLine.value);
    if (!(length > 0)) break;
    const profile =
      PROFILE_KEYS[lengthLine.key] ??
      fail(
        UNUSED_LENGTH_KEYS.includes(lengthLine.key)
          ? `${MISSING_VALUE}the flare of row ${row + 1}`
          : `${NOT_SUPPORTED_YET}a ${lengthLine.key} section`,
      );
    const s1 = Number(startArea.value),
      s2 = Number(endArea.value);
    if (!(s1 > 0 && s2 > 0))
      fail(`${NOT_SUPPORTED_YET}a section with an area of zero (row ${row + 1})`);
    segments.push({ profile, s1, s2, length });
  }
  return segments;
}

/**
 * The driver as the planner's Thiele/Small set: Hornresp's mechanical values (Mmd, Cms, Rms) to Mms with one side's
 * air load, Fs and Qms; the record's first Le is the plain inductance.
 */
function driverOf(lines: RecordLines): BoxModelTS {
  const Sd = requiredNumber(lines, "Sd"),
    Cms = requiredNumber(lines, "Cms"),
    Rms = requiredNumber(lines, "Rms");
  /** one side's air load on the cone, kg: 8/3·ρa³, a the cone's radius */
  const airMass = (8 / 3) * AIR_DENSITY * Math.pow(Sd / SQ_CM_PER_SQ_M / Math.PI, 1.5);
  /** the moving mass with that air load, kg */
  const Mms = requiredNumber(lines, "Mmd") / GRAMS_PER_KG + airMass;
  /** the free-air resonance, Hz */
  const Fs = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));
  return {
    Sd,
    Bl: requiredNumber(lines, "Bl"),
    Re: requiredNumber(lines, "Re"),
    Le: optionalNumber(lines, "Le") ?? 0,
    Mms: Mms * GRAMS_PER_KG,
    Fs,
    Qms: (2 * Math.PI * Fs * Mms) / Rms,
    Xmax: optionalNumber(lines, "Xmax") ?? 0,
  };
}

/** The layout: the caller's, else the record's OD or TH flag, else front-loaded. */
function layoutOf(lines: RecordLines, given: HornLayout | undefined): HornLayout {
  if (given) return given;
  const offset = (optionalNumber(lines, HORNRESP_LAYOUT_KEY.offsetDriver) ?? 0) !== 0,
    tapped = (optionalNumber(lines, HORNRESP_LAYOUT_KEY.tapped) ?? 0) !== 0;
  if (offset && tapped) fail(`${NOT_SUPPORTED_YET}both the OD and TH layouts`);
  return offset ? HORN_LAYOUT.offsetDriver : tapped ? HORN_LAYOUT.tapped : HORN_LAYOUT.frontLoaded;
}

/** Fails for any value the reader cannot model yet (see MUST_BE_ZERO), and for more than one driver count. */
function checkSupported(lines: RecordLines) {
  for (const [key, what] of Object.entries(MUST_BE_ZERO))
    if ((optionalNumber(lines, key) ?? 0) !== 0) fail(`${NOT_SUPPORTED_YET}${what}`);
  for (const line of lines)
    if (EQ_BAND_FREQUENCY.test(line.key) && Number(line.value) !== 0)
      fail(`${NOT_SUPPORTED_YET}an equalizer band (${line.key})`);
  if ((optionalNumber(lines, "Nd") ?? 1) !== 1)
    fail(`${NOT_SUPPORTED_YET}Nd other than 1 (give the drivers as one composite driver)`);
}

/** The design the record describes, in its layout. */
function designOf(lines: RecordLines, layout: HornLayout): HornLayoutDesign {
  const segments = segmentsOf(lines);
  const ventArea = optionalNumber(lines, "Ap") ?? 0;
  const ventLength = optionalNumber(lines, "Lpt") ?? 0;
  if (ventArea > 0 && !(ventLength > 0)) fail(`${NOT_SUPPORTED_YET}a vent with no length (Lpt)`);
  const rearLiters = requiredNumber(lines, "Vrc");
  const common = {
    driver: driverOf(lines),
    drivers: 1,
    count: 1,
    angle: angleOf(lines),
    segments,
    throatChamber: (optionalNumber(lines, "Vtc") ?? 0) / CM3_PER_LITER,
  };
  if (layout === HORN_LAYOUT.tapped) {
    if (segments.length < 2) fail(`${NOT_SUPPORTED_YET}a tapped horn with fewer than two sections`);
    if (ventArea > 0) fail(`${NOT_SUPPORTED_YET}a vent on a tapped horn`);
    return { layout, ...common, frontTap: 1, rearTap: 2, rearChamber: rearLiters };
  }
  if (!(rearLiters > 0)) fail(`${NOT_SUPPORTED_YET}an open rear (Vrc = 0)`);
  const rear: HornDesign["rear"] = {
    liters: rearLiters,
    port: ventArea > 0 ? { area: ventArea, length: ventLength } : null,
  };
  if (layout === HORN_LAYOUT.offsetDriver) {
    if (segments.length < 1) fail(`${NOT_SUPPORTED_YET}an offset-driver horn with no sections`);
    return { layout, ...common, rear, portOffset: 0, tap: 1 };
  }
  return { layout, ...common, rear, portOffset: 0 };
}

/**
 * Reads a Hornresp record onto the network presets, in the record's layout or the one `options.layout` gives (for a
 * record that does not name its own). A record the reader cannot model yet gives `ok: false` and the reason.
 */
export function readHornrespRecord(
  text: string,
  options: { layout?: HornLayout } = {},
): HornrespReading {
  try {
    const lines = recordLines(text);
    checkSupported(lines);
    const design = designOf(lines, layoutOf(lines, options.layout));
    // Hornresp's horn rear chamber is lossless; its direct radiator's vented box leaks (QL 7) without radiating it
    const direct = design.segments.length === 0;
    const losses = { QL: direct ? BOX_LEAK_Q : Infinity, Qp: Infinity, leakRadiates: false };
    const preset =
      hornLayoutNetwork(design, losses) ?? fail(`${NOT_SUPPORTED_YET}these driver taps`);
    return { ok: true, design, preset, volts: requiredNumber(lines, "Eg"), losses };
  } catch (thrown) {
    if (isProblem(thrown)) return { ok: false, reason: thrown.reason };
    throw thrown;
  }
}
