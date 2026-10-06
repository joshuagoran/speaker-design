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
        `Target: ${level.targetDb} dB SPL in the sub band at ${COVERAGE_LEVEL_REF_PLACE[level.levelRef]}, less the music-balance tilts above the crossovers. The planner's target is ${LISTENER_TARGET_DB} dB (${target} dB in this band). The planner decreases the system level to meet the target there. It never plays past its limit.`,
        `The audience average is the mean level in dB over the floor that the stats count. "1 m from the stacks" is at ear height, 1 m along each stack's aim from its front center. The level is the average of the two stacks.`,
        `Each band plays at the planner's limit: the sub's music limit through its lowpass, and the maximum curves of the mid and horn. The balance comes from the Design page: mid ${planner.midBandTiltDb} dB below the sub, horn ${planner.hornBandTiltDb} dB below the mid. The weakest band sets the level.`,
        "Past their ends, the planner's curves follow the crossover slope and keep their end phase.",
        "The sub and mid curves are for boxes on the floor. Below the baffle step, the model replaces the floor with a reflection from each box's height. The horn's sensitivity is free field.",
      ],
    ],
    [
      "Stacks",
      [
        `On the plan, a box's drivers are at its center, at their real heights. They are time-aligned on its axis, ${ALIGN_DISTANCE_M} m out at horn height.`,
        `Linkwitz-Riley crossovers (${slopes}), with phase. Each band also has its own phase: the sub's vented box and highpass, the mid's sealed box (no voice-coil inductance) and a first-order baffle-step shelf.`,
        "Sub delay: in phase with the mid at the crossover on the stack's axis (unwrapped phase). All subs use the same delay.",
        `The sub and mid are rigid pistons. Behind the box, they lose 3 dB at ${BOX_SHADOW_HZ} Hz and 6 dB per octave above.`,
        "The horn keeps its rated coverage (−6 dB at the edges) above its control frequency. Below it, the coverage widens, at most 40 dB down.",
      ],
    ],
    [
      "Floor, air and crowd",
      [
        `Floor reflection: ${FLOOR_REFLECTION.indoors} of the pressure indoors (hard floor), ${FLOOR_REFLECTION.outdoors} outdoors (ground).`,
        `A full floor keeps the bounce below ${CROWD_BOUNCE.loHz} Hz. The bounce decreases to ${CROWD_BOUNCE.hi} of it from ${CROWD_BOUNCE.hiHz / 1000} kHz. The crowd's absorption is the seated-audience row.`,
        `Air absorption on every path: ISO 9613-1, 20 °C, 50 % humidity. Speed of sound ${SPEED_OF_SOUND} m/s.`,
      ],
    ],
    [
      "Room",
      [
        "A rectangular box with flat sides. Each side and the ceiling has its own material. Its absorption is the published octave-band data (Everest & Pohlmann), 125 Hz–4 kHz, flat outside that range.",
        `Below twice the Schroeder frequency (within ${MODAL_HZ[0]}–${MODAL_HZ[1]} Hz${crossover != null ? `; here ${Math.round(crossover)} Hz` : ""}) the model sums the room's modes and blends them into the reflections over ${MODAL_FADE_OCT} octave. The modes decay at Sabine's rate and treat every side as solid. With an open side, they are only a rough guide.`,
        `Above that: one reflection from each wall and the ceiling, each with its own floor bounce. Then an even reverberant field (Hopkins–Stryker less the first reflections; horn directivity by Molloy).${t60 != null ? ` This room rings about ${t60.toFixed(1)} s at 1 kHz.` : ""}`,
      ],
    ],
    [
      "Summing and readouts",
      [
        `Below ${COHERENT_BELOW_HZ} Hz, all sources add with phase, so the stacks interfere. Above it, a band average adds boxes and reflections by power.`,
        `Bands, Hz: ${bands}; each averaged over ${BAND_POINTS} frequencies.`,
        `The floor stats leave out ${STATS_CLEARANCE_FT} ft around every box.`,
      ],
    ],
    [
      "Not modeled",
      [
        "Non-rectangular rooms, balconies, pillars, diffraction around obstacles, people that block the direct sound, and each driver's measured directivity.",
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
