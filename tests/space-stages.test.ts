// Stages and risers on the Space page: their outlines' rules (lib/speaker/spaceStages), their edits (pages/space/
// stageEdits), their names, a box standing on one and coupled with its faces (the space model), and their saves and
// share links.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  areaOf,
  boxFits,
  isSimple,
  rectCorners,
  shapesOverlap,
  stageKeepsRules,
  stageNames,
  straightEdges,
  within,
} from "../src/lib/speaker/spaceStages";
import {
  keepsRules,
  placedPlans,
  spotPlans,
  stageBox,
  withStageAdded,
  withStageBox,
  withStageDragged,
  withStageRemoved,
  withStageShape,
} from "../src/pages/space/stageEdits";
import { emptySpace, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { withBoxMoved } from "../src/pages/space/useSpace";
import { spaceModelLaidOut } from "../src/lib/speaker/spaceCoverage";
import { roomWalls } from "../src/lib/speaker/spaceCoupling";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { decodeLink, encodeLink, linkFragment, spaceEnvelope } from "../src/lib/io/shareLink";
import { openEnvelope } from "../src/pages/share/openShare";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { SHARE_KIND } from "../src/constants/share";
import {
  COUPLED_FLOOR,
  NEW_RISER,
  NEW_STAGE,
  SNAP_FLUSH_IN,
  STAGE_FACE,
  STAGE_SHAPE,
} from "../src/constants/space";
import { INCHES_PER_FOOT } from "../src/constants/units";
import type { SpaceDesign, SpacePlacement, SpaceSpec, SpaceStage } from "../src/types";

const ROOM = { widthFt: 30, lengthFt: 40 };

/** A rectangular stage from x0 to x1 across and y0 to y1 down the room, ft. */
const stage = (
  id: string,
  [x0, y0, x1, y1]: [number, number, number, number],
  heightFt = 2,
  on: string | null = null,
): SpaceStage => ({
  id,
  shape: STAGE_SHAPE.rectangle,
  corners: rectCorners(x0, y0, x1, y1),
  heightFt,
  on,
});

/** The empty space in a 30 × 40 ft room with these stages and placements. */
const spaceWith = (
  stages: readonly SpaceStage[],
  placements: readonly SpacePlacement[] = [],
): SpaceSpec => {
  const { space } = emptySpace();
  return {
    ...space,
    placements,
    venue: { ...space.venue, room: { ...space.venue.room, ...ROOM }, stages },
  };
};

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("geometry: the 8 corners, clockwise from the back left; touching is not overlapping", () => {
  const corners = rectCorners(0, 0, 4, 2);
  assert.deepEqual(corners[0], { x: 0, y: 0 });
  assert.deepEqual(corners[1], { x: 2, y: 0 });
  assert.deepEqual(corners[4], { x: 4, y: 2 });
  assert.equal(areaOf(corners), 8);
  // side by side, sharing an edge
  assert.equal(shapesOverlap(corners, rectCorners(4, 0, 6, 2)), false);
  assert.equal(shapesOverlap(corners, rectCorners(3.5, 0, 6, 2)), true);
  assert.ok(within(rectCorners(0, 0, 2, 2), corners));
  assert.ok(!within(rectCorners(3, 0, 5, 2), corners));
  // a corner pulled across the outline crosses it
  const crossed = corners.map((p, i) => (i === 1 ? { x: 2, y: 3 } : p));
  assert.equal(isSimple(corners), true);
  assert.equal(isSimple(crossed), false);
});

test("rules: no overlap at one level, a riser within its stage, no riser on a riser, at least 4 sq ft", () => {
  const main = stage("a", [-8, 0, 8, 8]);
  const keeps = (stages: SpaceStage[], s: SpaceStage) => stageKeepsRules(stages, ROOM, s);
  const touching = stage("b", [8, 0, 12, 4]);
  assert.ok(keeps([main, touching], touching));
  const over = stage("b", [7, 0, 12, 4]);
  assert.ok(!keeps([main, over], over));
  // a riser may overlap its stage, not stick out of it
  const riser = stage("r", [-4, 0, 4, 4], 1, "a");
  assert.ok(keeps([main, riser], riser));
  const out = stage("r", [6, 0, 10, 4], 1, "a");
  assert.ok(!keeps([main, out], out));
  const onRiser = stage("q", [-2, 0, 2, 2], 1, "r");
  assert.ok(!keeps([main, riser, onRiser], onRiser));
  const small = stage("s", [10, 10, 11.5, 12]);
  assert.ok(!keeps([small], small));
  // a floor stage stays in the room
  const past = stage("p", [10, 0, 16, 4]);
  assert.ok(!keeps([past], past));
});

test("rules: a box on the floor clears the stages; on a stage, it lies within it, clear of its risers", () => {
  const main = stage("a", [-8, 0, 8, 8]);
  const riser = stage("r", [-4, 0, 4, 4], 1, "a");
  const box = (x0: number, y0: number) => [rectCorners(x0, y0, x0 + 2, y0 + 2)];
  assert.ok(boxFits([main], box(-1, 8)));
  // its middle on the floor, its back over the stage
  assert.ok(!boxFits([main], box(-1, 7.5)));
  assert.ok(boxFits([main], box(-1, 5)));
  // its middle on the stage, its front past its edge
  assert.ok(!boxFits([main], box(-1, 6.5)));
  assert.ok(!boxFits([main, riser], box(3, 3)));
});

test("names: stages and risers are numbered on their own, in the list's order", () => {
  const stages = [
    stage("a", [-14, 0, -4, 8]),
    stage("b", [4, 0, 14, 8]),
    stage("r2", [6, 0, 10, 4], 1, "b"),
    stage("r1", [-12, 0, -8, 4], 1, "a"),
  ];
  const names = stageNames(stages);
  assert.deepEqual(
    ["a", "r1", "b", "r2"].map((id) => names.get(id)),
    ["Stage 1", "Riser 1", "Stage 2", "Riser 2"],
  );
});

test("add: a stage at the middle of the front wall, a riser at the middle of its stage's back edge", () => {
  const first = withStageAdded(spaceWith([]), null, []);
  assert.ok(first);
  const [main] = first.layout.venue.stages;
  assert.deepEqual(stageBox(main), { x: 0, y: 0, w: NEW_STAGE.widthFt, d: NEW_STAGE.depthFt });
  assert.equal(main.heightFt, NEW_STAGE.heightFt);
  assert.equal(main.on, null);
  // no room for another beside it at the front wall: the next goes in front of it
  const second = withStageAdded(first.layout, null, []);
  assert.ok(second);
  assert.deepEqual(stageBox(second.layout.venue.stages[1]), {
    x: 0,
    y: NEW_STAGE.depthFt,
    w: NEW_STAGE.widthFt,
    d: NEW_STAGE.depthFt,
  });
  const riser = withStageAdded(first.layout, main.id, []);
  assert.ok(riser);
  const r = riser.layout.venue.stages[1];
  assert.deepEqual(stageBox(r), { x: 0, y: 0, w: NEW_RISER.widthFt, d: NEW_RISER.depthFt });
  assert.equal(r.on, main.id);
  assert.notEqual(r.id, main.id);
  // a stage too small for an 8 × 4 ft riser takes a 4 × 4 ft one
  const small = spaceWith([stage("a", [-3, 0, 3, 6])]);
  const deck = withStageAdded(small, "a", []);
  assert.ok(deck);
  assert.deepEqual(stageBox(deck.layout.venue.stages[1]), { x: 0, y: 0, w: 4, d: 4 });
});

test("drag: a stage moves with its riser; dropped on a stage it is a riser, off it a floor stage", () => {
  const start = spaceWith([
    stage("a", [-8, 0, 8, 8]),
    stage("r", [-4, 0, 4, 4], 1, "a"),
    stage("b", [10, 20, 14, 24]),
  ]);
  const drag = (id: string, x: number, y: number, from = start) =>
    withStageDragged(from, { id, handle: null, by: { x, y }, snaps: false }, []);
  const moved = drag("a", 0, 10);
  assert.ok(moved);
  assert.deepEqual(stageBox(moved.venue.stages[1]), { x: 0, y: 10, w: 8, d: 4 });
  // b dropped wholly on a: a riser; dragged off again: a floor stage
  const riser = drag("b", -16, -16);
  assert.ok(riser);
  assert.equal(riser.venue.stages[2].on, "a");
  const back = drag("b", 16, 16, riser);
  assert.ok(back);
  assert.equal(back.venue.stages[2].on, null);
  // a stage with risers stays on the floor, so over another stage it overlaps it: the drag is undone
  const bigB = spaceWith([
    stage("a", [-12, 0, 12, 10]),
    stage("b", [-4, 20, 4, 24]),
    stage("r", [-2, 20, 2, 22], 1, "b"),
  ]);
  assert.equal(drag("b", 0, -18, bigB), null);
  // a riser dragged past its stage's edge is undone
  assert.equal(drag("r", 6, 0), null);
});

test("edit: a rectangle's handle moves its edge; a polygon's corner moves; back to a rectangle squares it", () => {
  const start = spaceWith([stage("a", [-8, 0, 8, 8])]);
  // the front edge's middle handle (5) moves the front edge down 2 ft
  const deeper = withStageDragged(
    start,
    { id: "a", handle: 5, by: { x: 1, y: 2 }, snaps: false },
    [],
  );
  assert.ok(deeper);
  assert.deepEqual(stageBox(deeper.venue.stages[0]), { x: 0, y: 0, w: 16, d: 10 });
  const poly = withStageShape(start, "a", STAGE_SHAPE.polygon, []);
  const pulled = withStageDragged(
    poly,
    { id: "a", handle: 4, by: { x: -2, y: 0 }, snaps: false },
    [],
  );
  assert.ok(pulled);
  assert.deepEqual(pulled.venue.stages[0].corners[4], { x: 6, y: 8 });
  const squared = withStageShape(pulled, "a", STAGE_SHAPE.rectangle, []);
  assert.deepEqual(squared.venue.stages[0].corners, rectCorners(-8, 0, 8, 8));
  // a corner pulled across the outline is undone
  const crossed = withStageDragged(
    poly,
    { id: "a", handle: 5, by: { x: 0, y: -12 }, snaps: false },
    [],
  );
  assert.equal(crossed, null);
  // the fields scale it; under 4 sq ft is undone
  const wide = withStageBox(start, "a", { w: 20 }, []);
  assert.deepEqual(stageBox(wide.venue.stages[0]), { x: 0, y: 0, w: 20, d: 8 });
  assert.equal(withStageBox(start, "a", { w: 1, d: 1 }, []), start);
});

/** The empty space with the Generic 18" Sub and 12" Top in it, with these stages and placements. */
function designWith(stages: readonly SpaceStage[], spots: [string, number, number, number?][]) {
  const sub = { ...templateSpeaker(SPEAKER_TEMPLATE.genericSub18), id: "sub" };
  const top = { ...templateSpeaker(SPEAKER_TEMPLATE.genericTop12), id: "top" };
  const placements = spots.map(([id, x, y, liftIn = 0]) =>
    spacePlacement({ x, y }, { kind: SPACE_ITEM.speaker, id }, liftIn),
  );
  const design: SpaceDesign = {
    space: spaceWith(stages, placements),
    stacks: [],
    speakers: [sub, top],
  };
  return { design, subD: speakerLayout(sub.cabinet).size.d / INCHES_PER_FOOT };
}

test("model: a box flush against a stage's front is coupled with the floor and that face, marked", () => {
  const main = stage("a", [-8, 0, 8, 8]);
  const { subD } = designWith([], []);
  const { design } = designWith([main], [["sub", -2, 8 + subD]]);
  const model = spaceModelLaidOut(design);
  const [box] = model.coupling.boxes;
  assert.deepEqual(box.surfaces, [COUPLED_FLOOR]);
  assert.deepEqual(box.stages, [{ stage: "a", face: STAGE_FACE.front }]);
  assert.ok(model.coupling.marks.some((m) => near(m.from.y, 8) && near(m.to.y, 8)));
  assert.equal(model.placements[0].item.standsOn, null);
  // a box on the stage flush beside a riser: the stage's top and the riser's side
  const riser = stage("r", [-4, 0, 4, 4], 1, "a");
  const topW = speakerLayout(templateSpeaker(SPEAKER_TEMPLATE.genericTop12).cabinet).size.w;
  const beside = spaceModelLaidOut(
    designWith([main, riser], [["top", 4 + topW / INCHES_PER_FOOT / 2, 3]]).design,
  );
  assert.equal(beside.placements[0].item.standsOn, "a");
  assert.deepEqual(beside.coupling.boxes[0].stages, [
    { stage: "a", face: STAGE_FACE.top },
    { stage: "r", face: STAGE_FACE.side },
  ]);
});

test("model: a box on a stage stands on its top: its height, and coupled with the top, not the floor", () => {
  const main = stage("a", [-8, 0, 8, 8], 2);
  const { design } = designWith([main], [["top", 0, 6, 6]]);
  const model = spaceModelLaidOut(design);
  const { item } = model.placements[0];
  assert.equal(item.standsOn, "a");
  // the stage's 2 ft top and its own 6 in
  assert.equal(item.placement.liftIn, 2 * INCHES_PER_FOOT + 6);
  assert.ok(near(Math.min(...item.boxes.flatMap((b) => b.corners.map((c) => c.z))), 2.5));
  // on the top itself
  const on = spaceModelLaidOut(designWith([main], [["top", 0, 6]]).design);
  assert.deepEqual(on.coupling.boxes[0].surfaces, []);
  assert.deepEqual(on.coupling.boxes[0].stages, [{ stage: "a", face: STAGE_FACE.top }]);
  assert.equal(on.placements[0].item.placement.liftIn, 2 * INCHES_PER_FOOT);
});

test("rules on boxes: a move onto a stage's edge is undone; a drag near a stage's front snaps flush", () => {
  const main = stage("a", [-8, 0, 8, 8]);
  const { design, subD } = designWith([main], [["sub", 0, 14]]);
  const model = spaceModelLaidOut(design);
  const plans = spotPlans(model.placements.map((p) => p.item));
  const at = (y: number) => ({
    ...design.space,
    placements: [{ ...design.space.placements[0], y }],
  });
  assert.ok(keepsRules(design.space, at(8 + subD), plans));
  assert.ok(!keepsRules(design.space, at(8 + subD - 0.5), plans));
  assert.equal(placedPlans(design.space.placements, plans).length, 1);
  const items = model.placements.map((p) => p.item);
  const raw = { x: 0.1, y: 8 + subD + (SNAP_FLUSH_IN / INCHES_PER_FOOT) * 0.8 };
  const [moved] = withBoxMoved(design.space.placements, items[0].placement, raw, ROOM, {
    items,
    at: 0,
    walls: roomWalls(design.space.venue.room),
    stages: { edges: straightEdges(main), fits: () => true },
  });
  assert.ok(near(moved.y, 8 + subD));
});

test("remove: a stage goes with its risers", () => {
  const start = spaceWith([stage("a", [-8, 0, 8, 8]), stage("r", [-4, 0, 4, 4], 1, "a")]);
  assert.deepEqual(withStageRemoved(start, "a").venue.stages, []);
  assert.equal(withStageRemoved(start, "r").venue.stages.length, 1);
});

test("saves: stages round trip; a save from before stages opens with none", () => {
  const space = spaceWith([stage("a", [-8, 0, 8, 8]), stage("r", [-4, 0, 4, 4], 1, "a")]);
  const design: SpaceDesign = { space, stacks: [], speakers: [] };
  const saved = { id: "doc", name: "Club", ...spaceSnapshot(design) };
  assert.deepEqual(spaceFromSaved(saved)?.space.venue.stages, space.venue.stages);
  const { stages: _stages, ...old } = saved.space.venue;
  const before = spaceFromSaved({ ...saved, space: { ...saved.space, venue: old } });
  assert.deepEqual(before?.space.venue.stages, []);
  // a riser that names no floor stage: not a space
  const lost = { ...saved.space.venue, stages: [stage("r", [-4, 0, 4, 4], 1, "x")] };
  assert.equal(spaceFromSaved({ ...saved, space: { ...saved.space, venue: lost } }), null);
});

test("share link: stages round trip", async () => {
  const space = spaceWith([stage("a", [-8, 0, 8, 8]), stage("r", [-4, 0, 4, 4], 1, "a")]);
  const design: SpaceDesign = { space, stacks: [], speakers: [] };
  const decoded = await decodeLink(
    linkFragment(SHARE_KIND.space, await encodeLink(spaceEnvelope(design))),
  );
  assert.ok(decoded.ok);
  const opened = openEnvelope(decoded.envelope);
  assert.ok(opened && opened.kind === SHARE_KIND.space);
  assert.deepEqual(opened.design.space.venue.stages, space.venue.stages);
});
