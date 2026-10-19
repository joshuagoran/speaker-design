// The panel sizes the Speaker page sets on a spec: the walls' size (the baffle of a frame box stays ¾″,
// lib/acoustics/boxModels BAFFLE_PLY_IN) and the side ducts' dividers' size. Dividers of the walls'
// size follow the walls' thickness, and dividers of another size keep their default (only the walls are measured). Pure.
import type { PanelNominal, SideDuctPort, SpeakerCabinet, SpeakerPanel } from "../../types";
import { defaultPanelIn } from "../build/panel";
import { PLYWOOD_MATERIAL } from "../../constants/panelSizes";
import { PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";

/**
 * The walls at another nominal size: its default thickness in the walls' material. A measured thickness belongs to its
 * size, so switching sizes drops it (the Cutlist page can measure the new size again). The same size keeps its
 * measured thickness.
 */
export const withWallPanel = (panel: SpeakerPanel, nominal: PanelNominal): SpeakerPanel =>
  nominal === panel.nominal
    ? panel
    : { ...panel, nominal, thicknessIn: defaultPanelIn(nominal, panel.material) };

/**
 * The side ducts with their dividers at another nominal size. The walls' size takes the walls' current thickness
 * (measured or default); another size is plywood at its default thickness. The same size
 * keeps its thickness.
 */
export const withDuctDivider = (
  port: SideDuctPort,
  divider: PanelNominal,
  walls: Pick<SpeakerPanel, "nominal" | "thicknessIn">,
): SideDuctPort =>
  divider === port.divider
    ? { ...port, divider }
    : {
        ...port,
        divider,
        div:
          divider === walls.nominal ? walls.thicknessIn : defaultPanelIn(divider, PLYWOOD_MATERIAL),
      };

/**
 * The cabinet with its walls at a measured thickness (the Cutlist page's measurement, or the default when it is
 * cleared): every side duct whose dividers are the walls' size takes the same thickness.
 */
export function withMeasuredWalls(
  cabinet: SpeakerCabinet,
  thicknessIn: SpeakerPanel["thicknessIn"],
): SpeakerCabinet {
  const { nominal } = cabinet.panel;
  return {
    ...cabinet,
    panel: { ...cabinet.panel, thicknessIn },
    chambers: cabinet.chambers.map((c) =>
      c.vent.kind === VENT_KIND.vented &&
      c.vent.port.shape === PORT_SHAPE.duct &&
      c.vent.port.divider === nominal
        ? {
            ...c,
            vent: { ...c.vent, port: { ...c.vent.port, divider: nominal, div: thicknessIn } },
          }
        : c,
    ),
  };
}
