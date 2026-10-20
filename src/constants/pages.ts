/**
 * Every page of the nav, by id, and the address hash it lives at. The Speaker Design page is the default (`#speaker`,
 * an empty hash, or any unknown hash, such as an old page's: no redirect); `tests/mobile-check.mjs` visits each hash.
 * The Notes page is not here: it has no tab and no hash, and opens only at the path `/notes` (`pageAt`).
 */
export const PAGE_HASHES = {
  speakerCutlist: "#speaker-cutlist",
  speaker: "#speaker",
  stack: "#stack",
  stackCutlist: "#stack-cutlist",
  space: "#space",
} as const;

/** The Notes page's id: the owner's reference page, outside the nav. */
export const NOTES_PAGE = "notes";
/** A page of the app: one of the nav's, or Notes. */
export type AppPage = keyof typeof PAGE_HASHES | typeof NOTES_PAGE;

/** The projects the header switches between, by id, and the name each button shows. */
export const PROJECT_NAMES = {
  /** the Speaker page: any single box */
  speaker: "Speaker",
  /** speakers in a fixed relationship */
  stack: "Stack",
  /** stacks and speakers placed in a room */
  space: "Space",
} as const;
export type ProjectId = keyof typeof PROJECT_NAMES;

/** The accessible name of each project's page-tab row. */
export const PROJECT_NAV_LABELS: Record<ProjectId, string> = {
  speaker: "Speaker pages",
  stack: "Stack pages",
  space: "Space pages",
};

/** Each project's pages, in the order its sub-tab row shows them, with the tab's label; the first is the project's home. */
export const PROJECT_PAGES = {
  speaker: [
    ["speaker", "Design"],
    ["speakerCutlist", "Cutlist"],
  ],
  stack: [
    ["stack", "Design"],
    ["stackCutlist", "Cutlist"],
  ],
  space: [["space", "Design"]],
} as const satisfies Record<ProjectId, readonly (readonly [AppPage, string])[]>;

/** The page an empty or unknown hash opens. */
export const DEFAULT_PAGE = "speaker" satisfies AppPage;
