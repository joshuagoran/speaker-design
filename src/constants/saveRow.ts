// The saving row (src/components/saved-configs/SaveRow): its actions and messages. A page passes the nouns that name
// its own designs (`SaveRowWords`). It imports nothing, so the Node checks (tests/mobile-check.mjs) can read it.

/** The row's actions and messages, the same on every page that has it. */
export const SAVE_ROW_TEXT = {
  /** the row's group name, as screen readers hear it */
  row: "Saved configurations",
  save: "Save",
  open: "Open",
  /** the start list, as screen readers hear it (the Node checks find it by this), and its first line */
  newFrom: "New from a template",
  newFromPrompt: "New from…",
  signIn: "Sign in with Google to save",
  signOut: "Sign out",
  unavailable: "Saving is unavailable in this view.",
  saveOver: "Save over",
  saveOverLabel: (name: string) => `Save over ${name}`,
  replace: (name: string) => `Replace “${name}” with this design?`,
  yes: "Yes",
  cancel: "Cancel",
  rename: "Rename",
  renameLabel: (name: string) => `New name for ${name}`,
  duplicate: "Duplicate",
  copyName: (name: string) => `${name} (copy)`,
  delete: "Delete",
  deleteLabel: (name: string) => `Delete ${name}`,
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
}
