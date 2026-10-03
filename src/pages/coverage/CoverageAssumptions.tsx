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
import type { CoverageRoom } from "../../types";

interface Props {
  room: CoverageRoom;
}

/** One group of fixed assumptions: a heading and its lines. */
type Group = [heading: string, lines: string[]];

/**
 * The fixed assumptions behind the map: everything the calculation takes as given that has no control on the page,
 * read from the model's own constants so the list stays in step with it. Folded away until opened.
 */
export function CoverageAssumptions({ room }: Props) {
  const crossover = room.outdoors ? null : modalCrossoverHz(room);
  const t60 = room.outdoors ? null : roomAbsorption(room, 1000).t60;
  const hz = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
  const bands = Object.values(COVERAGE_BANDS)
    .map((b) => `${b.name} ${hz(b.lo)}–${hz(b.hi)}`)
    .join(", ");
  const groups: Group[] = [
    [
      "Levels",
      [
        `Target: ${LISTENER_TARGET_DB} dB SPL at the listener in the sub band, less the music-balance tilts above the crossovers.`,
        "Each band at the planner's own limit: the sub at its music limit through its lowpass, the mid and horn at their maximum curves. The band with the least to spare sets the level.",
        "The planner's curves are carried past their ends along the crossover slope, their own phase held at the end.",
        "The sub and mid curves are taken as measured on the floor (half space); below the baffle step the map removes that and adds the floor back as a reflection. The horn's sensitivity is taken as free field.",
      ],
    ],
    [
      "Stacks",
      [
        "Every driver of a box sits at the box's center on the floor plan, at its real height.",
        `Each box's drivers are time-aligned on its axis ${ALIGN_DISTANCE_M} m out, at horn height.`,
        "Crossovers: Linkwitz-Riley, with their phase (the slopes are set on the Design page).",
        `Sub and mid radiate as rigid pistons. Behind a box they lose 3 dB at ${BOX_SHADOW_HZ} Hz and 6 dB per octave above it.`,
        "The horn holds its rated coverage (−6 dB at the edges) above its control frequency and widens below it, never dropping more than 40 dB.",
        "Each band's own phase from the planner's models: the sub's vented box and its highpass, the mid's sealed box (no voice-coil inductance). The baffle step is a first-order shelf, with its phase.",
        "Sub delay: auto puts the sub in phase with the mid at the crossover on the stack's axis (of the delays that do, the one nearest the difference in their group delays); one delay for every sub, in the stacks or in the middle.",
      ],
    ],
    [
      "Floor, air and crowd",
      [
        `Floor reflection: ${FLOOR_REFLECTION.indoors} of the pressure indoors (a hard floor), ${FLOOR_REFLECTION.outdoors} outdoors (ground).`,
        `A full floor: the floor bounce is unchanged below ${CROWD_BOUNCE.loHz} Hz and falls to ${CROWD_BOUNCE.hi} of it at ${CROWD_BOUNCE.hiHz / 1000} kHz and above. Its absorption uses the published row for a seated audience.`,
        "People blocking the direct sound are not modelled.",
        `Air absorption on every path: ISO 9613-1 at 20 °C and 50 % relative humidity. Speed of sound ${SPEED_OF_SOUND} m/s.`,
      ],
    ],
    [
      "Room",
      [
        "A rectangular box with flat surfaces. Material absorption: typical published octave-band values (Everest & Pohlmann), from 125 Hz to 4 kHz, held flat outside that range.",
        `Room modes below twice the Schroeder frequency, kept within ${MODAL_HZ[0]}–${MODAL_HZ[1]} Hz, blending into the reflection model over ${MODAL_FADE_OCT} octave.${crossover != null ? ` In this room: ${Math.round(crossover)} Hz.` : ""}`,
        "Modes all decay at one rate, from Sabine's reverberation time. They take every side as solid, so with an open side they are only a rough guide.",
        "Above that: one reflection off each wall and the ceiling (each with its own floor bounce), then an even reverberant field (Hopkins–Stryker, less the first reflection's share).",
        `Horns' directivity for the reverberant field: Molloy's estimate from their coverage.${t60 != null ? ` This room rings for about ${t60.toFixed(1)} s at 1 kHz.` : ""}`,
        "Not modelled: rooms that aren't rectangles, balconies, pillars, and sound bending around obstacles.",
      ],
    ],
    [
      "Summing and readouts",
      [
        `Below ${COHERENT_BELOW_HZ} Hz everything adds with phase. Above it, a band average adds the boxes and reflections by power.`,
        `Bands, Hz: ${bands}; each averaged over ${BAND_POINTS} frequencies.`,
        `The floor stats leave out ${STATS_CLEARANCE_FT} ft around every box.`,
      ],
    ],
  ];
  return (
    <details className="text-sm text-stone-500 max-w-prose">
      <summary className="cursor-pointer text-stone-900 font-semibold py-2">
        Assumptions (fixed in the calculation)
      </summary>
      <div className="flex flex-col gap-3 pt-1">
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
      </div>
    </details>
  );
}
