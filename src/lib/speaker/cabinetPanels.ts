// The panel sizes the Speaker page sets on a spec, as the PA page sets them on its design: the walls' size (the baffle
// of a frame box stays ¾″, lib/pa/calc BAFFLE_PLY_IN). Pure.
import type { PanelNominal, SpeakerPanel } from "../../types";
import { defaultPanelIn } from "../panel";

/**
 * The walls at another nominal size: its default thickness in the walls' material (the Cutlist page can measure it
 * again). The same size keeps its measured thickness.
 */
export const withWallPanel = (panel: SpeakerPanel, nominal: PanelNominal): SpeakerPanel =>
  nominal === panel.nominal
    ? panel
    : { ...panel, nominal, thicknessIn: defaultPanelIn(nominal, panel.material) };
