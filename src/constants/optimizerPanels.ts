import { PANEL_NOMINAL_NAMES } from "./panelSizes";
import type { PanelNominal } from "../types";

/**
 * The one plywood size each optimizer designs in, for now, at its thickness as measured on the Cutlist page: ¾″ / 18 mm
 * for the PA stack, ½″ / 12 mm for the Hi-fi speakers. Its cards set that size; widen these to search more.
 */
export const PA_OPTIMIZER_PANEL = "3/4" satisfies PanelNominal;
export const HIFI_OPTIMIZER_PANEL = "1/2" satisfies PanelNominal;

/** The optimizer bar's note when your design is in another size than the optimizer's. */
export const optimizerPanelNote = (n: PanelNominal) =>
  `The optimizer designs in ${PANEL_NOMINAL_NAMES[n].name} walls.`;
