// A mirrored pair on the Space page is one placement (`SpacePlacement.mirrored`) that the model stands twice
// (lib/speaker/spaceLayout expandPlacements): the expansion, a map drag of either box, the alignment list, and the
// presets and templates that set it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./pa-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { layersFromHifi } from "../src/lib/speaker/hifiSpec";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { expandPlacements } from "../src/lib/speaker/spaceLayout";
import { spaceModel } from "./helpers";
import { spaceAlignment } from "../src/lib/speaker/spaceAlignment";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { presetLayers } from "../src/pages/stack/stackPresets";
import { emptySpace, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { withBoxAimed, withBoxMoved } from "../src/pages/space/useSpace";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/acoustics/coverageLayout";
import { DEFAULT_FILL, DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { PAIR_SIDE } from "../src/constants/space";
import type { SavedConfig, SpaceDesign, SpacePlacement } from "../src/types";

const ITEM = { kind: SPACE_ITEM.stack, id: "s" } as const;

/** A mirrored placement at (-6, 10) toed in 20 degrees, tilted, lifted, at -3 dB and 2 ms. */
const PAIR: SpacePlacement = {
  ...spacePlacement({ x: -6, y: 10 }, ITEM, 24, { yawDeg: 20, mirrored: true }),
  aim: { yawDeg: 20, pitchDeg: 7 },
  levelDb: -3,
  delayMs: 2,
};

test("expansion: a placement on its own stands once; a mirrored one stands twice, as set and as its image", () => {
  const alone = spacePlacement({ x: 3, y: 4 }, ITEM, 0);
  const boxes = expandPlacements([alone, PAIR]);
  assert.equal(boxes.length, 3);
  assert.deepEqual(
    boxes.map((b) => [b.source, b.image, b.side]),
    [
      [0, false, null],
      [1, false, PAIR_SIDE.left],
      [1, true, PAIR_SIDE.right],
    ],
  );
  const [, asSet, image] = boxes;
  // as set: untouched
  assert.deepEqual([asSet.x, asSet.y, asSet.aim, asSet.image], [-6, 10, PAIR.aim, false]);
  // the image: x and rotation turned over, flipped left and right, the same height and tilt
  assert.deepEqual(
    [image.x, image.y, image.aim, image.image, image.liftIn],
    [6, 10, { yawDeg: -20, pitchDeg: 7 }, true, 24],
  );
  // level, delay and item are shared
  for (const b of [asSet, image]) assert.deepEqual([b.levelDb, b.delayMs, b.item], [-3, 2, ITEM]);
});

test("expansion: the left box is the one at negative x, whichever the placement is set as", () => {
  const sides = (x: number) => expandPlacements([{ ...PAIR, x }]).map((b) => [b.x, b.side]);
  assert.deepEqual(sides(-6), [
    [-6, PAIR_SIDE.left],
    [6, PAIR_SIDE.right],
  ]);
  assert.deepEqual(sides(6), [
    [6, PAIR_SIDE.right],
    [-6, PAIR_SIDE.left],
  ]);
  // on the center line the two boxes stand together, and the image keeps x = 0 (never -0)
  const [, onLine] = expandPlacements([{ ...PAIR, x: 0 }]);
  assert.ok(Object.is(onLine.x, 0));
});

test("expansion: the model plays both boxes with the placement's level and delay, mirrored about the center line", () => {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
  const design: SpaceDesign = {
    space: {
      ...read.space,
      placements: read.space.placements.map((p) => ({ ...p, levelDb: -2, delayMs: 1 })),
    },
    stacks: [read.stack],
    speakers: read.speakers,
  };
  const model = spaceModel(design);
  assert.equal(model.placements.length, 2);
  const [a, b] = model.placements;
  assert.deepEqual([a.item.placement.levelDb, b.item.placement.levelDb], [-2, -2]);
  assert.deepEqual([a.item.placement.delayMs, b.item.placement.delayMs], [1, 1]);
  assert.equal(a.item.drivers.length, b.item.drivers.length);
  // every driver of one box has its mirror image in the other, across the center line
  a.item.drivers.forEach((d, i) => {
    const m = b.item.drivers[i];
    assert.ok(Math.abs(d.at.x + m.at.x) < 1e-9 && Math.abs(d.at.y - m.at.y) < 1e-9);
    assert.ok(Math.abs(d.yaw + m.yaw) < 1e-9);
  });
});

test("map drag: moving the R box moves the placement to the box's mirror image", () => {
  const placements = [spacePlacement({ x: 0, y: 5 }, ITEM, 0), PAIR];
  const room = { widthFt: 40, lengthFt: 50 };
  const [, left, right] = expandPlacements(placements);
  assert.equal(right.side, PAIR_SIDE.right);
  // the R box dragged to (8.1, 12.4): it snaps to a quarter foot; the placement (as set, on the left) goes to its mirror
  const moved = withBoxMoved(placements, right, { x: 8.1, y: 12.4 }, room);
  assert.deepEqual([moved[1].x, moved[1].y], [-8, 12.5]);
  // so the R box stands where it was dragged and the L box is its mirror
  const [, l2, r2] = expandPlacements(moved);
  assert.deepEqual([r2.x, r2.y, l2.x, l2.y], [8, 12.5, -8, 12.5]);
  // the other placements are untouched
  assert.equal(moved[0], placements[0]);
  // the L box (as set) dragged moves it straight there
  assert.deepEqual(
    [
      withBoxMoved(placements, left, { x: -3, y: 2 }, room)[1].x,
      withBoxMoved(placements, left, { x: -3, y: 2 }, room)[1].y,
    ],
    [-3, 2],
  );
  // a drag past the wall stops at it, for either box
  assert.equal(withBoxMoved(placements, right, { x: 99, y: 0 }, room)[1].x, -20);
  assert.equal(withBoxMoved(placements, left, { x: -99, y: 0 }, room)[1].x, -20);
  // everything else about the placement stays
  assert.deepEqual({ ...moved[1], x: PAIR.x, y: PAIR.y }, PAIR);
});

test("map drag: turning the R box turns the placement the other way, and the L box follows as its mirror", () => {
  const placements = [PAIR];
  const [left, right] = expandPlacements(placements);
  // the R box at (6, 10) turned to face a point straight down the room and to its left: toward -x
  const toward = { x: 6 - 5, y: 10 + 5 };
  const turnedR = withBoxAimed(placements, right, toward);
  const [l1, r1] = expandPlacements(turnedR);
  assert.equal(r1.aim.yawDeg, -45);
  assert.equal(l1.aim.yawDeg, 45);
  // the L box turned by a drag to the same bearing sets the placement to it directly
  const turnedL = withBoxAimed(placements, left, { x: -6 - 5, y: 10 + 5 });
  assert.equal(turnedL[0].aim.yawDeg, -45);
  // the tilt stays
  assert.equal(turnedR[0].aim.pitchDeg, 7);
});

/** The PA design's space with a fill speaker placed down the room (placement 1). */
function paWithFill(): SpaceDesign {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
  const fill = speakerFromFill(DEFAULT_FILL, { id: "fill", name: "Fill" });
  const item = { kind: SPACE_ITEM.speaker, id: fill.id } as const;
  return {
    stacks: [read.stack],
    speakers: [...read.speakers, fill],
    space: {
      ...read.space,
      placements: [
        ...read.space.placements,
        { ...spacePlacement({ x: 0, y: 30 }, item, 60), fill: true },
      ],
      venue: { ...read.space.venue, listener: { x: 0, y: 40 } },
    },
  };
}

test("alignment: a pair is one placement; its two boxes share the delay and level", () => {
  const base = paWithFill();
  /** the pair's own delay, ms, and level, dB */
  const [pairMs, pairDb] = [2.5, -3];
  const design: SpaceDesign = {
    ...base,
    space: {
      ...base.space,
      placements: base.space.placements.map((p, k) =>
        k === 0 ? { ...p, delayMs: pairMs, levelDb: pairDb } : p,
      ),
    },
  };
  const model = spaceModel(design);
  const plain = spaceModel(base);
  // three boxes in the model (the pair's two and the fill), two placements in the list
  assert.equal(model.placements.length, 3);
  const rows = spaceAlignment(model);
  assert.deepEqual([...new Set(rows.map((r) => r.placement))], [0, 1]);
  // every voice of the pair, both boxes alike, plays its one delay and level on top of the stack's own
  model.feeds.forEach((f, i) => {
    const was = plain.feeds[i];
    assert.ok(was);
    const [ms, db] = f.placement === 0 ? [pairMs, pairDb] : [0, 0];
    assert.ok(Math.abs(f.delayMs - was.delayMs - ms) < 1e-9, f.id);
    assert.ok(Math.abs(20 * Math.log10(f.gain / was.gain) - db) < 1e-9, f.id);
  });
});

/** A space as the library stores it and reads it back. */
const roundTrip = (design: SpaceDesign) => {
  const doc: SavedConfig = { ...spaceSnapshot(design), id: "doc", name: "Doc", savedAt: 1 };
  return spaceFromSaved(doc);
};

test("presets: the PA, satellite and Hi-fi presets set `mirrored` on one placement, and round-trip", () => {
  const ids = { id: "p", name: "p" };
  for (const preset of Object.values(STACK_PRESET)) {
    const layers = presetLayers(preset, ids);
    const { placements } = layers.space;
    assert.ok(
      placements.every((p) => typeof p.mirrored === "boolean"),
      preset,
    );
    // a preset has a left and a right: one placement mirrored, or the two set on their own
    const boxes = expandPlacements(placements);
    assert.ok(boxes.length >= placements.length, preset);
    const opened = roundTrip({
      space: layers.space,
      stacks: [layers.stack],
      speakers: layers.speakers,
    });
    assert.deepStrictEqual(opened?.space.placements, placements, preset);
  }
  // the PA stack preset: one mirrored placement, its two boxes at ±9 ft, toed in, the right one flipped
  const pa = presetLayers(STACK_PRESET.paStack, ids).space.placements;
  assert.equal(pa.length, 1);
  assert.equal(pa[0].mirrored, true);
  assert.deepEqual(
    expandPlacements(pa).map((b) => [b.x, b.aim.yawDeg, b.image, b.side]),
    [
      [
        DEFAULT_COVERAGE_LAYOUT.stacks[0].x,
        DEFAULT_COVERAGE_LAYOUT.stacks[0].aim,
        false,
        PAIR_SIDE.left,
      ],
      [
        DEFAULT_COVERAGE_LAYOUT.stacks[1].x,
        DEFAULT_COVERAGE_LAYOUT.stacks[1].aim,
        true,
        PAIR_SIDE.right,
      ],
    ],
  );
  // the Hi-fi pair: one mirrored placement
  const hifi = layersFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, ids).space.placements;
  assert.equal(hifi.length, 1);
  assert.equal(hifi[0].mirrored, true);
  // an empty space round-trips too
  const empty = emptySpace();
  assert.deepStrictEqual(roundTrip(empty)?.space.placements, []);
});
