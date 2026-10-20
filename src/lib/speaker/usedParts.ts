// The parts a stack or a space uses: what a save, and a shared link, keeps of the design's lists. Pure.
import { SPACE_ITEM } from "../../constants/speakerSpec";
import type { SpaceDesign, StackDesign } from "../../types";

/** The speakers a stack's members name. */
export function stackSpeakers({ stack, speakers }: StackDesign): StackDesign["speakers"] {
  const used = new Set(stack.members.map((m) => m.speakerId));
  return speakers.filter((s) => used.has(s.id));
}

/** The stacks and speakers a space places: the stacks its placements name, and the speakers those or they name. */
export function usedParts(design: SpaceDesign): Pick<SpaceDesign, "stacks" | "speakers"> {
  const items = design.space.placements.map((p) => p.item);
  const stacks = design.stacks.filter((s) =>
    items.some((i) => i.kind === SPACE_ITEM.stack && i.id === s.id),
  );
  const ids = new Set([
    ...stacks.flatMap((s) => s.members.map((m) => m.speakerId)),
    ...items.flatMap((i) => (i.kind === SPACE_ITEM.speaker ? [i.id] : [])),
  ]);
  return { stacks, speakers: design.speakers.filter((s) => ids.has(s.id)) };
}
