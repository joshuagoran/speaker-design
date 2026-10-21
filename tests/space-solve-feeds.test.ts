// The space's feed solver (lib/speaker/solveFeeds), what Calculate delays and Calculate levels set: the mains' delays at
// the listener, each fill's delay and level at its own aim point, no history (any order, run twice: the same), typed
// delays not read, a mirrored pair's one delay, and the arrival list at the listener.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  arrivalStatus,
  aimPoint,
  boxArrivalMs,
  listenerArrivals,
  placementLevelAt,
  solveFeeds,
  type SolvedFeed,
} from "../src/lib/speaker/solveFeeds";
import { spaceGridRequest, type SpaceModel } from "../src/lib/speaker/spaceCoverage";
import { withCalculatedDelays } from "../src/pages/space/useSpace";
import { spaceModel } from "./helpers";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { homeVenue, spacePlacement } from "../src/lib/speaker/specParts";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
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

/** A placement of the box at `spot`, 5 ft up, aimed down the room, with `over` set on it. */
const at = (spot: FloorPoint, over: Partial<SpacePlacement> = {}): SpacePlacement => ({
  ...spacePlacement(spot, ITEM, 60),
  ...over,
});

/** A fill at `spot`, tilted down 15° so its axis meets ear height in front of it. */
const fillAt = (spot: FloorPoint, over: Partial<SpacePlacement> = {}): SpacePlacement =>
  at(spot, { fill: true, aim: { yawDeg: 0, pitchDeg: -15 }, ...over });

/** A 30 × 50 ft room holding `placements`, the listener where given (else 30 ft down the center line). */
function design(
  placements: readonly SpacePlacement[],
  where: { listener?: FloorPoint } = {},
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
        listener: where.listener ?? { x: 0, y: 30 },
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

/** What the solver sets for a design. */
const solve = (d: SpaceDesign) => solveFeeds(spaceModel(d), d.space.venue);

/** The design with the solver's delays and levels set, as Calculate delays and Calculate levels leave it. */
const applied = (d: SpaceDesign, solved: readonly SolvedFeed[] = solve(d)): SpaceDesign => ({
  ...d,
  space: {
    ...d.space,
    placements: d.space.placements.map((p, k) => ({
      ...p,
      delayMs: solved[k]?.delayMs ?? p.delayMs,
      levelDb: solved[k]?.levelDb ?? p.levelDb,
    })),
  },
});

test("solver: of two mains, the far one gets 0 and the near one the path difference at the listener", () => {
  const d = design([at({ x: 0, y: 2 }), at({ x: 0, y: 12 })]);
  const model = spaceModel(d);
  const [far, near] = solve(d);
  assert.equal(far.delayMs, 0);
  const { listener } = d.space.venue;
  const diff = arrival(model, 0, listener) - arrival(model, 1, listener);
  assert.ok(Math.abs(near.delayMs - diff) < 1e-9, `${near.delayMs} vs ${diff}`);
  // about 10 ft of path
  const tenFtMs = ((10 * METERS_PER_FOOT) / SPEED_OF_SOUND) * 1000;
  assert.ok(Math.abs(near.delayMs - tenFtMs) < 0.5, `${near.delayMs} ms, about ${tenFtMs}`);
});

test("solver: a fill arrives the nearest main's arrival less its own path, plus the precedence margin", () => {
  const d = design([at({ x: 8, y: 2 }), at({ x: -8, y: 2 }), fillAt({ x: -6, y: 22 })]);
  const model = spaceModel(d);
  const solved = solve(d);
  const fillBox = model.placements[2];
  assert.ok(fillBox);
  const spot = aimPoint(fillBox, d.space.venue);
  // the fill aims down onto the floor in front of it, at ear height
  assert.ok(spot.y > 22 && spot.y < 40, `aim ${spot.y} ft`);
  // the nearest main to its aim point is the left one (placement 1)
  const expected =
    arrival(model, 1, spot) + solved[1].delayMs - arrival(model, 2, spot) + FILL_PRECEDENCE_MS;
  assert.ok(expected > 0);
  assert.ok(Math.abs(solved[2].delayMs - expected) < 1e-9, `${solved[2].delayMs}`);
  assert.equal(solved[2].delayNote, null);
});

test("solver: a fill that would need a delay under 0 ms is held at 0, with a note", () => {
  // a fill far behind the main, aimed level: its axis runs to the back wall, much nearer the main
  const d = design([
    at({ x: 0, y: 20 }),
    fillAt({ x: 0, y: 2 }, { aim: { yawDeg: 0, pitchDeg: 0 } }),
  ]);
  const [, fill] = solve(d);
  assert.equal(fill.delayMs, 0);
  assert.equal(fill.delayNote, DELAY_NOTE.clamped);
  // with no main at all, nothing to line up with; Calculate delays gives the same note
  const lone = design([fillAt({ x: 0, y: 2 })]);
  const alone = solve(lone)[0];
  assert.deepEqual([alone.delayMs, alone.delayNote], [0, DELAY_NOTE.noMain]);
  assert.deepEqual(withCalculatedDelays(lone).notes, [DELAY_NOTE.noMain]);
});

test("solver: no history: the same layout in any order gives the same delays, and solving again changes nothing", () => {
  const list = [
    at({ x: 6, y: 2 }),
    at({ x: -6, y: 9 }),
    fillAt({ x: 0, y: 20 }),
    fillAt({ x: 10, y: 28 }),
  ];
  const forward = solve(design(list)).map((s) => s.delayMs);
  const backward = solve(design([...list].reverse()))
    .map((s) => s.delayMs)
    .reverse();
  forward.forEach((ms, k) => assert.ok(Math.abs(ms - (backward[k] ?? NaN)) < 1e-9, `${k}`));
  // the solved design solved again: the same feeds
  const once = solve(design(list));
  const again = solve(applied(design(list), once));
  again.forEach((s, k) => {
    assert.ok(Math.abs(s.delayMs - (once[k]?.delayMs ?? NaN)) < 1e-9, `delay ${k}`);
    assert.ok(Math.abs(s.levelDb - (once[k]?.levelDb ?? NaN)) < 1e-6, `level ${k}`);
  });
});

test("solver: a typed delay is not read: every main gets a new one", () => {
  const plain = solve(design([at({ x: 0, y: 2 }), at({ x: 0, y: 12 })]));
  const typed = solve(design([at({ x: 0, y: 2 }), at({ x: 0, y: 12 }, { delayMs: 30 })]));
  assert.deepEqual(typed, plain);
});

test("solver: a mirrored pair is one placement with one delay, on both boxes' voices", () => {
  const d = design([at({ x: -8, y: 2 }, { mirrored: true }), at({ x: 0, y: 10 })]);
  const model = spaceModel(d);
  const solved = solve(d);
  assert.equal(model.placements.length, 3);
  assert.equal(solved.length, 2);
  // the pair stands farther from the listener: it is the latest, the center box waits for it
  assert.equal(solved[0].delayMs, 0);
  assert.ok(solved[1].delayMs > 0);
  const after = spaceModel(applied(d, solved));
  after.feeds.forEach((f, i) => {
    if (f.placement === 1)
      assert.ok(Math.abs(f.delayMs - (model.feeds[i]?.delayMs ?? NaN) - solved[1].delayMs) < 1e-9);
  });
});

test("solver: the delays line up at the listener, so moving it changes them; the fill's level does not move", () => {
  const list = [at({ x: 0, y: 2 }), at({ x: 8, y: 12 }), fillAt({ x: -6, y: 22 })];
  const base = solve(design(list));
  const moved = solve(design(list, { listener: { x: 12, y: 15 } }));
  assert.ok(Math.abs(moved[1].delayMs - base[1].delayMs) > 0.1);
  assert.equal(moved[2].levelDb, base[2].levelDb);
});

test("solver: a fill's level matches the nearest main's level at the fill's aim point", () => {
  const d = applied(design([at({ x: 0, y: 2 }), fillAt({ x: 0, y: 25 })]));
  const model = spaceModel(d);
  const fillBox = model.placements[1];
  assert.ok(fillBox);
  const spot = aimPoint(fillBox, d.space.venue);
  const req = spaceGridRequest(model, d.space.venue, FILL_ALIGN_BAND, 0, 1);
  const mainDb = placementLevelAt(model, req, 0, spot);
  const fillDb = placementLevelAt(model, req, 1, spot);
  assert.ok(Math.abs(mainDb - fillDb) < 0.5, `main ${mainDb} dB, fill ${fillDb} dB`);
  // the fill is closer to its spot: it plays quieter than the mains
  assert.ok((d.space.placements[1]?.levelDb ?? 0) < 0);
});

test("arrivals: each placement at the listener after the latest main, in its status", () => {
  // delays calculated at the listener: the mains arrive together, the fill its margin or more after them
  const list = [at({ x: 0, y: 2 }), at({ x: 0, y: 12 }), fillAt({ x: 0, y: 25 })];
  const d = applied(design(list));
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
  const t0 = arrival(model, 0, off) + (d.space.placements[0]?.delayMs ?? NaN);
  const t1 = arrival(model, 1, off) + (d.space.placements[1]?.delayMs ?? NaN);
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
