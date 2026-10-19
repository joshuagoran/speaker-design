import type { ProjectId } from "./pages";

/** What one project's Cutlist page says: what one set of boxes is called, the set-count choices and their label, and where the boxes come from. */
export interface CutlistProject {
  set: string;
  setsLabel: string;
  sets: readonly number[];
  source: string;
}

/** What the Cutlist page says for each project that has one (the Space has none). */
export const CUTLIST_PROJECTS = {
  speaker: {
    set: "speaker",
    setsLabel: "Speakers",
    sets: [1, 2, 4],
    source: "the speaker on the Speaker page",
  },
  stack: {
    set: "stack",
    setsLabel: "Stacks",
    sets: [1, 2, 4],
    source: "the boxes on the Stack page",
  },
} as const satisfies Record<Exclude<ProjectId, "space">, CutlistProject>;

/** A project with a Cutlist page. */
export type CutlistProjectId = keyof typeof CUTLIST_PROJECTS;

/** The projects whose cutlist choices this browser keeps. */
export const CUTLIST_PROJECT = {
  speaker: "speaker",
  stack: "stack",
} as const satisfies Record<string, CutlistProjectId>;
export type StoredCutlistProject = (typeof CUTLIST_PROJECT)[keyof typeof CUTLIST_PROJECT];
