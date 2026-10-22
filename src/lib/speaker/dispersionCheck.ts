// The dispersion check at a crossover between two of a speaker's bands, on the speaker's own parts: each band's −6 dB
// beam width there, from the directivity every page shares (lib/speaker/spaceBeams `beamHalfAngles`); where the lower
// band's is narrower than the upper band's, the off-axis response dips at the crossover. One check per crossing
// (`crossingPairs`), on the lower band. Pure.
import type { BandId, SpeakerDriver, SpeakerSpec } from "../../types";
import type { ChipBody } from "./chips";
import {
  DISPERSION_COVERAGE,
  DISPERSION_MATCH_SHARE,
  DISPERSION_TEXT,
} from "../../constants/dispersionCheck";
import { CHAMBER_LOAD, DRIVER_KIND } from "../../constants/speakerSpec";
import { BEAM_EDGE_DB, DRIVER_PART } from "../../constants/space";
import { directivityAt, type CoveragePattern } from "../acoustics/coverage";
import { RAD } from "../../constants/units";
import { beamHalfAngles } from "./spaceBeams";
import { isConeKind } from "./driverParts";
import { driverPattern } from "./spaceCoverage";
import { speakerLayout } from "./speakerLayout";
import { hfBandOf } from "./speakerResponse";
import { crossingPairs } from "./stackResponse";

/** One crossing's check: the bands under and over it, where they cross (Hz, rounded), and the check without its id. */
export interface DispersionCheck {
  lower: BandId;
  upper: BandId;
  hz: number;
  chip: ChipBody;
}

/**
 * How wide `pattern` beams across at `hz` from a box `boxWIn` wide, degrees (rounded): between its −6 dB edges, as the
 * dispersion map and the Space page's beams show them; 180 where it never falls that far in front.
 */
const beamDeg = (pattern: CoveragePattern, hz: number, boxWIn: number) =>
  Math.round((2 * beamHalfAngles(directivityAt(pattern, hz, boxWIn), BEAM_EDGE_DB)[0]) / RAD);

/** What the check knows of the upper band's coverage: its beam, and how the tip says it (a figure, or a coaxial's or dome's words). */
interface UpperCoverage {
  kind: (typeof DISPERSION_COVERAGE)[keyof typeof DISPERSION_COVERAGE];
  deg: number;
}

/**
 * The band's coverage at `hz`: its first HF driver's (else its first cone's), from its horn or own waveguide, or as a
 * piston (a cone, a dome, or a coaxial's unpublished coverage).
 */
function upperCoverage(
  chambers: SpeakerSpec["cabinet"]["chambers"],
  band: BandId,
  hz: number,
  boxWIn: number,
): UpperCoverage | null {
  const placed = chambers.flatMap((c) => c.drivers.map((d) => ({ c, d })));
  const hf = placed.find(({ d }) => hfBandOf(d) === band)?.d;
  const coneAt = placed.find(({ d }) => isConeKind(d.kind) && d.bands[0] === band);
  // a cone in a horn-loaded chamber radiates from the mouth, which the check does not model
  if (!hf && coneAt?.c.load.kind === CHAMBER_LOAD.horn) return null;
  const driver: SpeakerDriver | undefined = hf ?? coneAt?.d;
  if (!driver) return null;
  const pattern = driverPattern({
    driver,
    part: hf ? DRIVER_PART.hf : DRIVER_PART.cone,
    mouth: null,
  });
  const deg = beamDeg(pattern, hz, boxWIn);
  if (pattern.horn) return { kind: DISPERSION_COVERAGE.rated, deg };
  if (!hf) return (pattern.a ?? 0) > 0 ? { kind: DISPERSION_COVERAGE.cone, deg } : null;
  // a compression driver with no horn has no coverage to compare
  if (driver.kind === DRIVER_KIND.compression) return null;
  return {
    kind:
      driver.kind === DRIVER_KIND.coaxial
        ? DISPERSION_COVERAGE.unpublished
        : DISPERSION_COVERAGE.dome,
    deg,
  };
}

/** The band's widest cone, as a piston, among chambers that are not horn-loaded; null with no such cone (or a horn's). */
function lowerPattern(
  chambers: SpeakerSpec["cabinet"]["chambers"],
  band: BandId,
): CoveragePattern | null {
  // a horn-loaded chamber's cones radiate from its mouth, which the check does not model: only direct cones count
  const radii = chambers
    .filter((c) => c.load.kind !== CHAMBER_LOAD.horn)
    .flatMap((c) => c.drivers.filter((d) => isConeKind(d.kind) && d.bands[0] === band))
    .map((driver) => driverPattern({ driver, part: DRIVER_PART.cone, mouth: null }).a ?? 0)
    .filter((a) => a > 0);
  return radii.length ? { a: Math.max(...radii) } : null;
}

/**
 * The speaker's checks, one per crossing between two of its bands (a band's lowpass meeting another's highpass), each
 * where the lower band's chip goes. None where the lower band has no cone with an area, or sits in a horn-loaded
 * chamber (its cones stand in for the mouth); none for a speaker with no crossing.
 */
export function dispersionChecks(spec: Pick<SpeakerSpec, "bands" | "cabinet">): DispersionCheck[] {
  const { bands, cabinet } = spec;
  const boxWIn = speakerLayout(cabinet).size.w;
  const nameOf = (id: BandId) => bands.find((b) => b.id === id)?.name ?? id;
  const filters = bands.map((b) => ({ crossover: { highpass: b.highpass, lowpass: b.lowpass } }));
  const all = crossingPairs(filters).flatMap((c): DispersionCheck[] => {
    const lower = bands[c.lower].id,
      upper = bands[c.upper].id;
    const xo = Math.round(c.hz);
    const pattern = lowerPattern(cabinet.chambers, lower);
    const coverage = upperCoverage(cabinet.chambers, upper, xo, boxWIn);
    if (!pattern || !coverage) return [];
    const deg = beamDeg(pattern, xo, boxWIn);
    const high = nameOf(upper);
    // the rounded angles, as the tip shows them, so the words never contradict the verdict
    const narrower = deg < coverage.deg * DISPERSION_MATCH_SHARE;
    const words = DISPERSION_TEXT.coverage;
    const said =
      coverage.kind === DISPERSION_COVERAGE.unpublished
        ? words.unpublished
        : coverage.kind === DISPERSION_COVERAGE.dome
          ? words.dome
          : words.degrees(coverage.deg);
    const chip: ChipBody = narrower
      ? ["warn", DISPERSION_TEXT.warnTitle(high), DISPERSION_TEXT.warnTip(deg, high, said, xo)]
      : ["ok", DISPERSION_TEXT.okTitle(high), DISPERSION_TEXT.okTip(deg, xo)];
    return [{ lower, upper, hz: xo, chip }];
  });
  // the first crossing of each lower band: a band's chip row holds one dispersion check
  return all.filter((k, i) => all.findIndex((o) => o.lower === k.lower) === i);
}
