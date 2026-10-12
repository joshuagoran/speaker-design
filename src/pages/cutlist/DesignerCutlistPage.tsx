import type { PanelExactIn, Setter } from "../../types";
import type { Designer } from "../designer/useDesigner";
import type { CutlistOptions } from "../pa-stack/hooks/useCutlistOptions";
import { speakerCutParts } from "../../lib/speaker/speakerBuild";
import { defaultPanelIn } from "../../lib/panel";
import { CutlistPage } from "./CutlistPage";
import { useStoredCutlistOptions } from "./useStoredCutlistOptions";
import { CUTLIST_PROJECT } from "../../constants/cutlistProjects";

interface Props {
  designer: Pick<Designer, "spec" | "editCabinet">;
}

/**
 * The Designer's Cutlist page: the speaker's parts, chamber by chamber (lib/speaker/speakerBuild), with the Designer's
 * own cutlist choices. The measured wall thickness is the speaker's own panel thickness, so the model and the cutlist
 * read the same walls.
 */
export function DesignerCutlistPage({ designer }: Props) {
  const stored = useStoredCutlistOptions(CUTLIST_PROJECT.designer);
  const { cabinet } = designer.spec;
  const { panel } = cabinet;
  const defaultIn = defaultPanelIn(panel.nominal, panel.material);
  /** the speaker's walls as a measurement: none when they are the panel's default thickness */
  const exactIn: PanelExactIn =
    panel.thicknessIn === defaultIn ? {} : { [panel.nominal]: panel.thicknessIn };
  const setPanelExactIn: Setter<PanelExactIn> = (v) => {
    const next = typeof v === "function" ? v(exactIn) : v;
    designer.editCabinet((c) => ({
      ...c,
      panel: {
        ...c.panel,
        thicknessIn: next[c.panel.nominal] ?? defaultPanelIn(c.panel.nominal, c.panel.material),
      },
    }));
  };
  const options: CutlistOptions = { ...stored, panelExactIn: exactIn, setPanelExactIn };
  const { parts, also } = speakerCutParts(cabinet, options.cornerJoint);
  return (
    <CutlistPage
      project={CUTLIST_PROJECT.designer}
      options={options}
      parts={parts}
      also={also}
      wall={panel.thicknessIn}
      panel={panel.nominal}
      material={panel.material}
    />
  );
}
