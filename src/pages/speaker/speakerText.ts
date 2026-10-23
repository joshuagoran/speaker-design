// The Speaker page's one-line summaries, built from the spec and the catalog.
import type {
  BandFilter,
  SpeakerNearMiss,
  SpeakerOptimizerMetrics,
  BoxBracing,
  SpeakerBand,
  SpeakerChamber,
  SpeakerHorn,
  SpeakerSpec,
} from "../../types";
import { formatDims, formatDollars, formatHz, formatWatts, formatDb } from "../../lib/format";
import {
  SPEAKER_TEXT,
  HORN_DRIVE_NAMES,
  HORN_PATH_NAMES,
  PORT_SHAPE_NAMES,
  VENT_KIND_NAMES,
} from "../../constants/speakerPage";
import { CHAMBER_LOAD, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";
import { CARD_LABELS, NEAR_MISS_YOURS } from "../../constants/optimizerText";
import { UI_TEXT } from "../../constants/uiText";
import { driverName } from "../../lib/speaker/driverLists";
import { pathIn } from "./hornSections";
import { CM2_PER_IN2 } from "../../constants/units";

/** "1 chamber", "2 chambers". */
export const countText = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A filter in words: its type and corner. */
export const filterText = (f: BandFilter) => `${f.type} ${formatHz(f.hz)}`;

/** A horn in a few words: its drive, sections, path length and path, e.g. "front-loaded horn, 2 sections, 40 in, straight". */
export const hornText = (horn: Pick<SpeakerHorn, "drive" | "path" | "segments">) =>
  [
    `${HORN_DRIVE_NAMES[horn.drive.kind].toLowerCase()} horn`,
    countText(horn.segments.length, "section", "sections"),
    `${pathIn(horn)} in`,
    HORN_PATH_NAMES[horn.path].toLowerCase(),
  ].join(", ");

/** A folded horn's straight horn (the shape its drawing should follow) in one line: its length and its end areas. */
export const straightHornText = (horn: Pick<SpeakerHorn, "segments">) => {
  const { segments } = horn;
  const areaIn2 = (cm2: number | undefined) => Math.round((cm2 ?? 0) / CM2_PER_IN2);
  return `${pathIn(horn)} in, ${areaIn2(segments[0]?.s1)} to ${areaIn2(segments[segments.length - 1]?.s2)} in²`;
};

/** A chamber in one line: its size, vent, horn and drivers. */
export function chamberText(chamber: SpeakerChamber) {
  const { vent } = chamber;
  const ventText =
    vent.kind === VENT_KIND.vented
      ? `${VENT_KIND_NAMES.vented.toLowerCase()} (${PORT_SHAPE_NAMES[vent.port.shape ?? PORT_SHAPE.round].toLowerCase()})`
      : VENT_KIND_NAMES[vent.kind].toLowerCase();
  const drivers = chamber.drivers.map((d) => `${d.count} × ${driverName(d)}`).join(" + ");
  return [
    formatDims(chamber.dims),
    ventText,
    chamber.stuffingPct ? `stuffed ${chamber.stuffingPct}%` : null,
    chamber.load.kind === CHAMBER_LOAD.horn ? hornText(chamber.load.horn) : null,
    drivers || "no drivers",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The input range in a few words, as the bands fold's summary says it: "input 120 Hz LR24 up", "input up to 120 Hz
 * LR24", "input 120 Hz LR24 to 2000 Hz LR24"; null when it is the full range.
 */
export function inputText({ highpass, lowpass }: SpeakerSpec["input"]) {
  if (highpass && lowpass)
    return `input ${formatHz(highpass.hz)} ${highpass.type} to ${formatHz(lowpass.hz)} ${lowpass.type}`;
  if (highpass) return `input ${formatHz(highpass.hz)} ${highpass.type} up`;
  if (lowpass) return `input up to ${formatHz(lowpass.hz)} ${lowpass.type}`;
  return null;
}

/** A band in one line: its name, filters, level and amp power. */
export function bandText(band: SpeakerBand) {
  const filters = [
    band.highpass && `HP ${filterText(band.highpass)}`,
    band.lowpass && `LP ${filterText(band.lowpass)}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `${band.name}${filters ? ` ${filters}` : ""}${band.levelDb ? ` ${formatDb(band.levelDb)} dB` : ""} ${formatWatts(band.ampW)}`;
}

/** The speaker in one line, as the library lists it: its chambers and bands. */
export const speakerSummary = (spec: Pick<SpeakerSpec, "cabinet" | "bands">) =>
  [
    spec.cabinet.chambers.map(chamberText).join("; "),
    countText(spec.bands.length, "band", "bands"),
  ].join(" · ");

/** A chamber's braces in words: its window braces and ribs, or none. */
export function bracingText(bracing: Pick<BoxBracing, "windows" | "ribs">): string {
  const windows = bracing.windows.x.length + bracing.windows.y.length + bracing.windows.z.length;
  const ribs = bracing.ribs.reduce((sum, r) => sum + r.at.length, 0);
  const parts = [
    windows > 0 && countText(windows, "window brace", "window braces"),
    ribs > 0 && countText(ribs, "rib", "ribs"),
  ].filter((p): p is string => !!p);
  return parts.length ? parts.join(", ") : SPEAKER_TEXT.noBraces;
}

/** The speaker's drivers in a few words, each part once with its total count: "2 × Name + 1 × Other". */
export function driverSummary(cabinet: Pick<SpeakerSpec["cabinet"], "chambers">): string {
  const counts = new Map<string, { name: string; n: number }>();
  for (const d of cabinet.chambers.flatMap((c) => c.drivers)) {
    const key = `${d.kind}:${d.driverId}`;
    counts.set(key, { name: driverName(d), n: (counts.get(key)?.n ?? 0) + d.count });
  }
  return [...counts.values()].map(({ name, n }) => `${n} × ${name}`).join(" + ");
}

/**
 * The facts the near miss names of its closest design: the weight (`weight`, default its total), the price and the
 * level at 1 m (none for a level that isn't modeled).
 */
export const nearMissFacts = (
  m: Pick<SpeakerOptimizerMetrics, "lb" | "price" | "pricePartial" | "musicDb">,
  weight = `${m.lb.toFixed(0)} lb`,
): string[] => [
  weight,
  `${formatDollars(m.price)}${m.pricePartial ? UI_TEXT.partialPriceMark : ""}`,
  ...(m.musicDb === null ? [] : [`${formatDb(m.musicDb)} dB at 1 m`]),
];

/**
 * The near miss's closest design in a sentence, from its facts; your own design is named as such ("Closest: your design
 * (...)."). Ends in a space.
 */
export const nearMissSentence = (facts: readonly string[], closestIsYours: boolean): string => {
  const text = facts.join(", ");
  return `${CARD_LABELS.nearMiss}: ${closestIsYours ? `${NEAR_MISS_YOURS} (${text})` : text}. `;
};

/**
 * The Speaker near miss's closest design in a sentence: its drivers, weight, price and level at 1 m. Empty when there is
 * none.
 */
export function speakerNearMissText({
  closest,
  closestIsYours,
}: Pick<SpeakerNearMiss, "closest" | "closestIsYours">): string {
  if (!closest) return "";
  return nearMissSentence(
    [driverSummary(closest.spec.cabinet), ...nearMissFacts(closest.metrics)],
    closestIsYours,
  );
}
