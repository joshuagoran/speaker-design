// The saving row's actions on the store (src/components/saved-configs/SaveRow), apart from React so tests can run them.
// A page's design is open in one save at most: the design's own id is that save's id. A new design's id is a draft id,
// which no save has.
import { SAVE_ROW_TEXT } from "../../constants/saveRow";
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
 * Save: the open save takes the design and its name; with no save open, a new save. The id of the save the design is
 * now open in, or null when the write fails (the store shows its own message).
 */
export async function saveDesign(
  store: Pick<ConfigStore, "saved" | "create" | "overwrite">,
  openId: string,
  name: string,
  data: SavedConfigData,
): Promise<string | null> {
  const open = openSave(store.saved, openId);
  if (!open) return store.create(name, data);
  return (await store.overwrite(open.id, name, data)) ? open.id : null;
}

/**
 * Save as: always a new save, under a name no save has (`freeName`). Its id and name, which the design takes; null
 * when the write fails.
 */
export async function saveDesignAs(
  store: Pick<ConfigStore, "saved" | "create">,
  name: string,
  data: SavedConfigData,
): Promise<Pick<SavedConfig, "id" | "name"> | null> {
  const free = freeName(store.saved ?? [], name);
  const id = await store.create(free, data);
  return id === null ? null : { id, name: free };
}

/** Delete: removes save `id`. True when it was the open save, so the design is open in none now. */
export const deleteSave = async (store: Pick<ConfigStore, "remove">, id: string, openId: string) =>
  (await store.remove(id)) && id === openId;
