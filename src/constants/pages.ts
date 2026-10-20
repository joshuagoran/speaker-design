/**
 * Every page of the nav, by id, and the address hash it lives at. The Speaker Design page is the default (`#speaker`,
 * an empty hash, or any unknown hash, such as an old page's: no redirect); `tests/mobile-check.mjs` visits each hash.
 */
export const PAGE_HASHES = {
  speakerCutlist: "#speaker-cutlist",
  speaker: "#speaker",
  stack: "#stack",
  stackCutlist: "#stack-cutlist",
  space: "#space",
} as const;

/** A page of the app. */
export type AppPage = keyof typeof PAGE_HASHES;

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
