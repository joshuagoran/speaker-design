import { UI_TEXT } from "./uiText";
import { PA_SETTINGS_TABS } from "./paSettingsTabs";

/** The PA settings column's fold sections, by id, and the name each shows (the phone sheet's tab names where they match). */
export const PA_SETTINGS_SECTIONS = {
  sub: PA_SETTINGS_TABS.sub,
  mid: UI_TEXT.midBass,
  horn: PA_SETTINGS_TABS.horn,
  xo: "Crossovers and amps",
  build: PA_SETTINGS_TABS.build,
} as const;
export type PaSettingsSection = keyof typeof PA_SETTINGS_SECTIONS;
/** The PA sections stored under an older id (their fold state carries over): Build was Look. */
export const PA_SETTINGS_RENAMED: Partial<Record<string, PaSettingsSection>> = { look: "build" };

/** The Hi-fi settings column's fold sections, by id, and the name each shows. */
export const HIFI_SETTINGS_SECTIONS = {
  drivers: "Drivers",
  box: "Box and port",
  xo: "Crossover and amps",
  room: "Room and seat",
} as const;
export type HifiSettingsSection = keyof typeof HIFI_SETTINGS_SECTIONS;

/** The Cutlist settings column's fold sections, by id, and the name each shows (also the phone sheet's tab names). */
export const CUTLIST_SETTINGS_SECTIONS = {
  boxes: "Boxes",
  sheets: "Sheets",
  grain: "Grain",
  cuts: "Cuts",
} as const;
export type CutlistSettingsSection = keyof typeof CUTLIST_SETTINGS_SECTIONS;

/** The Designer settings column's fold sections, by id, and the name each shows. */
export const DESIGNER_SETTINGS_SECTIONS = {
  speaker: "Speaker",
  construction: "Construction",
  chambers: "Chambers and drivers",
  bands: "Bands and filters",
  look: "Look",
} as const;
export type DesignerSettingsSection = keyof typeof DESIGNER_SETTINGS_SECTIONS;

/** The Stack settings column's fold sections, by id, and the name each shows. */
export const STACK_SETTINGS_SECTIONS = {
  stack: "Stack",
  members: "Members",
  crossovers: "Crossovers",
} as const;
export type StackSettingsSection = keyof typeof STACK_SETTINGS_SECTIONS;

/** The Space settings column's fold sections, by id, and the name each shows. */
export const SPACE_SETTINGS_SECTIONS = {
  space: "Space",
  room: "Room and listeners",
  placements: "Placements",
  hardware: "Hardware",
} as const;
export type SpaceSettingsSection = keyof typeof SPACE_SETTINGS_SECTIONS;
