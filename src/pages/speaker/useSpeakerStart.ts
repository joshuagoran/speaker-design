import { speakerStarts, startGroup, startSpeaker } from "./speakerStarts";
import { SPEAKER_START_NAMES, type SpeakerStart } from "../../constants/speakerStarts";
import { paPlannerDesign } from "./SpeakerPage";
import type { SpeakerPageState } from "./useSpeakerPage";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type { HifiPlanner } from "../hifi/useHifiPlanner";

/** A start as the lists show it: its id, its name and its group (the templates, or the designs you have now). */
export interface SpeakerStartOption {
  id: SpeakerStart;
  name: string;
  group: string;
}

/**
 * Where a new speaker starts: every start the lists show (the templates, then the current Hi-fi and PA designs), and
 * the call that replaces the design with one (the saving row's "New from…").
 */
export function useSpeakerStart(
  speakerPage: Pick<SpeakerPageState, "setSpec">,
  planner: PaPlanner,
  hifi: HifiPlanner,
) {
  const options: SpeakerStartOption[] = speakerStarts(planner.layout).map((id) => ({
    id,
    name: SPEAKER_START_NAMES[id],
    group: startGroup(id),
  }));
  /** replaces the design with the start's */
  const startWith = (start: SpeakerStart) =>
    speakerPage.setSpec(
      startSpeaker(start, {
        pa: paPlannerDesign(planner),
        hifi,
        hifiLook: { cabFinish: hifi.cabinetFinish, baffleColor: hifi.baffleColor },
      }),
    );
  return { options, startWith };
}
