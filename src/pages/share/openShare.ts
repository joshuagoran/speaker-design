// A shared envelope opened as the design its page holds: each part read as a save is read (so an older shape is brought
// up to date), and the models run once over the speakers, so a link that passes the checks but breaks a model does not
// reach a page. Pure.
import { SHARE_KIND } from "../../constants/share";
import { readSpeakerCopy } from "../../lib/speaker/speakerSaves";
import { speakerResponse } from "../../lib/speaker/speakerResponse";
import { stackResponse } from "../../lib/speaker/stackResponse";
import { stackFromSaved } from "../stack/stackSaves";
import { spaceFromSaved } from "../space/spaceSaves";
import type {
  ShareDesigns,
  ShareEnvelope,
  ShareKind,
  SpaceDesign,
  SpaceView,
  SpeakerSpec,
  StackDesign,
} from "../../types";

/** A shared design opened: its kind, and the design its page holds. */
export type OpenedShare =
  | {
      [K in Exclude<ShareKind, "space">]: { kind: K; design: ShareDesigns[K] };
    }[Exclude<ShareKind, "space">]
  | { kind: "space"; design: SpaceDesign; view?: SpaceView };

/** Runs the speaker's model once: it throws where the speaker is not one the model can read. */
function tryModel(speaker: SpeakerSpec) {
  speakerResponse({ cabinet: speaker.cabinet, bands: speaker.bands }, { feed: speaker.input });
}

/** Runs the stack's model once: it runs each member's speaker too. */
const tryStack = ({ stack, speakers }: StackDesign) =>
  stackResponse({ members: stack.members }, speakers);

/**
 * The design an envelope holds, read as its page reads a save; null when a part does not read, or passes the checks but
 * breaks a model (the link then does not open, and nothing is shown or written).
 */
export function openEnvelope(envelope: ShareEnvelope): OpenedShare | null {
  try {
    return read(envelope);
  } catch {
    return null;
  }
}

/** The design an envelope holds; throws where a part breaks a model. */
function read(envelope: ShareEnvelope): OpenedShare | null {
  switch (envelope.kind) {
    case SHARE_KIND.speaker: {
      const [speaker] = envelope.speakers;
      const design = readSpeakerCopy(speaker);
      tryModel(design);
      return { kind: SHARE_KIND.speaker, design };
    }
    case SHARE_KIND.stack: {
      const [stack] = envelope.stacks;
      const design = stackFromSaved({
        id: stack.id,
        name: stack.name,
        stack,
        speakers: envelope.speakers,
      });
      if (!design) return null;
      tryStack(design);
      return { kind: SHARE_KIND.stack, design };
    }
    case SHARE_KIND.space: {
      const [space] = envelope.spaces;
      const design: SpaceDesign | null = spaceFromSaved({
        id: space.id,
        name: space.name,
        space,
        stacks: envelope.stacks,
        speakers: envelope.speakers,
      });
      if (!design) return null;
      design.stacks.forEach((stack) => tryStack({ stack, speakers: design.speakers }));
      // a speaker that stands alone is not run by a stack's model
      const inStacks = new Set(design.stacks.flatMap((s) => s.members.map((m) => m.speakerId)));
      design.speakers.filter((s) => !inStacks.has(s.id)).forEach(tryModel);
      return { kind: SHARE_KIND.space, design, view: envelope.view };
    }
  }
}
