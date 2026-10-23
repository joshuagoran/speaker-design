import type { SavedConfig, SpeakerSpec } from "../../types";
import { readSavedSpeaker } from "../../lib/speaker/speakerSaves";

/** One saved Speaker a Stack can add: its save's id and name, and its design. */
export interface LibrarySpeaker {
  id: string;
  name: string;
  spec: Omit<SpeakerSpec, "id" | "name">;
}

/** The saved Speakers in a store's list, as the Stack's pickers show them (saves that hold no Speaker are left out). */
export function speakerLibrary(saved: readonly SavedConfig[] | null): LibrarySpeaker[] {
  return (saved ?? []).flatMap((c) => {
    const spec = readSavedSpeaker(Reflect.get(c, "speaker"));
    return spec ? [{ id: c.id, name: c.name, spec }] : [];
  });
}

/** A library Speaker as a Stack adds it: its design under the save's id and name. */
export const librarySpec = (o: LibrarySpeaker): SpeakerSpec => ({
  ...o.spec,
  id: o.id,
  name: o.name,
});
