/**
 * The local storage key each page keeps its working design under (`usePageDraft`), one per page. The draft is the
 * page's save document as `snapshot` writes it, plus its id and name.
 */
export const PAGE_DRAFT_KEYS = {
  speaker: "speaker.draft",
  stack: "stack.draft",
  space: "space.draft",
} as const;

/**
 * The session storage key each page keeps its shared view under (`usePageDraft`): the design a link opened, with the one
 * as it was opened, so a reload keeps it. It is never the draft's key.
 */
export const PAGE_SHARED_KEYS = {
  speaker: "speaker.shared",
  stack: "stack.shared",
  space: "space.shared",
} as const;

/**
 * The session storage key of the Speaker page's edit for a Stack: the Stack's speaker as edited, and which Stack it is
 * for, so a reload keeps the edit. Apart from the shared view's key, so an edit leaves a link's speaker as it is.
 */
export const STACK_EDIT_KEY = "speaker.stackEdit";

/** How long after the last change a page's draft is written, ms. */
export const DRAFT_WRITE_MS = 300;

/** What the page says after a restored draft broke it and was dropped. */
export const DRAFT_FAILED_TEXT = "Your last design did not load.";
