/**
 * The local storage key each page keeps its working design under (`usePageDraft`), one per page. The draft is the
 * page's save document as `snapshot` writes it, plus its id and name.
 */
export const PAGE_DRAFT_KEYS = {
  speaker: "speaker.draft",
  stack: "stack.draft",
  space: "space.draft",
} as const;

/** How long after the last change a page's draft is written, ms. */
export const DRAFT_WRITE_MS = 300;
