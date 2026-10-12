import type { PanelExactIn, Setter } from "../../types";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import type { CutlistOptions } from "./useCutlistOptions";
import { speakerCutParts, speakerPurchasedParts } from "../../lib/speaker/speakerBuild";
import { defaultPanelIn } from "../../lib/panel";
import { CutlistPage } from "./CutlistPage";
import { useStoredCutlistOptions } from "./useStoredCutlistOptions";
import { CUTLIST_PROJECT } from "../../constants/cutlistProjects";

interface Props {
  speakerPage: Pick<SpeakerPageState, "spec" | "editCabinet">;
}

/**
 * The Speaker Cutlist page: the speaker's parts, chamber by chamber (lib/speaker/speakerBuild), with the Speaker page's
 * own cutlist choices. The measured wall thickness is the speaker's own panel thickness, so the model and the cutlist
 * read the same walls.
 */
export function SpeakerCutlistPage({ speakerPage }: Props) {
  const stored = useStoredCutlistOptions(CUTLIST_PROJECT.speaker);
  const { cabinet } = speakerPage.spec;
  const { panel } = cabinet;
  const defaultIn = defaultPanelIn(panel.nominal, panel.material);
  /** the speaker's walls as a measurement: none when they are the panel's default thickness */
  const exactIn: PanelExactIn =
    panel.thicknessIn === defaultIn ? {} : { [panel.nominal]: panel.thicknessIn };
  const setPanelExactIn: Setter<PanelExactIn> = (v) => {
    const next = typeof v === "function" ? v(exactIn) : v;
    speakerPage.editCabinet((c) => ({
      ...c,
      panel: {
        ...c.panel,
        thicknessIn: next[c.panel.nominal] ?? defaultPanelIn(c.panel.nominal, c.panel.material),
      },
    }));
  };
  const options: CutlistOptions = { ...stored, panelExactIn: exactIn, setPanelExactIn };
  const { parts, vent } = speakerCutParts(cabinet, options.cornerJoint);
  const purchased = speakerPurchasedParts(cabinet);
  return (
    <CutlistPage
      project={CUTLIST_PROJECT.speaker}
      options={options}
      parts={parts}
      // the vent's lines under the purchased parts (the hardware is in the table)
      also={vent}
      purchased={purchased}
      csvName={`${speakerPage.spec.name || "speaker"} cutlist.csv`}
      wall={panel.thicknessIn}
      panel={panel.nominal}
      material={panel.material}
    />
  );
}
