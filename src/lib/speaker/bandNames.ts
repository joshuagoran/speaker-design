// The names the Speaker page gives its bands until the user renames one: "Full range" for one band, low to high for
// more ("Low", "Mid", "High"). A band whose name is one the page gives (or an earlier build's "Band 3") is renamed when
// the band count changes; a name the user typed stays.
import type { SpeakerBand } from "../../types";
import { AUTO_BAND_NAMES } from "../../constants/speakerSpec";
import { SPEAKER_TEXT } from "../../constants/speakerPage";

/** The name band `index` of `count` takes, low to high. */
export function autoBandName(index: number, count: number): string {
  if (count <= 1) return AUTO_BAND_NAMES.fullRange;
  if (index === 0) return AUTO_BAND_NAMES.low;
  if (index === count - 1) return AUTO_BAND_NAMES.high;
  /** how many bands sit between the lowest and the highest */
  const middle = count - 2;
  if (middle === 1) return AUTO_BAND_NAMES.mid;
  if (middle === 2) return index === 1 ? AUTO_BAND_NAMES.lowMid : AUTO_BAND_NAMES.highMid;
  return AUTO_BAND_NAMES.midN(index);
}

/** The most bands whose generated names are checked (more than any design uses). */
const MAX_BANDS = 12;

/** Every name the page gives a band at any count, and an earlier build's "Band N". */
const GIVEN_NAMES: ReadonlySet<string> = new Set(
  Array.from({ length: MAX_BANDS }, (_, i) => i + 1).flatMap((count) => [
    SPEAKER_TEXT.newBandName(count),
    ...Array.from({ length: count }, (_, index) => autoBandName(index, count)),
  ]),
);

/** Whether a band's name is one the page gave it (the user has not renamed it). */
export const autoNamed = (name: string) => GIVEN_NAMES.has(name);

/** The bands with every name the page gave renamed for their place and count; a name the user typed stays. */
export function withAutoNames<B extends Pick<SpeakerBand, "name">>(bands: readonly B[]): B[] {
  return bands.map((b, i) =>
    autoNamed(b.name) ? { ...b, name: autoBandName(i, bands.length) } : b,
  );
}
