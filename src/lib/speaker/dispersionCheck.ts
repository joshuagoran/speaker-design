// The dispersion check at a crossover between two of a speaker's bands, as the Hi-fi page's check but on the speaker's
// own parts: the lower band's cone is as wide as it gets until its beam narrows (ka, its circumference over the
// wavelength, past DISPERSION_NARROW_KA), and below the upper band's coverage the off-axis response dips at the
// crossover. One check per crossing (`crossingPairs`), on the lower band. Pure.
import type { BandId, SpeakerDriver, SpeakerSpec } from "../../types";
import type { ChipBody } from "../pa/chips";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import {
  DISPERSION_COVERAGE,
  DISPERSION_DOME_COVERAGE_DEG,
  DISPERSION_FULL_BEAM_DEG,
  DISPERSION_MATCH_SHARE,
  DISPERSION_NARROW_KA,
  DISPERSION_TEXT,
} from "../../constants/dispersionCheck";
import { CHAMBER_LOAD, DRIVER_KIND } from "../../constants/speakerSpec";
import { DRIVER_PART } from "../../constants/space";
import { RAD, SQ_CM_PER_SQ_M } from "../../constants/units";
import { coneParts, isConeKind } from "./driverParts";
import { driverPattern } from "./spaceCoverage";
import { hfBandOf } from "./speakerResponse";
import { crossingPairs } from "./stackResponse";

/** One crossing's check: the bands under and over it, where they cross (Hz, rounded), and the check without its id. */
export interface DispersionCheck {
  lower: BandId;
  upper: BandId;
  hz: number;
  chip: ChipBody;
}

/** How wide a cone of area `sdCm2` (cm²) beams at `hz`, degrees: all of `DISPERSION_FULL_BEAM_DEG` until it narrows. */
function beamDeg(sdCm2: number, hz: number): number {
  const radiusM = Math.sqrt(sdCm2 / SQ_CM_PER_SQ_M / Math.PI);
  const ka = ((2 * Math.PI * hz) / SPEED_OF_SOUND) * radiusM;
  return ka <= DISPERSION_NARROW_KA
    ? DISPERSION_FULL_BEAM_DEG
    : (2 * Math.asin(DISPERSION_NARROW_KA / ka)) / RAD;
}

/** What the check knows of the upper band's coverage: a rated horn's, a cone's beam, a coaxial's unpublished one, or a dome. */
type UpperCoverage =
  | { kind: typeof DISPERSION_COVERAGE.rated | typeof DISPERSION_COVERAGE.cone; deg: number }
  | { kind: typeof DISPERSION_COVERAGE.unpublished | typeof DISPERSION_COVERAGE.dome };

/**
 * The band's coverage at `hz`: its first HF driver's (else its first cone's), from its horn or own waveguide; a cone with
 * neither covers its own beam there; an HF driver with neither is a dome (or a coaxial's unpublished coverage).
 */
function upperCoverage(
  chambers: SpeakerSpec["cabinet"]["chambers"],
  band: BandId,
  hz: number,
): UpperCoverage | null {
  const drivers = chambers.flatMap((c) => c.drivers);
  const hf = drivers.find((d) => hfBandOf(d) === band);
  const cone = drivers.find((d) => isConeKind(d.kind) && d.bands[0] === band);
  const driver: SpeakerDriver | undefined = hf ?? cone;
  if (!driver) return null;
  const part = hf ? DRIVER_PART.hf : DRIVER_PART.cone;
  const pattern = driverPattern({ driver, part, mouth: null });
  if (pattern.horn) return { kind: DISPERSION_COVERAGE.rated, deg: Math.round(pattern.horn.covH) };
  const sd = hf ? 0 : (coneParts(driver)?.ts.Sd ?? 0);
  if (sd > 0) return { kind: DISPERSION_COVERAGE.cone, deg: Math.round(beamDeg(sd, hz)) };
  return {
    kind:
      hf && driver.kind === DRIVER_KIND.coaxial
        ? DISPERSION_COVERAGE.unpublished
        : DISPERSION_COVERAGE.dome,
  };
}

/** The largest cone area on the band, cm², among chambers that are not horn-loaded; null with no such cone (or a horn's). */
function lowerSdCm2(chambers: SpeakerSpec["cabinet"]["chambers"], band: BandId): number | null {
  const cones = chambers.flatMap((c) =>
    c.drivers.filter((d) => isConeKind(d.kind) && d.bands[0] === band).map((d) => ({ c, d })),
  );
  if (cones.length === 0 || cones.some(({ c }) => c.load.kind === CHAMBER_LOAD.horn)) return null;
  const sds = cones.map(({ d }) => coneParts(d)?.ts.Sd ?? 0).filter((sd) => sd > 0);
  return sds.length ? Math.max(...sds) : null;
}

/**
 * The speaker's checks, one per crossing between two of its bands (a band's lowpass meeting another's highpass), each
 * where the lower band's chip goes. None where the lower band has no cone with an area, or sits in a horn-loaded
 * chamber (its cones stand in for the mouth); none for a speaker with no crossing.
 */
export function dispersionChecks(spec: Pick<SpeakerSpec, "bands" | "cabinet">): DispersionCheck[] {
  const { bands, cabinet } = spec;
  const nameOf = (id: BandId) => bands.find((b) => b.id === id)?.name ?? id;
  const filters = bands.map((b) => ({ crossover: { highpass: b.highpass, lowpass: b.lowpass } }));
  const all = crossingPairs(filters).flatMap((c): DispersionCheck[] => {
    const lower = bands[c.lower].id,
      upper = bands[c.upper].id;
    const xo = Math.round(c.hz);
    const sd = lowerSdCm2(cabinet.chambers, lower);
    const coverage = upperCoverage(cabinet.chambers, upper, xo);
    if (sd === null || !coverage) return [];
    const beam = beamDeg(sd, xo);
    const deg = Math.round(beam);
    const high = nameOf(upper);
    const covered = "deg" in coverage ? coverage.deg : DISPERSION_DOME_COVERAGE_DEG;
    const narrower = beam < Math.min(covered, DISPERSION_FULL_BEAM_DEG) * DISPERSION_MATCH_SHARE;
    const words = DISPERSION_TEXT.coverage;
    const said =
      "deg" in coverage
        ? words.rated(coverage.deg)
        : coverage.kind === DISPERSION_COVERAGE.unpublished
          ? words.unpublished
          : words.dome;
    const chip: ChipBody = narrower
      ? ["warn", DISPERSION_TEXT.warnTitle(high), DISPERSION_TEXT.warnTip(deg, high, said, xo)]
      : ["ok", DISPERSION_TEXT.okTitle(high), DISPERSION_TEXT.okTip(deg, xo)];
    return [{ lower, upper, hz: xo, chip }];
  });
  // the first crossing of each lower band: a band's chip row holds one dispersion check
  return all.filter((k, i) => all.findIndex((o) => o.lower === k.lower) === i);
}
