// The Speaker page's driver comparison: every catalog option for one driver entry (the Speaker optimizer's candidates,
// lib/speaker/optimize/space), each put into your design with all else held (box, vent, filters, and amps), run through
// the page's own model (`evaluateSpeaker`), checked as the optimizer checks (`problemsOf`), and sorted. Pure.
import type {
  BandId,
  CompareProblem,
  DriverCompareOption,
  DriverCompareTarget,
  FrequencyPoint,
  SpeakerDriver,
  SpeakerSpec,
} from "../../types";
import {
  SPEAKER_OPTIMIZER_CATALOG,
  coneCandidates,
  hfCandidates,
  hornFacts,
  partFacts,
  withPart,
} from "./optimize/space";
import { evaluateSpeaker, problemsOf, type SizeCaps, type SpeakerEval } from "./optimize/evaluate";
import { isConeKind } from "./driverParts";
import { settledCabinet } from "./speakerLayout";
import { passbandEdgesHz } from "./speakerResponse";
import { upperFirst } from "../format";
import { SPEAKER_PROBLEM_TEXT } from "../../constants/speakerOptimizer";
import {
  DRIVER_COMPARE_SORT,
  SORT_DIRECTION,
  type DriverCompareSort,
  type SortDirection,
} from "../../constants/driverCompare";

/** An option's key: its part and its horn. */
export const optionKey = (o: DriverCompareOption): string => `${o.driverId}/${o.hornId ?? ""}`;

/** The entry's own part and horn. */
export const ownOption = (d: Pick<SpeakerDriver, "driverId" | "horn">): DriverCompareOption => ({
  driverId: d.driverId,
  hornId: d.horn?.hornId ?? null,
});

/** The part the comparison opened on, with its kind: the options keep it while the entry is still that kind. */
export type CompareOrigin = DriverCompareOption & Pick<SpeakerDriver, "kind">;

/**
 * A driver entry's options, yours first: a cone's same-kind, same-size catalog drivers with a US price and T/S
 * (`coneCandidates`), a
 * compression driver's pairs with the horns its exit takes (`hfCandidates`), or a tweeter's on its waveguide. `origin`
 * stays among them while the entry is its kind, so a swap can always go back.
 */
export function driverOptions(d: SpeakerDriver, origin?: CompareOrigin): DriverCompareOption[] {
  const own = ownOption(d);
  const found: DriverCompareOption[] = isConeKind(d.kind)
    ? coneCandidates(
        d.kind,
        d.driverId,
        SPEAKER_OPTIMIZER_CATALOG,
        partFacts(d.kind, d.driverId).size ?? undefined,
      ).map((driverId) => ({
        driverId,
        hornId: own.hornId,
      }))
    : hfCandidates(d, SPEAKER_OPTIMIZER_CATALOG, false, false);
  const list = [own, ...(origin && origin.kind === d.kind ? [origin] : []), ...found];
  const seen = new Set<string>();
  return list
    .map((o) => ({ driverId: o.driverId, hornId: o.hornId }))
    .filter((o) => {
      const key = optionKey(o);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The spec with an option in the entry (its count, place and bands kept), its drivers settled as every edit settles them. */
export function withOption(
  spec: SpeakerSpec,
  target: DriverCompareTarget,
  o: DriverCompareOption,
): SpeakerSpec {
  const chambers = spec.cabinet.chambers.map((c, k) =>
    k !== target.chamber
      ? c
      : {
          ...c,
          drivers: c.drivers.map((d, j) =>
            j === target.entry ? withPart(d, o.driverId, o.hornId) : d,
          ),
        },
  );
  return { ...spec, cabinet: settledCabinet({ ...spec.cabinet, chambers }) };
}

/** One of the entry's bands as the charts preview it: its response and its maximum output. */
export interface CompareBandCurves {
  id: BandId;
  curve: FrequencyPoint[];
  max: FrequencyPoint[];
}

/**
 * One option's run through the page's model: its numbers, the facts and warnings its checks read, and
 * the curves the charts preview (what the comparison's worker posts back).
 */
export type DriverCompareRun = Pick<SpeakerEval, "metrics" | "facts" | "warnings"> & {
  /** the entry's bands (a coaxial's two), each modeled one */
  bands: CompareBandCurves[];
  /** the speaker's summed response and summed maximum output */
  sum: FrequencyPoint[];
  maxSum: FrequencyPoint[];
};

/** A curve's points as plain frequency points (what the charts read). */
const points = (curve: readonly FrequencyPoint[]): FrequencyPoint[] =>
  curve.map(({ f, spl }) => ({ f, spl }));

/** An option put into the entry, run through the page's model. */
export function runOption(
  spec: SpeakerSpec,
  target: DriverCompareTarget,
  o: DriverCompareOption,
): DriverCompareRun {
  const next = withOption(spec, target, o);
  const ev = evaluateSpeaker(next);
  const ids = [...new Set(next.cabinet.chambers[target.chamber]?.drivers[target.entry]?.bands)];
  const bands = ids.flatMap((id): CompareBandCurves[] => {
    const r = ev.response.bands.find((b) => b.id === id);
    const l = ev.limits.bands.find((b) => b.id === id);
    return r ? [{ id, curve: r.curve, max: l ? points(l.max) : [] }] : [];
  });
  return {
    metrics: ev.metrics,
    facts: ev.facts,
    warnings: ev.warnings,
    bands,
    sum: ev.response.sum,
    maxSum: points(ev.limits.sum),
  };
}

/** What the comparison's worker is given: the spec, the entry and the options to run. */
export interface DriverCompareInput {
  spec: SpeakerSpec;
  target: DriverCompareTarget;
  options: readonly DriverCompareOption[];
}

/** Each option's run, in the input's order. */
export const runOptions = ({ spec, target, options }: DriverCompareInput): DriverCompareRun[] =>
  options.map((o) => runOption(spec, target, o));

/** One row of the comparison: the option, its name and own price, its run and what it fails. */
export interface DriverCompareRow {
  /** the option's key (`optionKey`) */
  id: string;
  option: DriverCompareOption;
  name: string;
  /** the part's own price with its horn, US dollars; null when the catalog lists none */
  price: number | null;
  /** the part's own weight with its horn, lb; null when the catalog lists none */
  lb: number | null;
  /**
   * its band's average level, dB, over your part's band (`passbandEdgesHz` of yours), so every option is read over the
   * same frequencies; null when the model doesn't run the band
   */
  levelDb: number | null;
  /** your design's part */
  yours: boolean;
  run: DriverCompareRun;
  /** what it fails against your design and the limits, and the bands that limit first (keep-up) */
  problems: CompareProblem[];
  /** it fails something your design doesn't */
  fails: boolean;
}

/** A curve's mean level, dB, over `window` (Hz, ends included); null when no point falls in it. */
function meanOver(
  curve: readonly FrequencyPoint[],
  window: NonNullable<ReturnType<typeof passbandEdgesHz>>,
): number | null {
  const pts = curve.filter((p) => p.f >= window.lowHz && p.f <= window.highHz);
  return pts.length ? pts.reduce((sum, p) => sum + p.spl, 0) / pts.length : null;
}

/** What the rows are made from besides the runs: the entry's kind and the option names. */
export interface CompareRowsContext {
  kind: SpeakerDriver["kind"];
  /** your option's key */
  yours: string;
  nameOf: (o: DriverCompareOption) => string;
}

/** The comparison checks fit and the model, not the optimizer's budget, weight, or size limits. */
const NO_LIMITS = { budget: null, maxLb: null } as const;
const NO_CAPS: SizeCaps = new Map();

/** A run's problems in words: the checks against `start`, then its warnings. */
function problemTexts(run: DriverCompareRun, start: DriverCompareRun): string[] {
  return [
    ...problemsOf(run, start, NO_LIMITS, NO_CAPS).map((p) => upperFirst(SPEAKER_PROBLEM_TEXT[p])),
    ...run.warnings,
  ];
}

/**
 * The rows for the options that have a run (`runOf`), in the options' order; none until yours has one. A problem your
 * design has too is marked `yoursToo` (it shows gray); a row fails when it adds one.
 */
export function compareRows(
  options: readonly DriverCompareOption[],
  runOf: (o: DriverCompareOption) => DriverCompareRun | undefined,
  ctx: CompareRowsContext,
): DriverCompareRow[] {
  const mine = options.find((o) => optionKey(o) === ctx.yours);
  const start = mine && runOf(mine);
  if (!start) return [];
  const yoursHas = new Set(problemTexts(start, start));
  const yourCurve = start.bands[0]?.curve;
  const window = yourCurve ? passbandEdgesHz(yourCurve) : null;
  return options.flatMap((option): DriverCompareRow[] => {
    const run = runOf(option);
    if (!run) return [];
    const id = optionKey(option);
    const part = partFacts(ctx.kind, option.driverId);
    const horn = option.hornId === null ? null : hornFacts(option.hornId);
    const problems = problemTexts(run, start).map((text) => ({
      text,
      yoursToo: yoursHas.has(text),
    }));
    return [
      {
        id,
        option,
        name: ctx.nameOf(option),
        price: part.priced ? part.price + (horn?.price ?? 0) : null,
        lb: part.weighed ? part.lb + (horn?.lb ?? 0) : null,
        levelDb: window && run.bands[0] ? meanOver(run.bands[0].curve, window) : null,
        yours: id === ctx.yours,
        run,
        problems,
        fails: problems.some((p) => !p.yoursToo),
      },
    ];
  });
}

/** Each sort key's best direction: the first click sorts best first. */
export const SORT_BEST: Record<DriverCompareSort, SortDirection> = {
  name: SORT_DIRECTION.ascending,
  price: SORT_DIRECTION.ascending,
  lb: SORT_DIRECTION.ascending,
  level: SORT_DIRECTION.descending,
  f3: SORT_DIRECTION.ascending,
  max: SORT_DIRECTION.descending,
  checks: SORT_DIRECTION.ascending,
};

/** A row's value for a sort key (null: no number, always last). */
function sortValue(r: DriverCompareRow, key: DriverCompareSort): number | string | null {
  const m = r.run.metrics;
  switch (key) {
    case DRIVER_COMPARE_SORT.name:
      return r.name;
    case DRIVER_COMPARE_SORT.price:
      return r.price;
    case DRIVER_COMPARE_SORT.lb:
      return r.lb;
    case DRIVER_COMPARE_SORT.level:
      return r.levelDb;
    case DRIVER_COMPARE_SORT.f3:
      return m.f3;
    case DRIVER_COMPARE_SORT.max:
      return m.musicDb;
    case DRIVER_COMPARE_SORT.checks:
      return r.problems.filter((p) => !p.yoursToo).length;
  }
}

/**
 * The rows in table order: yours first, the ones that fail something yours doesn't last, and each group by `key` in
 * `dir` (a row with no number last; ties by name).
 */
export function sortRows(
  rows: readonly DriverCompareRow[],
  key: DriverCompareSort,
  dir: SortDirection,
): DriverCompareRow[] {
  const sign = dir === SORT_DIRECTION.ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (a.yours !== b.yours) return a.yours ? -1 : 1;
    if (a.fails !== b.fails) return a.fails ? 1 : -1;
    const va = sortValue(a, key),
      vb = sortValue(b, key);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else if (va !== vb) {
      const order =
        typeof va === "string" || typeof vb === "string"
          ? String(va).localeCompare(String(vb))
          : va - vb;
      return order * sign;
    }
    return a.name.localeCompare(b.name);
  });
}
