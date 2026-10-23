// The saving row (src/components/saved-configs/SaveRow): its actions and messages. A page passes the nouns that name
// its own designs (`SaveRowWords`). It imports nothing, so the Node checks (tests/mobile-check.mjs) can read it.

/** The id a design has until a save holds it (no save has it). Saved drafts carry it, so keep its value. */
export const DRAFT_ID = "draft";

/** The row's actions and messages, the same on every page that has it. */
export const SAVE_ROW_TEXT = {
  /** the row's group name, as screen readers hear it */
  row: "Saved configurations",
  save: "Save",
  saveAs: "Save as",
  open: "Open",
  /** the start list, as screen readers hear it (the Node checks find it by this), and its first line */
  newFrom: "New from a preset",
  newFromPrompt: "New from…",
  signIn: "Sign in with Google to save",
  signOut: "Sign out",
  unavailable: "Saving is unavailable in this view.",
  cancel: "Cancel",
  copyName: (name: string) => `${name} (copy)`,
  delete: "Delete",
  deleteLabel: (name: string) => `Delete ${name}`,
  /** Delete's confirm step, inline (a browser dialog can be blocked in the artifact host): Delete again, or Cancel */
  confirmDelete: (design: string) => `Permanently delete this ${design}?`,
  /** the start list's tip: what picking a start does, by the design's noun */
  newFromTip: (design: string) =>
    `Starts a new ${design}, empty or from a preset, replacing the current design.`,
} as const;

/** The nouns a page's row names its designs with: the name box's placeholder, the saved list and the start list's tip. */
export interface SaveRowWords {
  namePlaceholder: string;
  /** the saved list, as screen readers hear it */
  savedList: string;
  /** the saved list's first line, by how many are saved */
  pick: (n: number) => string;
  noSaved: string;
  /** what picking a start does */
  newFromTip: string;
  /** Delete's confirm question */
  confirmDelete: string;
}
