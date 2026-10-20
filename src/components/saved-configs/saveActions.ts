// The saving row's actions on the store (src/components/saved-configs/SaveRow), apart from React so tests can run them.
// A page's design is open in one save at most: the design's own id is that save's id. A new design's id is a draft id,
// which no save has.
import { DRAFT_ID, SAVE_ROW_TEXT } from "../../constants/saveRow";
import type { ConfigStore } from "./useConfigStore";
import type { SavedConfig, SavedConfigData } from "../../types";

/** The save the design is open in, while the store still holds it; null for a new design or a deleted save. */
export const openSave = (saved: ConfigStore["saved"], openId: string): SavedConfig | null =>
  saved?.find((c) => c.id === openId) ?? null;

/** `name`, or its copy name (again, until it is free) where a save already has it. */
export function freeName(saved: readonly Pick<SavedConfig, "name">[], name: string): string {
  const taken = new Set(saved.map((c) => c.name));
  let free = name;
  while (taken.has(free)) free = SAVE_ROW_TEXT.copyName(free);
  return free;
}

/**
 * Save: the open save takes the design and its name; with no save open, a new save. The open save can be past the
 * list (it holds the newest only), or the list not loaded yet: then the store is asked whether it still exists. A
 * deleted one gives a new save. The id of the save the design is now open in; null when the write fails (the store
 * shows its own message), or when the page opened another design meanwhile (`openIdNow`), which keeps its own id.
 */
export async function saveDesign(
  store: Pick<ConfigStore, "saved" | "create" | "overwrite" | "exists">,
  openId: string,
  name: string,
  data: SavedConfigData,
  openIdNow: () => string = () => openId,
): Promise<string | null> {
  if (openId !== DRAFT_ID) {
    const there = openSave(store.saved, openId) !== null || (await store.exists(openId));
    if (there === null) return null;
    if (there)
      return (await store.overwrite(openId, name, data)) && openIdNow() === openId ? openId : null;
  }
  const id = await store.create(name, data);
  return openIdNow() === openId ? id : null;
}

/**
 * Save as: always a new save, under a name no save has (`freeName`). Its id and name, which the design takes; null
 * when the write fails, or when the page opened another design meanwhile (`openIdNow`).
 */
export async function saveDesignAs(
  store: Pick<ConfigStore, "saved" | "create">,
  openId: string,
  name: string,
  data: SavedConfigData,
  openIdNow: () => string = () => openId,
): Promise<Pick<SavedConfig, "id" | "name"> | null> {
  const free = freeName(store.saved ?? [], name);
  const id = await store.create(free, data);
  return id === null || openIdNow() !== openId ? null : { id, name: free };
}

/**
 * One store call at a time: `run(action)` drops the call while another runs (a double click makes one save).
 * `onBusy` hears when one starts and ends, so the row can disable its buttons.
 */
export function oneAtATime(onBusy: (busy: boolean) => void) {
  let running = false;
  return async <R>(action: () => Promise<R>): Promise<R | undefined> => {
    if (running) return undefined;
    running = true;
    onBusy(true);
    try {
      return await action();
    } finally {
      running = false;
      onBusy(false);
    }
  };
}

/** Delete: removes save `id`. True when it was the open save, so the design is open in none now. */
export const deleteSave = async (store: Pick<ConfigStore, "remove">, id: string, openId: string) =>
  (await store.remove(id)) && id === openId;
