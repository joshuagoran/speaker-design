// The Space page's target across the bands and where it is measured ("Measured at" and the music balance). Pure.
//
// The target is the venue's level in the lowest band. Each band above a crossover of the space's stacks is the band
// balance's step lower there (Flat: 0 dB; More bass: `MORE_BASS_STEP_DB`, a larger step at a sub crossover). A band's
// target is the target at its center (or at the one frequency). The reference Calculate gains reads: the audience's
// average (the floor but the space in front of each box), the listener, or the mean of the levels 1 m in front of each placement, on its aim.
import type { FloorPoint, SpaceDesign, SpaceVenue, SpeakerBand, SpeakerSpec } from "../../types";
import { oneMeterSpot, type COVERAGE_BANDS } from "../acoustics/coverage";
import { PA_SLIDERS } from "../../constants/paSliders";
import { expandPlacements, placementStack } from "./spaceLayout";
import { stackCrossoversHz } from "./stackResponse";
import type { SpaceModel } from "./spaceCoverage";
import { BAND_BALANCE, SPACE_TEXT, type BandBalance } from "../../constants/space";

/**
 * More bass: how far the target steps down at a crossover, dB: at a sub crossover (at or below
 * `SUB_CROSSOVER_MAX_HZ`), and above it.
 */
export const MORE_BASS_STEP_DB = { sub: 6, high: 3 } as const;

/** The highest crossover that takes More bass's sub step, Hz: the PA designs' highest sub-to-mid crossover. */
export const SUB_CROSSOVER_MAX_HZ = PA_SLIDERS.xoLo.max;

/** The Band balance tooltip: what each option does, with the steps of More bass. */
export const BAND_BALANCE_TIP = SPACE_TEXT.bandBalanceTip(
  MORE_BASS_STEP_DB.sub,
  MORE_BASS_STEP_DB.high,
  SUB_CROSSOVER_MAX_HZ,
);

/** How far the target steps down at a crossover at `hz` under the band balance, dB. */
const balanceStepAt = (hz: number, balance: BandBalance) =>
  balance === BAND_BALANCE.flat
    ? 0
    : hz <= SUB_CROSSOVER_MAX_HZ
      ? MORE_BASS_STEP_DB.sub
      : MORE_BASS_STEP_DB.high;

/**
 * Every crossover the space plays, Hz, low to high, once each: of its stacks' members and their speakers' bands, and
 * between placements (a sub alone and the tops on their stands cross between their input ranges).
 */
export function spaceCrossoversHz(design: Pick<SpaceDesign, "space" | "stacks" | "speakers">) {
  const members = expandPlacements(design.space.placements).flatMap(
    (p) => placementStack(design, p.item)?.stack.members ?? [],
  );
  return stackCrossoversHz({ members }, design.speakers);
}

/** The target at `f`, dB: the lowest band's, less the band balance's step at each crossover at or below `f`. */
export const spaceTargetAt = (
  targetDb: number,
  f: number,
  crossovers: readonly number[],
  balance: BandBalance,
) => crossovers.reduce((t, hz) => (hz <= f ? t - balanceStepAt(hz, balance) : t), targetDb);

/** A placement's footprint as `oneMeterSpot` takes it: none, its spot is already its front. */
const FRONT_SPOT = { w: 0, d: 0 };

/**
 * The spots 1 m in front of each placement, ft: from its base's front center along its aim, at ear height ("1 m from the
 * stacks", lib/acoustics/coverage oneMeterSpot), kept on the floor.
 */
export function oneMeterSpots(
  design: Pick<SpaceDesign, "space">,
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">,
): FloorPoint[] {
  return expandPlacements(design.space.placements).map((p) =>
    // its spot is its front: no depth to step past
    oneMeterSpot({ x: p.x, y: p.y, aim: p.aim.yawDeg }, FRONT_SPOT, room),
  );
}

/** A frequency range, Hz: a band's (`COVERAGE_BANDS`), or one frequency as `lo` = `hi`. */
export type BandRange = Pick<(typeof COVERAGE_BANDS)["sub"], "lo" | "hi">;

/** A box's passband corners, Hz; null where it has no such filter (open on that side). */
export interface PassbandCorners {
  highpassHz: number | null;
  lowpassHz: number | null;
}

/** A spot 1 m in front of a placement, with the corners of every band its boxes play (`placementPassbands`). */
export interface MeterSpot {
  at: FloorPoint;
  passbands: readonly PassbandCorners[];
}

/**
 * One band's passband: its own filters and its box's crossover in the stack (a speaker alone: its input range), the
 * higher highpass and the lower lowpass of each pair.
 */
export function bandPassband(
  band: Pick<SpeakerBand, "highpass" | "lowpass">,
  crossover: SpeakerSpec["input"],
): PassbandCorners {
  const highest = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? (a ?? b ?? null) : Math.max(a, b);
  const lowest = (a: number | undefined, b: number | undefined) =>
    a === undefined || b === undefined ? (a ?? b ?? null) : Math.min(a, b);
  return {
    highpassHz: highest(band.highpass?.hz, crossover.highpass?.hz),
    lowpassHz: lowest(band.lowpass?.hz, crossover.lowpass?.hz),
  };
}

/**
 * The passband of each band of each box of a placement (`bandPassband`). Empty where the design lacks what the
 * placement places.
 */
export function placementPassbands(stack: ReturnType<typeof placementStack>): PassbandCorners[] {
  if (!stack) return [];
  return stack.stack.members.flatMap((member) => {
    const speaker = stack.speakers.find((s) => s.id === member.speakerId);
    return (speaker?.bands ?? []).map((band) => bandPassband(band, member.crossover));
  });
}

/**
 * Whether a placement plays in a band: one of its box bands has a passband that overlaps the band's range (its
 * highpass is below the range's top and its lowpass above the range's bottom; a missing corner is open). A sub
 * lowpassed at 120 Hz doesn't play in the High band; a top highpassed at 120 Hz doesn't play in the Sub band.
 */
export const playsInBand = (passbands: readonly PassbandCorners[], range: BandRange): boolean =>
  passbands.some(
    ({ highpassHz, lowpassHz }) =>
      (highpassHz === null || highpassHz < range.hi) &&
      (lowpassHz === null || lowpassHz > range.lo),
  );

/**
 * The 1 m spots of the placements the model holds a stack or speaker for, each with the bands its boxes play (the
 * Space page's reference reads them). The model's placements are in the space's order, as `oneMeterSpots` are.
 */
export function meterSpotsOf(
  design: Pick<SpaceDesign, "space">,
  model: Pick<SpaceModel, "placements">,
  room: Pick<SpaceVenue["room"], "widthFt" | "lengthFt">,
): MeterSpot[] {
  return oneMeterSpots(design, room).flatMap((at, k) => {
    const box = model.placements[k];
    return box?.response ? [{ at, passbands: placementPassbands(box.item.stack) }] : [];
  });
}
