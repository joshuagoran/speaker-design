import { UI_TEXT } from "../../constants/uiText";
import { AssumptionsList } from "../../components/ui/AssumptionsList";
import {
  BOX_SHADOW_HZ,
  COHERENT_BELOW_HZ,
  SINGLE_FREQ_RANGE,
  STATS_CLEARANCE_FT,
} from "../../lib/acoustics/coverage";
import { SPACE_DETAILS, SPACE_LEVEL_REF_PLACE } from "../../constants/space";
import { AUTO_BALANCE_MODE, type AutoBalanceMode } from "../../constants/autoBalance";
import { STACK_LISTEN_DISTANCE_M } from "../../constants/speakerSpec";
import { sharedAssumptionGroups, stageSoundLines, type AssumptionGroup } from "./assumptionGroups";
import type { CoverageLevelRef, SpaceVenue } from "../../types";

interface Props {
  venue: Pick<SpaceVenue, "room" | "targetDb">;
  levelRef: CoverageLevelRef;
  balance: AutoBalanceMode;
  /** the target in the band on show, dB */
  target: number;
}

/**
 * How the Space page's map is modeled, for any stacks and speakers: the levels and the
 * sources the space plays, then the floor, room and summing both maps share. Folded away until opened.
 */
export function SpaceAssumptions({ venue, levelRef, balance, target }: Props) {
  const groups: AssumptionGroup[] = [
    [SPACE_DETAILS.marks, [...SPACE_DETAILS.markLines]],
    [SPACE_DETAILS.map, [...SPACE_DETAILS.mapLines(SINGLE_FREQ_RANGE[1], COHERENT_BELOW_HZ)]],
    [
      SPACE_DETAILS.levels,
      [
        SPACE_DETAILS.targetLine(
          venue.targetDb,
          SPACE_LEVEL_REF_PLACE[levelRef],
          Math.round(target),
        ),
        balance === AUTO_BALANCE_MODE.moreBass ? SPACE_DETAILS.moreBass : SPACE_DETAILS.flat,
        SPACE_DETAILS.headroom,
        SPACE_DETAILS.turnDown,
        SPACE_DETAILS.perBand,
        SPACE_DETAILS.bandLevel,
        SPACE_DETAILS.audience(STATS_CLEARANCE_FT),
        SPACE_DETAILS.oneMeter(SPACE_LEVEL_REF_PLACE.stacks),
      ],
    ],
    [SPACE_DETAILS.stages, [...SPACE_DETAILS.stageLines, ...stageSoundLines()]],
    [
      SPACE_DETAILS.boxes,
      [
        ...SPACE_DETAILS.boxLines(STACK_LISTEN_DISTANCE_M),
        `Cones and horn mouths: rigid pistons, behind the box −3 dB at ${BOX_SHADOW_HZ} Hz and 6 dB/octave above.`,
        "Horns and waveguides: rated coverage (−6 dB at the edges) above their control frequency, wider below.",
      ],
    ],
    ...sharedAssumptionGroups(venue.room),
  ];
  return <AssumptionsList groups={groups} summary={UI_TEXT.details} />;
}
