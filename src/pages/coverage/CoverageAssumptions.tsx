import { DetailsDropdown } from "../../components/ui/DetailsDropdown";
import { crossoverSlopesText } from "../../constants/crossovers";
import {
  ALIGN_DISTANCE_M,
  BAND_POINTS,
  BOX_SHADOW_HZ,
  COHERENT_BELOW_HZ,
  COVERAGE_BANDS,
  SPEED_OF_SOUND,
  STATS_CLEARANCE_FT,
} from "../../lib/pa/coverage";
import {
  CROWD_BOUNCE,
  FLOOR_REFLECTION,
  MODAL_FADE_OCT,
  MODAL_HZ,
  modalCrossoverHz,
  roomAbsorption,
} from "../../lib/pa/roomAcoustics";
import { LISTENER_TARGET_DB } from "../../lib/pa/optimize";
import { COVERAGE_LEVEL_REF_PLACE } from "../../constants/coverageLevel";
import type { CoverageLayout, CoverageRoom } from "../../types";
import type { CoverageInputs } from "./useCoverageMap";

interface Props {
  room: CoverageRoom;
  /** the planner's crossover slopes and music balance */
  planner: Pick<
    CoverageInputs,
    "subMidCrossoverOrder" | "midHornCrossoverOrder" | "midBandTiltDb" | "hornBandTiltDb"
  >;
  /** the target in the band on show, dB */
  target: number;
  /** the target level and where it is measured */
  level: Pick<CoverageLayout, "targetDb" | "levelRef">;
}

/** One group of assumptions: a heading and its lines. */
type Group = [heading: string, lines: string[]];

/**
 * How the map is modeled: everything the calculation takes as given, read from the model's own constants and the
 * design so the list stays in step with them. Folded away until opened.
 */
export function CoverageAssumptions({ room, planner, target, level }: Props) {
  const crossover = room.outdoors ? null : modalCrossoverHz(room);
  const t60 = room.outdoors ? null : roomAbsorption(room, 1000).t60;
  const hz = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
  const bands = Object.values(COVERAGE_BANDS)
    .map((b) => `${b.name} ${hz(b.lo)}–${hz(b.hi)}`)
    .join(", ");
  const slopes = crossoverSlopesText(planner.subMidCrossoverOrder, planner.midHornCrossoverOrder);
  const groups: Group[] = [
    [
      "Levels",
      [
        `Target: ${level.targetDb} dB SPL in the sub band at ${COVERAGE_LEVEL_REF_PLACE[level.levelRef]}, less the music-balance tilts (planner: ${LISTENER_TARGET_DB} dB, ${target} dB in this band), never past the limit.`,
        `Audience average: the mean dB over the counted floor. "1 m from the stacks": ear height, on each stack's aim, averaged.`,
        `Design-page balance: mid ${planner.midBandTiltDb} dB below the sub, horn ${planner.hornBandTiltDb} dB below the mid. The weakest band sets the level.`,
        "Past their ends, curves follow the crossover slope with their end phase.",
        "Sub and mid curves: boxes on the floor; below the baffle step, a reflection from each box's height. Horn sensitivity: free field.",
      ],
    ],
    [
      "Stacks",
      [
        `Drivers at each box's center and real height, time-aligned ${ALIGN_DISTANCE_M} m out at horn height.`,
        `Linkwitz-Riley crossovers (${slopes}) with phase, plus each band's own: vented sub and highpass, sealed mid (no voice-coil inductance), first-order baffle-step shelf.`,
        "Sub delay: in phase with the mid at the crossover on axis, one for all subs.",
        `Sub and mid: rigid pistons, behind the box −3 dB at ${BOX_SHADOW_HZ} Hz and 6 dB/octave above.`,
        "Horn: rated coverage (−6 dB at the edges) above its control frequency, wider below, at most 40 dB down.",
      ],
    ],
    [
      "Floor, air and crowd",
      [
        `Floor reflection: ${FLOOR_REFLECTION.indoors} of the pressure indoors (hard floor), ${FLOOR_REFLECTION.outdoors} outdoors (ground).`,
        `A full floor keeps the bounce below ${CROWD_BOUNCE.loHz} Hz, ${CROWD_BOUNCE.hi} of it from ${CROWD_BOUNCE.hiHz / 1000} kHz. Absorption: the seated-audience row.`,
        `Air absorption on every path: ISO 9613-1, 20 °C, 50 % humidity. Speed of sound ${SPEED_OF_SOUND} m/s.`,
      ],
    ],
    [
      "Room",
      [
        "A rectangular box. Each side and the ceiling has its own absorption (Everest & Pohlmann, 125 Hz–4 kHz).",
        `Below twice the Schroeder frequency (within ${MODAL_HZ[0]}–${MODAL_HZ[1]} Hz${crossover != null ? `; here ${Math.round(crossover)} Hz` : ""}) the room modes sum, blended over ${MODAL_FADE_OCT} octave; Sabine decay, solid sides (rough if a side is open).`,
        `Above: one reflection per wall and ceiling, each with a floor bounce, then a reverberant field (Hopkins–Stryker; Molloy horn directivity).${t60 != null ? ` This room rings about ${t60.toFixed(1)} s at 1 kHz.` : ""}`,
      ],
    ],
    [
      "Summing and readouts",
      [
        `Below ${COHERENT_BELOW_HZ} Hz, sources add with phase (the stacks interfere); above, band averages add by power.`,
        `Bands, Hz: ${bands}; each averaged over ${BAND_POINTS} frequencies.`,
        `The floor stats leave out ${STATS_CLEARANCE_FT} ft around every box.`,
      ],
    ],
    [
      "Not modeled",
      [
        "Non-rectangular rooms, balconies, pillars, diffraction, crowd shadowing, measured driver directivity.",
      ],
    ],
  ];
  return (
    <DetailsDropdown summary="Assumptions">
      {groups.map(([heading, lines]) => (
        <div key={heading}>
          <div className="text-stone-900 mb-0.5">{heading}</div>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </DetailsDropdown>
  );
}
