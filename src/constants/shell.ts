// The new layout's words (a test of the shell on the Stack level: library, canvas, inspector, results).
import { PROJECT_NAMES } from "./pages";

/** How far under its level the response falls at the "How low" frequency, dB. */
export const PREDICTION_LOW_DB = 6;

/** The frequency the "How wide" tile reads its angle at, Hz. */
export const PREDICTION_WIDE_HZ = 2000;

/** How far under on-axis the "How wide" angle reaches, dB. */
export const PREDICTION_WIDE_DB = -6;

/** The four answers every level shows, as tiles: each label with its tooltip. */
export const PREDICTION_TILES = {
  loud: {
    label: "How loud",
    tip: "The most it plays with music: all boxes at one volume, until the first band reaches its limit.",
  },
  low: {
    label: "How low",
    tip: `Where the response falls ${PREDICTION_LOW_DB} dB under its level.`,
  },
  wide: {
    label: "How wide",
    tip: `The horizontal angle within ${-PREDICTION_WIDE_DB} dB of on-axis, at ${PREDICTION_WIDE_HZ / 1000} kHz.`,
  },
  cost: { label: "Parts cost", tip: "The parts the cutlist lists, at catalog prices." },
  weight: { label: "Weight", tip: "All boxes, with their drivers and hardware." },
} as const;

export const SHELL_TEXT = {
  /** the line at the top: what this page is */
  preview: `A test of a new layout. The ${PROJECT_NAMES.stack} page is unchanged.`,
  library: "Library",
  yourSpeakers: "Your Speakers",
  examples: "Example Stacks",
  /** an example's button: opens it in place of the Stack on show */
  open: "Open",
  /** the canvas's views */
  front: "Front",
  view3d: "3D",
  canvasHint: `Click a box to select it. Double-click it to open its ${PROJECT_NAMES.speaker}.`,
  /** the inspector with nothing selected */
  stackHeading: PROJECT_NAMES.stack,
  selectHint: "Select a box to change it.",
  results: "Results",
  showResults: "Show results",
  hideResults: "Hide results",
} as const;
