// "Save a copy" of a shared design: every item gets a new id (`remapIds`), then each is saved to its own library: a
// space to Spaces, each stack to Stacks, each speaker to Speakers. The ids are new, so no saved item is replaced.
import { remapSpace, remapSpeaker, remapStack } from "../../lib/io/remapIds";
import { speakerSnapshot } from "../speaker/useSpeakerPage";
import { stackSnapshot } from "../stack/stackSaves";
import { spaceSnapshot } from "../space/spaceSaves";
import type { ConfigStore } from "../../components/saved-configs/useConfigStore";
import type { SpaceDesign, SpeakerSpec, StackDesign } from "../../types";

/** What a library offers a copy: a write to a document id that no saved item has. */
export type CopyStore = Pick<ConfigStore, "overwrite">;

/** The libraries a copy goes to, by what they hold. */
export interface CopyStores {
  speakers: CopyStore;
  stacks: CopyStore;
  spaces: CopyStore;
}

/**
 * Runs the saves in order, each only when the ones before it were saved; false at the first that was not. (A copy that
 * stops partway leaves the items saved so far as items of their own.)
 */
async function inOrder(saves: readonly (() => Promise<boolean>)[]): Promise<boolean> {
  for (const save of saves) if (!(await save())) return false;
  return true;
}

/** Writes a speaker to Speakers, under its own id. */
const putSpeaker = (speaker: SpeakerSpec, stores: CopyStores) =>
  stores.speakers.overwrite(speaker.id, speaker.name, speakerSnapshot(speaker));

/** Saves a speaker as a new Speaker. `makeId` gives each new id. */
export const saveSpeakerCopy = (speaker: SpeakerSpec, stores: CopyStores, makeId: () => string) =>
  putSpeaker(remapSpeaker(speaker, makeId), stores);

/** Saves a stack as a new Stack, and its speakers as new Speakers. */
export function saveStackCopy(design: StackDesign, stores: CopyStores, makeId: () => string) {
  const copy = remapStack(design, makeId);
  return inOrder([
    ...copy.speakers.map((s) => () => putSpeaker(s, stores)),
    () => stores.stacks.overwrite(copy.stack.id, copy.stack.name, stackSnapshot(copy)),
  ]);
}

/** Saves a space as a new Space, each stack it places as a new Stack, and each speaker as a new Speaker. */
export function saveSpaceCopy(design: SpaceDesign, stores: CopyStores, makeId: () => string) {
  const copy = remapSpace(design, makeId);
  return inOrder([
    ...copy.speakers.map((s) => () => putSpeaker(s, stores)),
    ...copy.stacks.map(
      (stack) => () =>
        stores.stacks.overwrite(
          stack.id,
          stack.name,
          stackSnapshot({ stack, speakers: copy.speakers }),
        ),
    ),
    () => stores.spaces.overwrite(copy.space.id, copy.space.name, spaceSnapshot(copy)),
  ]);
}
