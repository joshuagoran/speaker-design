import { AssumptionsList } from "../../components/ui/AssumptionsList";
import { crossoverSlopesText } from "../../constants/crossovers";
import { ALIGN_DISTANCE_M, BOX_SHADOW_HZ } from "../../lib/pa/coverage";
import { LISTENER_TARGET_DB } from "../../lib/pa/optimize";
import { COVERAGE_LEVEL_REF_PLACE } from "../../constants/coverageLevel";
import { sharedAssumptionGroups, type AssumptionGroup } from "./assumptionGroups";
import type { CoverageLayout, CoverageRoom } from "../../types";
import type { CoverageInputs } from "./useCoverageMap";

interface Props {
  room: CoverageRoom;
  /** the planner's crossover slopes and music balance */
  planner: Pick<
    CoverageInputs,
    "subMidCrossoverOrder" | "midHornCrossoverOrder" | "midBelowSubDb" | "hornBelowMidDb"
  >;
  /** the target in the band on show, dB */
  target: number;
  /** the target level and where it is measured */
  level: Pick<CoverageLayout, "targetDb" | "levelRef">;
}

/**
 * How the map is modeled: everything the calculation takes as given, read from the model's own constants and the
 * design so the list stays in step with them. Folded away until opened.
 */
export function CoverageAssumptions({ room, planner, target, level }: Props) {
  const slopes = crossoverSlopesText(planner.subMidCrossoverOrder, planner.midHornCrossoverOrder);
  const groups: AssumptionGroup[] = [
    [
      "Levels",
      [
        `Target: ${level.targetDb} dB SPL in the sub band at ${COVERAGE_LEVEL_REF_PLACE[level.levelRef]}, less the music-balance levels (planner: ${LISTENER_TARGET_DB} dB, ${target} dB in this band), never past the limit.`,
        `Audience average: the mean dB over the counted floor. "1 m from the stacks": ear height, on each stack's aim, averaged.`,
        `Design-page balance: mid ${planner.midBelowSubDb} dB below the sub, horn ${planner.hornBelowMidDb} dB below the mid. The weakest band sets the level.`,
        "Past their ends, curves follow the crossover slope with their end phase.",
        "Sub and mid curves: boxes on the floor; below the baffle step, a reflection from each box's height. Horn sensitivity: free field.",
      ],
    ],
    [
      "Stacks",
      [
        `Drivers at each box's center and real height, time-aligned ${ALIGN_DISTANCE_M} m out at horn height.`,
        `Linkwitz-Riley crossovers (${slopes}) with phase, plus each band's own: vented sub and highpass, sealed mid (with its voice-coil inductance where listed), first-order baffle-step shelf.`,
        "Sub delay: in phase with the mid at the crossover on axis, one for all subs.",
        `Sub and mid: rigid pistons, behind the box −3 dB at ${BOX_SHADOW_HZ} Hz and 6 dB/octave above.`,
        "Horn: rated coverage (−6 dB at the edges) above its control frequency, wider below, at most 40 dB down.",
      ],
    ],
    ...sharedAssumptionGroups(room),
  ];
  return <AssumptionsList groups={groups} />;
}
