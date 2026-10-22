// A band's filters as complex transfer functions, for the speaker model's sum (lib/speaker/speakerResponse). Pure.
import type { BandFilter, Complex, HighpassType, SpeakerBand } from "../../types";
import { abs, complex, divide, multiply } from "../acoustics/complex";
import { HIGHPASS_ALIGNMENTS, butterworth } from "../acoustics/boxModels";
import { FIRST_ORDER_FILTER } from "../../constants/speakerSpec";

/** Which side of its corner a filter passes. */
type FilterSide = "highpass" | "lowpass";

/** s^n */
function power(s: Complex, n: number): Complex {
  let out = complex(1);
  for (let i = 0; i < n; i++) out = multiply(out, s);
  return out;
}

/**
 * The filter's transfer at `f` (Hz): first order 1/(1 + s) or s/(1 + s); Butterworth n 1/Bn(s) or sⁿ/Bn(s); a
 * Linkwitz-Riley of order n is a Butterworth n/2 squared.
 */
export function filterTransfer(f: number, filter: BandFilter, side: FilterSide): Complex {
  const s = complex(0, f / filter.hz);
  if (filter.type === FIRST_ORDER_FILTER) {
    const d = complex(1, s.im);
    return divide(side === "lowpass" ? complex(1) : s, d);
  }
  const [kind, order] = HIGHPASS_ALIGNMENTS[filter.type];
  const d = kind === "lr" ? power(butterworth(s, order / 2), 2) : butterworth(s, order);
  return divide(side === "lowpass" ? complex(1) : power(s, order), d);
}

/** A highpass's gain (its magnitude) at `f`, Hz, corner `fc`: the Hi-fi box's subsonic reads it. */
export const highpassGain = (f: number, fc: number, type: HighpassType = "BW24") =>
  abs(filterTransfer(f, { hz: fc, type }, "highpass"));

/** A band's (or a feed's) highpass and lowpass together at `f` (Hz); 1 where it has neither. */
export function filtersTransfer(
  f: number,
  { highpass, lowpass }: Pick<SpeakerBand, "highpass" | "lowpass">,
): Complex {
  const hp = highpass ? filterTransfer(f, highpass, "highpass") : complex(1);
  return lowpass ? multiply(hp, filterTransfer(f, lowpass, "lowpass")) : hp;
}
