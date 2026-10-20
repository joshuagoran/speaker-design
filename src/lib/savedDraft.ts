import { PAGE_DRAFT_KEYS, PAGE_SHARED_KEYS } from "../constants/pageDrafts";
import { readSessionJson, removeSession, removeStored } from "./storage";
import type { SavedConfig } from "../types";

/**
 * A page's working design as its draft: the document its save would write (`snapshot`) with the design's id and name,
 * so the draft reads back through the same function that opens a saved document.
 */
export const draftDocument = (
  snapshot: object,
  { id, name }: Pick<SavedConfig, "id" | "name">,
): SavedConfig => ({ ...snapshot, id, name });

/** A stored draft as a document: null unless it is an object with an id and a name. */
export function asDraftDocument(raw: unknown): SavedConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const id: unknown = Reflect.get(raw, "id");
  const name: unknown = Reflect.get(raw, "name");
  return typeof id === "string" && typeof name === "string" ? { ...raw, id, name } : null;
}

/**
 * Drops the shared views from the browser (a link's design shown in place of a page's own); true when there was one. A
 * design from a link is the likelier cause of a page that will not render, and the page's own draft is the user's work.
 */
export function clearSharedViews(): boolean {
  let had = false;
  for (const key of Object.values(PAGE_SHARED_KEYS)) {
    if (readSessionJson<unknown>(key, null) !== null) had = true;
    removeSession(key);
  }
  return had;
}

/** Drops every page's draft and shared view from the browser, so the next start is each page's default design. */
export const clearPageDrafts = () => {
  for (const key of Object.values(PAGE_DRAFT_KEYS)) removeStored(key);
  for (const key of Object.values(PAGE_SHARED_KEYS)) removeSession(key);
};
