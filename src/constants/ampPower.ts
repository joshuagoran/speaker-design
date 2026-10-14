import type { LimitId } from "../types";

/** Club music (house, techno): how far its peaks rise above its average, dB. The amp power table's peak watts use it. */
export const MUSIC_CREST_DB = 10;

/**
 * A sine's peaks over its average, dB (twice the power). An amp's rating is a sine's average power, so the amp's peaks
 * are this much higher before it clips.
 */
export const SINE_CREST_DB = 10 * Math.log10(2);

/** The amp power table's flag when a driver's peaks pass its limit, by the limit (`ChannelPower.who`). */
export const PAST_LIMIT_ON_PEAKS: Record<LimitId, string> = {
  amp: "Clips on peaks",
  Xmax: "Past Xmax on peaks",
  thermal: "Past rating on peaks",
  port: "Port past limit on peaks",
  radiator: "Radiators past Xmax on peaks",
  throat: "Throat past limit on peaks",
};

/** Every amp power setting's label (PA, Fills, Speaker): the watts as entered, into the driver. */
export const AMP_POWER_LABEL = "Amp power, W";
/** The Hi-fi page's two amp power settings (the woofer's and the tweeter's channel). */
export const HIFI_AMP_LABELS = {
  woofer: "Woofer amp power, W",
  tweeter: "Tweeter amp power, W",
} as const;
/** Its tooltip: the model takes the watts into the driver's impedance as entered (lib/power), so give it the load's. */
export const AMP_POWER_TIP =
  "Use your amp's power rating at the load it drives (for example, at 4 Ω or 8 Ω).";

/** The Coverage page's amp power table: its heading, column names and notes. */
export const AMP_POWER_TEXT = {
  heading: "Amp power at the target",
  driver: "Driver",
  avg: "Average",
  peak: "Peak",
  maxPeak: "Max peak",
  amp: "Amp rating",
  headroom: "Peak headroom",
  limit: "Limit",
  crestNote: `Peaks assume club music, ${MUSIC_CREST_DB} dB above average. Max peak is the power at the first limit.`,
} as const;
