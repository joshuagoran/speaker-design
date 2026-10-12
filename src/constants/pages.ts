/**
 * Every page of the app, by id, and the address hash it lives at. The PA Design page is the default (`#`, or any
 * unknown hash); `tests/mobile-check.mjs` visits each hash.
 */
export const PAGE_HASHES = {
  planner: "#",
  coverage: "#coverage",
  cutlist: "#cutlist",
  fills: "#fills",
  notes: "#notes",
  hifi: "#hifi",
  hifiCutlist: "#hifi-cutlist",
  speakerCutlist: "#speaker-cutlist",
  speaker: "#speaker",
  stack: "#stack",
  stackCutlist: "#stack-cutlist",
  space: "#space",
  spaceNotes: "#space-notes",
} as const;
export type AppPage = keyof typeof PAGE_HASHES;

/** The projects the header switches between, by id, and the name each button shows. */
export const PROJECT_NAMES = {
  pa: "PA Stack",
  hifi: "Hi-fi",
  /** the Speaker page: any single box (docs/speaker-designer-plan.md, L3) */
  speaker: "Speaker",
  /** speakers in a fixed relationship (docs/speaker-designer-plan.md, L4a) */
  stack: "Stack",
  /** stacks and speakers placed in a room (docs/speaker-designer-plan.md, L4b) */
  space: "Space",
} as const;
export type ProjectId = keyof typeof PROJECT_NAMES;

/** The accessible name of each project's page-tab row. */
export const PROJECT_NAV_LABELS: Record<ProjectId, string> = {
  pa: "PA stack pages",
  hifi: "Hi-fi pages",
  speaker: "Speaker pages",
  stack: "Stack pages",
  space: "Space pages",
};

/** Each project's pages, in the order its sub-tab row shows them, with the tab's label; the first is the project's home. */
export const PROJECT_PAGES = {
  pa: [
    ["planner", "Design"],
    ["coverage", "Coverage"],
    ["cutlist", "Cutlist"],
    ["fills", "Fills"],
    ["notes", "Notes"],
  ],
  hifi: [
    ["hifi", "Design"],
    ["hifiCutlist", "Cutlist"],
  ],
  speaker: [
    ["speaker", "Design"],
    ["speakerCutlist", "Cutlist"],
  ],
  stack: [
    ["stack", "Design"],
    ["stackCutlist", "Cutlist"],
  ],
  space: [
    ["space", "Design"],
    ["spaceNotes", "Notes"],
  ],
} as const satisfies Record<ProjectId, readonly (readonly [AppPage, string])[]>;
