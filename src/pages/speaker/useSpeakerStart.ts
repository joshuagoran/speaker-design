import { SPEAKER_TEMPLATES, templateSpeaker } from "./speakerTemplates";
import {
  SPEAKER_START_GROUPS,
  SPEAKER_START_NAMES,
  type SpeakerTemplate,
} from "../../constants/speakerStarts";
import type { SpeakerPageState } from "./useSpeakerPage";

/** A start as the lists show it: its id, its name and its group (the templates). */
export interface SpeakerStartOption {
  id: SpeakerTemplate;
  name: string;
  group: string;
}

/** Every start the lists show: the templates, in order. */
const START_OPTIONS: readonly SpeakerStartOption[] = SPEAKER_TEMPLATES.map((id) => ({
  id,
  name: SPEAKER_START_NAMES[id],
  group: SPEAKER_START_GROUPS.templates,
}));

/**
 * Where a new speaker starts: every start the lists show (the templates), and the call that replaces the design with
 * one (the saving row's "New from…").
 */
export function useSpeakerStart(speakerPage: Pick<SpeakerPageState, "setSpec">) {
  /** replaces the design with the template's, as a draft under its name */
  const startWith = (start: SpeakerTemplate) => speakerPage.setSpec(templateSpeaker(start));
  return { options: START_OPTIONS, startWith };
}
