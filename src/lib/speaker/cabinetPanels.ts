// The panel sizes the Speaker page sets on a spec, as the PA page sets them on its design: the walls' size (the baffle
// of a frame box stays ¾″, lib/pa/calc BAFFLE_PLY_IN) and the side ducts' dividers' size. Pure.
import type { PanelNominal, SideDuctPort, SpeakerPanel } from "../../types";
import { defaultPanelIn, panelNominalNear } from "../panel";
import { ductDividerIn } from "../pa/calc";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";

/**
 * The walls at another nominal size: its default thickness in the walls' material (the Cutlist page can measure it
 * again). The same size keeps its measured thickness.
 */
export const withWallPanel = (panel: SpeakerPanel, nominal: PanelNominal): SpeakerPanel =>
  nominal === panel.nominal
    ? panel
    : { ...panel, nominal, thicknessIn: defaultPanelIn(nominal, panel.material) };

/**
 * The side ducts' dividers' nominal size: the one the port names, else (a spec saved before the size) the size nearest
 * their thickness, ½″ where it has none (`DUCT_DIVIDER_DEFAULT`).
 */
export const ductDividerOf = (port: Pick<SideDuctPort, "divider" | "div">): PanelNominal =>
  port.divider ?? panelNominalNear(ductDividerIn(port));

/**
 * The side ducts with their dividers at another nominal size: plywood, as the PA page's dividers, at its default
 * thickness. The same size keeps its thickness.
 */
export const withDuctDivider = (port: SideDuctPort, divider: PanelNominal): SideDuctPort =>
  divider === ductDividerOf(port)
    ? { ...port, divider }
    : { ...port, divider, div: defaultPanelIn(divider, PLYWOOD_MATERIAL) };
