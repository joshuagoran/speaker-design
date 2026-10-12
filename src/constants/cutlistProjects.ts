import type { ProjectId } from "./pages";

/** What one project's Cutlist page says: what one set of boxes is called, the set-count choices and their label, and where the boxes come from. */
export interface CutlistProject {
  set: string;
  setsLabel: string;
  sets: readonly number[];
  source: string;
}

/** What the Cutlist page says for each project. */
export const CUTLIST_PROJECTS = {
  pa: { set: "stack", setsLabel: "Stacks", sets: [1, 2, 4], source: "the Design page's boxes" },
  hifi: { set: "speaker", setsLabel: "Speakers", sets: [1, 2, 4], source: "the Hi-fi page's box" },
  designer: {
    set: "speaker",
    setsLabel: "Speakers",
    sets: [1, 2, 4],
    source: "the Designer's speaker",
  },
} as const satisfies Record<ProjectId, CutlistProject>;

/** A project with a Cutlist page. */
export type CutlistProjectId = keyof typeof CUTLIST_PROJECTS;

/** The projects whose cutlist choices this browser keeps (the PA stack's live in its planner and its saves). */
export const CUTLIST_PROJECT = {
  hifi: "hifi",
  designer: "designer",
} as const satisfies Record<string, CutlistProjectId>;
export type StoredCutlistProject = (typeof CUTLIST_PROJECT)[keyof typeof CUTLIST_PROJECT];
