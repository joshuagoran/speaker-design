// A horn's goals (`HornGoals`): how a design meets them, and a starting layout sized from them. Pure.
//
// The starting layout is one flare from the closed end (or the throat) to the mouth, its area growing evenly along the
// path (parabolic sections: flat panels, as a folded box builds them). The cones' sides split it into sections at their
// taps. The search tries path lengths around a quarter wavelength at the low goal, flares and tap places on a grid, then
// halves its steps around the best one. Each try is scored on the goals' band: the spread of its response, its level at
// the low goal, and the lowest maximum output against the target level.
//
// The air: a tapped horn fills the chamber's air but for a small rear chamber (the air behind the cones, room for the
// motors). A front-loaded or offset horn shares it with its rear chamber, a share the search also tries. Folding loses
// some air to the panels inside the fold (`FOLD_AIR_SHARE`).
import type {
  HornDesignResult,
  HornGoalFit,
  HornGoals,
  HornLayoutDesign,
  HornSegment,
  SpeakerChamber,
  SpeakerHorn,
  ThieleSmall,
} from "../../types";
import { hornDesignOf, type HornDesignRoom } from "./hornDesign";
import { hornLayoutModel } from "./hornLayoutModel";
import { logSpacedFrequencies } from "../acoustics/directivity";
import { wattsToVolts } from "../power";
import { SPEED_OF_SOUND } from "../../constants/acoustics";
import { CM_PER_M } from "../../constants/units";
import { HORN_PROFILE } from "../../constants/hornEngine";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_PATH,
  SPEAKER_RESPONSE_VOLTS,
} from "../../constants/speakerSpec";
import {
  FOLD_AIR_SHARE,
  HORN_GOAL_LIMIT,
  LOW_EDGE_DB,
  MIN_SECTION_SHARE,
  SEARCH_FLARES,
  SEARCH_PATH_SHARES,
  SEARCH_POINTS,
  SEARCH_REAR_SHARES,
  SEARCH_REFINE_ROUNDS,
  SEARCH_TAP_SHARES,
  TAPPED_REAR_PER_DISPLACEMENT,
} from "../../constants/hornGoals";
import { MIN_NET_L } from "./speakerBuild";

/** The drives a starting layout can be sized for: every drive the engines model. */
export type GoalDrive = Exclude<SpeakerHorn["drive"]["kind"], typeof HORN_DRIVE.back>;

/** A driver's power rating as the maximum output reads it: its watts (`aes`) and its nominal impedance. */
export type DriverPower = Pick<ThieleSmall, "aes" | "imp">;

/**
 * How a design meets the goals: its response at the model's drive over the goals' band, and its maximum output there,
 * where the drivers' power rating (`power`, into their impedance) or their Xmax stops it. Null when the engine cannot
 * model it or the band is empty.
 */
export function hornGoalFit(
  design: HornLayoutDesign,
  goals: HornGoals,
  power: DriverPower,
): HornGoalFit | null {
  if (!(goals.lowHz > 0 && goals.highHz > goals.lowHz)) return null;
  // no power or no travel: no maximum output to read
  if (!(power.aes > 0 && design.driver.Xmax > 0)) return null;
  const freqs = logSpacedFrequencies(goals.lowHz, goals.highHz, SEARCH_POINTS);
  const model = hornLayoutModel(design, freqs, SPEAKER_RESPONSE_VOLTS);
  if (!model || !model.curve.every((p) => Number.isFinite(p.spl) && p.xmm > 0)) return null;
  const spl = model.curve.map((p) => p.spl);
  const mean = spl.reduce((sum, x) => sum + x, 0) / spl.length;
  /** the most the drivers' power rating lifts the level from the model's drive, dB */
  const powerDb = 20 * Math.log10(wattsToVolts(power.aes, power) / SPEAKER_RESPONSE_VOLTS);
  let maxOutDb = Infinity,
    maxOutHz = goals.lowHz,
    limit: HornGoalFit["limit"] = HORN_GOAL_LIMIT.power;
  model.curve.forEach((p) => {
    /** the most the cones' Xmax lifts the level here, dB */
    const excursionDb = 20 * Math.log10(design.driver.Xmax / p.xmm);
    const out = p.spl + Math.min(powerDb, excursionDb);
    if (out < maxOutDb) {
      maxOutDb = out;
      maxOutHz = p.f;
      limit = excursionDb < powerDb ? HORN_GOAL_LIMIT.excursion : HORN_GOAL_LIMIT.power;
    }
  });
  return {
    spreadDb: Math.max(...spl) - Math.min(...spl),
    lowEdgeDb: spl[0] - mean,
    maxOutDb,
    maxOutHz,
    limit,
  };
}

/** A fit's score: lower is better. The spread, a low edge under the usual corner, and a shortfall from the target. */
const scoreOf = (fit: HornGoalFit, goals: HornGoals) =>
  fit.spreadDb +
  2 * Math.max(0, -LOW_EDGE_DB - fit.lowEdgeDb) +
  2 * Math.max(0, goals.targetDb - fit.maxOutDb);

/** What the search reads of the chamber: its drivers, vent and stuffing, and its place in the box. */
export interface GoalSearch {
  chamber: SpeakerChamber;
  drive: GoalDrive;
  /** the chamber's face and the cones' setback, as `hornDesignOf` reads them */
  room: Omit<HornDesignRoom, "netLiters">;
  /** the chamber's air for the horn and its rear chamber, L: its clear volume less the drivers' displacement */
  airLiters: number;
  /** the drivers' displacement, L: a tapped horn's rear chamber starts at a multiple of it */
  displacementLiters: number;
  power: DriverPower;
  goals: HornGoals;
  /**
   * The path the user picked: a straight horn stays within the chamber's depth, a folded one may be longer. Absent: the
   * path follows the length (folded when longer than the depth).
   */
  path?: SpeakerHorn["path"];
}

/** One try: the path length, cm, the flare, the tap places (shares of the path), and the rear chamber's share. */
interface Shape {
  pathCm: number;
  flare: number;
  taps: number[];
  rearShare: number;
}

/** A starting layout: the horn, the chamber's net air (its rear chamber), and how it meets the goals. */
export interface GoalHorn {
  horn: SpeakerHorn;
  netLiters: number;
  fit: HornGoalFit;
}

/** The sections of a path `pathCm` long holding `liters` of air, its area growing evenly by `flare`, split at `taps`. */
function sectionsOf(
  pathCm: number,
  flare: number,
  taps: readonly number[],
  liters: number,
): HornSegment[] {
  /** the closed end's area, cm²: the path's air over its length and its mean area's share */
  const start = (2 * liters * 1000) / (pathCm * (1 + flare));
  const areaAt = (share: number) => start * (1 + (flare - 1) * share);
  const cuts = [0, ...taps, 1];
  return cuts.slice(1).map((end, i) => ({
    profile: HORN_PROFILE.parabolic,
    s1: areaAt(cuts[i]),
    s2: areaAt(end),
    length: (end - cuts[i]) * pathCm,
  }));
}

/** The drive a shape's taps give, as the horn stores it (taps are section boundaries from 1). */
function driveOf(kind: GoalDrive): SpeakerHorn["drive"] {
  switch (kind) {
    case HORN_DRIVE.front:
      return { kind };
    case HORN_DRIVE.offset:
      return { kind, tap: 1 };
    case HORN_DRIVE.tapped:
      return { kind, frontTap: 1, rearTap: 2 };
  }
}

/** How many taps each drive splits the path at. */
const TAP_COUNT: Record<GoalDrive, number> = {
  [HORN_DRIVE.front]: 0,
  [HORN_DRIVE.offset]: 1,
  [HORN_DRIVE.tapped]: 2,
};

/** A horn without its drawn boards (`fold`), its path kept. */
function withoutDrawing(horn: SpeakerHorn): SpeakerHorn {
  const { fold: _fold, ...rest } = horn;
  return rest;
}

/**
 * A starting layout for the goals, or null when no try can be modeled (no cone driver with Thiele/Small parameters, a
 * vent the engine doesn't take, no air). The horn keeps the chamber's other horn settings (its driver board, its mouth's
 * place) but not its drawing; its path is the one the search names (a straight horn within the chamber's depth), else
 * folded when it is longer than the chamber is deep.
 */
export function goalHorn(search: GoalSearch, depthCm: number): GoalHorn | null {
  const { chamber, drive, goals } = search;
  // the chamber's horn without its drawing: each try is read from its own sections, not the old boards' trace
  const base: SpeakerHorn =
    chamber.load.kind === CHAMBER_LOAD.horn
      ? withoutDrawing(chamber.load.horn)
      : {
          segments: [],
          portOffset: 0,
          drive: { kind: HORN_DRIVE.front },
          path: HORN_PATH.straight,
        };
  const usable = search.airLiters * FOLD_AIR_SHARE;
  /** a tapped horn's rear chamber, L */
  const tappedRear = Math.max(MIN_NET_L, TAPPED_REAR_PER_DISPLACEMENT * search.displacementLiters);
  const quarterWaveCm = (SPEED_OF_SOUND * CM_PER_M) / (4 * goals.lowHz);
  const build = (shape: Shape) => {
    const rearL = drive === HORN_DRIVE.tapped ? tappedRear : usable * shape.rearShare;
    const hornL = usable - rearL;
    if (!(hornL > 0) || !(shape.pathCm > 0) || !(shape.flare >= 1)) return null;
    // a straight horn has to fit the chamber's depth
    if (search.path === HORN_PATH.straight && shape.pathCm > depthCm) return null;
    const horn: SpeakerHorn = {
      ...base,
      segments: sectionsOf(shape.pathCm, shape.flare, shape.taps, hornL),
      drive: driveOf(drive),
      path: search.path ?? (shape.pathCm > depthCm ? HORN_PATH.folded : HORN_PATH.straight),
      goals,
    };
    const read: HornDesignResult = hornDesignOf(
      { ...chamber, load: { kind: CHAMBER_LOAD.horn, horn }, netLiters: rearL },
      { count: 1, angle: 2 },
      { ...search.room, netLiters: rearL },
    );
    const fit = read.ok ? hornGoalFit(read.design, goals, search.power) : null;
    return fit && { horn, netLiters: rearL, fit, score: scoreOf(fit, goals) };
  };
  /** the taps must stay in order, inside the path, each section at least `MIN_SECTION_SHARE` of it */
  const tapsValid = (taps: readonly number[]) =>
    [0, ...taps, 1].every((t, i, all) => i === 0 || t - all[i - 1] >= MIN_SECTION_SHARE);
  const tapSets: number[][] =
    TAP_COUNT[drive] === 0
      ? [[]]
      : TAP_COUNT[drive] === 1
        ? SEARCH_TAP_SHARES.map((t) => [t])
        : SEARCH_TAP_SHARES.flatMap((a) =>
            SEARCH_TAP_SHARES.filter((b) => b > a).map((b) => [a, b]),
          );
  const rearShares = drive === HORN_DRIVE.tapped ? [0] : SEARCH_REAR_SHARES;
  let best: ReturnType<typeof build> = null,
    bestShape: Shape | null = null;
  for (const share of SEARCH_PATH_SHARES)
    for (const flare of SEARCH_FLARES)
      for (const taps of tapSets)
        for (const rearShare of rearShares) {
          // a straight horn tries lengths up to the chamber's depth (the shares past it all try the full depth)
          const pathCm =
            search.path === HORN_PATH.straight
              ? Math.min(share * quarterWaveCm, depthCm)
              : share * quarterWaveCm;
          const shape = { pathCm, flare, taps, rearShare };
          const tried = build(shape);
          if (tried && (!best || tried.score < best.score)) {
            best = tried;
            bestShape = shape;
          }
        }
  if (!best || !bestShape) return null;
  // halve the steps around the best: each setting one step up and down in turn, kept when it scores better
  let step = { path: 0.075 * quarterWaveCm, flare: 0.5, tap: 0.05, rear: 0.075 };
  for (let round = 0; round < SEARCH_REFINE_ROUNDS; round++) {
    const moves = (s: Shape): Shape[] => [
      { ...s, pathCm: s.pathCm + step.path },
      { ...s, pathCm: s.pathCm - step.path },
      { ...s, flare: s.flare + step.flare },
      { ...s, flare: Math.max(1, s.flare - step.flare) },
      ...s.taps.flatMap((_, i) =>
        [step.tap, -step.tap].map((d) => ({
          ...s,
          taps: s.taps.map((t, j) => (j === i ? t + d : t)),
        })),
      ),
      ...(drive === HORN_DRIVE.tapped
        ? []
        : [
            { ...s, rearShare: Math.min(0.9, s.rearShare + step.rear) },
            { ...s, rearShare: Math.max(0.05, s.rearShare - step.rear) },
          ]),
    ];
    for (const shape of moves(bestShape)) {
      if (!tapsValid(shape.taps)) continue;
      const tried = build(shape);
      if (tried && tried.score < best.score) {
        best = tried;
        bestShape = shape;
      }
    }
    step = { path: step.path / 2, flare: step.flare / 2, tap: step.tap / 2, rear: step.rear / 2 };
  }
  return { horn: best.horn, netLiters: best.netLiters, fit: best.fit };
}
