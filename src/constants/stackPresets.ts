// Where a new stack (Stack page) or space (Space page) starts: a preset, or the current PA design
// (src/pages/stack/stackPresets). The PA page becomes these presets at L3f (docs/speaker-designer-plan.md). The picker's
// label, button and "current designs" group are the start picker's (START_PICKER_TEXT,
// START_PICKER_GROUPS).
import { START_PICKER_GROUPS } from "./startPicker";

/** The presets, by id: the PA page's starting design in each layout, and the Hi-fi page's pair. */
export const STACK_PRESET = {
  paStack: "paStack",
  paPole: "paPole",
  paSatellite: "paSatellite",
  paTower: "paTower",
  hifiPair: "hifiPair",
} as const;
export type StackPreset = (typeof STACK_PRESET)[keyof typeof STACK_PRESET];

/** Where a new stack or space starts, by id: a preset, or the design on the PA page now. */
export const STACK_START = { ...STACK_PRESET, paCurrent: "paCurrent" } as const;
export type StackStart = (typeof STACK_START)[keyof typeof STACK_START];

/** What each start shows in the picker. */
export const STACK_START_NAMES = {
  paStack: "PA stack: the top on the sub",
  paPole: "PA on a pole: the top on a pole over the sub",
  paSatellite: "PA satellites: the tops on stands, one sub",
  paTower: "PA tower",
  hifiPair: "Hi-fi pair",
  paCurrent: "The current PA design",
} as const satisfies Record<StackStart, string>;

/** The name a new stack or space takes, by start (its speakers' names start with it). */
export const STACK_START_DESIGN_NAMES = {
  paStack: "PA stack",
  paPole: "PA on a pole",
  paSatellite: "PA satellites",
  paTower: "PA tower",
  hifiPair: "Hi-fi pair",
  paCurrent: "PA design",
} as const satisfies Record<StackStart, string>;

/** The picker's groups. */
export const STACK_START_GROUPS = {
  presets: "Presets",
  current: START_PICKER_GROUPS.current,
} as const;
