// Where a new Designer speaker starts: empty, or the current PA or Hi-fi design read through the L1 adapters
// (lib/speaker paSpec, hifiSpec).
import type {
  HifiDesignState,
  PaLayout,
  PaPlannerDesign,
  SpeakerPart,
  SpeakerSpec,
} from "../../types";
import { systemFromPa } from "../../lib/speaker/paSpec";
import { speakerFromHifi } from "../../lib/speaker/hifiSpec";
import { speakerIdentity } from "../../lib/speaker/specParts";
import { DEFAULT_COVERAGE_LAYOUT } from "../coverage/useCoverageLayout";
import {
  DESIGNER_START,
  DESIGNER_START_SPEAKER_NAMES,
  type DesignerStart,
} from "../../constants/designer";
import { SPEAKER_PART } from "../../constants/speakerSpec";
import { DRAFT_SPEAKER_ID, emptySpeaker } from "./useDesigner";

/** What a start reads: the PA design as the planner holds it, the Hi-fi design and its look. */
export interface DesignerSources {
  pa: PaPlannerDesign;
  hifi: HifiDesignState;
  hifiLook: SpeakerSpec["look"];
}

/** The PA speaker each PA start takes. */
const PA_START_PARTS = {
  paSub: SPEAKER_PART.sub,
  paTop: SPEAKER_PART.top,
  paTower: SPEAKER_PART.tower,
} as const satisfies Partial<Record<DesignerStart, SpeakerPart>>;

/** The starts the PA design offers: the tower's one speaker, or the sub and the mid/high box of the other layouts. */
export const paStarts = (layout: PaLayout): DesignerStart[] =>
  layout === "tower" ? [DESIGNER_START.paTower] : [DESIGNER_START.paSub, DESIGNER_START.paTop];

/** The speaker a start gives, as a draft under the start's name. */
export function startSpeaker(start: DesignerStart, sources: DesignerSources): SpeakerSpec {
  const identity = { id: DRAFT_SPEAKER_ID, name: DESIGNER_START_SPEAKER_NAMES[start] };
  switch (start) {
    case DESIGNER_START.empty:
      return emptySpeaker();
    case DESIGNER_START.hifi:
      return speakerFromHifi(sources.hifi, sources.hifiLook, identity);
    case DESIGNER_START.paSub:
    case DESIGNER_START.paTop:
    case DESIGNER_START.paTower: {
      // the speakers alone are read: where the stacks stand (the coverage page's) doesn't change them
      const read = systemFromPa(sources.pa, identity, DEFAULT_COVERAGE_LAYOUT.stacks);
      const id = speakerIdentity(identity, PA_START_PARTS[start]).id;
      const found = read.speakers.find((s) => s.id === id);
      // a PA start the layout doesn't have (paStarts offers only the layout's): the empty speaker
      return found ? { ...found, ...identity } : emptySpeaker();
    }
  }
}
