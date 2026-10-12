// The music balance: how far each band's level sits below the band under it, in dB (a level, not an angle). A saved
// design keeps the first key names, `tilt` (mid below sub) and `hfTilt` (horn below mid), so every older save loads.
// Also the bands balanced to it at their limits, as the coverage map plays them.
import { highpassPhase, subMusicThroughLowpass } from "./calc";
import { balanceLevels, withOwnPhase } from "./coverage";
import type { PaDerivedDesign, PaDesignInputs } from "./paDesign";
import type { BalancedLevels, CoverageStack, MusicBalance, PaDesignConfig } from "../../types";

/** The keys a design saves the music balance under. */
export const musicBalanceToSave = (
  midBelowSubDb: number,
  hornBelowMidDb: number,
): Pick<PaDesignConfig, "tilt" | "hfTilt"> => ({ tilt: midBelowSubDb, hfTilt: hornBelowMidDb });

/** The music balance a saved design holds; null where it has none (the planner keeps its current value). */
export const savedMusicBalance = (c: Partial<Pick<PaDesignConfig, "tilt" | "hfTilt">>) => ({
  midBelowSubDb: typeof c.tilt === "number" ? c.tilt : null,
  hornBelowMidDb: typeof c.hfTilt === "number" ? c.hfTilt : null,
});

/** The PA design's fields the balanced levels read: its models, crossovers, sub box and music balance. */
export type PaBalanceInputs = Pick<
  PaDerivedDesign,
  | "stackGeometry"
  | "effectiveMidBoxDims"
  | "subModeled"
  | "subAmpVoltage"
  | "midModeled"
  | "hornModel"
> &
  Pick<
    PaDesignInputs,
    | "subMidCrossoverHz"
    | "subMidCrossoverOrder"
    | "subHighpassHz"
    | "subHighpassType"
    | "midHornCrossoverHz"
    | "midHornCrossoverOrder"
  > & {
    /** the sub box as modeled (at least what its parts need) */
    subBox: PaDesignInputs["subBoxDims"];
    /** the music balance: the mid band's level below the sub's, dB */
    midBelowSubDb: MusicBalance["tilt"];
    /** the music balance: the horn band's level below the mid's, dB */
    hornBelowMidDb: MusicBalance["hfTilt"];
  };

/** The design's music balance: its crossovers, and each band's level under the one below. */
export const musicBalanceOf = (
  p: Pick<
    PaBalanceInputs,
    "subMidCrossoverHz" | "midHornCrossoverHz" | "midBelowSubDb" | "hornBelowMidDb"
  >,
): MusicBalance => ({
  xoLo: p.subMidCrossoverHz,
  xoHi: p.midHornCrossoverHz,
  tilt: p.midBelowSubDb,
  hfTilt: p.hornBelowMidDb,
});

/** The stack the map places, but for its sub delay: the dispersion model's, the sub's footprint, the mid box's width. */
export const coverageGeometry = (
  p: Pick<PaBalanceInputs, "stackGeometry" | "subBox" | "effectiveMidBoxDims">,
): Omit<CoverageStack, "subDelayMs"> | null =>
  p.stackGeometry
    ? {
        ...p.stackGeometry,
        footprint: { w: p.subBox.w, d: p.subBox.d },
        midW: p.effectiveMidBoxDims.w,
      }
    : null;

/**
 * Each band at the design's own limit (the sub at its music limit through its lowpass, the mid and horn as the system
 * chart draws them), with the sub's and mid's own phase, then balanced: the weakest band sets the level. Null without
 * a mid model or a stack.
 */
export function balancedLevelsOf(
  p: Pick<
    PaBalanceInputs,
    | "subModeled"
    | "midModeled"
    | "hornModel"
    | "subAmpVoltage"
    | "subMidCrossoverHz"
    | "subHighpassHz"
    | "subHighpassType"
  >,
  geometry: Omit<CoverageStack, "subDelayMs"> | null,
  balance: MusicBalance,
): BalancedLevels | null {
  const { subModeled, midModeled, hornModel } = p;
  if (!midModeled || !geometry) return null;
  return balanceLevels(
    {
      sub: subModeled
        ? withOwnPhase(
            subMusicThroughLowpass(
              subModeled.mdl,
              subModeled.lim,
              p.subAmpVoltage,
              p.subMidCrossoverHz,
              geometry.orderLo,
            ),
            subModeled.mdl.curve,
            (f) => highpassPhase(f, p.subHighpassHz, p.subHighpassType),
          )
        : null,
      mid: withOwnPhase(midModeled.max, midModeled.mdl.curve),
      horn: hornModel ? hornModel.curve : [],
    },
    balance,
    geometry,
  );
}
