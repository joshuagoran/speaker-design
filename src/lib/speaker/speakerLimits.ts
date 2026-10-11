// The speaker at its limits: each band's drivers at the amp's full power through the band's filters, up to the first
// limit the PA and Hi-fi pages already use. Pure; it reads the response's chamber runs, so no box model runs again.
//
// - Cones (lib/pa/calc sineLimitAt, the PA's maxOutputCurve per point): the cone's Xmax and the vent's air speed at
//   each frequency, the driver's program rating (2 × AES) and the amp as ceilings on the whole drive. Radiators add
//   their travel against their Xmax, as the Hi-fi engine checks it (lib/hifi hifiWooferPrep).
// - Datasheet drivers keep their engine's power rule: a compression driver the PA's (lib/pa/calc hornPower), a tweeter
//   and a coaxial's HF section the Hi-fi's (lib/hifi tweeterMaxLevel), derated below their rating's frequency when
//   the band's highpass sits there.
// - A band's drive: its amp's voltage into 8 Ω (`ampW`), through a passive band's pad. Its level for music is one
//   drive for the whole band, set where the band first meets a limit (as the PA sub's music limit and the Hi-fi
//   woofer's). The sum takes one input for every band: at each frequency the first band to meet a limit sets it.
import type {
  BandId,
  LimitId,
  LimitPeak,
  SpeakerBand,
  SpeakerChamber,
  SpeakerChamberLimits,
  SpeakerDriver,
  SpeakerDriverPower,
  SpeakerLimits,
  SpeakerResponse,
  SpeakerSpec,
} from "../../types";
import { abs } from "../acoustics/complex";
import { FLARED_PORT_SPEED_RATIO, ampVoltage, hornPower, sineLimitAt } from "../pa/calc";
import { tweeterMaxLevel } from "../hifi/hifi";
import { CD_OPTIONS, HIFI_PASSIVES, hifiDriverById } from "../data";
import { byId } from "../tables";
import { coneParts } from "./driverParts";
import { filtersTransfer } from "./bandFilter";
import { NO_FILTERS } from "./specParts";
import {
  SPEAKER_RESPONSE_FREQUENCIES,
  chamberCones,
  hfBandOf,
  passbandDb,
  type SpeakerResponseOptions,
} from "./speakerResponse";
import { HIFI_DRIVE, HIFI_PORT_MAX_MS } from "../../constants/hifiEngine";
import { DRIVER_KIND, SPEAKER_RESPONSE_VOLTS, VENT_KIND } from "../../constants/speakerSpec";

/** The limits' options: the filters ahead of the speaker (as the response's), and the vents' air-speed limit. */
export interface SpeakerLimitsOptions extends SpeakerResponseOptions {
  /** the most air speed a vent takes, m/s (sine peak): the Hi-fi engine's 17; flared PA tubes take more */
  portMaxMs?: number;
}

/**
 * A band's drive with the amp at full power, V RMS: the amp's voltage into 8 Ω, through a passive band's pad (a
 * network can't add gain, so a band set above its channel gets the channel's full voltage).
 */
export const bandDriveVolts = (band: Pick<SpeakerBand, "ampW" | "drive" | "levelDb">) =>
  ampVoltage(band.ampW) *
  (band.drive === HIFI_DRIVE.passive ? Math.pow(10, Math.min(0, band.levelDb) / 20) : 1);

/** The most air speed the chamber's vent takes, m/s: `portMaxMs`, more for flared PA tubes; null without a vent. */
function ventSpeedMax(chamber: SpeakerChamber, portMaxMs: number): number | null {
  if (chamber.vent.kind !== VENT_KIND.vented) return null;
  const { port } = chamber.vent;
  return "flared" in port && port.flared ? portMaxMs * FLARED_PORT_SPEED_RATIO : portMaxMs;
}

/** The radiators' Xmax, mm; null without radiators (or with an id the catalog doesn't have). */
const radiatorXmax = (chamber: SpeakerChamber) =>
  chamber.vent.kind === VENT_KIND.radiator
    ? (byId(HIFI_PASSIVES, chamber.vent.radiators.id)?.Xmax ?? null)
    : null;

/** A datasheet driver's power at a band's drive, by its engine's rule, and its impedance, Ω; null with no HF data. */
function driverPower(driver: SpeakerDriver, band: SpeakerBand, driveV: number) {
  // no highpass: the rating as published (a coaxial's own network, which the spec doesn't model)
  const xo = band.highpass?.hz ?? Infinity;
  /** the drive as amp watts into 8 Ω, as both engines take their amp */
  const ampW = (driveV * driveV) / 8;
  switch (driver.kind) {
    case DRIVER_KIND.compression: {
      const hf = byId(CD_OPTIONS, driver.driverId)?.hf;
      if (!hf) return null;
      const p = hornPower(hf, xo, ampW);
      return { watts: p.P, who: p.who, derate: p.derate, imp: p.imp };
    }
    case DRIVER_KIND.tweeter:
    case DRIVER_KIND.coaxial: {
      const tweeter = hifiDriverById("tweeter", driver.driverId);
      if (!tweeter) return null;
      const p = tweeterMaxLevel(tweeter, { xo, tAmpW: ampW });
      return { watts: p.pMax, who: p.who, derate: p.derate, imp: p.imp };
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
 * The speaker at its limits, from its response (`speakerResponse` with the same options): each band alone at each
 * frequency and for music, each chamber's cones and each datasheet driver at full power, and the whole speaker on one
 * input. A band whose amp gives no voltage has no limits.
 */
export function speakerLimits(
  spec: Pick<SpeakerSpec, "cabinet" | "bands">,
  response: SpeakerResponse,
  { feed = NO_FILTERS, portMaxMs = HIFI_PORT_MAX_MS }: SpeakerLimitsOptions = {},
): SpeakerLimits {
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const volts = SPEAKER_RESPONSE_VOLTS;
  const modeled = new Set(response.bands.map((b) => b.id));
  /** the modeled bands with a drive, by id */
  const bandById = new Map(
    spec.bands.filter((b) => modeled.has(b.id) && bandDriveVolts(b) > 0).map((b) => [b.id, b]),
  );
  const scales = new Map<BandId, BandScale>();
  const scaleOf = (id: BandId) => {
    let sc = scales.get(id);
    if (!sc) scales.set(id, (sc = { s: new Float64Array(freqs.length), who: [] }));
    return sc;
  };
  /** lowers the band's scale at point `i` to `s` when that is lower, with its limit */
  const lower = (sc: BandScale, i: number, s: number, who: LimitId) => {
    if (sc.who[i] === undefined || s < sc.s[i]) {
      sc.s[i] = s;
      sc.who[i] = who;
    }
  };
  /** each band's filters and the feed's, as a gain at each frequency */
  const gains = new Map(
    [...bandById].map(([id, band]) => [
      id,
      freqs.map((f) => abs(filtersTransfer(f, band)) * abs(filtersTransfer(f, feed))),
    ]),
  );
  const drivers: SpeakerDriverPower[] = [];
  const chambers = spec.cabinet.chambers.map((chamber, k): SpeakerChamberLimits | null => {
    for (const driver of chamber.drivers) {
      const id = hfBandOf(driver);
      const band = id === null ? undefined : bandById.get(id);
      if (id === null || !band) continue;
      const driveV = bandDriveVolts(band);
      const power = driverPower(driver, band, driveV);
      if (!power) continue;
      drivers.push({ band: id, driver, ...power });
      // the most voltage it takes, against the band's drive: the same at every frequency (a power ceiling)
      const s = Math.sqrt(power.watts * power.imp) / driveV;
      const sc = scaleOf(id);
      for (let i = 0; i < freqs.length; i++) lower(sc, i, s, power.who);
    }
    const drive = response.chambers[k]?.drive;
    const cones = chamberCones(chamber);
    const parts = cones && coneParts(cones.first);
    const id = cones?.first.bands[0];
    const band = id === undefined ? undefined : bandById.get(id);
    const gain = id === undefined ? undefined : gains.get(id);
    if (!drive || !parts || id === undefined || !band || !gain) return null;
    const driveV = bandDriveVolts(band);
    /** from the model's drive to the band's, before the filters */
    const toDrive = driveV / volts;
    const portMax = ventSpeedMax(chamber, portMaxMs);
    const xR = radiatorXmax(chamber);
    const excursion = startPeak(parts.ts.Xmax);
    const port = portMax === null ? null : startPeak(portMax);
    const radiator = xR === null ? null : startPeak(xR);
    const sc = scaleOf(id);
    drive.forEach((d, i) => {
      const g = toDrive * gain[i];
      const point = {
        xmm: d.xmm * g,
        vel: d.vel === undefined ? undefined : d.vel * g,
        prx: d.prx === undefined ? undefined : d.prx * g,
      };
      const cone = sineLimitAt(point, parts.ts, driveV, portMax ?? Infinity);
      // the radiators' travel, as the Hi-fi engine reads it
      const vr = xR !== null && point.prx ? (driveV * xR) / point.prx : Infinity;
      lower(sc, i, Math.min(cone.V, vr) / driveV, vr < cone.V ? "radiator" : cone.who);
      raise(excursion, point.xmm, freqs[i]);
      raise(port, point.vel, freqs[i]);
      raise(radiator, point.prx, freqs[i]);
    });
    return {
      band: id,
      excursion,
      port,
      radiator,
      driveW: (driveV * driveV) / 8,
      programW: 2 * parts.ts.aes,
    };
  });
  /** each band's headroom over the response at each frequency, dB, for the sum */
  const headroom = new Map<BandId, Float64Array>();
  const bands = response.bands.flatMap((rb) => {
    const band = bandById.get(rb.id);
    if (!band) return [];
    const sc = scales.get(rb.id) ?? null;
    // the response's band at 2.83 V (its level in it) moved to the amp's full drive
    const toFull = 20 * Math.log10(bandDriveVolts(band) / volts) - band.levelDb;
    const sAt = (i: number) => (sc ? sc.s[i] : 1);
    const whoAt = (i: number): LimitId => sc?.who[i] ?? "amp";
    const room = Float64Array.from(freqs, (_, i) => toFull + 20 * Math.log10(sAt(i)));
    headroom.set(rb.id, room);
    let worst = 0;
    for (let i = 1; i < freqs.length; i++) if (sAt(i) < sAt(worst)) worst = i;
    return [
      {
        id: rb.id,
        driveVolts: bandDriveVolts(band),
        max: rb.curve.map((o, i) => ({ f: o.f, spl: o.spl + room[i], who: whoAt(i) })),
        musicDb: rb.passbandDb + toFull + 20 * Math.log10(sAt(worst)),
        who: whoAt(worst),
        whoHz: freqs[worst],
      },
    ];
  });
  // the whole speaker on one input: at each frequency the band with the least headroom sets it
  const sum = bands.length
    ? response.sum.map((o, i) => {
        const first = bands.reduce((a, b) =>
          (headroom.get(b.id)?.[i] ?? Infinity) < (headroom.get(a.id)?.[i] ?? Infinity) ? b : a,
        );
        return {
          f: o.f,
          spl: o.spl + (headroom.get(first.id)?.[i] ?? 0),
          who: first.max[i].who,
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
