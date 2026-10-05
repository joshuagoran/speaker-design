import type { ProjectId } from "./pages";

/**
 * What the Cutlist page says for each project: what one set of boxes is called, the set-count choices and their
 * label, and where the boxes come from.
 */
export const CUTLIST_PROJECTS = {
  pa: { set: "stack", setsLabel: "Stacks", sets: [1, 2, 4], source: "the Design page's boxes" },
  hifi: { set: "speaker", setsLabel: "Speakers", sets: [1, 2, 4], source: "the Hi-fi page's box" },
} as const satisfies Record<
  ProjectId,
  { set: string; setsLabel: string; sets: readonly number[]; source: string }
>;
