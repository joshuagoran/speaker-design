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
// - The horn rows: S1 to S5, each row's length keyed by its flare (Con, Exp, Par; L12 to L45 when unused). A row of
//   zero length ends the path; each used row starts at the area the row before it ends at. The mouth key is Cir after
//   an Exp row and Fta after a Con or Par row (not read).
// - The layout: the key of the driver count's line, the line after Re, names it (Nd = 1, OD = 1, TH = 1; its value is
//   the number of drivers). Nd: front-loaded, or direct with no horn. OD: the path starts closed at S1 and the fronts
//   tap it at S2, the rears in the rear chamber. TH: the path starts closed at S1; the fronts tap it at S2 and the rears
//   at S3 (three rows) or S4 (four rows). Hornresp's other layouts (OD1, TH1, BP4 and more) are not read yet.
// - The chambers: front-loaded and offset-driver horns' are lumped (Hornresp's masked chamber resonances), so Lrc and
//   Atc are not used. A tapped horn's are passages from the cones to their taps (Hornresp's TH model, masked or not):
//   Vtc with the area Atc on the front side, Vrc with the length Lrc (area Vrc/Lrc) on the rear side.
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
  TapChamber,
} from "../../../types";
import { BOX_LEAK_Q } from "../../../constants/acoustics";
import {
  HORN_LAYOUT,
  HORNRESP_AREA_KEYS,
  HORNRESP_CUTOFF_KEYS,
  HORNRESP_FLARE_KEY,
  HORNRESP_KEY,
  HORNRESP_LAYOUT_KEY,
  HORNRESP_UNUSED_LENGTH_KEYS,
  INVALID_RECORD,
  MISSING_VALUE,
  NOT_SUPPORTED_YET,
} from "../../../constants/acousticNetwork";
import { HORN_PROFILE } from "../../../constants/hornEngine";
import { CM3_PER_LITER, GRAMS_PER_KG } from "../../../constants/units";
import { oneSideAirMass } from "../hornModel";
import { hornLayoutNetwork } from "./presets";

/** Hornresp's flare keys, as a row names its length, and the profile each is. */
const PROFILE_KEYS: Record<string, HornProfile> = {
  [HORNRESP_FLARE_KEY.conical]: HORN_PROFILE.conical,
  [HORNRESP_FLARE_KEY.exponential]: HORN_PROFILE.exponential,
  [HORNRESP_FLARE_KEY.parabolic]: HORN_PROFILE.parabolic,
};
/** The keys a row's length takes when the row is unused, as plain strings to look a record's key up in. */
const UNUSED_LENGTH_KEYS: readonly string[] = HORNRESP_UNUSED_LENGTH_KEYS;
/** The solid angles the radiation impedance models, in units of π (free air, 4π, is not modeled). */
const RADIATION_ANGLES: readonly RadiationAngle[] = [2, 1, 0.5];

/**
 * Values that must be zero (or absent) for the reader to model a record, and what each one is. A nonzero value gives
 * "not supported yet: " and its name.
 */
const MUST_BE_ZERO: Record<string, string> = {
  [HORNRESP_KEY.addedMass]: `a passive radiator (${HORNRESP_KEY.addedMass})`,
  [HORNRESP_KEY.pathLength]: "an acoustic path length",
  [HORNRESP_KEY.lossyInductance]: "the lossy inductance model",
  [HORNRESP_KEY.semiInductance]: "the semi-inductance model",
  [HORNRESP_KEY.dampingModel]: "the frequency-dependent damping model",
  [HORNRESP_KEY.closedMouth]: "a closed mouth",
  [HORNRESP_KEY.rearFilling]: `a filled rear chamber (${HORNRESP_KEY.rearFilling})`,
  [HORNRESP_KEY.rearFillingLength]: `a filled rear chamber (${HORNRESP_KEY.rearFillingLength})`,
  [HORNRESP_KEY.hornFilling1]: `absorbent filling in the horn (${HORNRESP_KEY.hornFilling1})`,
  [HORNRESP_KEY.hornFilling2]: `absorbent filling in the horn (${HORNRESP_KEY.hornFilling2})`,
  [HORNRESP_KEY.hornFilling3]: `absorbent filling in the horn (${HORNRESP_KEY.hornFilling3})`,
  [HORNRESP_KEY.hornFilling4]: `absorbent filling in the horn (${HORNRESP_KEY.hornFilling4})`,
  [HORNRESP_KEY.highPass]: "an active high-pass filter",
  [HORNRESP_KEY.lowPass]: "an active low-pass filter",
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
    // a blank value ("Key =", its space trimmed) keeps its line, so that it fails where it is read
    .map((line) => /^(.+?) =(?: (.*))?$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ key: match[1].trim(), value: (match[2] ?? "").trim() }));
type RecordLines = ReturnType<typeof recordLines>;

/** A line's value as a finite number; a blank value or one that is not a number fails. */
function numberOf(line: RecordLines[number]): number {
  const value = line.value === "" ? NaN : Number(line.value);
  return Number.isFinite(value) ? value : fail(`${INVALID_RECORD}${line.key} = ${line.value}`);
}
/** The first number a record gives for `key`, or null when it has no such line; a value that is not a number fails. */
function optionalNumber(lines: RecordLines, key: string): number | null {
  const line = lines.find((l) => l.key === key);
  return line ? numberOf(line) : null;
}
/** The first number a record gives for `key`; a record without it fails. */
function requiredNumber(lines: RecordLines, key: string): number {
  return optionalNumber(lines, key) ?? fail(`${MISSING_VALUE}${key}`);
}
/** The first number a record gives for `key`, which must be positive; a record without it fails. */
function positiveNumber(lines: RecordLines, key: string): number {
  const value = requiredNumber(lines, key);
  return value > 0 ? value : fail(`${INVALID_RECORD}${key} = ${value} (it must be positive)`);
}

/** The solid angle: "Ang = 2.0 x Pi" is half space. */
function angleOf(lines: RecordLines): RadiationAngle {
  const line =
    lines.find((l) => l.key === HORNRESP_KEY.angle) ??
    fail(`${MISSING_VALUE}${HORNRESP_KEY.angle}`);
  const units = Number(line.value.replace(/x\s*Pi/i, "").trim());
  return (
    RADIATION_ANGLES.find((angle) => angle === units) ??
    fail(`${NOT_SUPPORTED_YET}a solid angle of ${line.value} (2π, π and π/2 only)`)
  );
}

/**
 * The horn rows, S1 first, up to the first of zero length. Each row's areas and cutoff must carry its keys (S1, S2
 * and F12 for the first row, up to S4, S5 and F45 for the fourth), and each row must start at the area the row before
 * it ends at.
 */
function segmentsOf(lines: RecordLines): HornSegment[] {
  const firstArea = HORNRESP_AREA_KEYS[0];
  const start = lines.findIndex((l) => l.key === firstArea);
  if (start < 0) fail(`${MISSING_VALUE}${firstArea}`);
  const segments: HornSegment[] = [];
  for (let row = 0; row < UNUSED_LENGTH_KEYS.length; row++) {
    const [startArea, endArea, lengthLine, cutoffLine] = lines.slice(
      start + row * 4,
      start + row * 4 + 4,
    );
    if (!startArea || !endArea || !lengthLine || !cutoffLine)
      fail(`${MISSING_VALUE}the horn's row ${row + 1}`);
    const startKey = HORNRESP_AREA_KEYS[row],
      endKey = HORNRESP_AREA_KEYS[row + 1],
      cutoffKey = HORNRESP_CUTOFF_KEYS[row];
    if (startArea.key !== startKey || endArea.key !== endKey || cutoffLine.key !== cutoffKey)
      fail(
        `${INVALID_RECORD}the horn's row ${row + 1} has ${startArea.key}, ${endArea.key} and ${cutoffLine.key}, not ${startKey}, ${endKey} and ${cutoffKey}`,
      );
    const length = numberOf(lengthLine);
    if (length < 0) fail(`${INVALID_RECORD}${lengthLine.key} = ${lengthLine.value}`);
    if (length === 0) break;
    const profile =
      PROFILE_KEYS[lengthLine.key] ??
      fail(
        UNUSED_LENGTH_KEYS.includes(lengthLine.key)
          ? `${MISSING_VALUE}the flare of row ${row + 1}`
          : `${NOT_SUPPORTED_YET}a ${lengthLine.key} section`,
      );
    const s1 = numberOf(startArea),
      s2 = numberOf(endArea);
    if (!(s1 > 0 && s2 > 0))
      fail(`${NOT_SUPPORTED_YET}a section with an area of zero (row ${row + 1})`);
    const previous = segments[segments.length - 1];
    if (previous && previous.s2 !== s1)
      fail(
        `${INVALID_RECORD}the horn's row ${row + 1} starts at ${startKey} = ${s1}, not at row ${row}'s end (${previous.s2})`,
      );
    segments.push({ profile, s1, s2, length });
  }
  return segments;
}

/**
 * The driver as the planner's Thiele/Small set: Hornresp's mechanical values (Mmd, Cms, Rms) to Mms with one side's
 * air load, Fs and Qms; the record's first Le is the plain inductance.
 */
function driverOf(lines: RecordLines): BoxModelTS {
  const Sd = positiveNumber(lines, HORNRESP_KEY.coneArea),
    Cms = positiveNumber(lines, HORNRESP_KEY.compliance),
    Rms = positiveNumber(lines, HORNRESP_KEY.mechanicalResistance);
  /** the moving mass with one side's air load on the cone, kg */
  const Mms = positiveNumber(lines, HORNRESP_KEY.movingMass) / GRAMS_PER_KG + oneSideAirMass(Sd);
  /** the free-air resonance, Hz */
  const Fs = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));
  return {
    Sd,
    Bl: positiveNumber(lines, HORNRESP_KEY.forceFactor),
    Re: positiveNumber(lines, HORNRESP_KEY.coilResistance),
    Le: optionalNumber(lines, HORNRESP_KEY.inductance) ?? 0,
    Mms: Mms * GRAMS_PER_KG,
    Fs,
    Qms: (2 * Math.PI * Fs * Mms) / Rms,
    Xmax: optionalNumber(lines, HORNRESP_KEY.excursion) ?? 0,
  };
}

/** The layouts the reader takes, by the key of the record's driver count line. */
const LAYOUT_OF_KEY: Record<string, HornLayout> = {
  [HORNRESP_LAYOUT_KEY.frontLoaded]: HORN_LAYOUT.frontLoaded,
  [HORNRESP_LAYOUT_KEY.offsetDriver]: HORN_LAYOUT.offsetDriver,
  [HORNRESP_LAYOUT_KEY.tapped]: HORN_LAYOUT.tapped,
};

/**
 * The record's driver count line: the line after the first Re, whose key names the layout (Nd, OD, TH or another of
 * Hornresp's) and whose value is the number of drivers.
 */
function layoutLineOf(lines: RecordLines) {
  const re = lines.findIndex((l) => l.key === HORNRESP_KEY.coilResistance);
  if (re < 0) fail(`${MISSING_VALUE}${HORNRESP_KEY.coilResistance}`);
  return lines[re + 1] ?? fail(`${MISSING_VALUE}${HORNRESP_LAYOUT_KEY.frontLoaded}`);
}

/** The layout: the caller's, else the one the record's driver count line names. */
function layoutOf(lines: RecordLines, given: HornLayout | undefined): HornLayout {
  if (given) return given;
  const { key } = layoutLineOf(lines);
  return LAYOUT_OF_KEY[key] ?? fail(`${NOT_SUPPORTED_YET}Hornresp's ${key} layout`);
}

/** Fails for any value the reader cannot model yet (see MUST_BE_ZERO), and for more than one driver count. */
function checkSupported(lines: RecordLines) {
  for (const [key, what] of Object.entries(MUST_BE_ZERO))
    if ((optionalNumber(lines, key) ?? 0) !== 0) fail(`${NOT_SUPPORTED_YET}${what}`);
  for (const line of lines)
    if (EQ_BAND_FREQUENCY.test(line.key) && Number(line.value) !== 0)
      fail(`${NOT_SUPPORTED_YET}an equalizer band (${line.key})`);
  const { key, value } = layoutLineOf(lines);
  if (Number(value) !== 1)
    fail(`${NOT_SUPPORTED_YET}${key} other than 1 (give the drivers as one composite driver)`);
}

/**
 * A tapped horn's chamber from its volume (cm³) and its area (cm²), or null for none (either one zero, as Hornresp's
 * "Vrc and/or Lrc = 0").
 */
const tapChamberOf = (cubicCm: number, area: number): TapChamber | null =>
  cubicCm > 0 && area > 0 ? { liters: cubicCm / CM3_PER_LITER, area } : null;

/** The design the record describes, in its layout. */
function designOf(lines: RecordLines, layout: HornLayout): HornLayoutDesign {
  const segments = segmentsOf(lines);
  const ventArea = optionalNumber(lines, HORNRESP_KEY.ventArea) ?? 0;
  const ventLength = optionalNumber(lines, HORNRESP_KEY.ventLength) ?? 0;
  if (ventArea > 0 && !(ventLength > 0))
    fail(`${NOT_SUPPORTED_YET}a vent with no length (${HORNRESP_KEY.ventLength})`);
  // the flag only acts on a vent (Hornresp sets it on every tapped horn, which takes no vent here)
  if (ventArea > 0 && (optionalNumber(lines, HORNRESP_KEY.endCorrection) ?? 0) !== 0)
    fail(`${NOT_SUPPORTED_YET}Hornresp's vent end correction (${HORNRESP_KEY.endCorrection} 1)`);
  const rearLiters = requiredNumber(lines, HORNRESP_KEY.rearVolume);
  const throatCubicCm = optionalNumber(lines, HORNRESP_KEY.throatVolume) ?? 0;
  const common = {
    driver: driverOf(lines),
    drivers: 1,
    count: 1,
    angle: angleOf(lines),
    segments,
  };
  if (layout === HORN_LAYOUT.tapped) {
    if (segments.length < 3)
      fail(`${NOT_SUPPORTED_YET}a tapped horn with fewer than three sections`);
    if (ventArea > 0) fail(`${NOT_SUPPORTED_YET}a vent on a tapped horn`);
    const throatArea = optionalNumber(lines, HORNRESP_KEY.throatArea) ?? 0;
    if (throatCubicCm > 0 && !(throatArea > 0))
      fail(
        `${NOT_SUPPORTED_YET}a tapped horn's throat chamber with no area (${HORNRESP_KEY.throatArea})`,
      );
    const rearLength = optionalNumber(lines, HORNRESP_KEY.rearLength) ?? 0;
    return {
      layout,
      ...common,
      // the rears tap S3 on a three-section path, S4 on a four-section one
      frontTap: 1,
      rearTap: segments.length - 1,
      frontChamber: tapChamberOf(throatCubicCm, throatArea),
      rearChamber: tapChamberOf(
        rearLiters * CM3_PER_LITER,
        rearLength > 0 ? (rearLiters * CM3_PER_LITER) / rearLength : 0,
      ),
    };
  }
  const throatChamber = throatCubicCm / CM3_PER_LITER;
  if (!(rearLiters > 0)) fail(`${NOT_SUPPORTED_YET}an open rear (${HORNRESP_KEY.rearVolume} = 0)`);
  const rear: HornDesign["rear"] = {
    liters: rearLiters,
    port: ventArea > 0 ? { area: ventArea, length: ventLength } : null,
  };
  if (layout === HORN_LAYOUT.offsetDriver) {
    if (segments.length < 2)
      fail(`${NOT_SUPPORTED_YET}an offset-driver horn with fewer than two sections`);
    return { layout, ...common, throatChamber, rear, portOffset: 0, tap: 1 };
  }
  return { layout, ...common, throatChamber, rear, portOffset: 0 };
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
    const losses = {
      QL: direct ? BOX_LEAK_Q : Infinity,
      Qp: Infinity,
      leakRadiates: false,
      // the amplifier's output resistance, in series with the coil
      sourceResistance: optionalNumber(lines, HORNRESP_KEY.sourceResistance) ?? 0,
    };
    const preset =
      hornLayoutNetwork(design, losses) ?? fail(`${NOT_SUPPORTED_YET}these driver taps`);
    return { ok: true, design, preset, volts: requiredNumber(lines, HORNRESP_KEY.drive), losses };
  } catch (thrown) {
    if (isProblem(thrown)) return { ok: false, reason: thrown.reason };
    throw thrown;
  }
}
