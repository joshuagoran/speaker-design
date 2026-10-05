import { UI_TEXT } from "./uiText";

/** The PA settings column's fold sections, by id, and the name each shows. "Look" matches the phone sheet's tab. */
export const PA_SETTINGS_SECTIONS = {
  sub: "Sub",
  mid: UI_TEXT.midBass,
  horn: "Horn",
  xo: "Crossovers and amps",
  look: "Look",
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
