// The speaker at its limits: each band's drivers at the amp's full power through the band's filters, up to the first
// limit the box models use. Pure; it reads the response's chamber runs, so no box model runs again.
//
// - Cones (lib/acoustics/boxModels sineLimitAt, per point): the cone's Xmax and the vent's air speed at
//   each frequency, the driver's program rating (2 × AES) and the amp as ceilings on the whole drive. Radiators add
//   their travel against their Xmax, as the Hi-fi engine checks it.
// - Datasheet drivers keep their engine's power rule: a compression driver the PA's (lib/acoustics/boxModels hornPower), a tweeter
//   and a coaxial's HF section the Hi-fi's (lib/speaker/twoWay tweeterMaxLevel), derated below their rating's frequency when
//   the band's highpass sits there.
// - A band's drive: its amp power (`ampW`, the watts into its load, lib/power) as a voltage, through a passive band's pad. Its level for music is one
//   drive for the whole band, set where the band first meets a limit (as the PA sub's music limit and the Hi-fi
//   woofer's). Each band's own curve takes the amp and the program rating on the whole drive, as the PA does.
// - The sum takes one input for every band: at each frequency the first band to meet a limit sets it. There a band can
//   only limit where it carries signal: the program rating takes the drive the band's own filters leave it, and so
//   does the amp of an active band (its filters run ahead of the amp). A passive band's amp is the channel it shares,
//   ahead of the network: the same ceiling for every band on the channel (the amp is a voltage ceiling, √(8 W), as
//   both engines take it, so the summed load doesn't move it). The feed (the speaker's input range) shapes the signal
//   itself: the sum follows it, and nothing is pushed harder outside it. In a stack the feed is the member's crossover,
//   ahead of every amp: it lifts the sum's ceilings as an active band's own filters do (`stackCrossover`).
// - Each vent takes its own air-speed limit (`maxSpeedMs`, set by the spec); a drawn horn's vent has none. A horn's
//   throat air speed is shown, with no limit or guide: a throat does not chuff like a port, and there is no common
//   figure for it.
import type {
  BandId,
  NominalImpedance,
  LimitId,
  LimitPeak,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerChamberLimits,
  SpeakerDriver,
  SpeakerDriverPower,
  SpeakerLimits,
  SpeakerResponse,
  SpeakerSpec,
} from "../../types";
import { abs } from "../acoustics/complex";
import { ampVoltage, ampWatts, hornPower, sineLimitAt } from "../acoustics/boxModels";
import { voltsToWatts } from "../power";
import { tweeterMaxLevel } from "./twoWay";
import { CD_OPTIONS, HIFI_PASSIVES, hifiDriverById } from "../data";
import { byId } from "../tables";
import { coneParts, hfParts } from "./driverParts";
import { filtersTransfer } from "./bandFilter";
import { NO_FILTERS } from "./specParts";
import { chamberCones, hfBandOf, passbandDb, type SpeakerResponseOptions } from "./speakerResponse";
import { tracedHorn } from "./foldHorn";
import { HIFI_DRIVE } from "../../constants/hifiEngine";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  SPEAKER_RESPONSE_VOLTS,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { INPUT_RANGE_LIMIT, LIMIT_NAMES, PER_FREQUENCY_LIMITS } from "../../constants/limits";

/** Where the input range ends, as a gain: its filters −6 dB down (a Linkwitz-Riley filter's corner). */
const INPUT_EDGE_GAIN = 0.5;

/** Options: the feed (as the response's), and whether it is a stack's crossover. */
export interface SpeakerLimitsOptions extends SpeakerResponseOptions {
  /**
   * the feed is a stack member's crossover: in the front end ahead of every amp, it lifts the amp's and the program
   * rating's ceilings in the sum as an active band's own filters do (the stack's other members carry the signal outside
   * it). Alone, the feed is the input range, which shapes the signal itself: the sum follows it.
   */
  stackCrossover?: boolean;
}

/**
 * A band's drive with the amp at full power, V RMS: its amp power (the watts into its `load`, lib/power) as a voltage,
 * through a passive band's pad (a network can't add gain, so a band set above its channel gets the channel's full
 * voltage).
 */
export const bandDriveVolts = (
  band: Pick<SpeakerBand, "ampW" | "drive" | "levelDb">,
  load: NominalImpedance,
) =>
  ampVoltage(band.ampW, load) *
  (band.drive === HIFI_DRIVE.passive ? Math.pow(10, Math.min(0, band.levelDb) / 20) : 1);

/**
 * Each band's amp load: the first driver that feeds it (a cone's T/S, a datasheet driver's HF section), since the model
 * doesn't know how several drivers are wired; the passive bands share their channel's, the first passive band's. Empty
 * (8 Ω, lib/power) where no modeled driver feeds a band.
 */
export function bandLoads(
  spec: Pick<SpeakerSpec, "cabinet" | "bands">,
): Map<BandId, NominalImpedance> {
  const first = new Map<BandId, NominalImpedance>();
  for (const chamber of spec.cabinet.chambers)
    for (const driver of chamber.drivers) {
      const cone = coneParts(driver);
      const coneBand = driver.bands[0];
      if (cone && coneBand !== undefined && !first.has(coneBand)) first.set(coneBand, cone.ts);
      const hfBand = hfBandOf(driver);
      const hf = hfBand === null ? null : hfParts(driver);
      if (hf && hfBand !== null && !first.has(hfBand)) first.set(hfBand, { imp: hf.imp });
    }
  const passive = spec.bands.find((b) => b.drive === HIFI_DRIVE.passive);
  const channel = passive ? (first.get(passive.id) ?? {}) : {};
  return new Map(
    spec.bands.map((b) => [
      b.id,
      b.drive === HIFI_DRIVE.passive ? channel : (first.get(b.id) ?? {}),
    ]),
  );
}

/** The most air speed the chamber's vent takes, m/s; null without a vent. */
const ventSpeedMax = (chamber: SpeakerChamber) =>
  chamber.vent.kind === VENT_KIND.vented ? chamber.vent.maxSpeedMs : null;

/**
 * The air speed limit of the vent the cones see, m/s: the chamber's own (`ventSpeedMax`), or none (Infinity) for a drawn
 * horn's vent, whose air speed is shown and does not limit; null without a vent.
 */
const portSpeedMax = (
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">,
  chamber: SpeakerChamber,
) => ventSpeedMax(chamber) ?? (tracedHorn(cabinet, chamber)?.rearVent ? Infinity : null);

/** The radiators' Xmax, mm; null without radiators (or with an id the catalog doesn't have). */
const radiatorXmax = (chamber: SpeakerChamber) =>
  chamber.vent.kind === VENT_KIND.radiator
    ? (byId(HIFI_PASSIVES, chamber.vent.radiators.id)?.Xmax ?? null)
    : null;

/**
 * A datasheet driver's power at a band's drive, by its engine's rule, its impedance, Ω, and its program rating (derated),
 * W; null with no HF data.
 */
function driverPower(driver: SpeakerDriver, band: SpeakerBand, driveV: number) {
  // no highpass: the rating as published (a coaxial's own network, which the spec doesn't model)
  const xo = band.highpass?.hz ?? Infinity;
  switch (driver.kind) {
    case DRIVER_KIND.compression: {
      const hf = byId(CD_OPTIONS, driver.driverId)?.hf;
      if (!hf) return null;
      // the watts the band's drive puts into the driver (lib/power)
      const p = hornPower(hf, xo, voltsToWatts(driveV, hf));
      return { watts: p.P, who: p.who, derate: p.derate, imp: p.imp, programW: p.pProg };
    }
    case DRIVER_KIND.tweeter:
    case DRIVER_KIND.coaxial: {
      const tweeter = hifiDriverById("tweeter", driver.driverId);
      if (!tweeter) return null;
      const p = tweeterMaxLevel(tweeter, { xo, tAmpW: voltsToWatts(driveV, tweeter.hf) });
      return { watts: p.pMax, who: p.who, derate: p.derate, imp: p.imp, programW: p.pProg };
    }
    case DRIVER_KIND.sub:
    case DRIVER_KIND.mid:
    case DRIVER_KIND.woofer:
      return null;
  }
}

/** A band's drive scale at each frequency (1: the amp at full power) where its first limit gives out, and which. */
interface BandScale {
  s: Float64Array;
  who: LimitId[];
}

/** A peak that starts below any level, against `limit`. */
const startPeak = (limit: number): LimitPeak => ({ peak: 0, hz: 0, limit });
/** Keeps the higher of a peak and a new level at `hz`. */
const raise = (p: LimitPeak | null, level: number | undefined, hz: number) => {
  if (p && level !== undefined && level > p.peak) {
    p.peak = level;
    p.hz = hz;
  }
};

/**
 * The speaker at its limits, from its response (`speakerResponse` with the same feed): each band alone at each
 * frequency and for music, each chamber's cones and each datasheet driver at full power, and the whole speaker on one
 * input. A band whose amp gives no voltage has no limits.
 */
export function speakerLimits(
  spec: Pick<SpeakerSpec, "cabinet" | "bands">,
  response: SpeakerResponse,
  { feed = NO_FILTERS, stackCrossover = false }: SpeakerLimitsOptions = {},
): SpeakerLimits {
  // the response's own frequencies (the page's grid, or the optimizer's coarse screen)
  const freqs = response.sum.map((o) => o.f);
  const volts = SPEAKER_RESPONSE_VOLTS;
  const modeled = new Set(response.bands.map((b) => b.id));
  const loads = bandLoads(spec);
  /** a band's amp load, and its drive at full power */
  const loadOf = (id: BandId) => loads.get(id) ?? {};
  const driveOf = (b: SpeakerBand) => bandDriveVolts(b, loadOf(b.id));
  /** the modeled bands with a drive, by id */
  const bandById = new Map(
    spec.bands.filter((b) => modeled.has(b.id) && driveOf(b) > 0).map((b) => [b.id, b]),
  );
  /** each band's scales: its own (the PA's whole-drive ceilings) and the sum's (where it carries signal) */
  const scales = new Map<BandId, BandScale>();
  const sumScales = new Map<BandId, BandScale>();
  const scaleIn = (map: Map<BandId, BandScale>, id: BandId) => {
    let sc = map.get(id);
    if (!sc) map.set(id, (sc = { s: new Float64Array(freqs.length), who: [] }));
    return sc;
  };
  /** lowers the band's scale at point `i` to `s` when that is lower, with its limit */
  const lower = (sc: BandScale, i: number, s: number, who: LimitId) => {
    if (sc.who[i] === undefined || s < sc.s[i]) {
      sc.s[i] = s;
      sc.who[i] = who;
    }
  };
  /** each band's own filters as a gain at each frequency */
  const bandGains = new Map(
    [...bandById].map(([id, band]) => [id, freqs.map((f) => abs(filtersTransfer(f, band)))]),
  );
  /** the feed's filters (the input range) as a gain at each frequency */
  const feedGain = freqs.map((f) => abs(filtersTransfer(f, feed)));
  /** each band's filters with the feed's: what the drivers get */
  const gains = new Map([...bandGains].map(([id, g]) => [id, g.map((x, i) => x * feedGain[i])]));
  /** what of the feed is ahead of the amps in the sum at point `i`: a stack's crossover; none of the input range */
  const aheadGain = (i: number) => (stackCrossover ? feedGain[i] : 1);
  /**
   * What lifts a band's ceilings in the sum at point `i`: its own filters, and a stack's crossover (the input range
   * shapes the signal itself). The program rating takes them always; the amp takes a band's own filters only when
   * active (a passive network is after it).
   */
  const ceilingGain = (id: BandId, i: number) => (bandGains.get(id)?.[i] ?? 1) * aheadGain(i);
  const ampGain = (band: SpeakerBand, i: number) =>
    band.drive === HIFI_DRIVE.passive ? aheadGain(i) : ceilingGain(band.id, i);
  const drivers: SpeakerDriverPower[] = [];
  const chambers = spec.cabinet.chambers.map((chamber, k): SpeakerChamberLimits | null => {
    for (const driver of chamber.drivers) {
      const id = hfBandOf(driver);
      const band = id === null ? undefined : bandById.get(id);
      if (id === null || !band) continue;
      const driveV = driveOf(band);
      const power = driverPower(driver, band, driveV);
      if (!power) continue;
      const { programW } = power;
      drivers.push({ band: id, driver, ...power });
      // the most voltage it takes, against the band's drive: the same at every frequency (a power ceiling)
      const s = Math.sqrt(power.watts * power.imp) / driveV;
      /** the voltage its program rating allows */
      const vProgram = Math.sqrt(programW * power.imp);
      const sc = scaleIn(scales, id),
        sumSc = scaleIn(sumScales, id);
      for (let i = 0; i < freqs.length; i++) {
        lower(sc, i, s, power.who);
        // in the sum, both ceilings on the drive its own filters leave it here
        const amp = driveV / ampGain(band, i),
          program = vProgram / ceilingGain(id, i);
        lower(
          sumSc,
          i,
          Math.min(amp, program) / driveV,
          program < amp ? LIMIT_NAMES.thermal : LIMIT_NAMES.amp,
        );
      }
    }
    const drive = response.chambers[k]?.drive;
    const cones = chamberCones(chamber);
    const parts = cones && coneParts(cones.first);
    const id = cones?.first.bands[0];
    const band = id === undefined ? undefined : bandById.get(id);
    const gain = id === undefined ? undefined : gains.get(id);
    if (!drive || !parts || id === undefined || !band || !gain) return null;
    const driveV = driveOf(band);
    /** from the model's drive to the band's, before the filters */
    const toDrive = driveV / volts;
    const portMax = portSpeedMax(spec.cabinet, chamber);
    const xR = radiatorXmax(chamber);
    const excursion = startPeak(parts.ts.Xmax);
    const port = portMax === null ? null : startPeak(portMax);
    // a horn's throat: its peak shown, with no limit
    const throat = chamber.load.kind === CHAMBER_LOAD.horn ? startPeak(Infinity) : null;
    const radiator = xR === null ? null : startPeak(xR);
    const sc = scaleIn(scales, id),
      sumSc = scaleIn(sumScales, id);
    drive.forEach((d, i) => {
      const g = toDrive * gain[i];
      const point = {
        xmm: d.xmm * g,
        vel: d.vel === undefined ? undefined : d.vel * g,
        prx: d.prx === undefined ? undefined : d.prx * g,
        throat: d.throat === undefined ? undefined : d.throat * g,
      };
      const cone = sineLimitAt(point, parts.ts, driveV, portMax ?? Infinity);
      // the radiators' travel, as the Hi-fi engine reads it
      const vr = xR !== null && point.prx ? (driveV * xR) / point.prx : Infinity;
      const [ownWho, ownV] = (
        [
          [cone.who, cone.V],
          [LIMIT_NAMES.radiator, vr],
        ] satisfies [LimitId, number][]
      ).reduce((a, b) => (b[1] < a[1] ? b : a));
      lower(sc, i, ownV / driveV, ownWho);
      // in the sum: the program rating on the drive its own filters leave it here, and the amp on what it sees
      const limits: [LimitId, number][] = [
        [LIMIT_NAMES.port, cone.vp],
        [LIMIT_NAMES.Xmax, cone.vx],
        [LIMIT_NAMES.radiator, vr],
        [LIMIT_NAMES.thermal, cone.vt / ceilingGain(id, i)],
        [LIMIT_NAMES.amp, driveV / ampGain(band, i)],
      ];
      const [who, v] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
      lower(sumSc, i, v / driveV, who);
      raise(excursion, point.xmm, freqs[i]);
      raise(port, point.vel, freqs[i]);
      raise(radiator, point.prx, freqs[i]);
      raise(throat, point.throat, freqs[i]);
    });
    return {
      band: id,
      excursion,
      port,
      radiator,
      throat,
      driveW: ampWatts(driveV, loadOf(id)),
      programW: 2 * parts.ts.aes,
    };
  });
  /** each band's headroom over the response at each frequency, dB, and what sets it, for the sum */
  const headroom = new Map<BandId, { room: Float64Array; who: (i: number) => LimitId }>();
  const bands = response.bands.flatMap((rb) => {
    const band = bandById.get(rb.id);
    if (!band) return [];
    const sc = scales.get(rb.id) ?? null;
    // the response's band at 2.83 V (its level in it) moved to the amp's full drive
    const toFull = 20 * Math.log10(driveOf(band) / volts) - band.levelDb;
    const sAt = (i: number) => (sc ? sc.s[i] : 1);
    const whoAt = (i: number): LimitId => sc?.who[i] ?? LIMIT_NAMES.amp;
    const room = Float64Array.from(freqs, (_, i) => toFull + 20 * Math.log10(sAt(i)));
    const sumSc = sumScales.get(rb.id);
    headroom.set(rb.id, {
      room: Float64Array.from(freqs, (_, i) => toFull + 20 * Math.log10(sumSc ? sumSc.s[i] : 1)),
      who: (i: number) => sumSc?.who[i] ?? LIMIT_NAMES.amp,
    });
    let worst = 0;
    for (let i = 1; i < freqs.length; i++) if (sAt(i) < sAt(worst)) worst = i;
    const who = whoAt(worst);
    return [
      {
        id: rb.id,
        driveVolts: driveOf(band),
        max: rb.curve.map((o, i) => ({ f: o.f, spl: o.spl + room[i], who: whoAt(i) })),
        musicDb: rb.passbandDb + toFull + 20 * Math.log10(sAt(worst)),
        who,
        // the amp and the program rating set every frequency alike, so the search keeps the first: no frequency of its own
        whoHz: PER_FREQUENCY_LIMITS.has(who) ? freqs[worst] : null,
      },
    ];
  });
  // the whole speaker on one input: at each frequency the band with the least headroom sets it
  // outside the input range a ceiling on the whole drive (the amp, the program rating) is far off: the range sets it
  const sumWho = (who: LimitId, i: number): SpeakerLimits["sum"][number]["who"] =>
    !stackCrossover && feedGain[i] < INPUT_EDGE_GAIN && !PER_FREQUENCY_LIMITS.has(who)
      ? INPUT_RANGE_LIMIT
      : who;
  const sum = bands.length
    ? response.sum.map((o, i) => {
        const roomOf = (id: BandId) => headroom.get(id)?.room[i] ?? Infinity;
        const first = bands.reduce((a, b) => (roomOf(b.id) < roomOf(a.id) ? b : a));
        return {
          f: o.f,
          spl: o.spl + roomOf(first.id),
          who: sumWho(headroom.get(first.id)?.who(i) ?? LIMIT_NAMES.amp, i),
          band: first.id,
        };
      })
    : [];
  // for music, the band whose music limit leaves the least headroom over its passband sets the speaker's level
  const musicRoom = (b: (typeof bands)[number]) =>
    b.musicDb - (response.bands.find((rb) => rb.id === b.id)?.passbandDb ?? 0);
  const first = bands.length ? bands.reduce((a, b) => (musicRoom(b) < musicRoom(a) ? b : a)) : null;
  return {
    bands,
    chambers,
    drivers,
    sum,
    musicDb: first ? passbandDb(response.sum) + musicRoom(first) : null,
    band: first ? first.id : null,
  };
}
