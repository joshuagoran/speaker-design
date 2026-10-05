import { UI_TEXT } from "./uiText";
import { PA_SETTINGS_TABS } from "./paSettingsTabs";

/** The PA settings column's fold sections, by id, and the name each shows (the phone sheet's tab names where they match). */
export const PA_SETTINGS_SECTIONS = {
  sub: PA_SETTINGS_TABS.sub,
  mid: UI_TEXT.midBass,
  horn: PA_SETTINGS_TABS.horn,
  xo: "Crossovers and amps",
  look: PA_SETTINGS_TABS.look,
} as const;
export type PaSettingsSection = keyof typeof PA_SETTINGS_SECTIONS;

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
