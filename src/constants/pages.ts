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
  designerCutlist: "#designer-cutlist",
  designer: "#designer",
  stack: "#stack",
} as const;
export type AppPage = keyof typeof PAGE_HASHES;

/** The projects the header switches between, by id, and the name each button shows. */
export const PROJECT_NAMES = {
  pa: "PA Stack",
  hifi: "Hi-fi",
  /** the speaker designer: any single box (docs/speaker-designer-plan.md, L3) */
  designer: "Designer",
  /** speakers in a fixed relationship (docs/speaker-designer-plan.md, L4a) */
  stack: "Stack",
} as const;
export type ProjectId = keyof typeof PROJECT_NAMES;

/** The accessible name of each project's page-tab row. */
export const PROJECT_NAV_LABELS: Record<ProjectId, string> = {
  pa: "PA stack pages",
  hifi: "Hi-fi pages",
  designer: "Designer pages",
  stack: "Stack pages",
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
  designer: [
    ["designer", "Design"],
    ["designerCutlist", "Cutlist"],
  ],
  stack: [["stack", "Design"]],
} as const satisfies Record<ProjectId, readonly (readonly [AppPage, string])[]>;
