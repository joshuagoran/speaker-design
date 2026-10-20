// Where a new stack (Stack page) or space (Space page) starts: an empty design or a preset (src/pages/stack/stackPresets),
// as the saving row's "New from…" lists them. It imports nothing, so the Node checks (tests/three-memory-check.mjs) can
// read it.

/** The presets, by id: the default PA design in each layout, and the default Hi-fi pair. */
export const STACK_PRESET = {
  paStack: "paStack",
  paPole: "paPole",
  paSatellite: "paSatellite",
  paTower: "paTower",
  hifiPair: "hifiPair",
} as const;
export type StackPreset = (typeof STACK_PRESET)[keyof typeof STACK_PRESET];

/** The start "New from…" lists first: an empty design. */
export const EMPTY_START = "empty";
/** A start "New from…" lists on the Stack and Space pages: the empty design, or a preset. */
export type DesignStart = StackPreset | typeof EMPTY_START;

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

/** The groups "New from…" lists the starts under. */
export const STACK_START_GROUPS = {
  presets: "Presets",
} as const;
