import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { OLD_SAVE_COLLECTIONS, OLD_SAVE_KIND } from "../../constants/speakerSpec";
import { oldSavesOf, type OldSave } from "./oldSaves";

/**
 * The signed-in user's PA and Hi-fi page saves, read only, for the Stack page to open as stacks (src/pages/stack/
 * oldSaves). Nothing writes them from here.
 */
export function useOldSaves(): OldSave[] {
  const pa = useConfigStore(OLD_SAVE_COLLECTIONS.pa);
  const hifi = useConfigStore(OLD_SAVE_COLLECTIONS.hifi);
  return [
    ...oldSavesOf(OLD_SAVE_KIND.pa, pa.saved ?? []),
    ...oldSavesOf(OLD_SAVE_KIND.hifi, hifi.saved ?? []),
  ];
}
