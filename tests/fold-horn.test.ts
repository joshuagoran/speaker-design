// A drawn horn as the sound model reads it (lib/speaker/foldHorn `traceModel`): sections from the trace, taps on their
// boundaries, and the sealed air behind the cones as the rear chamber.
import { expect, test } from "vite-plus/test";
import { CHAMBER_LOAD, FOLD_WALL, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";
import { CM_PER_IN } from "../src/constants/units";
import { foldTrace, type FoldDriverShape } from "../src/lib/speaker/foldTrace";
import { traceModel } from "../src/lib/speaker/foldHorn";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { roomOf } from "./horn-room";
import type { FoldBoard, HornFold, SidePoint, SpeakerChamber } from "../src/types";

/** one 18″ driver, as the mock sets it */
const DRIVER_18: FoldDriverShape = { cutoutIn: 16.6, depthIn: 8.2, motorIn: 7.6, count: 1 };
const pt = (zIn: number, yIn: number): SidePoint => ({ zIn, yIn });
const board = (a: SidePoint, b: SidePoint): FoldBoard => ({ a, b });

/** the mock's starts, in a 30 × 40 in side section 20 in wide */
const TAPPED: HornFold = {
  boards: [
    board(pt(0, 22), pt(19.5, 22)),
    board(pt(0, 15), pt(11, 15)),
    board(pt(19, 7.5), pt(8.5, 7.5)),
    board(pt(19, 7.5), pt(19, 22)),
  ],
  drivers: { board: 0, along: 0.5, face: -1 },
  mouth: { wall: FOLD_WALL.baffle, fromIn: 22.75, toIn: 40 },
};
const SERPENTINE_BOARDS = [
  board(pt(0, 12), pt(30, 12)),
  board(pt(30, 21), pt(8, 21)),
  board(pt(0, 30), pt(22, 30)),
];
const OFFSET: HornFold = {
  boards: SERPENTINE_BOARDS,
  drivers: { board: 0, along: 0.63, face: 1 },
  mouth: { wall: FOLD_WALL.baffle, fromIn: 30.75, toIn: 40 },
};
const FRONT: HornFold = { ...OFFSET, drivers: { board: 0, along: 0.66, face: 1 } };
const EMPTY: HornFold = {
  boards: [],
  drivers: null,
  mouth: { wall: FOLD_WALL.baffle, fromIn: 30, toIn: 40 },
};

const modelOf = (fold: HornFold) =>
  traceModel(
    foldTrace({ depthIn: 30, heightIn: 40, widthIn: 20, boardIn: 0.75, fold, driver: DRIVER_18 }),
  );
const lengthIn = (m: ReturnType<typeof modelOf>) =>
  m.segments.reduce((sum, s) => sum + s.length, 0) / CM_PER_IN;

test("a tapped spiral: both taps on section boundaries, the whole path long, no rear chamber", () => {
  const m = modelOf(TAPPED);
  expect(m.drive?.kind).toBe(HORN_DRIVE.tapped);
  if (m.drive?.kind !== HORN_DRIVE.tapped) return;
  expect(m.drive.frontTap).toBeGreaterThan(0);
  expect(m.drive.rearTap).toBeGreaterThan(m.drive.frontTap);
  expect(m.drive.rearTap).toBeLessThan(m.segments.length);
  expect(lengthIn(m)).toBeCloseTo(75, 0);
  expect(m.rearLiters).toBeNull();
  expect(m.segments.every((s) => s.s1 > 0 && s.s2 > 0 && s.length > 0)).toBe(true);
});

test("an offset horn: one tap, and the sealed air behind the cones as its rear chamber", () => {
  const m = modelOf(OFFSET);
  expect(m.drive?.kind).toBe(HORN_DRIVE.offset);
  expect(m.rearLiters).toBeGreaterThan(50);
});

test("a front-loaded horn starts at the cones", () => {
  const m = modelOf(FRONT);
  expect(m.drive?.kind).toBe(HORN_DRIVE.front);
  expect(lengthIn(m)).toBeLessThan(67);
  expect(m.rearLiters).toBeGreaterThan(50);
});

test("an empty box gives no horn", () => {
  expect(modelOf(EMPTY).drive).toBeNull();
});

test("the sound model reads the traced horn in place of the stored one", () => {
  const [bin] = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne).cabinet.chambers;
  const horn = {
    segments: [{ profile: "con" as const, s1: 500, s2: 2000, length: 100 }],
    portOffset: 0,
    drive: { kind: HORN_DRIVE.front },
    path: HORN_PATH.folded,
    fold: TAPPED,
  };
  const chamber: SpeakerChamber = {
    ...bin,
    vent: { kind: "sealed" } as SpeakerChamber["vent"], // boundary cast: the sealed vent has no other fields
    load: { kind: CHAMBER_LOAD.horn, horn },
  };
  const read = hornDesignOf(
    chamber,
    { count: 1, angle: 2 },
    { ...roomOf(bin), traced: modelOf(TAPPED) },
  );
  expect(read.ok && read.design.layout).toBe(HORN_LAYOUT.tapped);
  const none = hornDesignOf(
    chamber,
    { count: 1, angle: 2 },
    { ...roomOf(bin), traced: modelOf(EMPTY) },
  );
  expect(none.ok).toBe(false);
});
