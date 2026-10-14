// The space's feed solver (lib/speaker/solveFeeds): the mains' Auto delays at the alignment point, each fill's Auto
// delay and level at its own aim point, no history (any order, run twice: the same), Custom values kept, a mirrored
// pair's one delay, the listener moving nothing, and the arrival list at the listener.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  arrivalStatus,
  aimPoint,
  boxArrivalMs,
  listenerArrivals,
  placementLevelAt,
  solveFeeds,
} from "../src/lib/speaker/solveFeeds";
import {
  spaceGridRequest,
  spaceModel,
  spaceModelLaidOut,
  withSolved,
  type SpaceModel,
} from "../src/lib/speaker/spaceCoverage";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { homeVenue, spacePlacement } from "../src/lib/speaker/specParts";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { AUTO_LEVEL, SPACE_ITEM } from "../src/constants/speakerSpec";
import {
  ARRIVAL_STATUS,
  DELAY_NOTE,
  FILL_ALIGN_BAND,
  FILL_PRECEDENCE_MS,
  SEATED_EAR_FT,
} from "../src/constants/space";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { METERS_PER_FOOT } from "../src/constants/units";
import type { FloorPoint, SpaceDesign, SpacePlacement } from "../src/types";

/** The one speaker every placement here places: the fill template's box. */
const SPEAKER = speakerFromFill(DEFAULT_FILL, { id: "box", name: "Box" });
const ITEM = { kind: SPACE_ITEM.speaker, id: SPEAKER.id } as const;

/** A placement of the box at `spot`, 5 ft up, aimed down the room, with `over` set on it (Auto delay by default). */
const at = (spot: FloorPoint, over: Partial<SpacePlacement> = {}): SpacePlacement => ({
  ...spacePlacement(spot, ITEM, 60),
  ...over,
});

/** A fill at `spot`, tilted down 15° so its axis meets ear height in front of it. */
const fillAt = (spot: FloorPoint, over: Partial<SpacePlacement> = {}): SpacePlacement =>
  at(spot, { fill: true, levelDb: AUTO_LEVEL, aim: { yawDeg: 0, pitchDeg: -15 }, ...over });

/** A 30 × 50 ft room holding `placements`, the listener and the alignment point where given. */
function design(
  placements: readonly SpacePlacement[],
  where: { listener?: FloorPoint; alignAt?: FloorPoint } = {},
): SpaceDesign {
  const venue = homeVenue(10, { x: 0, y: 40 }, SEATED_EAR_FT);
  return {
    stacks: [],
    speakers: [SPEAKER],
    space: {
      id: "test",
      name: "test",
      placements,
      venue: {
        ...venue,
        room: { ...venue.room, widthFt: 30, lengthFt: 50 },
        listener: where.listener ?? venue.listener,
        alignAt: where.alignAt ?? { x: 0, y: 30 },
      },
    },
  };
}

/** Placement `k`'s first arrival at a floor spot at ear height, ms, without its own delay. */
const arrival = (model: SpaceModel, k: number, spot: FloorPoint) => {
  const times = model.placements
    .filter((p) => p.item.placement.source === k)
    .map((p) => boxArrivalMs(p, { ...spot, z: SEATED_EAR_FT }));
  const known = times.filter((t): t is number => t !== null);
  assert.ok(known.length);
  return Math.min(...known);
};

/** The solved delays, ms. */
const delays = (d: SpaceDesign) => spaceModel(d).solved.map((s) => s.delayMs);

test("solver: of two mains, the far one gets 0 and the near one the path difference", () => {
  const d = design([at({ x: 0, y: 2 }), at({ x: 0, y: 12 })]);
  const model = spaceModel(d);
  const [far, near] = model.solved;
  assert.equal(far.delayMs, 0);
  const diff = arrival(model, 0, d.space.venue.alignAt) - arrival(model, 1, d.space.venue.alignAt);
  assert.ok(Math.abs(near.delayMs - diff) < 1e-9, `${near.delayMs} vs ${diff}`);
  // about 10 ft of path
  const tenFtMs = ((10 * METERS_PER_FOOT) / SPEED_OF_SOUND) * 1000;
  assert.ok(Math.abs(near.delayMs - tenFtMs) < 0.5, `${near.delayMs} ms, about ${tenFtMs}`);
  assert.ok(far.delayAuto && near.delayAuto);
});

test("solver: a fill arrives the nearest main's arrival less its own path, plus the precedence margin", () => {
  const d = design([at({ x: 8, y: 2 }), at({ x: -8, y: 2 }), fillAt({ x: -6, y: 22 })]);
  const laid = spaceModelLaidOut(d);
  const model = spaceModel(d);
  const fillBox = laid.placements[2];
  assert.ok(fillBox);
  const spot = aimPoint(fillBox, d.space.venue);
  // the fill aims down onto the floor in front of it, at ear height
  assert.ok(spot.y > 22 && spot.y < 40, `aim ${spot.y} ft`);
  // the nearest main to its aim point is the left one (placement 1)
  const expected =
    arrival(laid, 1, spot) + model.solved[1].delayMs - arrival(laid, 2, spot) + FILL_PRECEDENCE_MS;
  assert.ok(expected > 0);
  assert.ok(Math.abs(model.solved[2].delayMs - expected) < 1e-9, `${model.solved[2].delayMs}`);
  assert.equal(model.solved[2].delayNote, null);
});

test("solver: a fill that would need a delay under 0 ms is held at 0, with a note", () => {
  // a fill far behind the main, aimed level: its axis runs to the back wall, much nearer the main
  const d = design([
    at({ x: 0, y: 20 }),
    fillAt({ x: 0, y: 2 }, { aim: { yawDeg: 0, pitchDeg: 0 } }),
  ]);
  const [, fill] = spaceModel(d).solved;
  assert.equal(fill.delayMs, 0);
  assert.equal(fill.delayNote, DELAY_NOTE.clamped);
  // with no main at all, nothing to line up with
  const alone = spaceModel(design([fillAt({ x: 0, y: 2 })])).solved[0];
  assert.deepEqual([alone.delayMs, alone.delayNote], [0, DELAY_NOTE.noMain]);
});

test("solver: no history: the same layout in any order gives the same delays, and solving again changes nothing", () => {
  const list = [
    at({ x: 6, y: 2 }),
    at({ x: -6, y: 9 }),
    fillAt({ x: 0, y: 20 }),
    fillAt({ x: 10, y: 28 }),
  ];
  const forward = delays(design(list));
  const backward = delays(design([...list].reverse())).reverse();
  forward.forEach((ms, k) => assert.ok(Math.abs(ms - (backward[k] ?? NaN)) < 1e-9, `${k}`));
  // the solved model solved again: the same feeds
  const d = design(list);
  const solved = spaceModel(d);
  const again = solveFeeds(withSolved(solved, solved.solved), d.space.venue);
  assert.deepEqual(again, solved.solved);
});

test("solver: a Custom main keeps its value and counts in the latest with it", () => {
  const d = design([at({ x: 0, y: 2 }), at({ x: 0, y: 12 }, { delayMs: 30 })]);
  const model = spaceModel(d);
  const [auto, custom] = model.solved;
  assert.deepEqual([custom.delayMs, custom.delayAuto], [30, false]);
  const { alignAt } = d.space.venue;
  const expected = arrival(model, 1, alignAt) + 30 - arrival(model, 0, alignAt);
  assert.ok(Math.abs(auto.delayMs - expected) < 1e-9, `${auto.delayMs} vs ${expected}`);
});

test("solver: a mirrored pair is one placement with one delay, on both boxes' voices", () => {
  const d = design([at({ x: -8, y: 2 }, { mirrored: true }), at({ x: 0, y: 10 })]);
  const model = spaceModel(d);
  assert.equal(model.placements.length, 3);
  assert.equal(model.solved.length, 2);
  // the pair stands farther from the alignment point: it is the latest, the center box waits for it
  assert.equal(model.solved[0].delayMs, 0);
  assert.ok(model.solved[1].delayMs > 0);
  for (const f of model.feeds.filter((o) => o.placement === 0))
    assert.ok(Math.abs(f.delayMs - f.memberDelayMs - model.solved[0].delayMs) < 1e-9);
});

test("solver: moving the listener changes no delay or level; moving the alignment point changes the delays", () => {
  const list = [at({ x: 0, y: 2 }), at({ x: 8, y: 12 }), fillAt({ x: -6, y: 22 })];
  const base = spaceModel(design(list)).solved;
  const moved = spaceModel(design(list, { listener: { x: 10, y: 15 } })).solved;
  assert.deepEqual(moved, base);
  const shifted = spaceModel(design(list, { alignAt: { x: 12, y: 15 } })).solved;
  assert.ok(Math.abs(shifted[1].delayMs - base[1].delayMs) > 0.1);
});

test("solver: a fill's Auto level matches the nearest main's level at the fill's aim point; the listener moves nothing", () => {
  const list = [at({ x: 0, y: 2 }), fillAt({ x: 0, y: 25 })];
  const d = design(list);
  const model = spaceModel(d);
  const fillBox = model.placements[1];
  assert.ok(fillBox);
  const spot = aimPoint(fillBox, d.space.venue);
  const req = spaceGridRequest(model, d.space.venue, FILL_ALIGN_BAND, 0, 1);
  const mainDb = placementLevelAt(model, req, 0, spot);
  const fillDb = placementLevelAt(model, req, 1, spot);
  assert.ok(Math.abs(mainDb - fillDb) < 0.5, `main ${mainDb} dB, fill ${fillDb} dB`);
  // the fill is closer to its spot: it plays quieter than the mains
  assert.ok(model.solved[1].levelAuto && model.solved[1].levelDb < 0);
  const moved = spaceModel(design(list, { listener: { x: -10, y: 10 } })).solved[1];
  assert.equal(moved.levelDb, model.solved[1].levelDb);
});

test("arrivals: each placement at the listener after the latest main, in its status", () => {
  // the listener at the alignment point: the mains arrive together, the fill its margin or more after them
  const list = [at({ x: 0, y: 2 }), at({ x: 0, y: 12 }), fillAt({ x: 0, y: 25 })];
  const d = design(list, { listener: { x: 0, y: 30 }, alignAt: { x: 0, y: 30 } });
  const model = spaceModel(d);
  const rows = listenerArrivals(model, d.space.venue.listener, d.space.venue.earFt);
  assert.deepEqual(
    rows.map((r) => r.placement),
    [0, 1, 2],
  );
  assert.ok(Math.abs(rows[0].afterMainsMs) < 1e-9 && Math.abs(rows[1].afterMainsMs) < 1e-9);
  assert.equal(rows[0].status, ARRIVAL_STATUS.onTime);
  // elsewhere, a main's row is its own arrival less the latest main's
  const off = { x: 12, y: 8 };
  const [a, b] = listenerArrivals(model, off, d.space.venue.earFt);
  const t0 = arrival(model, 0, off) + model.solved[0].delayMs;
  const t1 = arrival(model, 1, off) + model.solved[1].delayMs;
  assert.ok(Math.abs(a.afterMainsMs - (t0 - Math.max(t0, t1))) < 1e-9);
  assert.ok(Math.abs(b.afterMainsMs - (t1 - Math.max(t0, t1))) < 1e-9);
  // the status thresholds: mains within 1 ms on time, within 3 close, beyond off; a fill 5 to 15 ms after on time
  assert.deepEqual(
    [arrivalStatus(-0.9, false), arrivalStatus(2.5, false), arrivalStatus(-3.5, false)],
    [ARRIVAL_STATUS.onTime, ARRIVAL_STATUS.close, ARRIVAL_STATUS.off],
  );
  assert.deepEqual(
    [arrivalStatus(6, true), arrivalStatus(2, true), arrivalStatus(20, true)],
    [ARRIVAL_STATUS.onTime, ARRIVAL_STATUS.close, ARRIVAL_STATUS.close],
  );
});
