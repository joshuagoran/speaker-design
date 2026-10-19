// Where a new stack (Stack page) or space (Space page) starts: a preset (src/pages/stack/stackPresets). The picker's
// label and button are the start picker's (START_PICKER_TEXT).

/** The presets, by id: the PA page's starting design in each layout, and the Hi-fi page's pair. */
export const STACK_PRESET = {
  paStack: "paStack",
  paPole: "paPole",
  paSatellite: "paSatellite",
  paTower: "paTower",
  hifiPair: "hifiPair",
} as const;
export type StackPreset = (typeof STACK_PRESET)[keyof typeof STACK_PRESET];

/** What each start shows in the picker. */
export const STACK_START_NAMES = {
  paStack: "PA stack: the top on the sub",
  paPole: "PA on a pole: the top on a pole over the sub",
  paSatellite: "PA satellites: the tops on stands, one sub",
  paTower: "PA tower",
  hifiPair: "Hi-fi pair",
} as const satisfies Record<StackPreset, string>;

/** The name a new stack or space takes, by start (its speakers' names start with it). */
export const STACK_START_DESIGN_NAMES = {
  paStack: "PA stack",
  paPole: "PA on a pole",
  paSatellite: "PA satellites",
  paTower: "PA tower",
  hifiPair: "Hi-fi pair",
} as const satisfies Record<StackPreset, string>;

/** The picker's groups. */
export const STACK_START_GROUPS = {
  presets: "Presets",
} as const;
