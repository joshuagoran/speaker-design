/** Club music (house, techno): how far its peaks rise above its average, dB. The amp power table's peak watts use it. */
export const MUSIC_CREST_DB = 10;

/** The Coverage page's amp power table: its heading, column names and notes. */
export const AMP_POWER_TEXT = {
  heading: "Amp power at the target",
  driver: "Driver",
  avg: "Average W",
  peak: "Peak W",
  amp: "Amp",
  headroom: "Headroom",
  limit: "Limit",
  clips: "Clips on peaks",
  crestNote: `Peaks assume club music, ${MUSIC_CREST_DB} dB above average.`,
  allAmp: "The amp sets every max: more amp power raises it.",
  notAmp: "More amp power won't raise the max of:",
} as const;
