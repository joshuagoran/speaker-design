import { MUSIC_CREST_DB, SINE_CREST_DB } from "../../constants/ampPower";
import type {
  BalancedLevels,
  FrequencyPoint,
  HornResponse,
  PaMaxPoint,
  SubLimits,
  SubLimitWho,
} from "../../types";

/** An amp channel of the stack: one per driver, named as the coverage map's pads name the bands. */
export type AmpChannel = keyof BalancedLevels["pads"];

/** A channel at its max level: the power the model drives there, W; the amp's power into the driver, W; what sets the max. */
export interface ChannelMax {
  wAtMax: number;
  ampW: number;
  who: SubLimitWho;
}

/** A channel at the target level: its max, the headroom to it, and the average and peak power there. */
export interface ChannelPower extends ChannelMax {
  channel: AmpChannel;
  /** dB from the target up to the max */
  headroomDb: number;
  avgW: number;
  /** the power on music peaks, `MUSIC_CREST_DB` above the average */
  peakW: number;
  /**
   * the peak power at the limit that sets the max (`who`), W: the max is a sine whose peaks reach that limit, so
   * twice its average (`SINE_CREST_DB`); amp-limited, twice the amp's rating
   */
  maxPeakW: number;
  /** dB from the music's peaks up to `maxPeakW`: 10·log10(maxPeakW / peakW). Below 0 the peaks pass the limit. */
  peakHeadroomDb: number;
  /** whether the peaks pass the limit */
  pastLimit: boolean;
}

/** The power at a level `headroomDb` under the max, W: power follows level, 10 dB per decade. */
export const powerAtTarget = (wAtMax: number, headroomDb: number) =>
  wAtMax * 10 ** (-headroomDb / 10);

/** The power on music peaks, W: the average raised by the crest factor. */
export const peakPower = (avgW: number, crestDb: number = MUSIC_CREST_DB) =>
  avgW * 10 ** (crestDb / 10);

/**
 * A band's headroom, dB: how far the system's gain and the band's own pad turn it down from its max (both 0 or less).
 */
export const headroomDb = (gain: number, pad: number) => Math.max(0, -(gain + pad));

/**
 * Watts into 8 ohm for a voltage. The model takes the sub and mid at 8 ohm nominal (`ampVoltage`,
 * `thermalVoltageLimit`, `SubLimits.W`; the catalog lists only their Re), so their watts and the amp's agree.
 */
const wattsInto8 = (v: number) => (v * v) / 8;

/** The sub at its music limit: the drive and limit `subwooferLimits` found, against the amp's voltage. */
export const subMax = (lim: Pick<SubLimits, "W" | "who">, ampV: number): ChannelMax => ({
  wAtMax: lim.W,
  ampW: wattsInto8(ampV),
  who: lim.who,
});

/**
 * The mid at its max between the crossovers. The model's limit curve (`maxOutputCurve`) gives each frequency its own
 * drive; music drives the whole band at one level, so the lowest drive in the band sets it, and that point's limit
 * names it. `curve` is the model at the amp's voltage `ampV`, point for point with `max`.
 */
export function midMax(
  max: readonly PaMaxPoint[],
  curve: readonly Pick<FrequencyPoint, "spl">[],
  ampV: number,
  band: readonly [lo: number, hi: number],
): ChannelMax | null {
  let low: { db: number; who: SubLimitWho } | null = null;
  for (const [i, p] of max.entries()) {
    const at = curve[i];
    if (p.f < band[0] || p.f > band[1] || !at) continue;
    const db = p.spl - at.spl;
    if (!low || db < low.db) low = { db, who: p.who };
  }
  if (!low) return null;
  return {
    wAtMax: wattsInto8(ampV * 10 ** (low.db / 20)),
    ampW: wattsInto8(ampV),
    who: low.who,
  };
}

/** The compression driver at its max: the power the horn model gives it, against the amp's power into its impedance. */
export const hornMax = (h: Pick<HornResponse, "P" | "pAmp" | "who">): ChannelMax => ({
  wAtMax: h.P,
  ampW: h.pAmp,
  who: h.who,
});

/**
 * How far past the limit the peaks go before they count as past it, dB: half the table's 0.1 dB step, so a flag
 * always shows with a peak headroom that reads below 0.
 */
const PEAK_MARGIN_DB = 0.05;

/** A channel at the target, `headroom` dB under its max. */
export function channelPower(channel: AmpChannel, max: ChannelMax, headroom: number): ChannelPower {
  const avgW = powerAtTarget(max.wAtMax, headroom),
    peakW = peakPower(avgW),
    maxPeakW = peakPower(max.wAtMax, SINE_CREST_DB),
    // the same as headroom − (MUSIC_CREST_DB − SINE_CREST_DB), read off the two peak columns
    peakHeadroomDb = 10 * Math.log10(maxPeakW / peakW);
  // a small margin, so peaks that just reach the limit (as rounded) don't read as past it
  const pastLimit = peakHeadroomDb < -PEAK_MARGIN_DB;
  return {
    channel,
    ...max,
    headroomDb: headroom,
    avgW,
    peakW,
    maxPeakW,
    peakHeadroomDb,
    pastLimit,
  };
}
