/**
 * Every driver maker, by id, and its name. Driver rows carry the id (`maker`), so code decides on the maker by id and
 * never by the start of a driver's name ("SB Audience" is pro, "SB Acoustics" hi-fi). A part from a new maker needs its
 * id and name added here first, and its segment in MAKER_SEGMENT; the catalog tables' `maker` fields only accept these ids.
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

/**
 * Whether each maker is a hi-fi or a pro (PA) maker: a published Xmax with no coil and gap heights is estimated with
 * that segment's band (`ESTIMATE` in lib/xmax). Every maker must be classified; a new one fails the type check here.
 */
export const MAKER_SEGMENT: Record<keyof typeof MAKER_NAMES, "hifi" | "pro"> = {
  bc: "pro",
  beyma: "pro",
  celestion: "pro",
  ciare: "pro",
  dayton: "hifi",
  eighteenSound: "pro",
  eminence: "pro",
  faital: "pro",
  fostex: "hifi",
  lavoce: "pro",
  peerless: "hifi",
  purifi: "hifi",
  sbAcoustics: "hifi",
  sbAudience: "pro",
  scanSpeak: "hifi",
  seas: "hifi",
};
