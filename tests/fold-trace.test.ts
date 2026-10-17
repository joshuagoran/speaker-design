// The trace of a folded horn (lib/speaker/foldTrace): the mock's four starts, the horn type from the taps, and the checks.
import { describe, expect, test } from "vite-plus/test";
import { FOLD_CHECK, FOLD_DRIVERS_REASON, FOLD_VENT_END_RATIO } from "../src/constants/foldHorn";
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

describe("the rear chamber's vent", () => {
  /** the opening's height on the baffle, in: a duct this high is drawn by two boards 10 in long, 3/4 in thick */
  const OPENING_IN = 1.5;
  const DUCT_LENGTH_IN = 10;
  const BOARD_IN = 0.75;
  /** the offset horn's rear chamber is the air under its driver board; a duct leads from the baffle into it */
  const DUCT: HornFold = {
    ...OFFSET,
    boards: [
      ...SERPENTINE_BOARDS,
      // the faces of the two boards are 1.5 in apart: the duct from y = 3 to y = 4.5
      board(pt(0, 3 - BOARD_IN / 2), pt(DUCT_LENGTH_IN, 3 - BOARD_IN / 2)),
      board(pt(0, 4.5 + BOARD_IN / 2), pt(DUCT_LENGTH_IN, 4.5 + BOARD_IN / 2)),
    ],
    vent: { wall: FOLD_WALL.baffle, fromIn: 3, toIn: 3 + OPENING_IN },
  };

  test("a duct drawn by two boards traces to the drawn height and length, within a cell or two", () => {
    const t = trace(DUCT);
    expect(t.vented).not.toBeNull();
    const duct = t.vented?.duct;
    if (!duct) return;
    expect(Math.abs(duct.heightIn - OPENING_IN)).toBeLessThanOrEqual(0.5);
    // the run ends where the air widens past twice the opening: up to about the opening's width past the boards' ends
    expect(duct.lengthIn).toBeGreaterThanOrEqual(DUCT_LENGTH_IN + BOARD_IN - 0.5);
    expect(duct.lengthIn).toBeLessThanOrEqual(DUCT_LENGTH_IN + BOARD_IN + 1.25 * OPENING_IN);
    // the area is the height across the chamber's inside width
    expect(duct.areaIn2).toBeCloseTo(duct.heightIn * 20, 9);
  });

  test("the vented chamber takes the rear chamber's place, less the duct's air", () => {
    const bare = trace(OFFSET);
    const t = trace(DUCT);
    expect(t.hornType).toBe(HORN_DRIVE.offset);
    // the pocket under the driver board is the vented chamber: no sealed air is left, and the cones' back opens into it
    expect(bare.sealed).toHaveLength(1);
    expect(t.sealed).toEqual([]);
    expect(t.vented?.opensToBack).toBe(true);
    expect(t.vented?.opensToFront).toBe(false);
    // the boards and the duct's own air come off its liters
    expect(t.vented?.liters).toBeLessThan(bare.sealed[0].liters);
    expect(t.vented?.liters).toBeGreaterThan(0.8 * bare.sealed[0].liters);
    expect(t.checks.map((c) => c.id)).toEqual([]);
    // the grid marks its cells
    expect(t.grid.vented.reduce((sum, v) => sum + v, 0)).toBe(t.vented?.cells);
    expect(bare.vented).toBeNull();
    expect(bare.grid.vented.some((v) => v)).toBe(false);
  });

  test("a vent straight through the wall is a duct as high as its opening and about as long as the wall", () => {
    const fold: HornFold = { ...OFFSET, vent: { wall: FOLD_WALL.baffle, fromIn: 3, toIn: 5 } };
    const duct = trace(fold).vented?.duct;
    expect(duct).toBeDefined();
    if (!duct) return;
    // the opening is 2 in: the duct is at least that high, and no higher than the end ratio allows
    expect(duct.heightIn).toBeGreaterThanOrEqual(2);
    expect(duct.heightIn).toBeLessThanOrEqual(2 * FOLD_VENT_END_RATIO);
    // the wall's thickness, and the run before the air opens out to twice the opening
    expect(duct.lengthIn).toBeGreaterThanOrEqual(BOARD_IN);
    expect(duct.lengthIn).toBeLessThanOrEqual(BOARD_IN + 2 * 2);
  });

  test("a vent in the horn's passage fails the leak check and gives no vented chamber", () => {
    const fold: HornFold = { ...OFFSET, vent: { wall: FOLD_WALL.baffle, fromIn: 14, toIn: 16 } };
    const t = trace(fold);
    expect(t.checks).toContainEqual({ id: FOLD_CHECK.ventLeak });
    expect(t.vented).toBeNull();
    // the rear chamber is a plain sealed pocket again
    expect(t.sealed.some((p) => p.opensToBack)).toBe(true);
  });

  test("a vent on a board fails the blocked check", () => {
    const fold: HornFold = {
      ...OFFSET,
      vent: { wall: FOLD_WALL.baffle, fromIn: 11.75, toIn: 12.25 },
    };
    const t = trace(fold);
    expect(t.checks).toContainEqual({ id: FOLD_CHECK.ventBlocked });
    expect(t.vented).toBeNull();
  });

  test("a vent into air that no driver uses fails the stray check", () => {
    // an upright board splits the rear chamber: the cones' back opens behind it, the vent is in front of it
    const fold: HornFold = {
      ...OFFSET,
      boards: [...SERPENTINE_BOARDS, board(pt(20, 0), pt(20, 12))],
      vent: { wall: FOLD_WALL.baffle, fromIn: 3, toIn: 4.5 },
    };
    const t = trace(fold);
    expect(t.checks).toContainEqual({ id: FOLD_CHECK.ventStray });
    expect(t.vented?.opensToBack).toBe(false);
    expect(t.vented?.opensToFront).toBe(false);
    // the pocket behind the board is still the rear chamber, with no vent
    expect(t.sealed.some((p) => p.opensToBack)).toBe(true);
    expect(t.checks.map((c) => c.id)).not.toContain(FOLD_CHECK.strayAir);
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
