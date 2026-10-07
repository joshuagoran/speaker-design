import { MUSIC_CREST_DB } from "../../constants/ampPower";
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
  /** whether the peaks ask for more than the amp has */
  clips: boolean;
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

/** Watts into 8 ohm for an amp voltage, as `ampVoltage` rates the amp. */
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

/** A channel at the target, `headroom` dB under its max. */
export function channelPower(channel: AmpChannel, max: ChannelMax, headroom: number): ChannelPower {
  const avgW = powerAtTarget(max.wAtMax, headroom),
    peakW = peakPower(avgW);
  return { channel, ...max, headroomDb: headroom, avgW, peakW, clips: peakW > max.ampW * 1.001 };
}
