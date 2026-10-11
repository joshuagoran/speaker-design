// The general speaker model: any speaker spec's response on axis at 1 m in half space. Each chamber runs through the
// box model of its kind (the engines' own: sealed and vented from lib/pa/calc, passive radiators from lib/hifi, a horn
// built into the box through the horn engine), each datasheet driver through its engine's datasheet model; then each
// band's filters and level, and the bands summed with their phase. Pure.
//
// Not modeled here (they belong to where the box stands, the later Space page): the baffle step, diffraction, the room,
// directivity and the drivers' positions (every driver is on the listening axis, at the same distance). The tilt is
// not read either.
import type {
  BandId,
  Complex,
  FrequencyPoint,
  Horn,
  SpeakerBandResponse,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerChamberResponse,
  SpeakerDriver,
  SpeakerFeed,
  SpeakerModelGap,
  SpeakerResponse,
  SpeakerSpec,
} from "../../types";
import { abs, add, complex, multiply, phasor, scale } from "../acoustics/complex";
import { hornModel } from "../acoustics/hornModel";
import { boxModel, closedBox } from "../pa/calc";
import { logSpacedFrequencies, passiveRadiatorBox } from "../hifi/hifi";
import { HIFI_PASSIVES, HIFI_WAVEGUIDES, HORN_OPTIONS, passiveRadiatorMassMax } from "../data";
import { byId } from "../tables";
import { chamberNetLiters, chamberVentModel, stuffedLiters } from "./chamberAir";
import { hornDesignOf } from "./hornDesign";
import { coneParts, hfParts, isConeKind, type ConeParts } from "./driverParts";
import { filtersTransfer } from "./bandFilter";
import { NO_FILTERS } from "./specParts";
import { FREQ_AXIS_MAX_HZ, FREQ_AXIS_MIN_HZ } from "../../constants/chartScales";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  ONE_WATT_VOLTS,
  SPEAKER_MODEL_GAP,
  SPEAKER_RESPONSE_VOLTS,
  VENT_KIND,
} from "../../constants/speakerSpec";

/** How many points the model works out, log-spaced over the charts' 15 Hz–20 kHz (as the Hi-fi responses). */
const POINTS = 220;

/** The frequencies every speaker response is worked out at, Hz. */
export const SPEAKER_RESPONSE_FREQUENCIES = logSpacedFrequencies(
  FREQ_AXIS_MIN_HZ,
  FREQ_AXIS_MAX_HZ,
  POINTS,
);

/** The box models' grid options for the same frequencies (their grid is the same log spacing). */
const GRID = { fmin: FREQ_AXIS_MIN_HZ, fmax: FREQ_AXIS_MAX_HZ, N: POINTS };

/** A band's level, dB: the mean of its curve where it is within this much of its highest point. */
const PASSBAND_DB = 3;

/** A pressure as a complex number from its level, dB, and its phase, radians. */
const pressureOf = (db: number, phase = 0): Complex => scale(phasor(phase), Math.pow(10, db / 20));

/** A level, dB, from a pressure. */
const levelOf = (p: Complex) => 20 * Math.log10(Math.max(1e-9, abs(p)));

/**
 * `count` alike cones in parallel, each on the full voltage, as one cone for the box models: the areas and moving
 * masses add and the coil resistance divides, so the circuit's elements are the bank's (as the horn engine wires its
 * `drivers`, Hornresp's Nd).
 */
const bank = ({ ts }: ConeParts, count: number) =>
  count === 1 ? ts : { ...ts, Sd: ts.Sd * count, Mms: ts.Mms * count, Re: ts.Re / count };

/** One chamber's cones on the grid: a pressure per frequency; or a gap. */
interface ChamberCones {
  pressure: Complex[] | null;
  result: SpeakerChamberResponse;
}

/** The chamber's cone drivers: alike, feeding the same bands; null when it has none. */
function chamberCones(chamber: SpeakerChamber) {
  const cones = chamber.drivers.filter((d) => isConeKind(d.kind));
  if (cones.length === 0) return null;
  const [first] = cones;
  const alike = cones.every(
    (d) => d.kind === first.kind && d.driverId === first.driverId && d.bands[0] === first.bands[0],
  );
  return { first, alike, count: cones.reduce((sum, d) => sum + d.count, 0) };
}

/** Whether a size or frequency the models divide by is a positive number. */
const positive = (x: number) => Number.isFinite(x) && x > 0;

/**
 * The chamber's cones through its box model at `volts`: sealed, vented, passive radiators, or the horn engine for a
 * horn built into the box, each on the chamber's air with its stuffing. The net air and the tuning come with it. A
 * size the models can't run on (no air, no port area or length, no cones) is the `noModel` gap.
 */
function modelChamber(
  cabinet: SpeakerCabinet,
  chamber: SpeakerChamber,
  volts: number,
): ChamberCones {
  const cones = chamberCones(chamber);
  const parts = cones && coneParts(cones.first);
  const displacementL = parts && cones ? parts.dispL * cones.count : 0;
  const netLiters = chamberNetLiters(cabinet, chamber, displacementL);
  const empty = (gaps: SpeakerModelGap[]): ChamberCones => ({
    pressure: null,
    result: { netLiters, fb: null, qtc: null, gaps },
  });
  if (!cones) return empty([]);
  if (!cones.alike) return empty([SPEAKER_MODEL_GAP.mixedDrivers]);
  if (!parts) return empty([SPEAKER_MODEL_GAP.unknownDriver]);
  /** the air the box acts like: the net air and the stuffing */
  const airL = stuffedLiters(chamber, netLiters);
  if (!positive(netLiters) || !positive(airL) || !positive(cones.count))
    return empty([SPEAKER_MODEL_GAP.noModel]);
  const done = (
    curve: readonly { raw: number; rawPhase?: number }[],
    fb: number | null,
    qtc: number | null,
  ): ChamberCones => ({
    pressure: curve.map((o) => pressureOf(o.raw, o.rawPhase)),
    result: { netLiters, fb, qtc, gaps: [] },
  });
  if (chamber.load.kind === CHAMBER_LOAD.horn) {
    const read = hornDesignOf(chamber, { count: 1, angle: 2 });
    if (!read.ok) return empty([read.gap]);
    const model = hornModel(read.design, SPEAKER_RESPONSE_FREQUENCIES, volts);
    if (!model) return empty([SPEAKER_MODEL_GAP.noModel]);
    return {
      pressure: model.curve.map((o) => pressureOf(o.spl, o.phase)),
      result: { netLiters: read.design.rear.liters, fb: model.fb, qtc: null, gaps: [] },
    };
  }
  const ts = bank(parts, cones.count);
  const { vent } = chamber;
  switch (vent.kind) {
    case VENT_KIND.sealed: {
      const m = closedBox(ts, airL, null, null, volts, {
        ...GRID,
        hpOrder: 4,
        lpOrder: 4,
        phase: true,
      });
      return m ? done(m.curve, null, m.Qtc) : empty([SPEAKER_MODEL_GAP.noModel]);
    }
    case VENT_KIND.vented: {
      const port = chamberVentModel(cabinet, chamber);
      if (
        !port ||
        !positive(port.areaIn2) ||
        !positive(port.lenIn) ||
        !positive(port.openings) ||
        !Number.isFinite(port.endCorrectionIn)
      )
        return empty([SPEAKER_MODEL_GAP.noModel]);
      // no filter here: the band's filters come after (a 1 Hz corner leaves `spl` as `raw`; only `raw` is read)
      const m = boxModel(ts, airL, port.areaIn2, port.lenIn, 1, volts, undefined, {
        ...GRID,
        nPorts: port.openings,
        ecIn: port.endCorrectionIn,
        phase: true,
      });
      return m ? done(m.curve, m.Fb, null) : empty([SPEAKER_MODEL_GAP.noModel]);
    }
    case VENT_KIND.radiator: {
      const { radiators } = vent;
      const drv = byId(HIFI_PASSIVES, radiators.id);
      if (!drv) return empty([SPEAKER_MODEL_GAP.unknownRadiator]);
      if (!positive(radiators.n) || !(radiators.addG >= 0))
        return empty([SPEAKER_MODEL_GAP.noModel]);
      // the added mass kept under the most the radiator takes, as the Hi-fi page keeps it (lib/hifi/boxLayout)
      const pr = {
        drv,
        n: radiators.n,
        addG: Math.min(radiators.addG, passiveRadiatorMassMax(drv)),
      };
      const m = passiveRadiatorBox(ts, airL, pr, 1, volts, undefined, {
        ...GRID,
        phase: true,
      });
      return m ? done(m.curve, m.Fb, null) : empty([SPEAKER_MODEL_GAP.noModel]);
    }
  }
}

/** Every catalog horn, PA and Hi-fi, by id. */
const hornById = (id: Horn["id"]) => byId(HORN_OPTIONS, id) ?? byId(HIFI_WAVEGUIDES, id);

/**
 * A datasheet driver's (or a coaxial's HF section's) level at `f`, dB at 1 m: its 1 W sensitivity moved to `volts`
 * into its impedance. A compression driver on a catalog horn also falls 12 dB/oct below the horn's loading limit, as
 * the PA's horn model (lib/pa/calc hornResponse); a tweeter keeps the Hi-fi engine's flat sensitivity.
 */
function hfLevelAt(driver: SpeakerDriver, sens: number, imp: number, volts: number, f: number) {
  const flat = sens + 10 * Math.log10(8 / imp) + 20 * Math.log10(volts / ONE_WATT_VOLTS);
  const lowHz =
    driver.kind === DRIVER_KIND.compression && driver.horn
      ? (hornById(driver.horn.hornId)?.hf?.lowHz ?? 0)
      : 0;
  return lowHz ? flat + 20 * Math.log10(Math.min(1, Math.pow(f / lowHz, 2))) : flat;
}

/** Adds `pressure` (one per frequency) into the band's running sum. */
function addTo(sums: Map<BandId, Complex[]>, band: BandId, pressure: readonly Complex[]) {
  const sum = sums.get(band);
  sums.set(band, sum ? sum.map((p, i) => add(p, pressure[i])) : [...pressure]);
}

/** The mean of a curve's levels where they are within PASSBAND_DB of its highest. */
function passbandDb(curve: readonly FrequencyPoint[]) {
  const top = Math.max(...curve.map((o) => o.spl));
  const pass = curve.filter((o) => o.spl >= top - PASSBAND_DB);
  return pass.reduce((sum, o) => sum + o.spl, 0) / pass.length;
}

/** Whether a band's (or a feed's) filter corners are positive frequencies. */
const filtersOk = ({ highpass, lowpass }: SpeakerFeed) =>
  (!highpass || positive(highpass.hz)) && (!lowpass || positive(lowpass.hz));

/** Options: the filters ahead of the speaker (a system source's, the sub crossover), on every band. */
export interface SpeakerResponseOptions {
  feed?: SpeakerFeed;
}

/**
 * The speaker's response on axis at 1 m in half space at `SPEAKER_RESPONSE_VOLTS` on every band: each chamber's cones
 * through its box model, each datasheet driver's level, each band through its filters (and the feed's) and level, and
 * the bands summed with their phase. A coaxial's cone feeds its first band and its HF section its second.
 */
export function speakerResponse(
  spec: Pick<SpeakerSpec, "cabinet" | "bands">,
  { feed = NO_FILTERS }: SpeakerResponseOptions = {},
): SpeakerResponse {
  const volts = SPEAKER_RESPONSE_VOLTS;
  const freqs = SPEAKER_RESPONSE_FREQUENCIES;
  const sums = new Map<BandId, Complex[]>();
  const chambers = spec.cabinet.chambers.map((chamber) => {
    const { pressure, result } = modelChamber(spec.cabinet, chamber, volts);
    const cones = chamberCones(chamber);
    if (pressure && cones) addTo(sums, cones.first.bands[0], pressure);
    const gaps = [...result.gaps];
    for (const driver of chamber.drivers) {
      if (isConeKind(driver.kind) && driver.kind !== DRIVER_KIND.coaxial) continue;
      // a coaxial's HF section feeds its second band (its first, with only one); a datasheet driver its first
      const band =
        driver.kind === DRIVER_KIND.coaxial
          ? (driver.bands[1] ?? driver.bands[0])
          : driver.bands[0];
      if (band === undefined) continue;
      const hf = hfParts(driver);
      if (!hf) {
        gaps.push(SPEAKER_MODEL_GAP.noHf);
        continue;
      }
      if (!positive(driver.count) || !positive(hf.imp)) {
        gaps.push(SPEAKER_MODEL_GAP.noModel);
        continue;
      }
      addTo(
        sums,
        band,
        freqs.map((f) =>
          scale(pressureOf(hfLevelAt(driver, hf.sens, hf.imp, volts, f)), driver.count),
        ),
      );
    }
    return { ...result, gaps };
  });
  const bands: SpeakerBandResponse[] = [];
  const gaps: SpeakerModelGap[] = [];
  /** the bands' pressures summed */
  let total = freqs.map(() => complex(0));
  // the feed's filters reach every band: a corner that isn't a positive frequency leaves them all out
  const feedOk = filtersOk(feed);
  if (!feedOk) gaps.push(SPEAKER_MODEL_GAP.badFilter);
  for (const band of spec.bands) {
    const drivers = sums.get(band.id);
    if (!drivers || !feedOk) continue;
    if (!filtersOk(band) || !Number.isFinite(band.levelDb)) {
      gaps.push(SPEAKER_MODEL_GAP.badFilter);
      continue;
    }
    const gain = Math.pow(10, band.levelDb / 20);
    const out = drivers.map((p, i) =>
      scale(
        multiply(multiply(p, filtersTransfer(freqs[i], band)), filtersTransfer(freqs[i], feed)),
        gain,
      ),
    );
    total = total.map((p, i) => add(p, out[i]));
    const curve = out.map((p, i) => ({ f: freqs[i], spl: levelOf(p) }));
    bands.push({ id: band.id, curve, passbandDb: passbandDb(curve) });
  }
  return {
    sum: total.map((p, i) => ({ f: freqs[i], spl: levelOf(p) })),
    bands,
    chambers,
    gaps,
  };
}
