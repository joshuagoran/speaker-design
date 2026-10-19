// The Speaker optimizer's screen: each unit alone through the same model on a coarse grid (speakerResponse and
// speakerLimits with fewer points), its chamber's net air estimated (no cabinet build). Each option gives each band it
// feeds its music headroom, the F3 where it feeds the lowest band, and its parts' price and weight. Pure.
import type {
  BandFilter,
  BandId,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerLimits,
  SpeakerPort,
  SpeakerResponse,
  SpeakerSpec,
} from "../../../types";
import { speakerResponse } from "../speakerResponse";
import { speakerLimits } from "../speakerLimits";
import { chamberVentModel } from "../chamberAir";
import { hifiVentFits } from "../speakerBuild";
import { coneParts } from "../driverParts";
import { highpassOptions } from "../../optimizer/searchSpace";
import { LITERS_PER_CUBIC_IN } from "../../../constants/units";
import { LIMIT_NAMES } from "../../../constants/limits";
import { VENT_KIND } from "../../../constants/speakerSpec";
import { f3Of, type SpeakerEval } from "./evaluate";
import {
  hornFacts,
  movedFilter,
  partFacts,
  isSubsonic,
  unitBands,
  withPart,
  type ConeUnit,
  type CrossoverPair,
  type HfUnit,
  type SearchUnit,
  type SizeModel,
  chamberLadder,
} from "./space";
import { portSizes, radiatorMasses, tunedPort, withPort } from "./vent";
import { hornFits, speakerLayout } from "../speakerLayout";
import { hornById } from "../../data";
import type { SpeakerOptimizerLocks } from "../../../types";

/**
 * The screen's grid: this many points over the charts' axis (the page's has 220). The finalists and the shown cards
 * are worked out on the full grid.
 */
export const SCREEN_POINTS = 40;
/** The tunings a vented chamber tries, as factors of yours. */
const FB_FACTORS = [0.85, 0.93, 1, 1.08, 1.18];
/** How many of each goal's best options a unit keeps for the combine step. */
const UNIT_PER_GOAL = 4;

/** One way to set a unit, as the screen found it. */
export interface UnitOption {
  /** its unit, by index */
  unit: number;
  driverId: string;
  /** an HF unit's horn (null: none); a cone unit's is null */
  hornId: string | null;
  /** the chamber's volume factor and its step on the ladder (yours: 1) */
  v: number;
  /** the port as screened, its length solved for `fbHz`; null: the vent stays as it is */
  port: SpeakerPort | null;
  fbHz: number | null;
  /** the radiators' added mass, g; null: as it is */
  addG: number | null;
  /** the unit's band's protection highpass, Hz, where the search moves it; null: as it is */
  subsonicHz: number | null;
  /** each crossover the unit's band takes as its highpass, by pair index: the factor on yours */
  xo: ReadonlyMap<number, number>;
  /** each band's music headroom over its passband, dB, at the top amp power */
  room: ReadonlyMap<BandId, number>;
  minRoom: number;
  /** the lowest band's own F3 where the unit feeds it, Hz */
  f3: number | null;
  /** its parts' price (the unpriced ones 0) and weight, lb */
  price: number;
  lb: number;
  /** your own setting of the unit */
  own: boolean;
}

/** What the screen reads of the search. */
export interface ScreenInput {
  spec: SpeakerSpec;
  start: SpeakerEval;
  units: readonly SearchUnit[];
  pairs: readonly CrossoverPair[];
  locks: SpeakerOptimizerLocks;
  model: SizeModel;
  ladder: readonly number[];
  amps: ReadonlyMap<BandId, number>;
  /** the band with the lowest passband now: its F3 is the speaker's */
  lowest: BandId | null;
  /**
   * the options a unit keeps of these (one unit's, yours among them): for each goal the best `perGoal` that keep what
   * the goal keeps, by the search's estimate of the speaker with this unit changed alone
   */
  select: (opts: readonly UnitOption[], perGoal: number) => UnitOption[];
}

/** Every combination of the crossover factors a unit takes, by pair index. */
function xoCombos(
  pairs: readonly CrossoverPair[],
  spec: SpeakerSpec,
  bands: readonly BandId[],
  thin = false,
) {
  let out: Map<number, number>[] = [new Map()];
  pairs.forEach((p, i) => {
    if (p.factors.length < 2 || !bands.includes(spec.bands[p.upper].id)) return;
    const factors = thin ? p.factors.filter((f) => THIN_FACTORS.includes(f)) : p.factors;
    out = out.flatMap((m) => factors.map((f) => new Map([...m, [i, f]])));
  });
  return out;
}

/** The crossover factors a unit tries when its full pass would run past UNIT_RUNS. */
export const THIN_FACTORS: readonly number[] = [0.8, 1, 1.26];
/** The tunings a unit tries when its full pass would still run past UNIT_RUNS. */
const THIN_FB_FACTORS = [0.93, 1, 1.08];
/** About the most runs a unit's full pass takes: past it, fewer crossovers, then fewer volumes, then fewer tunings. */
const UNIT_RUNS = 1200;

/** A full pass's runs, about (a tuning tries some port sizes, and two protection highpasses where it moves one). */
const passRuns = (
  drivers: number,
  p: Pick<ConePass, "ladder" | "fbFactors" | "combos">,
  venting: boolean,
) => drivers * p.ladder.length * p.combos.length * (1 + (venting ? p.fbFactors.length * 3 : 0));

/** The full pass, thinned until it fits UNIT_RUNS (yours stays on every list). */
function fullPass(
  input: ScreenInput,
  u: ConeUnit,
  ladder: readonly number[],
  drivers: number,
): ConePass {
  const p: ConePass = {
    ladder,
    fbFactors: FB_FACTORS,
    combos: xoCombos(input.pairs, input.spec, u.bands),
    allSubsonics: true,
  };
  if (passRuns(drivers, p, u.venting) > UNIT_RUNS)
    p.combos = xoCombos(input.pairs, input.spec, u.bands, true);
  if (passRuns(drivers, p, u.venting) > UNIT_RUNS)
    p.ladder = ladder.filter((v, i) => i % 2 === 0 || Math.abs(v - 1) < 1e-9);
  if (passRuns(drivers, p, u.venting) > UNIT_RUNS) p.fbFactors = THIN_FB_FACTORS;
  return p;
}

/** The unit's bands as a run takes them: the top amps, the crossovers moved, the protection highpass set. */
function runBands(
  input: ScreenInput,
  bands: readonly BandId[],
  xo: ReadonlyMap<number, number>,
  subsonicHz: number | null,
): SpeakerBand[] {
  const { spec, pairs, amps } = input;
  return bands.flatMap((id) => {
    const i = spec.bands.findIndex((b) => b.id === id);
    const band = spec.bands[i];
    if (!band) return [];
    let { highpass, lowpass } = band;
    for (const [p, f] of xo) {
      const pair = pairs[p];
      if (pair.upper === i && highpass) highpass = movedFilter(highpass, f);
      if (pair.lower === i && lowpass) lowpass = movedFilter(lowpass, f);
    }
    if (subsonicHz !== null && highpass)
      highpass = { ...highpass, hz: subsonicHz } satisfies BandFilter;
    return [{ ...band, highpass, lowpass, ampW: amps.get(id) ?? band.ampW }];
  });
}

/** One coarse run of chamber `k` alone (the others empty, with set air, so no cabinet is built) on these bands. */
function run(
  input: ScreenInput,
  k: number,
  chamber: SpeakerChamber,
  bands: SpeakerBand[],
): { response: SpeakerResponse; limits: SpeakerLimits } {
  const { spec } = input;
  const cabinet: SpeakerCabinet = {
    ...spec.cabinet,
    chambers: spec.cabinet.chambers.map((c, i) =>
      i === k ? chamber : { ...c, drivers: [], netLiters: c.netLiters ?? 1 },
    ),
  };
  const response = speakerResponse({ cabinet, bands }, { feed: spec.input, points: SCREEN_POINTS });
  return { response, limits: speakerLimits({ cabinet, bands }, response, { feed: spec.input }) };
}

/** The headroom of each band in a run, and the lowest band's F3; null when a band isn't modeled. */
function readRun(
  input: ScreenInput,
  bands: readonly BandId[],
  r: { response: SpeakerResponse; limits: SpeakerLimits },
) {
  const room = new Map<BandId, number>();
  let f3: number | null = null;
  for (const id of bands) {
    const rb = r.response.bands.find((b) => b.id === id),
      lb = r.limits.bands.find((b) => b.id === id);
    if (!rb || !lb) return null;
    room.set(id, lb.musicDb - rb.passbandDb);
    if (id === input.lowest) f3 = f3Of(rb.curve);
  }
  return {
    room,
    f3,
    minRoom: Math.min(...room.values()),
    who: r.limits.bands.find((b) => b.id === bands[0])?.who,
  };
}

/** The chamber's air as the screen estimates it: its clear volume at `v`, less the cones, the wood and the vent. */
function netEstimator(input: ScreenInput, u: ConeUnit) {
  const { spec, start, model } = input;
  const k = u.chamber;
  const chamber = spec.cabinet.chambers[k];
  const build = start.build.chambers[k];
  const count = u.entries.reduce((sum, j) => sum + chamber.drivers[j].count, 0);
  const dispOf = (driverId: string) =>
    (coneParts(withPart(chamber.drivers[u.entries[0]], driverId, null))?.dispL ?? 0) * count;
  const ventL = (cab: SpeakerCabinet, c: SpeakerChamber) => {
    const vm = chamberVentModel(cab, c);
    return vm ? vm.areaIn2 * vm.lenIn * LITERS_PER_CUBIC_IN : 0;
  };
  const clearL = model.clearIn3[k] * LITERS_PER_CUBIC_IN;
  const raw = (v: number, driverId: string) =>
    clearL * v - dispOf(driverId) - (build ? build.woodL * Math.pow(v, 2 / 3) + build.recessL : 0);
  // calibrated on your design: the estimate of yours meets its real net air
  const own = chamber.drivers[u.entries[0]].driverId;
  const real = start.response.chambers[k]?.netLiters ?? raw(1, own) - ventL(spec.cabinet, chamber);
  const offset = real - (raw(1, own) - ventL(spec.cabinet, chamber));
  return (v: number, driverId: string) =>
    (cab: SpeakerCabinet, c: SpeakerChamber): number =>
      chamber.netLiters !== null
        ? chamber.netLiters * v
        : Math.max(1, raw(v, driverId) + offset - ventL(cab, c));
}

/** One pass over a cone unit's drivers: the volumes, tunings, crossovers and protection highpasses it tries. */
interface ConePass {
  ladder: readonly number[];
  fbFactors: readonly number[];
  combos: readonly Map<number, number>[];
  /** every protection highpass a tuning takes, or only the first */
  allSubsonics: boolean;
}

/**
 * The cone unit's options, in two passes: every candidate at your volume on a few tunings, then the full ladder for the
 * drivers that pass (the ones nothing beats, at most DRIVER_KEEP, and yours). `count` is told each run.
 */
function screenCone(input: ScreenInput, ui: number, u: ConeUnit, count: () => void): UnitOption[] {
  const { spec, start, model } = input;
  const k = u.chamber;
  const chamber0 = spec.cabinet.chambers[k];
  const fb0 = start.response.chambers[k]?.fb ?? null;
  const vented = u.venting && chamber0.vent.kind === VENT_KIND.vented && fb0 !== null;
  const masses =
    u.venting && chamber0.vent.kind === VENT_KIND.radiator ? radiatorMasses(chamber0) : [];
  const subsonic = vented && isSubsonic(spec, input.pairs, input.locks, u.bands[0]);
  const net = netEstimator(input, u);
  const wall = model.walls[k];
  const clearH = chamber0.dims.h - wall.h;
  const n = u.entries.reduce((sum, j) => sum + chamber0.drivers[j].count, 0);
  const ownDriver = chamber0.drivers[u.entries[0]].driverId;

  const pass = (driverId: string, p: ConePass): UnitOption[] => {
    const out: UnitOption[] = [];
    const facts = partFacts(u.driverKind, driverId);
    /** runs one setting on every crossover combination; whether the first band's limit was its port every time */
    const tryAll = (
      chamber: SpeakerChamber,
      o: Pick<UnitOption, "driverId" | "v" | "port" | "fbHz" | "addG">,
      subsonics: readonly (number | null)[],
      own: boolean,
    ) => {
      let portLimited = true;
      for (const xo of p.combos)
        for (const subsonicHz of subsonics) {
          count();
          const r = readRun(
            input,
            u.bands,
            run(input, k, chamber, runBands(input, u.bands, xo, subsonicHz)),
          );
          if (!r) continue;
          if (r.who !== LIMIT_NAMES.port) portLimited = false;
          const mine = own && subsonicHz === null && [...xo.values()].every((f) => f === 1);
          out.push({
            unit: ui,
            hornId: null,
            ...o,
            subsonicHz,
            xo,
            ...r,
            price: facts.price * n,
            lb: facts.lb * n,
            own: mine,
          });
        }
      return portLimited;
    };
    const drivers = chamber0.drivers.map((d, j) =>
      u.entries.includes(j) ? withPart(d, driverId, null) : d,
    );
    for (const v of p.ladder) {
      const dims = { ...chamber0.dims, h: clearH * v + wall.h };
      const shaped: SpeakerChamber = { ...chamber0, dims, drivers };
      const cab = {
        ...spec.cabinet,
        chambers: spec.cabinet.chambers.map((c, i) => (i === k ? shaped : c)),
      };
      const netOf = net(v, driverId);
      const withNet = (c: SpeakerChamber, cb: SpeakerCabinet): SpeakerChamber => ({
        ...c,
        netLiters: netOf(cb, c),
      });
      // as it is, its own vent: at your volume (a part swap alone), or wherever the vent can't change
      if (v === 1 || !u.venting)
        tryAll(
          withNet(shaped, cab),
          { driverId, v, port: null, fbHz: null, addG: null },
          [null],
          driverId === ownDriver && v === 1,
        );
      if (vented && fb0 !== null)
        for (const f of p.fbFactors) {
          const fbHz = fb0 * f;
          for (const size of portSizes(shaped)) {
            const port = tunedPort(cab, k, size, fbHz, netOf);
            if (!port) continue;
            const c = withPort(shaped, port);
            const cb = { ...cab, chambers: cab.chambers.map((x, i) => (i === k ? c : x)) };
            // a longer port (a larger one) won't fit either
            if (!hifiVentFits(cb, c)) break;
            const subsonics = subsonic
              ? highpassOptions(fbHz).slice(0, p.allSubsonics ? 2 : 1)
              : [null];
            if (!tryAll(withNet(c, cb), { driverId, v, port, fbHz, addG: null }, subsonics, false))
              break;
          }
        }
      for (const addG of masses) {
        if (chamber0.vent.kind !== VENT_KIND.radiator) break;
        const c: SpeakerChamber = {
          ...shaped,
          vent: { ...chamber0.vent, radiators: { ...chamber0.vent.radiators, addG } },
        };
        tryAll(withNet(c, cab), { driverId, v, port: null, fbHz: null, addG }, [null], false);
      }
    }
    return out;
  };

  const drivers = passDrivers(input, u.drivers, ownDriver, (id) =>
    pass(id, {
      ladder: [1],
      fbFactors: FIRST_FB_FACTORS,
      combos: [new Map()],
      allSubsonics: false,
    }),
  );
  const full = fullPass(
    input,
    u,
    u.sized ? chamberLadder(model, k, input.ladder) : [1],
    drivers.length,
  );
  return drivers.flatMap((id) => pass(id, full));
}

/** The tunings the first pass tries, as factors of yours. */
const FIRST_FB_FACTORS = [0.9, 1, 1.1];
/** The most candidates a unit takes to its full pass. */
const DRIVER_KEEP = 8;

/** How many of each goal's best first-pass options send their candidate on to the full pass. */
const FIRST_PER_GOAL = 2;

/**
 * The candidates that go on to the full pass: the ones whose first-pass options the search keeps (`select`, the best
 * FIRST_PER_GOAL for each goal), at most DRIVER_KEEP, yours always. With few candidates, all of them, and no first pass.
 */
function passDrivers(
  input: ScreenInput,
  ids: readonly string[],
  own: string,
  first: (id: string) => UnitOption[],
): string[] {
  if (ids.length <= DRIVER_KEEP) return [...ids];
  const of = new Map<UnitOption, string>();
  for (const id of ids) for (const o of first(id)) of.set(o, id);
  const kept = new Set([own]);
  for (const o of input.select([...of.keys()], FIRST_PER_GOAL)) {
    if (kept.size >= DRIVER_KEEP) break;
    const id = of.get(o);
    if (id !== undefined) kept.add(id);
  }
  return ids.filter((id) => kept.has(id));
}

/** The HF unit's options: the parts that fit where yours sits, then the kept ones on each crossover it takes. */
function screenHf(input: ScreenInput, ui: number, u: HfUnit, count: () => void): UnitOption[] {
  const { spec } = input;
  const chamber0 = spec.cabinet.chambers[u.chamber];
  const entry = chamber0.drivers[u.entry];
  const placed = speakerLayout(spec.cabinet).chambers[u.chamber];
  const ownKey = `${entry.driverId}/${entry.horn?.hornId ?? ""}`;
  const keyOf = (p: { driverId: string; hornId: string | null }) =>
    `${p.driverId}/${p.hornId ?? ""}`;
  // a horn that doesn't fit where yours sits can't be built there
  const parts = u.parts.filter((part) => {
    if (keyOf(part) === ownKey || !entry.horn || part.hornId === null) return true;
    const horn = hornById(part.hornId);
    return !!horn && !!placed && hornFits(horn, placed, entry.horn.placement);
  });
  const pass = (
    part: { driverId: string; hornId: string | null },
    combos: readonly Map<number, number>[],
  ) => {
    const out: UnitOption[] = [];
    const driver = withPart(entry, part.driverId, part.hornId);
    const chamber: SpeakerChamber = {
      ...chamber0,
      drivers: [driver],
      netLiters: chamber0.netLiters ?? 1,
    };
    const f = partFacts(entry.kind, part.driverId),
      h = hornFacts(part.hornId);
    for (const xo of combos) {
      count();
      const r = readRun(
        input,
        [u.band],
        run(input, u.chamber, chamber, runBands(input, [u.band], xo, null)),
      );
      if (!r) continue;
      out.push({
        unit: ui,
        driverId: part.driverId,
        hornId: part.hornId,
        v: 1,
        port: null,
        fbHz: null,
        addG: null,
        subsonicHz: null,
        xo,
        ...r,
        price: (f.price + h.price) * entry.count,
        lb: (f.lb + h.lb) * entry.count,
        own: keyOf(part) === ownKey && [...xo.values()].every((x) => x === 1),
      });
    }
    return out;
  };
  const keys = passDrivers(input, parts.map(keyOf), ownKey, (key) => {
    const part = parts.find((p) => keyOf(p) === key);
    return part ? pass(part, [new Map()]) : [];
  });
  const combos = xoCombos(input.pairs, spec, [u.band]);
  return parts.filter((p) => keys.includes(keyOf(p))).flatMap((p) => pass(p, combos));
}

/** About how many runs the screen makes for a unit (the progress total). */
export function screenRuns(input: ScreenInput, u: SearchUnit): number {
  const kept = (n: number) => Math.min(n, DRIVER_KEEP);
  const first = (n: number, each: number) => (n > DRIVER_KEEP ? n * each : 0);
  if (u.kind === "hf")
    return (
      first(u.parts.length, 1) +
      kept(u.parts.length) * xoCombos(input.pairs, input.spec, unitBands(u)).length
    );
  const ladder = u.sized ? chamberLadder(input.model, u.chamber, input.ladder) : [1];
  return (
    first(u.drivers.length, 1 + (u.venting ? FIRST_FB_FACTORS.length * 2 : 0)) +
    passRuns(kept(u.drivers.length), fullPass(input, u, ladder, kept(u.drivers.length)), u.venting)
  );
}

/** Each unit's options, screened and kept (`select`, the best UNIT_PER_GOAL for each goal). `onRun` hears each run. */
export function screenAll(input: ScreenInput, onRun: () => void): UnitOption[][] {
  return input.units.map((u, ui) => {
    const opts =
      u.kind === "cone" ? screenCone(input, ui, u, onRun) : screenHf(input, ui, u, onRun);
    return input.select(opts, UNIT_PER_GOAL);
  });
}
