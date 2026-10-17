// TH18 by Xoc1 drawn as a folded horn (the th18 template: its plans' boards, lib/defaults TH18_XOC1) and traced
// (lib/speaker/foldTrace, foldHorn traceModel), against its Hornresp record and Hornresp's results
// (tools/hornresp/records/th18-xoc1.txt, tests/hornresp/th18-xoc1-results.txt). It measures how well a hand-drawn horn
// is modeled: the traced path, taps and areas against the record's, and the traced horn played through the network
// against Hornresp. The record played straight separates the engine's error from the drawing's.
//
// The bounds are what the trace gives today, with a little room. Two known faults in the trace set them:
// - The path is the shortest way through the air from the mouth: it hugs the inside of each bend, so it comes out 26%
//   short of the record (and of the plans' center line). A path along the passage's middle measures within 2%.
// - The rears are sampled beside the basket on its back side, about 20 cm farther from the mouth than the cone.
// The driver's basket and motor are also solid across the whole width, so the mouth leg chokes under the motor.
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { readHornrespRecord } from "../src/lib/acoustics/network/hornrespRecord";
import { hornLayoutNetwork, presetModel } from "../src/lib/acoustics/network/presets";
import { segmentAreaAt } from "../src/lib/acoustics/hornSegments";
import { tracedHorn } from "../src/lib/speaker/foldHorn";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
import { CM_PER_IN, CM2_PER_IN2 } from "../src/constants/units";
import type { FoldTrace, HornLayoutDesign, HornSegment } from "../src/types";
import { HORNRESP_DIR, resultsOf } from "./hornresp-records";

const RECORD = fs.readFileSync(
  path.join(import.meta.dirname, "..", "tools", "hornresp", "records", "th18-xoc1.txt"),
  "latin1",
);
/** Hornresp's results for the record */
const HORNRESP = resultsOf(
  fs.readFileSync(path.join(HORNRESP_DIR, "th18-xoc1-results.txt"), "utf8"),
);
/** the band the SPL is compared over, Hz */
const BAND = { fromHz: 30, toHz: 150 };
/** the band whose mean level the tuning's −3 and −6 dB points are read from, Hz */
const PASSBAND = { fromHz: 40, toHz: 100 };
/** where the tuning's points are read down from, Hz: above the traced horn's own fall (it is down 2 dB at 41 Hz) */
const TUNING_FROM_HZ = 50;
/** the record's taps, cm from the closed end (its S2 and S4) */
const RECORD_TAPS_CM = { front: 21.76, rear: 284.22 };

/** The template, its one chamber and its traced horn. */
function drawnTh18() {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.th18);
  assert.equal(spec.cabinet.chambers.length, 1);
  const [chamber] = spec.cabinet.chambers;
  const drawn = tracedHorn(spec.cabinet, chamber);
  assert.ok(drawn, "the fold traces");
  return { spec, chamber, drawn };
}

/** The record read as a tapped horn. */
function recordDesign() {
  const reading = readHornrespRecord(RECORD);
  assert.ok(reading.ok, reading.ok ? "" : reading.reason);
  assert.ok(reading.design.layout === HORN_LAYOUT.tapped);
  return { reading, design: reading.design };
}

/** The area `sCm` along a path of segments, cm², by each segment's flare law; the mouth's past the end. */
function areaAlong(segments: readonly HornSegment[], sCm: number): number {
  let left = sCm;
  for (const segment of segments) {
    if (left <= segment.length) return segmentAreaAt(segment, left);
    left -= segment.length;
  }
  return segments[segments.length - 1].s2;
}

/** A path's length, cm. */
const lengthCm = (segments: readonly HornSegment[]) =>
  segments.reduce((sum, s) => sum + s.length, 0);

/** A design's SPL (the radiated power's, as Hornresp gives it) at Hornresp's frequencies. */
function splOf(
  design: HornLayoutDesign,
  losses: Parameters<typeof hornLayoutNetwork>[1],
  volts: number,
) {
  const preset = hornLayoutNetwork(design, losses);
  assert.ok(preset);
  const model = presetModel(
    preset,
    HORNRESP.map((p) => p.f),
    volts,
  );
  assert.ok(model);
  return model.curve.map((p) => ({ f: p.f, spl: p.powerSpl }));
}

/** How a curve differs from Hornresp's over `BAND`: the rms and the worst difference, dB, and where the worst is. */
function differenceDb(curve: readonly { f: number; spl: number }[]) {
  const inBand = curve
    .map((p, i) => ({ f: p.f, db: p.spl - HORNRESP[i].spl }))
    .filter((p) => p.f >= BAND.fromHz && p.f <= BAND.toHz);
  const worst = inBand.reduce((w, p) => (Math.abs(p.db) > Math.abs(w.db) ? p : w));
  return { rms: Math.sqrt(inBand.reduce((sum, p) => sum + p.db ** 2, 0) / inBand.length), worst };
}

/** Hornresp's mean level over `PASSBAND`, dB: what the tuning's points are read from. */
const PASSBAND_DB = (() => {
  const points = HORNRESP.filter((p) => p.f >= PASSBAND.fromHz && p.f <= PASSBAND.toHz);
  return points.reduce((sum, p) => sum + p.spl, 0) / points.length;
})();

/**
 * The tuning: where a curve, read down from `TUNING_FROM_HZ`, first falls `dropDb` under Hornresp's passband level (between
 * two points, on a log frequency scale), Hz.
 */
function lowPointHz(curve: readonly { f: number; spl: number }[], dropDb: number): number {
  const level = PASSBAND_DB - dropDb;
  const top = curve.findIndex((p) => p.f >= TUNING_FROM_HZ);
  for (let i = top; i > 0; i--) {
    const [below, above] = [curve[i - 1], curve[i]];
    if (below.spl < level && above.spl >= level) {
      const k = (level - below.spl) / (above.spl - below.spl);
      return below.f * (above.f / below.f) ** k;
    }
  }
  return NaN;
}

/**
 * A path along the passage's middle, in: from the closed end to the mouth on the trace's grid, each step costing its
 * length over the square of the clearance there (the distance to the nearest board or wall), so it keeps to the middle
 * of each leg and round each bend. A trace measured this way would follow the center line the record is drawn on.
 */
function middlePathIn(trace: FoldTrace): number {
  const { nz, ny, cellIn, solid, dist } = trace.grid;
  const count = nz * ny;
  /** the eight steps: across, up, and each diagonal, with their lengths in cells */
  const steps = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ] as const;
  // the clearance: spread from the boards and the walls until it settles (the mouth's cells, at distance 0, are open)
  const clearance = new Float64Array(count).fill(Infinity);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      const k = j * nz + i;
      const edge = i === 0 || j === 0 || i === nz - 1 || j === ny - 1;
      if (solid[k]) clearance[k] = 0;
      else if (edge && dist[k] !== 0) clearance[k] = cellIn / 2;
    }
  for (let changed = true; changed;) {
    changed = false;
    for (let k = 0; k < count; k++) {
      const i = k % nz,
        j = Math.floor(k / nz);
      for (const [di, dj, step] of steps) {
        const a = i + di,
          b = j + dj;
        if (a < 0 || b < 0 || a >= nz || b >= ny) continue;
        const through = clearance[b * nz + a] + step * cellIn;
        if (through < clearance[k] - 1e-9) {
          clearance[k] = through;
          changed = true;
        }
      }
    }
  }
  // the cheapest way from the mouth to each air cell, and the cell it came from
  const cost = new Float64Array(count).fill(Infinity);
  const from = new Int32Array(count).fill(-1);
  const queue: number[] = [];
  for (let k = 0; k < count; k++)
    if (dist[k] === 0) {
      cost[k] = 0;
      queue.push(k);
    }
  // a label-correcting search: a cell goes back on the queue whenever it gets cheaper
  for (let at = 0; at < queue.length; at++) {
    const k = queue[at];
    const i = k % nz,
      j = Math.floor(k / nz);
    for (const [di, dj, step] of steps) {
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= nz || b >= ny) continue;
      const next = b * nz + a;
      if (dist[next] === Infinity) continue;
      // no squeezing diagonally between two solid cells, as the trace
      if (di && dj && (solid[j * nz + a] || solid[b * nz + i])) continue;
      const through = cost[k] + (step * cellIn) / Math.max(clearance[next], cellIn / 2) ** 2;
      if (through < cost[next]) {
        cost[next] = through;
        from[next] = k;
        queue.push(next);
      }
    }
  }
  const end = trace.closedEnd;
  assert.ok(end);
  let k = Math.floor(end.yIn / cellIn) * nz + Math.floor(end.zIn / cellIn);
  let lengthIn = 0;
  for (; from[k] >= 0; k = from[k]) {
    const q = from[k];
    lengthIn += Math.hypot((q % nz) - (k % nz), Math.floor(q / nz) - Math.floor(k / nz)) * cellIn;
  }
  return lengthIn;
}

test("TH18 template: a folded tapped horn that traces as tapped and plays on the page", () => {
  const { spec, chamber, drawn } = drawnTh18();
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn);
  const { horn } = chamber.load;
  assert.equal(horn.path, HORN_PATH.folded);
  assert.equal(horn.drive.kind, HORN_DRIVE.tapped);
  assert.equal(horn.fold?.boards.length, 8);
  assert.equal(drawn.trace.hornType, HORN_DRIVE.tapped);
  assert.equal(drawn.drive?.kind, HORN_DRIVE.tapped);
  const response = speakerResponse(spec);
  assert.deepEqual(response.chambers[0].gaps, []);
  assert.ok(response.sum.length > 0 && response.sum.every((p) => Number.isFinite(p.spl)));
});

test("TH18 drawn: the traced path, taps and areas against the record's", () => {
  const { drawn } = drawnTh18();
  const { trace } = drawn;
  const { design } = recordDesign();
  const recordIn = lengthCm(design.segments) / CM_PER_IN;
  // the path: 89.3 in against the record's 121.4 in (−26%): the shortest path hugs the inside of each bend
  const short = 1 - trace.pathIn / recordIn;
  assert.ok(short > 0 && short <= 0.27, `traced ${trace.pathIn} in vs ${recordIn} in`);
  // a path along the passage's middle: 120.1 in (−1.1%)
  const middle = middlePathIn(trace);
  assert.ok(Math.abs(middle / recordIn - 1) <= 0.02, `middle ${middle} in vs ${recordIn} in`);
  // the fronts: 9.22 in from the closed end against the record's 8.57 in
  assert.ok(trace.taps.front !== null && trace.taps.back !== null);
  const frontOff = trace.taps.front - RECORD_TAPS_CM.front / CM_PER_IN;
  assert.ok(Math.abs(frontOff) <= 0.75, `fronts off by ${frontOff} in`);
  // the rears, from the mouth (the end both paths share): 18.2 in against the record's 9.5 in; sampled beside the basket
  const rearOff = trace.pathIn - trace.taps.back - (recordIn - RECORD_TAPS_CM.rear / CM_PER_IN);
  assert.ok(Math.abs(rearOff) <= 9, `rears off by ${rearOff} in`);
  // the area at each share of the path (the paths' lengths differ), 4 in from each end left out (the trace's own
  // ends): 1.0 dB rms, the worst −3.0 dB in the mouth leg, where the motor stands across the whole width
  const offsets = trace.sections
    .filter((s) => s.sIn >= 4 && s.sIn <= trace.pathIn - 4)
    .map((s) => ({
      sIn: s.sIn,
      db:
        10 *
        Math.log10(
          (s.areaIn2 * CM2_PER_IN2) /
            areaAlong(design.segments, (s.sIn / trace.pathIn) * lengthCm(design.segments)),
        ),
    }));
  const rms = Math.sqrt(offsets.reduce((sum, o) => sum + o.db ** 2, 0) / offsets.length);
  const worst = offsets.reduce((w, o) => (Math.abs(o.db) > Math.abs(w.db) ? o : w));
  assert.ok(rms <= 1.1, `area ${rms} dB rms`);
  assert.ok(Math.abs(worst.db) <= 3.1, `area ${worst.db} dB at ${worst.sIn} in`);
});

test("TH18 drawn: played against Hornresp, the record straight and the traced horn", () => {
  const { drawn } = drawnTh18();
  const { reading, design } = recordDesign();
  assert.ok(drawn.drive?.kind === HORN_DRIVE.tapped);
  // the record straight: the engine's own error (none: it matches Hornresp)
  const straight = splOf(design, reading.losses, reading.volts);
  // the record without its front chamber (Vtc 2.4 L): a drawn horn's passage holds the cones' front air instead
  const noFrontChamber = splOf({ ...design, frontChamber: null }, reading.losses, reading.volts);
  // the traced horn: the record's driver on the traced sections and taps, as hornDesignOf builds a drawn horn
  const traced = splOf(
    {
      ...design,
      segments: [...drawn.segments],
      frontTap: drawn.drive.frontTap,
      rearTap: drawn.drive.rearTap,
      frontChamber: null,
      rearChamber: null,
    },
    reading.losses,
    reading.volts,
  );
  // 30–150 Hz: straight 0.00 dB; without the front chamber 0.41 dB rms, 1.10 dB at worst (141 Hz)
  assert.ok(differenceDb(straight).rms <= 0.02);
  const plain = differenceDb(noFrontChamber);
  assert.ok(plain.rms <= 0.45 && Math.abs(plain.worst.db) <= 1.2, JSON.stringify(plain));
  // traced: 4.9 dB rms, −10.0 dB at worst (30 Hz): its path is 26% short, so it tunes higher
  const off = differenceDb(traced);
  assert.ok(off.rms <= 5 && Math.abs(off.worst.db) <= 10.5, JSON.stringify(off));
  // the tuning (−3 and −6 dB under Hornresp's 40–100 Hz level): Hornresp 36.0 and 33.0 Hz; without the front chamber
  // 36.2 and 33.3 Hz; traced 41.2 and 39.6 Hz
  const [hr3, hr6] = [lowPointHz(HORNRESP, 3), lowPointHz(HORNRESP, 6)];
  assert.ok(Math.abs(lowPointHz(noFrontChamber, 3) - hr3) <= 0.5);
  assert.ok(Math.abs(lowPointHz(noFrontChamber, 6) - hr6) <= 0.5);
  assert.ok(Math.abs(lowPointHz(traced, 3) - hr3) <= 5.5, `${lowPointHz(traced, 3)} Hz`);
  assert.ok(Math.abs(lowPointHz(traced, 6) - hr6) <= 7, `${lowPointHz(traced, 6)} Hz`);
});
