import { AssumptionsList } from "../../components/ui/AssumptionsList";
import { BOX_SHADOW_HZ } from "../../lib/pa/coverage";
import { SPACE_LEVEL_REF_PLACE } from "../../constants/space";
import { AUTO_BALANCE_MODE_LABEL, type AutoBalanceMode } from "../../constants/autoBalance";
import { STACK_LISTEN_DISTANCE_M } from "../../constants/speakerSpec";
import { sharedAssumptionGroups, type AssumptionGroup } from "../coverage/assumptionGroups";
import type { CoverageLevelRef, SpaceVenue } from "../../types";

interface Props {
  venue: Pick<SpaceVenue, "room" | "targetDb">;
  levelRef: CoverageLevelRef;
  balance: AutoBalanceMode;
  /** the target in the band on show, dB */
  target: number;
}

/**
 * How the Space page's map is modeled (the PA Coverage page's list, for any stacks and speakers): the levels and the
 * sources the space plays, then the floor, room and summing both maps share. Folded away until opened.
 */
export function SpaceAssumptions({ venue, levelRef, balance, target }: Props) {
  const groups: AssumptionGroup[] = [
    [
      "Levels",
      [
        `Target: ${venue.targetDb} dB SPL in the lowest band at ${SPACE_LEVEL_REF_PLACE[levelRef]}, music balance ${AUTO_BALANCE_MODE_LABEL[balance].toLowerCase()} (${target.toFixed(0)} dB in this band), never past the limit.`,
        `Audience average: the mean dB over the listening area. "${SPACE_LEVEL_REF_PLACE.stacks}": ear height, 1 m in front of each placed stack or speaker that has a model, on its aim, averaged.`,
        "One input drives the whole space. Each band plays at its Level and its box's level; the placement with the least headroom sets the level.",
      ],
    ],
    [
      "Stacks and speakers",
      [
        `Each box's speaker in the Speaker page's model, through its crossover, with the stack's delays (in phase at the crossovers ${STACK_LISTEN_DISTANCE_M} m out).`,
        "Each driver at its own place in its speaker, on its box's aim: its cabinet's kick-back, its tilt in the stack and the placement's.",
        "Each cone band: a first-order baffle-step shelf. Each placement's level and delay.",
        `Cones and horn mouths: rigid pistons, behind the box −3 dB at ${BOX_SHADOW_HZ} Hz and 6 dB/octave above.`,
        "Horns and waveguides: rated coverage (−6 dB at the edges) above their control frequency, wider below, at most 40 dB down.",
      ],
    ],
    ...sharedAssumptionGroups(venue.room),
  ];
  return <AssumptionsList groups={groups} />;
}
