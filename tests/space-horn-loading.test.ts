// A horn-loaded box on the Space page takes its mouth's load from where it stands (lib/speaker/spaceLoading, from
// lib/speaker/spaceCoupling): the floor and side walls narrow its solid angle, identical boxes beside it share their
// load. The Speaker page's model stays one box alone in half space; a box without a horn doesn't change.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { bandOfPart, spaceModelLaidOut, spaceResponse } from "../src/lib/speaker/spaceCoverage";
import { spaceCoupling } from "../src/lib/speaker/spaceCoupling";
import { boxLoadings } from "../src/lib/speaker/spaceLoading";
import { spaceLayout } from "../src/lib/speaker/spaceLayout";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { spacePlacement, stackMember } from "../src/lib/speaker/specParts";
import { emptySpace } from "../src/pages/space/spaceSaves";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { spaceModel } from "./helpers";
import { CHAMBER_LOAD, SPACE_ITEM } from "../src/constants/speakerSpec";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { INCHES_PER_FOOT } from "../src/constants/units";
import type {
  FrequencyPoint,
  SpaceDesign,
  SpacePlacement,
  SpeakerSpec,
  StackSpec,
} from "../src/types";

/** A horn sub (the TH18), and a box with no horn (the PA sub box). */
const HORN: SpeakerSpec = { ...templateSpeaker(SPEAKER_TEMPLATE.th18), id: "horn" };
const OTHER: SpeakerSpec = { ...templateSpeaker(SPEAKER_TEMPLATE.paSubBox), id: "other" };
const HORN_ITEM = { kind: SPACE_ITEM.speaker, id: HORN.id } as const;
const OTHER_ITEM = { kind: SPACE_ITEM.speaker, id: OTHER.id } as const;
/** Two TH18s, one on the other. */
const TWO_HIGH: StackSpec = {
  id: "two",
  name: "Two high",
  notes: "",
  members: [
    stackMember(HORN.id, HORN.input),
    { ...stackMember(HORN.id, HORN.input), pose: { xIn: 0, yIn: 0, zIn: 0, on: 0, pitchDeg: 0 } },
  ],
};
const STACK_ITEM = { kind: SPACE_ITEM.stack, id: TWO_HIGH.id } as const;
/** A TH18 with the PA sub box on it. */
const MIXED: StackSpec = {
  ...TWO_HIGH,
  id: "mixed",
  name: "Mixed",
  members: [TWO_HIGH.members[0], { ...TWO_HIGH.members[1], speakerId: OTHER.id }],
};
const MIXED_ITEM = { kind: SPACE_ITEM.stack, id: MIXED.id } as const;

const BASE = emptySpace();
const ROOM = BASE.space.venue.room;
const HORN_SIZE = speakerLayout(HORN.cabinet).size;
/** The horn's width and depth, ft. */
const W_FT = HORN_SIZE.w / INCHES_PER_FOOT;
const D_FT = HORN_SIZE.d / INCHES_PER_FOOT;
/** A spot whose box stands against the left wall. */
const LEFT = -ROOM.widthFt / 2 + W_FT / 2;

/** The space in the default room with `placements`. */
const spaceOf = (placements: SpacePlacement[]): SpaceDesign => ({
  ...BASE,
  space: { ...BASE.space, placements },
  stacks: [TWO_HIGH, MIXED],
  speakers: [HORN, OTHER],
});

/** Each box's loading per member, as the model works it out. */
function loadings(placements: SpacePlacement[]) {
  const design = spaceOf(placements);
  const items = spaceLayout(design, bandOfPart);
  return boxLoadings(items, spaceCoupling(items, design.space.venue.room).boxes);
}

/** The level of a curve nearest `f`, dB. */
const levelAt = (curve: readonly FrequencyPoint[], f: number) =>
  curve.reduce((a, b) => (Math.abs(Math.log(b.f / f)) < Math.abs(Math.log(a.f / f)) ? b : a)).spl;

/** A curve's power mean from `lo` to `hi` Hz, dB. */
const meanDb = (curve: readonly FrequencyPoint[], lo: number, hi: number) => {
  const band = curve.filter((o) => o.f >= lo && o.f <= hi);
  return 10 * Math.log10(band.reduce((s, o) => s + Math.pow(10, o.spl / 10), 0) / band.length);
};

test("loading: one horn sub alone: the floor, a side wall at right angles, nothing when lifted", () => {
  assert.deepEqual(loadings([spacePlacement({ x: 0, y: 10 }, HORN_ITEM, 0)]), [
    [{ angle: 1, count: 1 }],
  ]);
  assert.deepEqual(loadings([spacePlacement({ x: LEFT, y: 10 }, HORN_ITEM, 0)]), [
    [{ angle: 0.5, count: 1 }],
  ]);
  assert.deepEqual(loadings([spacePlacement({ x: 0, y: 10 }, HORN_ITEM, 24)]), [
    [{ angle: 2, count: 1 }],
  ]);
  // lifted to the ceiling mid-room: the ceiling halves it as the floor does; outdoors there is none
  const toCeiling = ROOM.ceilingFt * INCHES_PER_FOOT - HORN_SIZE.h;
  assert.deepEqual(loadings([spacePlacement({ x: 0, y: 10 }, HORN_ITEM, toCeiling)]), [
    [{ angle: 1, count: 1 }],
  ]);
  const items = spaceLayout(
    spaceOf([spacePlacement({ x: 0, y: 10 }, HORN_ITEM, toCeiling)]),
    bandOfPart,
  );
  assert.deepEqual(boxLoadings(items, spaceCoupling(items, { ...ROOM, outdoors: true }).boxes), [
    [{ angle: 2, count: 1 }],
  ]);
  // the front wall behind it changes nothing: with the floor, a quarter space; in the corner, still an eighth
  assert.deepEqual(loadings([spacePlacement({ x: 0, y: D_FT }, HORN_ITEM, 0)]), [
    [{ angle: 1, count: 1 }],
  ]);
  assert.deepEqual(loadings([spacePlacement({ x: LEFT, y: D_FT }, HORN_ITEM, 0)]), [
    [{ angle: 0.5, count: 1 }],
  ]);
  // a box with no horn gets none
  assert.deepEqual(loadings([spacePlacement({ x: LEFT, y: 10 }, OTHER_ITEM, 0)]), [[]]);
});

test("loading: identical horn subs side by side share their load; another design adds nothing", () => {
  const pair = [{ angle: 1, count: 2 }];
  assert.deepEqual(
    loadings([
      spacePlacement({ x: -W_FT / 2, y: 10 }, HORN_ITEM, 0),
      spacePlacement({ x: W_FT / 2, y: 10 }, HORN_ITEM, 0),
    ]),
    [pair, pair],
  );
  // a mirrored pair meeting at the center line
  assert.deepEqual(
    loadings([spacePlacement({ x: W_FT / 2, y: 10 }, HORN_ITEM, 0, { mirrored: true })]),
    [pair, pair],
  );
  // three in a row: one chain
  const three = [-W_FT, 0, W_FT].map((x) => spacePlacement({ x, y: 10 }, HORN_ITEM, 0));
  assert.deepEqual(
    loadings(three).map((l) => l[0]?.count),
    [3, 3, 3],
  );
  // set back a foot, the fronts are not in one plane
  assert.deepEqual(
    loadings([
      spacePlacement({ x: -W_FT / 2, y: 10 }, HORN_ITEM, 0),
      spacePlacement({ x: W_FT / 2, y: 11 }, HORN_ITEM, 0),
    ]).map((l) => l[0]?.count),
    [1, 1],
  );
  // another design beside it, coupled, adds nothing
  const mixed = spaceOf([
    spacePlacement({ x: -W_FT / 2, y: 10 }, HORN_ITEM, 0),
    spacePlacement(
      { x: speakerLayout(OTHER.cabinet).size.w / INCHES_PER_FOOT / 2, y: 10 },
      OTHER_ITEM,
      0,
    ),
  ]);
  const items = spaceLayout(mixed, bandOfPart);
  const coupling = spaceCoupling(items, ROOM);
  assert.deepEqual(coupling.boxes[0].boxes, [1]);
  assert.deepEqual(boxLoadings(items, coupling.boxes)[0], [{ angle: 1, count: 1 }]);
});

test("loading: in a stack, identical members share their load; the member on top is not on the floor", () => {
  assert.deepEqual(loadings([spacePlacement({ x: 0, y: 10 }, STACK_ITEM, 0)]), [
    [
      { angle: 1, count: 2 },
      { angle: 2, count: 2 },
    ],
  ]);
  // against a side wall, both members meet it
  assert.deepEqual(loadings([spacePlacement({ x: LEFT, y: 10 }, STACK_ITEM, 0)]), [
    [
      { angle: 0.5, count: 2 },
      { angle: 1, count: 2 },
    ],
  ]);
  // a horn sub with another design on top: each alone
  assert.deepEqual(loadings([spacePlacement({ x: 0, y: 10 }, MIXED_ITEM, 0)]), [
    [{ angle: 1, count: 1 }],
  ]);
  // the stack's own members are coupled with each other, but not marked on the plan
  const design = spaceOf([spacePlacement({ x: 0, y: 10 }, STACK_ITEM, 0)]);
  const coupling = spaceCoupling(spaceLayout(design, bandOfPart), ROOM);
  assert.deepEqual(coupling.boxes[0].members[0].boxes, [{ item: 0, box: 1 }]);
  assert.deepEqual(coupling.boxes[0].boxes, []);
  assert.deepEqual(coupling.marks, []);
});

test("loading: against a wall a horn sub is louder in the low end; the Speaker page's model is unchanged", () => {
  const listener = { x: 0, y: 20 };
  const run = (placements: SpacePlacement[]) => {
    const design = spaceOf(placements);
    const model = spaceModel(design);
    return { model, at: spaceResponse(model, design.space.venue, listener) };
  };
  const mid = run([spacePlacement({ x: 0, y: 10 }, HORN_ITEM, 0)]);
  const wall = run([spacePlacement({ x: LEFT, y: 10 }, HORN_ITEM, 0)]);
  assert.ok(meanDb(wall.at, 25, 60) > meanDb(mid.at, 25, 60));
  // the box's own output moves with its load, and its limits with it
  const own = (m: typeof mid) => m.model.placements[0].response?.sum ?? [];
  assert.notEqual(levelAt(own(wall), 40), levelAt(own(mid), 40));
  assert.notEqual(wall.model.placements[0].headroomDb, mid.model.placements[0].headroomDb);
  // lifted clear of everything, it plays as the Speaker and Stack pages model it: alone in half space
  const lifted = run([spacePlacement({ x: 0, y: 10 }, HORN_ITEM, 24)]);
  const alone = stackResponse({ members: [stackMember(HORN.id, HORN.input)] }, [HORN]);
  assert.deepEqual(lifted.model.placements[0].response?.sum, alone.sum);
  assert.deepEqual(
    speakerResponse(HORN),
    speakerResponse(HORN, { loading: { angle: 2, count: 1 } }),
  );
});

test("loading: a box with no horn plays the same wherever it stands", () => {
  assert.ok(OTHER.cabinet.chambers.every((c) => c.load.kind !== CHAMBER_LOAD.horn));
  const own = (placements: SpacePlacement[]) =>
    spaceModelLaidOut(spaceOf(placements)).placements[0].response?.sum;
  const lifted = own([spacePlacement({ x: 0, y: 10 }, OTHER_ITEM, 24)]);
  assert.deepEqual(own([spacePlacement({ x: 0, y: 10 }, OTHER_ITEM, 0)]), lifted);
  assert.deepEqual(own([spacePlacement({ x: LEFT, y: D_FT }, OTHER_ITEM, 0)]), lifted);
});
