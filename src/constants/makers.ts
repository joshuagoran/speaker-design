/**
 * Every driver maker, by id, and its name. Driver rows carry the id (`maker`), so code decides on the maker by id and
 * never by the start of a driver's name ("SB Audience" is pro, "SB Acoustics" hi-fi).
 */
export const MAKER_NAMES = {
  bc: "B&C",
  beyma: "Beyma",
  celestion: "Celestion",
  ciare: "Ciare",
  dayton: "Dayton Audio",
  eighteenSound: "18 Sound",
  eminence: "Eminence",
  faital: "FaitalPRO",
  fostex: "Fostex",
  lavoce: "Lavoce",
  peerless: "Peerless",
  purifi: "Purifi",
  sbAcoustics: "SB Acoustics",
  sbAudience: "SB Audience",
  scanSpeak: "Scan-Speak",
  seas: "Seas",
} as const;
