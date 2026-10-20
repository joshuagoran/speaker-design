// New ids for a shared design's items, for "Save a copy": every item gets an id of its own, and what names an item (a
// stack's member, a space's placement) follows it. Nothing the design is saved next to can be replaced, since no id
// is one a library holds. Pure: `makeId` gives each new id.
import { SPACE_ITEM } from "../../constants/speakerSpec";
import type { SpaceDesign, SpeakerSpec, StackDesign, StackSpec } from "../../types";

/** Each item's old id with the new one `makeId` gives it. */
const newIds = (items: readonly { id: string }[], makeId: () => string) =>
  new Map(items.map((item) => [item.id, makeId()]));

/** The item with the id the map gives it (an id the map does not hold stays: it names nothing in the design). */
const withNewId = <T extends { id: string }>(item: T, ids: ReadonlyMap<string, string>): T => ({
  ...item,
  id: ids.get(item.id) ?? item.id,
});

/** The speaker under a new id. */
export const remapSpeaker = (speaker: SpeakerSpec, makeId: () => string): SpeakerSpec => ({
  ...speaker,
  id: makeId(),
});

/** The stack's members, naming the speakers by their new ids. */
const memberRefs = (stack: StackSpec, speakerIds: ReadonlyMap<string, string>): StackSpec => ({
  ...stack,
  members: stack.members.map((m) => ({
    ...m,
    speakerId: speakerIds.get(m.speakerId) ?? m.speakerId,
  })),
});

/** The stack and its speakers, each under a new id; the members name the new speakers. */
export function remapStack(design: StackDesign, makeId: () => string): StackDesign {
  const speakerIds = newIds(design.speakers, makeId);
  return {
    stack: withNewId(memberRefs(design.stack, speakerIds), new Map([[design.stack.id, makeId()]])),
    speakers: design.speakers.map((s) => withNewId(s, speakerIds)),
  };
}

/** The space, its stacks and its speakers, each under a new id; the placements and the stacks' members name the new ones. */
export function remapSpace(design: SpaceDesign, makeId: () => string): SpaceDesign {
  const speakerIds = newIds(design.speakers, makeId);
  const stackIds = newIds(design.stacks, makeId);
  const { space } = design;
  return {
    space: {
      ...withNewId(space, new Map([[space.id, makeId()]])),
      placements: space.placements.map((p) => ({
        ...p,
        item: {
          ...p.item,
          id:
            (p.item.kind === SPACE_ITEM.stack ? stackIds : speakerIds).get(p.item.id) ?? p.item.id,
        },
      })),
    },
    stacks: design.stacks.map((s) => withNewId(memberRefs(s, speakerIds), stackIds)),
    speakers: design.speakers.map((s) => withNewId(s, speakerIds)),
  };
}
