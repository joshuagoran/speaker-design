// The trace of a folded horn (lib/speaker/foldTrace): the mock's four starts, the horn type from the taps, and the checks.
import { describe, expect, test } from "vite-plus/test";
import { FOLD_CHECK, FOLD_DRIVERS_REASON } from "../src/constants/foldHorn";
import { FOLD_WALL, HORN_DRIVE } from "../src/constants/speakerSpec";
import { foldTrace, type FoldDriverShape, type FoldTraceInput } from "../src/lib/speaker/foldTrace";
import type { FoldBoard, HornFold, SidePoint } from "../src/types";

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

const trace = (fold: HornFold, over: Partial<FoldTraceInput> = {}) =>
  foldTrace({
    depthIn: 30,
    heightIn: 40,
    widthIn: 20,
    boardIn: 0.75,
    fold,
    driver: DRIVER_18,
    ...over,
  });
const ids = (fold: HornFold, over: Partial<FoldTraceInput> = {}) =>
  trace(fold, over).checks.map((c) => c.id);

describe("horn type from the taps", () => {
  test("a tapped spiral: both sides of the cones open into the passage", () => {
    const t = trace(TAPPED);
    expect(t.hornType).toBe(HORN_DRIVE.tapped);
    expect(t.pathIn).toBeGreaterThan(72);
    expect(t.pathIn).toBeLessThan(78);
    expect(t.taps.front).not.toBeNull();
    expect(t.taps.back).not.toBeNull();
    expect(t.closedEnd).not.toBeNull();
    expect(t.sections.length).toBeGreaterThan(100);
  });

  test("an offset horn: one side in the passage, the other in a rear chamber", () => {
    const t = trace(OFFSET);
    expect(t.hornType).toBe(HORN_DRIVE.offset);
    expect(t.taps.back).toBeNull();
    expect(t.sealed.some((p) => p.opensToBack)).toBe(true);
    expect(ids(OFFSET)).not.toContain(FOLD_CHECK.rearChamber);
    expect(ids(OFFSET)).not.toContain(FOLD_CHECK.strayAir);
  });

  test("a front-loaded horn: the cones sit at the closed end", () => {
    const t = trace(FRONT);
    expect(t.hornType).toBe(HORN_DRIVE.front);
    expect(t.taps.front).toBeLessThan(16.6 / 2 + 2);
  });

  test("the sealed pocket's volume uses the inside width", () => {
    const wide = trace(OFFSET).sealed[0];
    const narrow = trace(OFFSET, { widthIn: 10 }).sealed[0];
    expect(wide.liters).toBeCloseTo(narrow.liters * 2, 6);
  });
});

describe("checks", () => {
  test("a box with no drivers fails the drivers check", () => {
    const t = trace(EMPTY, { driver: null });
    expect(t.hornType).toBeNull();
    expect(t.checks).toContainEqual({ id: FOLD_CHECK.drivers, reason: FOLD_DRIVERS_REASON.none });
    expect(t.parts).toEqual([]);
  });

  test("an empty box is one passage the length of its diagonal reach", () => {
    const t = trace(EMPTY, { driver: null });
    expect(t.pathIn).toBeGreaterThan(30);
    expect(t.sealed).toEqual([]);
  });

  test("a mouth on a board fails the mouth check", () => {
    // a board lies over the whole mouth
    const fold: HornFold = {
      ...EMPTY,
      boards: [board(pt(0, 29), pt(0, 41))],
    };
    const t = trace(fold, { driver: null });
    expect(t.checks.map((c) => c.id)).toContain(FOLD_CHECK.mouth);
    expect(t.pathIn).toBe(0);
    expect(t.closedEnd).toBeNull();
    expect(t.sections).toEqual([]);
  });

  test("a board that walls off a pocket fails the stray sealed air check", () => {
    // a box across the corner far from the mouth, closed on all sides by boards and the walls
    const fold: HornFold = {
      ...EMPTY,
      boards: [board(pt(0, 8), pt(8, 8)), board(pt(8, 0), pt(8, 8))],
    };
    const t = trace(fold, { driver: null });
    expect(t.sealed).toHaveLength(1);
    expect(t.checks).toContainEqual({ id: FOLD_CHECK.strayAir, count: 1 });
  });

  test("both sides of the cones face a board: the drivers check fails", () => {
    const fold: HornFold = {
      boards: [
        board(pt(0, 20), pt(30, 20)),
        board(pt(0, 21.5), pt(30, 21.5)),
        board(pt(0, 18.5), pt(30, 18.5)),
      ],
      drivers: { board: 0, along: 0.5, face: 1 },
      mouth: { wall: FOLD_WALL.baffle, fromIn: 30, toIn: 40 },
    };
    expect(ids(fold)).toContain(FOLD_CHECK.drivers);
  });

  test("a cutout that runs off its board fails the cutout check", () => {
    const fold: HornFold = { ...OFFSET, drivers: { board: 0, along: 0.99, face: 1 } };
    expect(trace(fold).checks).toContainEqual({ id: FOLD_CHECK.cutout, row: 0 });
  });

  test("a motor near a wall fails the magnet check", () => {
    const fold: HornFold = { ...OFFSET, drivers: { board: 0, along: 0.5, face: -1 } };
    expect(ids(fold)).toContain(FOLD_CHECK.magnet);
  });
});

describe("speed", () => {
  test("one trace of a 30 × 40 in box takes under 100 ms", () => {
    trace(TAPPED); // warm up
    const start = performance.now();
    trace(TAPPED);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
