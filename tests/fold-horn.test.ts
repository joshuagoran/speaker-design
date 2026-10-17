// A drawn horn as the sound model reads it (lib/speaker/foldHorn `traceModel`): sections from the trace, taps on their
// boundaries, and the sealed air behind the cones as the rear chamber.
import { expect, test } from "vite-plus/test";
import assert from "node:assert";
import { withHornFold } from "../src/pages/speaker/chamberLoad";
import {
  CHAMBER_LOAD,
  FOLD_WALL,
  HORN_DRIVE,
  HORN_PATH,
  PORT_SHAPE,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";
import { CM_PER_IN, CM2_PER_IN2 } from "../src/constants/units";
import { BOTH_ENDS_CORRECTION_RATIO, rectangleEndCorrection } from "../src/lib/acoustics/radiation";
import { foldTrace, type FoldDriverShape } from "../src/lib/speaker/foldTrace";
import { isDrawn, roomFits, traceModel } from "../src/lib/speaker/foldHorn";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { roomOf } from "./horn-room";
import type { FoldBoard, HornDrive, HornFold, SidePoint, SpeakerChamber } from "../src/types";

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

const traceOf = (fold: HornFold) =>
  foldTrace({ depthIn: 30, heightIn: 40, widthIn: 20, boardIn: 0.75, fold, driver: DRIVER_18 });
const modelOf = (fold: HornFold) => traceModel(traceOf(fold));
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

test("an empty box gives no horn, and is not drawn", () => {
  expect(modelOf(EMPTY).drive).toBeNull();
  expect(isDrawn(EMPTY)).toBe(false);
  expect(isDrawn(undefined)).toBe(false);
  expect(isDrawn(OFFSET)).toBe(true);
});

test("a room too small for a fold traces to nothing", () => {
  const room = { depthIn: 0, heightIn: 40, widthIn: 20 };
  expect(roomFits(room)).toBe(false);
  const t = foldTrace({ ...room, boardIn: 0.75, fold: OFFSET, driver: DRIVER_18 });
  expect(traceModel(t).drive).toBeNull();
});

test("a tap at the closed end, or two taps at one place, still lands on its own inner boundary", () => {
  const offset = traceOf(OFFSET);
  const atEnd = traceModel({
    ...offset,
    taps: {
      front: offset.taps.front === null ? null : 0,
      back: offset.taps.back === null ? null : 0,
    },
  });
  expect(atEnd.drive?.kind === HORN_DRIVE.offset && atEnd.drive.tap).toBeGreaterThanOrEqual(1);
  const tapped = traceOf(TAPPED);
  const same = traceModel({ ...tapped, taps: { front: 30, back: 30 } });
  expect(same.drive?.kind).toBe(HORN_DRIVE.tapped);
  if (same.drive?.kind !== HORN_DRIVE.tapped) return;
  expect(same.drive.rearTap).toBeGreaterThan(same.drive.frontTap);
});

test("no sealed air behind the cones gives no horn", () => {
  const offset = traceOf(OFFSET);
  expect(traceModel({ ...offset, sealed: [] }).drive).toBeNull();
});

/** the offset horn with a duct from the baffle into its rear chamber, 1.5 in high and 10 in long */
const VENTED: HornFold = {
  ...OFFSET,
  boards: [
    ...SERPENTINE_BOARDS,
    board(pt(0, 2.625), pt(10, 2.625)),
    board(pt(0, 4.875), pt(10, 4.875)),
  ],
  vent: { wall: FOLD_WALL.baffle, fromIn: 3, toIn: 4.5 },
};

test("a vented rear chamber: its liters and its duct as the rear vent", () => {
  const t = traceOf(VENTED);
  const m = traceModel(t);
  expect(m.drive?.kind).toBe(HORN_DRIVE.offset);
  expect(t.vented).not.toBeNull();
  expect(m.rearLiters).toBe(t.vented?.liters);
  expect(m.rearVent).toEqual({
    areaIn2: t.vented?.duct.areaIn2,
    lengthIn: t.vented?.duct.lengthIn,
    heightIn: t.vented?.duct.heightIn,
    // the chamber's inside width
    widthIn: 20,
  });
  // a front-loaded horn takes its vent the same way
  const front = traceModel(traceOf({ ...VENTED, drivers: { board: 0, along: 0.66, face: 1 } }));
  expect(front.drive?.kind).toBe(HORN_DRIVE.front);
  expect(front.rearVent).not.toBeNull();
});

test("a horn with no vent, or a vent no driver uses, has a sealed rear chamber", () => {
  expect(modelOf(OFFSET).rearVent).toBeNull();
  const stray: HornFold = {
    ...OFFSET,
    boards: [...SERPENTINE_BOARDS, board(pt(20, 0), pt(20, 12))],
    vent: { wall: FOLD_WALL.baffle, fromIn: 3, toIn: 4.5 },
  };
  const m = modelOf(stray);
  expect(m.rearVent).toBeNull();
  expect(m.rearLiters).toBeGreaterThan(20);
  // a vent in the passage leaks: the rear chamber is the sealed pocket again
  const leak = modelOf({ ...OFFSET, vent: { wall: FOLD_WALL.baffle, fromIn: 14, toIn: 16 } });
  expect(leak.rearVent).toBeNull();
  expect(leak.rearLiters).toBeCloseTo(modelOf(OFFSET).rearLiters ?? 0, 6);
  // a tapped horn has no rear chamber to vent
  expect(
    modelOf({ ...TAPPED, vent: { wall: FOLD_WALL.baffle, fromIn: 1, toIn: 3 } }).rearVent,
  ).toBeNull();
});

/** a drawn horn's chamber, with the chamber's own (stored) vent a slot of the given height */
function drawnChamber(fold: HornFold, drive: HornDrive): SpeakerChamber {
  const [bin] = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne).cabinet.chambers;
  const horn = {
    segments: [
      { profile: "con" as const, s1: 500, s2: 1000, length: 50 },
      { profile: "con" as const, s1: 1000, s2: 2000, length: 50 },
      { profile: "con" as const, s1: 2000, s2: 3000, length: 50 },
    ],
    portOffset: 0,
    drive,
    path: HORN_PATH.folded,
    fold,
  };
  return {
    ...bin,
    vent: {
      kind: VENT_KIND.vented,
      port: { shape: PORT_SHAPE.slot, n: 1, h: 3, len: 12 },
      maxSpeedMs: 17,
    },
    load: { kind: CHAMBER_LOAD.horn, horn },
  };
}

test("the sound model builds the vented rear chamber from the trace, not from the chamber's vent", () => {
  const chamber = drawnChamber(VENTED, { kind: HORN_DRIVE.offset, tap: 1 });
  const room = { ...roomOf(chamber), traced: modelOf(VENTED) };
  const read = hornDesignOf(chamber, { count: 1, angle: 2 }, room);
  expect(read.ok).toBe(true);
  if (!read.ok || read.design.layout === HORN_LAYOUT.tapped) throw new Error("an offset design");
  const vent = modelOf(VENTED).rearVent;
  if (!vent) throw new Error("a vented model");
  const { port } = read.design.rear;
  expect(port?.area).toBeCloseTo(vent.areaIn2 * CM2_PER_IN2, 9);
  expect(port?.slot).toEqual({
    width: vent.widthIn * CM_PER_IN,
    height: vent.heightIn * CM_PER_IN,
  });
  // its length: the duct and the inner end's correction (0.61 r where the outer end's is 0.85 r)
  const correction =
    (BOTH_ENDS_CORRECTION_RATIO - 1) * rectangleEndCorrection(vent.heightIn, vent.widthIn);
  expect(port?.length).toBeCloseTo((vent.lengthIn + correction) * CM_PER_IN, 9);
  expect(read.design.rear.liters).toBeGreaterThan(0);
  // no vent in the drawing: a sealed rear chamber, whatever the chamber's own vent says
  const sealed = hornDesignOf(
    chamber,
    { count: 1, angle: 2 },
    { ...room, traced: modelOf(OFFSET) },
  );
  if (!sealed.ok || sealed.design.layout === HORN_LAYOUT.tapped)
    throw new Error("an offset design");
  expect(sealed.design.rear.port).toBeNull();
});

test("a drawn tapped horn ignores the chamber's vent; a stored one still has the gap", () => {
  const drive = { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 } as const;
  const chamber = drawnChamber(TAPPED, drive);
  const drawn = hornDesignOf(
    chamber,
    { count: 1, angle: 2 },
    { ...roomOf(chamber), traced: modelOf(TAPPED) },
  );
  expect(drawn.ok && drawn.design.layout).toBe(HORN_LAYOUT.tapped);
  const stored = hornDesignOf(chamber, { count: 1, angle: 2 }, roomOf(chamber));
  expect(stored.ok).toBe(false);
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

test("drawing the first board seals the chamber's own vent; an undrawn fold keeps it", () => {
  const [bin] = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne).cabinet.chambers;
  assert.notEqual(bin.vent.kind, VENT_KIND.sealed);
  assert.equal(withHornFold(bin, EMPTY).vent, bin.vent);
  assert.equal(withHornFold(bin, OFFSET).vent.kind, VENT_KIND.sealed);
});
