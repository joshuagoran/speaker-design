// The Speaker optimizer's builds: a screened choice made into a whole spec on the page's field steps (the box shaped,
// the parts swapped, each tuned port's length solved on the chamber's real net air, the crossovers moved, the bands'
// balance held), and a built design's amps trimmed to the least power that keeps a level. What comes out is what a
// card loads: nothing changes a design after this. Pure.
import type { BandId, ChangeName, SpeakerBand, SpeakerChamber, SpeakerSpec } from "../../../types";
import { passbandDb, speakerResponse } from "../speakerResponse";
import { chamberNetLiters } from "../speakerBuild";
import { coneParts } from "../driverParts";
import { HIFI_DRIVE } from "../../../constants/hifiEngine";
import { SPEAKER_RESPONSE_VOLTS, VENT_KIND } from "../../../constants/speakerSpec";
import { SPEAKER_STEPS } from "../../../constants/speakerSteps";
import { CHANGE_NAMES } from "../../../constants/optimizerText";
import { DRIVER_KIND } from "../../../constants/speakerSpec";
import { withAmps, type SpeakerEval } from "./evaluate";
import {
  movedFilter,
  onStep,
  resizedChamber,
  shapedChambers,
  withPart,
  type BoxShape,
  type CrossoverPair,
  type SearchUnit,
  type SizeModel,
} from "./space";
import { tunedPort } from "./vent";
import { ampWatts } from "../../pa/calc";
import { bandLoads } from "../speakerLimits";
import type { UnitOption } from "./screen";

/** What a build reads of the search. */
export interface BuildInput {
  spec: SpeakerSpec;
  start: SpeakerEval;
  units: readonly SearchUnit[];
  pairs: readonly CrossoverPair[];
  model: SizeModel;
  /** each band's top amp power, W */
  amps: ReadonlyMap<BandId, number>;
}

/** A screened choice: one option per unit, and the box's shape. */
export interface Choice {
  options: readonly UnitOption[];
  shape: BoxShape;
}

/** The spec with chamber `k` edited. */
const editChamber = (
  spec: SpeakerSpec,
  k: number,
  edit: (c: SpeakerChamber) => SpeakerChamber,
): SpeakerSpec => ({
  ...spec,
  cabinet: {
    ...spec.cabinet,
    chambers: spec.cabinet.chambers.map((c, i) => (i === k ? edit(c) : c)),
  },
});

/**
 * The choice as a whole spec, on the field steps, the amps at their top; null when a tuned port can't reach its tuning.
 * The bands a changed part feeds keep their passband level (the balance): their Level moves by the difference, on its
 * step (a passive band never above 0 dB).
 */
export function buildChoice(input: BuildInput, choice: Choice): SpeakerSpec | null {
  const { spec, start, units, pairs, model, amps } = input;
  const placed = shapedChambers(spec, model, choice.shape);
  let out: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c, i) => resizedChamber(c, placed[i], model, i)),
    },
  };
  const changedBands = new Set<BandId>();
  // the parts, and a radiator's mass
  choice.options.forEach((o, ui) => {
    const u = units[ui];
    if (u.kind === "cone") {
      const own = spec.cabinet.chambers[u.chamber].drivers[u.entries[0]].driverId;
      if (o.driverId !== own) for (const b of u.bands) changedBands.add(b);
      out = editChamber(out, u.chamber, (c) => ({
        ...c,
        drivers: c.drivers.map((d, j) =>
          u.entries.includes(j) ? withPart(d, o.driverId, null) : d,
        ),
        vent:
          o.addG !== null && c.vent.kind === VENT_KIND.radiator
            ? { ...c.vent, radiators: { ...c.vent.radiators, addG: o.addG } }
            : c.vent,
      }));
    } else {
      const d = spec.cabinet.chambers[u.chamber].drivers[u.entry];
      if (o.driverId !== d.driverId || o.hornId !== (d.horn?.hornId ?? null))
        changedBands.add(u.band);
      out = editChamber(out, u.chamber, (c) => ({
        ...c,
        drivers: c.drivers.map((x, j) => (j === u.entry ? withPart(x, o.driverId, o.hornId) : x)),
      }));
    }
  });
  // each tuned port, its length solved on the built chamber's real net air
  for (const [ui, o] of choice.options.entries()) {
    const u = units[ui];
    if (u.kind !== "cone" || o.port === null || o.fbHz === null) continue;
    const k = u.chamber;
    const chamber = out.cabinet.chambers[k];
    const cone = chamber.drivers[u.entries[0]];
    const count = u.entries.reduce((sum, j) => sum + chamber.drivers[j].count, 0);
    const dispL = (coneParts(cone)?.dispL ?? 0) * count;
    const port = tunedPort(out.cabinet, k, { ...o.port }, o.fbHz, (cab, c) =>
      chamberNetLiters(cab, c, dispL),
    );
    if (!port) return null;
    out = editChamber(out, k, (c) =>
      c.vent.kind === VENT_KIND.vented ? { ...c, vent: { ...c.vent, port } } : c,
    );
  }
  // the crossovers, the protection highpasses and the amps
  const bands = out.bands.map((b): SpeakerBand => ({ ...b, ampW: amps.get(b.id) ?? b.ampW }));
  choice.options.forEach((o) => {
    for (const [p, f] of o.xo) {
      const pair = pairs[p];
      const lo = bands[pair.lower],
        hi = bands[pair.upper];
      if (lo.lowpass) bands[pair.lower] = { ...lo, lowpass: movedFilter(lo.lowpass, f) };
      if (hi.highpass)
        bands[pair.upper] = { ...bands[pair.upper], highpass: movedFilter(hi.highpass, f) };
    }
    if (o.subsonicHz !== null) {
      const u = units[o.unit];
      const i = bands.findIndex((b) => u.kind === "cone" && b.id === u.bands[0]);
      const hp = bands[i]?.highpass;
      if (hp) bands[i] = { ...bands[i], highpass: { ...hp, hz: o.subsonicHz } };
    }
  });
  out = { ...out, bands };
  if (!changedBands.size) return out;
  // the balance: each band a changed part feeds back to its passband level now
  const now = speakerResponse(out, { feed: out.input });
  return {
    ...out,
    bands: out.bands.map((b) => {
      if (!changedBands.has(b.id)) return b;
      const was = start.response.bands.find((r) => r.id === b.id)?.passbandDb;
      const is = now.bands.find((r) => r.id === b.id)?.passbandDb;
      if (was === undefined || is === undefined) return b;
      const level = onStep(b.levelDb + was - is, SPEAKER_STEPS.levelDb);
      return {
        ...b,
        levelDb: b.drive === HIFI_DRIVE.passive ? Math.min(Math.max(0, b.levelDb), level) : level,
      };
    }),
  };
}

/** The headroom a level needs from every band, dB over its passband: the level less the speaker's passband. */
const neededRoom = (ev: SpeakerEval, needDb: number) => needDb - passbandDb(ev.response.sum);

/** How many tries the trim takes to reach its level, a step up each time, before it keeps the top power. */
const TRIM_TRIES = 4;

/**
 * The design with each unlocked amp group (`groups`) at the least power, on the amp's step, that keeps the speaker's level
 * at `needDb`: each band's drive at its first limit is known from the top run, so the power one needs follows; the
 * limits run again to check it. A trim that misses the level, or adds a band that limits first, keeps the top power.
 */
export function trimAmps(
  ev: SpeakerEval,
  needDb: number,
  groups: readonly BandId[][],
): SpeakerEval {
  const { spec } = ev;
  if (ev.metrics.musicDb === null || !groups.length) return ev;
  const room = neededRoom(ev, needDb);
  const watts = new Map(spec.bands.map((b) => [b.id, b.ampW]));
  const loads = bandLoads(spec);
  for (const group of groups) {
    let w = 0;
    for (const id of group) {
      const band = spec.bands.find((b) => b.id === id);
      const lim = ev.limits.bands.find((b) => b.id === id),
        rb = ev.response.bands.find((b) => b.id === id);
      if (!band) continue;
      if (!lim || !rb) {
        w = Math.max(w, band.ampW);
        continue;
      }
      /** the drive at the band's first limit, and the drive that gives it the headroom the level needs, V */
      const vLimit =
        SPEAKER_RESPONSE_VOLTS * Math.pow(10, (lim.musicDb - rb.passbandDb + band.levelDb) / 20);
      const vNeed = SPEAKER_RESPONSE_VOLTS * Math.pow(10, (room + band.levelDb) / 20);
      if (vNeed > vLimit) {
        w = Math.max(w, band.ampW);
        continue;
      }
      const pad =
        band.drive === HIFI_DRIVE.passive ? Math.pow(10, Math.min(0, band.levelDb) / 20) : 1;
      const need = ampWatts(vNeed / pad, loads.get(id) ?? {});
      w = Math.max(
        w,
        Math.ceil(need / SPEAKER_STEPS.ampW) * SPEAKER_STEPS.ampW,
        SPEAKER_STEPS.ampW,
      );
    }
    for (const id of group)
      watts.set(id, Math.min(w, spec.bands.find((b) => b.id === id)?.ampW ?? w));
  }
  for (let t = 0; t < TRIM_TRIES; t++) {
    const trimmed = withAmps(ev, {
      ...spec,
      bands: spec.bands.map((b) => ({ ...b, ampW: watts.get(b.id) ?? b.ampW })),
    });
    const level = trimmed.metrics.musicDb;
    if (level !== null && level >= needDb - 0.01)
      return trimmed.warnings.length > ev.warnings.length ? ev : trimmed;
    // a step up for every trimmed group
    for (const group of groups)
      for (const id of group) {
        const top = spec.bands.find((b) => b.id === id)?.ampW ?? 0;
        watts.set(id, Math.min(top, (watts.get(id) ?? top) + SPEAKER_STEPS.ampW * (t + 1)));
      }
  }
  return ev;
}

/** What a design changes from yours, in the cards' words, and how many things it changes (parts, box size, vents). */
export function changesOf(
  spec: SpeakerSpec,
  start: SpeakerSpec,
  pairs: readonly CrossoverPair[],
): { changed: ChangeName[]; count: number } {
  const changed = new Set<ChangeName>();
  let count = 0;
  const kindChange = {
    [DRIVER_KIND.sub]: CHANGE_NAMES.subDriver,
    [DRIVER_KIND.mid]: CHANGE_NAMES.midDriver,
    [DRIVER_KIND.woofer]: CHANGE_NAMES.woofer,
    [DRIVER_KIND.tweeter]: CHANGE_NAMES.tweeter,
    [DRIVER_KIND.compression]: CHANGE_NAMES.hf,
    [DRIVER_KIND.coaxial]: CHANGE_NAMES.coaxial,
  } as const;
  let sized = false;
  spec.cabinet.chambers.forEach((c, k) => {
    const was = start.cabinet.chambers[k];
    if (!was) return;
    if (c.dims.w !== was.dims.w || c.dims.h !== was.dims.h || c.dims.d !== was.dims.d) sized = true;
    // a chamber's cones change together: one change
    let cones = false;
    c.drivers.forEach((d, j) => {
      const w = was.drivers[j];
      if (!w) return;
      if (d.driverId !== w.driverId) {
        changed.add(kindChange[d.kind]);
        if (d.kind === DRIVER_KIND.compression || d.kind === DRIVER_KIND.tweeter) count++;
        else cones = true;
      }
      if ((d.horn?.hornId ?? null) !== (w.horn?.hornId ?? null)) {
        changed.add(CHANGE_NAMES.horn);
        count++;
      }
    });
    if (cones) count++;
    if (JSON.stringify(c.vent) !== JSON.stringify(was.vent)) {
      changed.add(c.vent.kind === VENT_KIND.radiator ? CHANGE_NAMES.radiator : CHANGE_NAMES.vent);
      count++;
    }
  });
  if (sized) {
    changed.add(CHANGE_NAMES.boxSize);
    count++;
  }
  const uppers = new Set(pairs.map((p) => p.upper));
  spec.bands.forEach((b, i) => {
    const was = start.bands[i];
    if (!was) return;
    // only a crossover moves a lowpass; a highpass is a crossover's or the band's protection
    if (b.lowpass?.hz !== was.lowpass?.hz) changed.add(CHANGE_NAMES.crossovers);
    if (b.highpass?.hz !== was.highpass?.hz)
      changed.add(uppers.has(i) ? CHANGE_NAMES.crossovers : CHANGE_NAMES.highpass);
    if (b.ampW !== was.ampW) changed.add(CHANGE_NAMES.ampPower);
    if (b.levelDb !== was.levelDb) changed.add(CHANGE_NAMES.bandLevels);
  });
  return { changed: [...changed], count };
}
