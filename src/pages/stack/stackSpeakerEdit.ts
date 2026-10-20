// A Stack's speaker, edited on the Speaker page and brought back: saved to the speaker library, then used by every
// member of the Stack that named it. Apart from React, so tests can run it.
import { freeName, openSave } from "../../components/saved-configs/saveActions";
import type { ConfigStore } from "../../components/saved-configs/useConfigStore";
import { DRAFT_ID } from "../../constants/saveRow";
import { speakerSnapshot } from "../speaker/useSpeakerPage";
import type { SpeakerSpec, StackDesign, StackMember } from "../../types";

/** The id separator of a preset's or a numbered copy's speaker ids (`draft/top`, `doc/2`); no document id has one. */
const ID_PATH_SEPARATOR = "/";

/** Whether a speaker id can be a saved document's: the draft id and the ids with a path separator never are. */
const maySave = (id: SpeakerSpec["id"]) => id !== DRAFT_ID && !id.includes(ID_PATH_SEPARATOR);

/**
 * Saves a Stack's speaker to the library: the save under its id takes it where that save exists (it may be past the
 * list, so the store is asked); otherwise a new save, under a name no save has (`freeName`). The speaker as saved, with
 * the save's id and name; null when a read or the write fails (the store shows its own message).
 */
export async function saveStackSpeaker(
  store: Pick<ConfigStore, "saved" | "create" | "overwrite" | "exists">,
  speaker: SpeakerSpec,
): Promise<SpeakerSpec | null> {
  const data = speakerSnapshot(speaker);
  if (maySave(speaker.id)) {
    const there = openSave(store.saved, speaker.id) !== null || (await store.exists(speaker.id));
    if (there === null) return null;
    if (there) return (await store.overwrite(speaker.id, speaker.name, data)) ? speaker : null;
  }
  const name = freeName(store.saved ?? [], speaker.name);
  const id = await store.create(name, data);
  return id === null ? null : { ...speaker, id, name };
}

/**
 * The Stack with `speaker` in place of its copy `fromId`: every member that named `fromId` names the speaker's id, and
 * the copy becomes the speaker (its body and its name). A Stack without that copy comes back as it was.
 */
export function withStackSpeaker(
  design: StackDesign,
  fromId: StackMember["speakerId"],
  speaker: SpeakerSpec,
): StackDesign {
  if (!design.speakers.some((s) => s.id === fromId)) return design;
  const members = design.stack.members.map((m) =>
    m.speakerId === fromId ? { ...m, speakerId: speaker.id } : m,
  );
  // one copy per id: an older copy under the speaker's id gives way to it
  const speakers = design.speakers.flatMap((s) =>
    s.id === fromId ? [speaker] : s.id === speaker.id ? [] : [s],
  );
  return { stack: { ...design.stack, members }, speakers };
}
