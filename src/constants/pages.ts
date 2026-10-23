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
  /** a test of the new layout on the Stack level: no tab links to it */
  stackShell: "#stack-shell",
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

/** The name of a project's Cutlist tab. */
export const CUTLIST_TAB_NAME = "Cutlist";

/** Each project's pages, in the order its sub-tab row shows them, with the tab's label; the first is the project's home. */
export const PROJECT_PAGES = {
  speaker: [
    ["speaker", "Design"],
    ["speakerCutlist", CUTLIST_TAB_NAME],
  ],
  stack: [
    ["stack", "Design"],
    ["stackCutlist", CUTLIST_TAB_NAME],
  ],
  space: [["space", "Design"]],
} as const satisfies Record<ProjectId, readonly (readonly [AppPage, string])[]>;

/** Pages no tab lists, by the project whose tabs show above them. */
export const UNLISTED_PAGE_PROJECTS = { stackShell: "stack" } as const satisfies Partial<
  Record<AppPage, ProjectId>
>;

/** The page an empty or unknown hash opens. */
export const DEFAULT_PAGE = "speaker" satisfies AppPage;
