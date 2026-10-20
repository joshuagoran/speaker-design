// The Speaker page's starting points (src/pages/speaker/speakerTemplates, useSpeakerStart): their ids and names. It
// imports nothing, so the Node checks (tests/mobile-check.mjs, tests/three-memory-check.mjs) can read it.

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
  genericSub18: "genericSub18",
  genericDualSub18: "genericDualSub18",
  genericTop12: "genericTop12",
  genericTop15: "genericTop15",
  genericHornSub18: "genericHornSub18",
} as const;
export type SpeakerTemplate = (typeof SPEAKER_TEMPLATE)[keyof typeof SPEAKER_TEMPLATE];

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
  genericSub18: 'Generic 18" Sub',
  genericDualSub18: 'Generic Dual 18" Sub',
  genericTop12: 'Generic 12" Top',
  genericTop15: 'Generic 15" Top',
  genericHornSub18: 'Generic 18" Horn Sub',
} as const satisfies Record<SpeakerTemplate, string>;

/** The name a new design takes, by start (a saved speaker keeps its own). */
export const SPEAKER_START_SPEAKER_NAMES = {
  empty: "New Speaker",
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
  genericSub18: SPEAKER_START_NAMES.genericSub18,
  genericDualSub18: SPEAKER_START_NAMES.genericDualSub18,
  genericTop12: SPEAKER_START_NAMES.genericTop12,
  genericTop15: SPEAKER_START_NAMES.genericTop15,
  genericHornSub18: SPEAKER_START_NAMES.genericHornSub18,
} as const satisfies Record<SpeakerTemplate, string>;

/** The groups "New from…" lists the starts under: the templates. */
export const SPEAKER_START_GROUPS = {
  templates: "Templates",
} as const;
