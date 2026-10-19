/** The Cutlist settings column's fold sections, by id, and the name each shows (also the phone sheet's tab names). */
export const CUTLIST_SETTINGS_SECTIONS = {
  boxes: "Boxes",
  sheets: "Sheets",
  grain: "Grain",
  cuts: "Cuts",
} as const;
export type CutlistSettingsSection = keyof typeof CUTLIST_SETTINGS_SECTIONS;

/** The Speaker page settings column's fold sections, by id, and the name each shows. */
export const SPEAKER_SETTINGS_SECTIONS = {
  construction: "Construction",
  chambers: "Chambers",
  bands: "Bands and filters",
  look: "Look",
  optimizer: "Optimizer",
} as const;
export type SpeakerSettingsSection = keyof typeof SPEAKER_SETTINGS_SECTIONS;
/** The Speaker page's phone sheet tabs that need a shorter name than their section (one word, so the row fits). */
export const SPEAKER_SETTINGS_TABS = {
  construction: "Build",
  bands: "Bands",
} as const satisfies Partial<Record<SpeakerSettingsSection, string>>;

/** The Stack settings column's fold sections, by id, and the name each shows. */
export const STACK_SETTINGS_SECTIONS = {
  stack: "Stack",
  members: "Boxes",
  crossovers: "Crossovers",
  optimizer: "Optimizer",
} as const;
export type StackSettingsSection = keyof typeof STACK_SETTINGS_SECTIONS;

/** The Space settings column's fold sections, by id, and the name each shows. */
export const SPACE_SETTINGS_SECTIONS = {
  space: "Space",
  room: "Room and listeners",
  placements: "Placements",
  hardware: "Amp power and alignment",
} as const;
export type SpaceSettingsSection = keyof typeof SPACE_SETTINGS_SECTIONS;
/** The Space page's phone sheet tabs that need a shorter name than their section (one word, so the row fits). */
export const SPACE_SETTINGS_TABS = {
  room: "Room",
  hardware: "Amps",
} as const satisfies Partial<Record<SpaceSettingsSection, string>>;
