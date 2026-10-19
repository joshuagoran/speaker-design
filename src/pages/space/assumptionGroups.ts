// The Space page's coverage map assumptions, as groups of lines: read from the model's own constants and the room, so
// the list stays in step with them. The page adds its own levels and sources (SpaceAssumptions).
import {
  BAND_POINTS,
  COHERENT_BELOW_HZ,
  COVERAGE_BANDS,
  STATS_CLEARANCE_FT,
} from "../../lib/acoustics/coverage";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import {
  CROWD_BOUNCE,
  FLOOR_REFLECTION,
  MODAL_FADE_OCT,
  MODAL_HZ,
  modalCrossoverHz,
  roomAbsorption,
} from "../../lib/acoustics/roomAcoustics";
import type { CoverageRoom } from "../../types";

/** One group of assumptions: a heading and its lines. */
export type AssumptionGroup = [heading: string, lines: string[]];

/** A frequency in the list's short form: 2k for 2000 Hz. */
const hz = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

/** The groups after a map's own levels and sources: the floor, air and crowd, the room, the summing, what isn't modeled. */
export function sharedAssumptionGroups(room: CoverageRoom): AssumptionGroup[] {
  const crossover = room.outdoors ? null : modalCrossoverHz(room);
  const t60 = room.outdoors ? null : roomAbsorption(room, 1000).t60;
  const bands = Object.values(COVERAGE_BANDS)
    .map((b) => `${b.name} ${hz(b.lo)}–${hz(b.hi)}`)
    .join(", ");
  return [
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
        `Bands, Hz: ${bands}; each averaged over ${BAND_POINTS} frequencies, with more where the room modes sum.`,
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
}
