// Known folded horns laid out in runs (lib/speaker/hornFold): their runs traced from their plans, their sections and
// driver from their Hornresp records. The drivers' spot closest to the record's taps must give the record's taps, and
// the horn played from that spot must meet Hornresp's results.
//
// - TH18 by Xoc1 (tapped): runs traced from a section of its STL at mid-width, each run's center line midway between
//   its two boards, to about ±10 mm. Its boards slant; straight runs with the record's areas overlap a board or two by
//   up to an inch, so the fit is not checked.
// - SKRAM (offset driver): runs from the acoustic path in its FreeCAD sketch, mirrored (its mouth is on its back). Its
//   record's mouth area is the sketch's height times the box's depth, not its width (its spreadsheet), a third larger
//   than built, so its ducts overlap its boards and the fit is not checked either.
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { readHornrespRecord } from "../src/lib/acoustics/network/hornrespRecord";
import { fittedRuns, hornFold, type FoldTaps } from "../src/lib/speaker/hornFold";
import { splitSegmentsAt } from "../src/lib/acoustics/hornSegments";
import { hornLayoutNetwork, presetModel } from "../src/lib/acoustics/network/presets";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";
import { CM_PER_IN, CM2_PER_IN2 } from "../src/constants/units";
import type { HornLayoutDesign, HornRun } from "../src/types";
import { resultsOf } from "./hornresp-records";

const MM_PER_IN = 25.4;
const RECORDS = path.join(import.meta.dirname, "..", "tools", "hornresp", "records");
const RESULTS = path.join(import.meta.dirname, "hornresp");

/** A design's runs from its center line's points, mm: z back from the baffle's inside face, y up. */
const runsOf = (points: readonly (readonly [number, number])[]): HornRun[] =>
  points.slice(1).map(([z, y], i) => {
    const [z0, y0] = points[i];
    return {
      lengthCm: Math.hypot(z - z0, y - y0) / 10,
      angleDeg: ((Math.atan2(y - y0, z - z0) * 180) / Math.PI + 360) % 360,
    };
  });

/** A known design: its record, its runs, its box (mm) and its mouth's center height, mm. */
interface Known {
  record: string;
  points: readonly (readonly [number, number])[];
  /** the duct's width across the box, the box's clear height (from its bottom panel's top) and depth, the walls, mm */
  widthMm: number;
  clearHMm: number;
  depthMm: number;
  wallMm: number;
  mouthYMm: number;
}

const TH18: Known = {
  record: "th18-xoc1",
  points: [
    [438, 368.9],
    [50, 585],
    [60, 929],
    [206, 929],
    [206, 668],
    [377, 628],
    [382, 899],
    [572, 899],
    [572, 255],
    [442, 169],
    [0, 268],
  ],
  widthMm: 535,
  clearHMm: 980,
  depthMm: 688,
  wallMm: 18,
  mouthYMm: 268,
};

const SKRAM: Known = {
  record: "od-skram",
  points: [
    [205.3, 157],
    [198.2, 429.8],
    [191.2, 694.4],
    [191.2, 721.9],
    [163.5, 749.5],
    [88.7, 749.0],
    [59.6, 719.7],
    [59.6, 690.4],
    [69.7, 303.9],
    [71.7, 266.5],
    [32.3, 229.0],
    [0, 229],
  ],
  widthMm: 610,
  clearHMm: 879,
  depthMm: 777,
  wallMm: 18,
  mouthYMm: 229,
};

/** A known design's record, and its fold with the spot closest to `want` (cm). */
function foldOf(known: Known, want: { front: number; rear: number | null }) {
  const reading = readHornrespRecord(
    fs.readFileSync(path.join(RECORDS, `${known.record}.txt`), "latin1"),
  );
  assert.ok(reading.ok, reading.ok ? "" : reading.reason);
  const { segments } = reading.design;
  const width = known.widthMm / MM_PER_IN;
  const pathIn = segments.reduce((sum, s) => sum + s.length, 0) / CM_PER_IN;
  const mouthH = (segments[segments.length - 1]?.s2 ?? 0) / CM2_PER_IN2 / width;
  const fold = hornFold({
    segments,
    areaScale: 1,
    mouth: { x: -width / 2, y: known.mouthYMm / MM_PER_IN - mouthH / 2, w: width, h: mouthH },
    clear: { x: -width / 2, y: known.wallMm / MM_PER_IN, w: width, h: known.clearHMm / MM_PER_IN },
    depthIn: known.depthMm / MM_PER_IN,
    wallIn: known.wallMm / MM_PER_IN,
    runs: fittedRuns(runsOf(known.points), pathIn),
    mount: null,
    wantTaps: {
      front: want.front / CM_PER_IN,
      rear: want.rear === null ? null : want.rear / CM_PER_IN,
    },
  });
  assert.ok(fold?.mount);
  return { reading, fold, mount: fold.mount, pathCm: pathIn * CM_PER_IN };
}

/** The design with its sections split at the spot's taps (inches), the taps as its boundaries. */
function playedFrom(design: HornLayoutDesign, taps: FoldTaps): HornLayoutDesign {
  const cuts = [taps.front, taps.rear].flatMap((t) => (t === null ? [] : [t * CM_PER_IN]));
  const split = splitSegmentsAt(design.segments, cuts);
  if (design.layout === HORN_LAYOUT.tapped)
    return {
      ...design,
      segments: split.segments,
      frontTap: split.boundaries[0],
      rearTap: split.boundaries[1],
    };
  if (design.layout === HORN_LAYOUT.offsetDriver)
    return { ...design, segments: split.segments, tap: split.boundaries[0] };
  return design;
}

/** The most the played design's SPL differs from Hornresp's over `fromHz` to `toHz`, dB. */
function worstDb(
  name: string,
  reading: ReturnType<typeof foldOf>["reading"],
  design: HornLayoutDesign,
  fromHz: number,
  toHz: number,
) {
  assert.ok(reading.ok);
  const results = resultsOf(
    fs.readFileSync(path.join(RESULTS, `${name}-results.txt`), "utf8"),
  ).filter((p) => p.f >= fromHz && p.f <= toHz);
  const preset = hornLayoutNetwork(design, reading.losses);
  assert.ok(preset);
  const model = presetModel(
    preset,
    results.map((p) => p.f),
    reading.volts,
  );
  assert.ok(model);
  return Math.max(...results.map((p, i) => Math.abs(model.curve[i].powerSpl - p.spl)));
}

test("TH18: the spot on the driver board gives the record's taps and plays as Hornresp does", () => {
  // the record's taps: the fronts after its first section, the backs after its third
  const { reading, mount, pathCm } = foldOf(TH18, { front: 21.76, rear: 284.22 });
  assert.ok(reading.ok);
  // the drivers on the board between the closed end's run and the mouth's: the fronts into the start, the backs into
  // the mouth's run, a run on each side
  assert.ok(mount.across !== null);
  assert.ok(mount.taps.front !== null && mount.taps.rear !== null);
  const front = mount.taps.front * CM_PER_IN,
    rear = mount.taps.rear * CM_PER_IN;
  assert.ok(Math.abs(front - 21.76) < 1, `front ${front} cm`);
  assert.ok(Math.abs(rear - 284.22) < 0.03 * pathCm, `back ${rear} cm`);
  const worst = worstDb(TH18.record, reading, playedFrom(reading.design, mount.taps), 30, 150);
  assert.ok(worst < 1, `${worst} dB from Hornresp, 30–150 Hz`);
});

test("SKRAM: the spot on the rear chamber's wall gives the record's tap and plays as Hornresp does", () => {
  const { reading, mount } = foldOf(SKRAM, { front: 27.28, rear: null });
  assert.ok(reading.ok);
  // the drivers on the wall between the first run and the rear chamber: the fronts into the run
  assert.equal(mount.run, 0);
  assert.equal(mount.across, null);
  assert.equal(mount.taps.rear, null);
  assert.ok(mount.taps.front !== null && Math.abs(mount.taps.front * CM_PER_IN - 27.28) < 1);
  const worst = worstDb(SKRAM.record, reading, playedFrom(reading.design, mount.taps), 20, 200);
  assert.ok(worst < 0.5, `${worst} dB from Hornresp, 20–200 Hz`);
});
