// A folded horn laid out in boards (lib/speaker/hornBoards, lib/speaker/foldLayouts): the gates and sections from the
// boards, the taps where the drivers sit, and each check failing when it should.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  foldBodyFrom,
  foldPasses,
  hornBoardsLayout,
  type FoldDriverBody,
  type FoldRoom,
} from "../src/lib/speaker/hornBoards";
import {
  mirroredBoards,
  offsetZigzagBoards,
  spiralBoards,
  zigzagBoards,
} from "../src/lib/speaker/foldLayouts";
import {
  FOLD_CUTOUT_MARGIN_IN,
  FOLD_FACE,
  FOLD_MIN_PASSAGE_IN,
  FOLD_SHAPE,
} from "../src/constants/hornBoards";
import { CM2_PER_IN2, CM_PER_IN } from "../src/constants/units";
import type { FoldShape, HornBoards, HornSegment } from "../src/types";
import { splitSegmentsAt, segmentAreaAt } from "../src/lib/acoustics/hornSegments";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { roomOf } from "./horn-room";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { withGoalHorn, withHornDrive } from "../src/pages/speaker/chamberLoad";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { foldNarrowingDb, refinedBoards } from "../src/lib/speaker/foldRefine";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";

/** A 30 × 38 in side section, 21 in wide, 3/4 in walls. */
const ROOM: FoldRoom = { depthIn: 30, heightIn: 38, wallIn: 0.75, widthIn: 21 };
/** An 18″ sub's body: cutout, motor, depth behind its mounting face, excursion. */
const SUB18_CONE = { cutoutIn: 16.6, motorIn: 9 };
const SUB18: FoldDriverBody = foldBodyFrom(SUB18_CONE, 7.5, 0.5, 1);
/** Each leg's height in the four-leg zigzag, in. */
const LEG_H = (ROOM.heightIn - 3 * ROOM.wallIn) / 4;

const ZIGZAG = zigzagBoards(ROOM, 4);
const layoutOf = (plan: HornBoards, body: FoldDriverBody | null = SUB18) =>
  hornBoardsLayout(plan, ROOM, body);

/** The plan with corner `i` moved. */
const withCorner = (plan: HornBoards, i: number, z: number, y: number): HornBoards => ({
  ...plan,
  corners: plan.corners.map((c, k) => (k === i ? { ...c, z, y } : c)),
});

test("horn boards: a four-leg zigzag passes every check, its passage as high as a leg all the way", () => {
  const layout = layoutOf(ZIGZAG);
  assert.ok(foldPasses(layout), JSON.stringify(layout.checks));
  // the closed end's gate, three per turn, the mouth's
  assert.equal(layout.gates.length, 1 + 3 * 3 + 1);
  for (const g of layout.gates)
    assert.ok(Math.abs(g.heightIn - LEG_H) < 1e-6, `gate ${g.heightIn} in`);
  // four legs a turn short of the depth, plus the turns
  const legIn = ROOM.depthIn - LEG_H;
  assert.ok(
    layout.pathIn > 4 * legIn && layout.pathIn < 4 * ROOM.depthIn,
    `path ${layout.pathIn} in`,
  );
  // the sections run the whole path at one area
  const area = LEG_H * ROOM.widthIn * CM2_PER_IN2;
  assert.ok(
    layout.segments.every((s) => Math.abs(s.s1 - area) < 1e-6 && Math.abs(s.s2 - area) < 1e-6),
  );
  const totalCm = layout.segments.reduce((sum, s) => sum + s.length, 0);
  assert.ok(Math.abs(totalCm - layout.pathIn * CM_PER_IN) < 1e-6);
  assert.ok(Math.abs(layout.airLiters - (area * totalCm) / 1000) < 1e-6);
});

test("horn boards: the drivers' taps are where they sit along the first two legs", () => {
  const { taps } = layoutOf(ZIGZAG);
  const along = ZIGZAG.drivers?.alongIn ?? 0;
  assert.ok(taps?.front != null && taps.rear != null);
  // the fronts open into the first leg, which starts at the baffle
  assert.ok(Math.abs(taps.front - along) < 1e-6, `front ${taps.front} in`);
  // the backs into the second, which runs forward from the turn at the back
  assert.ok(
    taps.rear > ROOM.depthIn - LEG_H && taps.rear < 2 * ROOM.depthIn,
    `back ${taps.rear} in`,
  );
  // the fronts facing the other way swap the taps' legs
  const flipped = layoutOf({
    ...ZIGZAG,
    drivers: { board: 0, alongIn: along, coneFace: FOLD_FACE.offset },
  });
  assert.ok(flipped.taps && Math.abs((flipped.taps.rear ?? 0) - taps.front) < 1e-6);
});

test("horn boards: each check fails when it should", () => {
  // a free corner past the back wall
  assert.equal(
    layoutOf(withCorner(ZIGZAG, 1, ROOM.depthIn + 2, ZIGZAG.corners[1].y)).checks.outside,
    0,
  );
  // the second board's free end dropped through the first board
  const crossed = layoutOf(
    withCorner(ZIGZAG, 3, ZIGZAG.corners[3].z + 8, ZIGZAG.corners[0].y - 1),
  ).checks;
  assert.deepEqual(crossed.crossing, [0, 1]);
  // the second board lowered to just over the first: the passage between them is too low
  const low = ZIGZAG.corners[0].y + ROOM.wallIn + FOLD_MIN_PASSAGE_IN / 2;
  const squeezed = withCorner(withCorner(ZIGZAG, 2, ROOM.depthIn, low), 3, LEG_H, low);
  assert.notEqual(layoutOf(squeezed, null).checks.thin, null);
  // the drivers near the board's end: the cutout runs off it
  const offEnd = layoutOf({
    ...ZIGZAG,
    drivers: { board: 0, alongIn: 3, coneFace: FOLD_FACE.line },
  });
  assert.equal(offEnd.checks.drivers?.cutoutFits, false);
  // a magnet deeper than the leg above
  assert.equal(
    layoutOf(ZIGZAG, foldBodyFrom(SUB18_CONE, LEG_H + 1, 0.5, 1)).checks.drivers?.magnetClear,
    false,
  );
  // an excursion the leg below cannot take
  assert.equal(layoutOf(ZIGZAG, { ...SUB18, xmaxIn: LEG_H }).checks.drivers?.coneRoom, false);
  // the drivers on a board no leg runs along
  const stray: HornBoards = {
    ...ZIGZAG,
    corners: [...ZIGZAG.corners, { z: 10, y: 37, wall: null }, { z: 28, y: 37, wall: null }],
    boards: [...ZIGZAG.boards, { a: 6, b: 7, side: -1 }],
    drivers: { board: 3, alongIn: 9, coneFace: FOLD_FACE.line },
  };
  assert.equal(layoutOf(stray).checks.drivers?.facesPassage, false);
});

test("horn boards: a passage with no legs cannot be measured", () => {
  const layout = layoutOf({ ...ZIGZAG, legs: [] });
  assert.equal(layout.checks.broken, true);
  assert.equal(layout.segments.length, 0);
  assert.equal(foldPasses(layout), false);
});

test("horn boards: the passage draws as one piece per leg and per turn, the turns out to the far wall", () => {
  const { pieces } = layoutOf(ZIGZAG);
  assert.equal(pieces.length, 4 + 3);
  const area = (ps: readonly { z: number; y: number }[]) =>
    Math.abs(
      ps.reduce(
        (sum, p, i) => sum + p.z * ps[(i + 1) % ps.length].y - ps[(i + 1) % ps.length].z * p.y,
        0,
      ),
    ) / 2;
  // a turn spans both legs' heights and the board between, from the board's end to the wall
  const turn = pieces[4];
  assert.ok(
    Math.abs(area(turn) - LEG_H * (2 * LEG_H + ROOM.wallIn)) < 1e-6,
    `turn ${area(turn)} in²`,
  );
});

test("horn boards: without drivers on a board the throat is the closed end", () => {
  const plan = zigzagBoards(ROOM, 4, false);
  const layout = layoutOf(plan);
  assert.equal(layout.taps, null);
  assert.ok(foldPasses(layout));
});

test("horn boards: a folded tapped PA v2 bin's automatic boards pass every check and play", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
  const tapped = withHornDrive(spec.cabinet.chambers[0], HORN_DRIVE.tapped);
  assert.ok(tapped.load.kind === CHAMBER_LOAD.horn);
  const chamber = {
    ...tapped,
    load: { ...tapped.load, horn: { ...tapped.load.horn, path: HORN_PATH.folded } },
  };
  const cabinet = { ...spec.cabinet, chambers: [chamber] };
  const fold = hornFlare(cabinet, speakerLayout(cabinet).chambers[0])?.fold;
  assert.ok(fold && foldPasses(fold.layout), JSON.stringify(fold?.layout.checks));
  const response = speakerResponse({ ...spec, cabinet });
  assert.ok(response.bands.length > 0, "the boards' passage plays");
});

test("horn boards: the sections split at the taps along their own flare", () => {
  const segments: HornSegment[] = [
    { profile: HORN_PROFILE.exponential, s1: 300, s2: 1200, length: 100 },
    { profile: HORN_PROFILE.conical, s1: 1200, s2: 2000, length: 50 },
  ];
  // a cut inside a section, one within the snap of a boundary, one past the end
  const { segments: split, boundaries } = splitSegmentsAt(segments, [40, 100.02, 200]);
  assert.equal(split.length, 3);
  assert.deepEqual(boundaries, [1, 2, 3]);
  assert.ok(Math.abs(split[0].s2 - segmentAreaAt(segments[0], 40)) < 1e-6);
  assert.equal(split[1].s1, split[0].s2);
  assert.ok(Math.abs(split.reduce((sum, s) => sum + s.length, 0) - 150) < 1e-9);
  // a step into a section stays: the first piece keeps the section's own start area
  const stepped = splitSegmentsAt([{ ...segments[0] }, { ...segments[1], s1: 1500 }], [120]);
  assert.equal(stepped.segments[1].s1, 1500);
});

test("horn boards: the engine reads the boards' taps either way round, and refuses taps at one boundary", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
  const chamber = withHornDrive(spec.cabinet.chambers[0], HORN_DRIVE.tapped);
  const room = { ...roomOf(chamber), netLiters: 5 };
  const { segments } = layoutOf(ZIGZAG);
  const read = (taps: { front: number; rear: number }) =>
    hornDesignOf(chamber, { count: 1, angle: 2 }, { ...room, fold: { segments, taps } });
  const fronts = read({ front: 10, rear: 50 });
  const backs = read({ front: 50, rear: 10 });
  assert.ok(
    fronts.ok &&
      backs.ok &&
      fronts.design.layout === HORN_LAYOUT.tapped &&
      backs.design.layout === HORN_LAYOUT.tapped,
  );
  // the same taps in order; the two passages' air swapped
  assert.deepEqual(
    [backs.design.frontTap, backs.design.rearTap],
    [fronts.design.frontTap, fronts.design.rearTap],
  );
  assert.equal(backs.design.frontChamber?.liters, fronts.design.rearChamber?.liters);
  assert.equal(backs.design.rearChamber?.liters, fronts.design.frontChamber?.liters);
  assert.equal(read({ front: 10, rear: 10.001 }).ok, false);
});

test("horn boards: a board against a wall at an angle is cut to it; drivers side by side need the width", () => {
  const tilted = withCorner(ZIGZAG, 1, ZIGZAG.corners[1].z, ZIGZAG.corners[1].y + 5);
  const [aEnd, bEnd] = layoutOf(tilted).cuts[0].endCutsDeg;
  // the baffle end meets the wall at the board's tilt off square; the free end is square
  const tilt = (Math.atan2(5, ZIGZAG.corners[1].z) * 180) / Math.PI;
  assert.ok(Math.abs(aEnd - tilt) < 1e-6, `${aEnd}°`);
  assert.equal(bEnd, 0);
  assert.equal(layoutOf(ZIGZAG, { ...SUB18, count: 2 }).checks.drivers?.cutoutFits, false);
});

test("horn boards: Design from goals gives a folded horn boards that pass, or nothing when none fits", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
  const tapped = withHornDrive(spec.cabinet.chambers[0], HORN_DRIVE.tapped);
  assert.ok(tapped.load.kind === CHAMBER_LOAD.horn);
  const folded = {
    ...tapped,
    load: { ...tapped.load, horn: { ...tapped.load.horn, path: HORN_PATH.folded } },
  };
  const cabinet = { ...spec.cabinet, chambers: [folded] };
  // goals low enough that the search folds the path
  const goals = { lowHz: 30, highHz: 100, targetDb: 120 };
  const found = withGoalHorn(
    cabinet,
    folded,
    speakerLayout(cabinet).chambers[0],
    HORN_DRIVE.tapped,
    goals,
  );
  if (
    found?.chamber.load.kind === CHAMBER_LOAD.horn &&
    found.chamber.load.horn.path === HORN_PATH.folded
  ) {
    assert.ok(found.chamber.load.horn.boards, "its own boards");
    const laid = { ...cabinet, chambers: [found.chamber] };
    const fold = hornFlare(laid, speakerLayout(laid).chambers[0])?.fold;
    assert.ok(fold && foldPasses(fold.layout), JSON.stringify(fold?.layout.checks));
  }
  // a box too small for the drivers folded: no design
  const small = { ...folded, dims: { w: 24, h: 18, d: 14 } };
  const smallCab = { ...spec.cabinet, chambers: [small] };
  const none = withGoalHorn(
    smallCab,
    small,
    speakerLayout(smallCab).chambers[0],
    HORN_DRIVE.tapped,
    goals,
  );
  assert.ok(
    none === null ||
      (none.chamber.load.kind === CHAMBER_LOAD.horn &&
        none.chamber.load.horn.path !== HORN_PATH.folded),
    "no folded design that cannot be built",
  );
});

test("horn boards: mirrored top to bottom, a zigzag passes the same checks with its mouth at the bottom", () => {
  const flipped = mirroredBoards(ZIGZAG, ROOM.heightIn);
  const layout = layoutOf(flipped);
  assert.ok(foldPasses(layout), JSON.stringify(layout.checks));
  assert.ok(Math.abs(layout.pathIn - layoutOf(ZIGZAG).pathIn) < 1e-6);
  const mouth = layout.gates[layout.gates.length - 1];
  assert.ok(Math.max(mouth.a.y, mouth.b.y) < ROOM.heightIn / 2, "the mouth low on the baffle");
});

test("horn boards: an offset zigzag over a sealed rear chamber taps its first leg and passes", () => {
  const plan = offsetZigzagBoards(ROOM, 3, 10, SUB18.cutoutIn);
  const layout = layoutOf(plan);
  assert.ok(foldPasses(layout), JSON.stringify(layout.checks));
  assert.ok(layout.taps && layout.taps.front !== null && layout.taps.rear === null);
});

test("horn boards: a tapped spiral taps near the closed end and near the mouth, and passes", () => {
  const plan = spiralBoards(ROOM, 3, 0.35, SUB18, 1, 1.25);
  const layout = layoutOf(plan);
  assert.ok(foldPasses(layout), JSON.stringify(layout.checks));
  assert.ok(layout.taps && layout.taps.front !== null && layout.taps.rear !== null);
  assert.ok(layout.taps.front < 0.15 * layout.pathIn, `front tap ${layout.taps.front}`);
  assert.ok(layout.taps.rear > 0.8 * layout.pathIn, `rear tap ${layout.taps.rear}`);
  // the turn round the last inner board goes round its free end, not the end joined to the riser's board
  assert.ok(layout.gates.every((g) => g.heightIn >= FOLD_MIN_PASSAGE_IN));
  // a cutout at the far end of the drivers' board, its margin on the board but over the riser's board joined
  // under it, does not fit
  const board = plan.boards[0];
  const farIn = plan.corners[board.b].z - SUB18.cutoutIn / 2 - FOLD_CUTOUT_MARGIN_IN - 0.1;
  const over = layoutOf({ ...plan, drivers: plan.drivers && { ...plan.drivers, alongIn: farIn } });
  assert.equal(over.checks.drivers?.cutoutFits, false);
});

test("horn boards: a tapped horn's Layout keeps its automatic boards to zigzags or spirals", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
  const tapped = withHornDrive(spec.cabinet.chambers[0], HORN_DRIVE.tapped);
  assert.ok(tapped.load.kind === CHAMBER_LOAD.horn);
  const foldWith = (foldShape: FoldShape) => {
    assert.ok(tapped.load.kind === CHAMBER_LOAD.horn);
    const chamber = {
      ...tapped,
      load: { ...tapped.load, horn: { ...tapped.load.horn, foldShape } },
    };
    const cabinet = { ...spec.cabinet, chambers: [chamber] };
    return hornFlare(cabinet, speakerLayout(cabinet).chambers[0])?.fold;
  };
  // a spiral's mouth's leg runs over the drivers' board; a zigzag's over its last board
  const mouthOver = (fold: ReturnType<typeof foldWith>) => {
    const last = fold?.plan.legs.at(-1)?.left;
    return last && "board" in last ? last.board : null;
  };
  const spiral = foldWith(FOLD_SHAPE.spiral);
  assert.ok(spiral && foldPasses(spiral.layout), JSON.stringify(spiral?.layout.checks));
  assert.equal(mouthOver(spiral), spiral.plan.drivers?.board);
  const zigzag = foldWith(FOLD_SHAPE.zigzag);
  assert.ok(zigzag && foldPasses(zigzag.layout), JSON.stringify(zigzag?.layout.checks));
  assert.equal(mouthOver(zigzag), zigzag.plan.boards.length - 1);
});

test("horn boards: a passage that only widens costs nothing; one that narrows along its legs costs score", () => {
  assert.ok(foldNarrowingDb(layoutOf(zigzagBoards(ROOM, 4, true, 1, 1.25))) < 1e-9);
  assert.ok(foldNarrowingDb(layoutOf(zigzagBoards(ROOM, 4, true, 1, 0.8))) > 0);
});

test("horn boards: refining keeps a better score and keeps a resting corner on its board", () => {
  const plan = spiralBoards(ROOM, 3, 0.35, SUB18, 1, 1.25);
  // the riser board's top end rests on the drivers' board; a score that wants it lower and further back can only slide it back along that board
  const riser = plan.boards[plan.boards.length - 1];
  const top = riser.b;
  const startY = plan.corners[top].y;
  const score = (p: HornBoards) =>
    foldPasses(layoutOf(p)) ? p.corners[top].y - p.corners[top].z : null;
  const start = score(plan);
  assert.ok(start !== null);
  const refined = refinedBoards(plan, start, score, ROOM.wallIn);
  assert.ok(refined.score < start, "moving the corner along the board scores better");
  assert.ok(
    Math.abs(refined.plan.corners[top].y - startY) < 1e-9,
    "the corner stays on the drivers' board",
  );
  assert.ok(foldPasses(layoutOf(refined.plan)));
});
