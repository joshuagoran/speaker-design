// The Speaker page's starting points (src/pages/speaker/speakerStarts, speakerTemplates): their ids, names, groups and
// the controls that pick one. It imports nothing, so the Node checks (tests/mobile-check.mjs,
// tests/three-memory-check.mjs) can read it.

/**
 * The templates, by id: each builds a new speaker from the catalog and the defaults (src/pages/speaker/
 * speakerTemplates). A template sets only the first values; a saved speaker keeps no template or role.
 */
export const SPEAKER_TEMPLATE = {
  empty: "empty",
  paSubBox: "paSubBox",
  paMidHighBox: "paMidHighBox",
  paTowerBaffleHorn: "paTowerBaffleHorn",
  paTowerTopHorn: "paTowerTopHorn",
  hifiTwoWay: "hifiTwoWay",
  monitorCoax: "monitorCoax",
  monitorHorn: "monitorHorn",
  fill: "fill",
  paV2SubBinOne: "paV2SubBinOne",
  paV2SubBinTwo: "paV2SubBinTwo",
  paV2MidBox: "paV2MidBox",
  th18: "th18",
  skram: "skram",
} as const;
export type SpeakerTemplate = (typeof SPEAKER_TEMPLATE)[keyof typeof SPEAKER_TEMPLATE];

/** The starts that read a design you have now (the L1 adapters), by id. */
export const SPEAKER_CURRENT_START = {
  hifi: "hifi",
  paSub: "paSub",
  paTop: "paTop",
  paTower: "paTower",
} as const;
export type SpeakerCurrentStart =
  (typeof SPEAKER_CURRENT_START)[keyof typeof SPEAKER_CURRENT_START];

/** Where a new design starts, by id: a template, or a design you have now. */
export const SPEAKER_START = { ...SPEAKER_TEMPLATE, ...SPEAKER_CURRENT_START } as const;
export type SpeakerStart = SpeakerTemplate | SpeakerCurrentStart;

/** What each start shows in the picker. */
export const SPEAKER_START_NAMES = {
  empty: "Empty speaker",
  paSubBox: "PA sub",
  paMidHighBox: "PA mid/high box",
  paTowerBaffleHorn: "PA tower, horn in the baffle",
  paTowerTopHorn: "PA tower, horn on top",
  hifiTwoWay: "Hi-fi 2-way",
  monitorCoax: "DJ booth monitor, coaxial",
  monitorHorn: "DJ booth monitor, woofer and small horn",
  fill: "Fill",
  paV2SubBinOne: "PA v2 sub bin, one driver",
  paV2SubBinTwo: "PA v2 sub bin, two drivers",
  paV2MidBox: "PA v2 mid box",
  th18: "TH18 tapped horn (Xoc1)",
  skram: "SKRAM offset-driver horn",
  hifi: "The Hi-fi design",
  paSub: "The PA design's sub",
  paTop: "The PA design's mid/high box",
  paTower: "The PA design's tower",
} as const satisfies Record<SpeakerStart, string>;

/** The name a new design takes, by start (a saved speaker keeps its own). */
export const SPEAKER_START_SPEAKER_NAMES = {
  empty: "New speaker",
  paSubBox: "PA sub",
  paMidHighBox: "PA mid/high box",
  paTowerBaffleHorn: "PA tower",
  paTowerTopHorn: "PA tower",
  hifiTwoWay: "Hi-fi speaker",
  monitorCoax: "Booth monitor",
  monitorHorn: "Booth monitor",
  fill: "Fill",
  paV2SubBinOne: "Sub bin",
  paV2SubBinTwo: "Sub bin",
  paV2MidBox: "Mid box",
  th18: "TH18",
  skram: "SKRAM",
  hifi: "Hi-fi speaker",
  paSub: "PA sub",
  paTop: "PA mid/high box",
  paTower: "PA tower",
} as const satisfies Record<SpeakerStart, string>;
