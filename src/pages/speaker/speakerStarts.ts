// Where a new speaker on the Speaker page starts: a template (speakerTemplates), or the current PA or Hi-fi design read through
// the L1 adapters (lib/speaker paSpec, hifiSpec).
import type {
  HifiDesignState,
  PaLayout,
  PaPlannerDesign,
  SpeakerPart,
  SpeakerSpec,
} from "../../types";
import { layersFromPa } from "../../lib/speaker/paSpec";
import { speakerFromHifi } from "../../lib/speaker/hifiSpec";
import { speakerIdentity } from "../../lib/speaker/specParts";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import {
  SPEAKER_CURRENT_START,
  SPEAKER_START,
  SPEAKER_START_GROUPS,
  SPEAKER_START_SPEAKER_NAMES,
  SPEAKER_TEMPLATE,
  type SpeakerCurrentStart,
  type SpeakerStart,
  type SpeakerTemplate,
} from "../../constants/speakerStarts";
import { SPEAKER_PART } from "../../constants/speakerSpec";
import { DRAFT_SPEAKER_ID, emptySpeaker } from "./useSpeakerPage";
import { SPEAKER_TEMPLATES, templateSpeaker } from "./speakerTemplates";

/** What a start reads: the PA design as the planner holds it, the Hi-fi design and its look. */
export interface StartSources {
  pa: PaPlannerDesign;
  hifi: HifiDesignState;
  hifiLook: SpeakerSpec["look"];
}

/** The PA speaker each PA start takes. */
const PA_START_PARTS = {
  paSub: SPEAKER_PART.sub,
  paTop: SPEAKER_PART.top,
  paTower: SPEAKER_PART.tower,
} as const satisfies Partial<Record<SpeakerStart, SpeakerPart>>;

/** The starts the PA design offers: the tower's one speaker, or the sub and the mid/high box of the other layouts. */
export const paStarts = (layout: PaLayout): SpeakerStart[] =>
  layout === "tower" ? [SPEAKER_START.paTower] : [SPEAKER_START.paSub, SPEAKER_START.paTop];

/** Every start the picker lists, in order: the templates, then the current Hi-fi and PA designs. */
export const speakerStarts = (layout: PaLayout): SpeakerStart[] => [
  ...SPEAKER_TEMPLATES,
  SPEAKER_START.hifi,
  ...paStarts(layout),
];

/** Whether a start is a template (else it reads a current design). */
export const isTemplate = (start: SpeakerStart): start is SpeakerTemplate =>
  Object.hasOwn(SPEAKER_TEMPLATE, start);

/** The picker's group a start is listed under. */
export const startGroup = (start: SpeakerStart) =>
  isTemplate(start) ? SPEAKER_START_GROUPS.templates : SPEAKER_START_GROUPS.current;

/** The speaker a current-design start gives, as a draft under the start's name. */
function currentSpeaker(start: SpeakerCurrentStart, sources: StartSources): SpeakerSpec {
  const identity = { id: DRAFT_SPEAKER_ID, name: SPEAKER_START_SPEAKER_NAMES[start] };
  switch (start) {
    case SPEAKER_CURRENT_START.hifi:
      return speakerFromHifi(sources.hifi, sources.hifiLook, identity);
    case SPEAKER_CURRENT_START.paSub:
    case SPEAKER_CURRENT_START.paTop:
    case SPEAKER_CURRENT_START.paTower: {
      // the speakers alone are read: where the stacks stand (the coverage page's) doesn't change them
      const read = layersFromPa(sources.pa, identity, DEFAULT_COVERAGE_LAYOUT);
      const id = speakerIdentity(identity, PA_START_PARTS[start]).id;
      const found = read.speakers.find((s) => s.id === id);
      // a PA start the layout doesn't have (paStarts offers only the layout's): the empty speaker
      return found ? { ...found, ...identity } : emptySpeaker();
    }
  }
}

/** The speaker a start gives, as a draft under the start's name. */
export const startSpeaker = (start: SpeakerStart, sources: StartSources): SpeakerSpec =>
  isTemplate(start) ? templateSpeaker(start) : currentSpeaker(start, sources);
