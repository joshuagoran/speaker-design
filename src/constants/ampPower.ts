/** Club music (house, techno): how far its peaks rise above its average, dB. The amp power table's peak watts use it. */
export const MUSIC_CREST_DB = 10;

/**
 * A sine's peaks over its average, dB (twice the power). An amp's rating is a sine's average power, so the amp's peaks
 * are this much higher before it clips.
 */
export const SINE_CREST_DB = 10 * Math.log10(2);

/** The Coverage page's amp power table: its heading, column names and notes. */
export const AMP_POWER_TEXT = {
  heading: "Amp power at the target",
  driver: "Driver",
  avg: "Average",
  peak: "Peak",
  amp: "Amp rating",
  headroom: "Headroom",
  limit: "Limit",
  clips: "Clips on peaks",
  crestNote: `Peaks assume club music, ${MUSIC_CREST_DB} dB above average. An amp clips when the peaks pass twice its rating.`,
  allAmp: "The amp sets every max: more amp power raises it.",
  notAmp: "More amp power won't raise the max of:",
} as const;
