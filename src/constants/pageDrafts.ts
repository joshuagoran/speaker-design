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

/** How long after the last change a page's draft is written, ms. */
export const DRAFT_WRITE_MS = 300;

/** What the page says after a restored draft broke it and was dropped. */
export const DRAFT_FAILED_TEXT = "Your last design did not load.";
