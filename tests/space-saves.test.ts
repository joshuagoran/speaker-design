// The Space page's saves (src/pages/space/spaceSaves) and placement edits: a space saved and opened again is the same
// space, with the same model; a mirror pair follows its lead; the hardware numbers its channels.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { homeVenue } from "../src/lib/speaker/specParts";
import { resolvedPlacement } from "../src/lib/speaker/spaceLayout";
import { spaceModel, spaceOutputs } from "../src/lib/speaker/spaceCoverage";
import { ampPowerGroups, channelGroups, withAmpPower } from "../src/lib/speaker/spaceHardware";
import { emptySpace, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { fittedSpace, withFollows, withStack, withoutPlacement } from "../src/pages/space/useSpace";
import { SPACE_ITEM, SPEAKER_BAND } from "../src/constants/speakerSpec";
import { SEATED_EAR_FT } from "../src/constants/space";
import type { SavedConfig, SpaceDesign } from "../src/types";

/** A PA design's space, with a tilt, a lift, a level and a delay set, so every field goes round. */
function paSpace(): SpaceDesign {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
  const [left, right] = read.space.placements;
  return {
    space: {
      ...read.space,
      placements: [
        { ...left, liftIn: 12, aim: { yawDeg: 15, pitchDeg: -5 }, levelDb: -2, delayMs: 0.5 },
        right,
      ],
    },
    stacks: [read.stack],
    speakers: read.speakers,
  };
}

/** A document as the config store reads it back: the save's fields, its id, name and time. */
const asDoc = (design: SpaceDesign, id: string, name: string): SavedConfig => ({
  ...spaceSnapshot(design),
  id,
  name,
  savedAt: 1,
});

test("space saves: a space saved and opened is the same space under the document's id and name", () => {
  const design = paSpace();
  const opened = spaceFromSaved(asDoc(design, "doc1", "Club"));
  assert.ok(opened);
  // as the stores keep it: undefined fields dropped
  assert.deepStrictEqual(
    opened,
    JSON.parse(JSON.stringify({ ...design, space: { ...design.space, id: "doc1", name: "Club" } })),
  );
  // the same model numbers
  const out = (d: SpaceDesign) => spaceOutputs(spaceModel(d), 1000);
  assert.deepEqual(out(opened), out(design));
});

test("space saves: a save keeps only what it places; a document without a space opens nothing", () => {
  const design = paSpace();
  const extra = { ...design.stacks[0], id: "unused" };
  const saved = spaceSnapshot({ ...design, stacks: [...design.stacks, extra] });
  assert.deepEqual(
    saved.stacks.map((s) => s.id),
    design.stacks.map((s) => s.id),
  );
  assert.equal(spaceFromSaved({ id: "x", name: "x", stack: {} }), null);
  // an empty space goes round too
  const empty = emptySpace();
  assert.deepStrictEqual(
    spaceFromSaved(asDoc(empty, empty.space.id, empty.space.name)),
    JSON.parse(JSON.stringify(empty)),
  );
});

test("space edits: a mirror pair follows its lead; removing the lead leaves it where it stood", () => {
  const { placements } = paSpace().space;
  const right = resolvedPlacement(placements, 1);
  assert.equal(placements[1].follows, 0);
  assert.deepEqual(
    [right.x, right.y, right.liftIn, right.aim, right.mirror],
    [-placements[0].x, placements[0].y, 12, { yawDeg: -15, pitchDeg: -5 }, true],
  );
  // it plays at its lead's level and delay, and has no feed of its own
  assert.deepEqual([right.levelDb, right.delayMs], [-2, 0.5]);
  // a level or delay stored on the copy is not read
  const strayed = resolvedPlacement(
    placements.map((p, i) => (i === 1 ? { ...p, levelDb: 6, delayMs: 9 } : p)),
    1,
  );
  assert.deepEqual([strayed.levelDb, strayed.delayMs], [-2, 0.5]);
  const [alone] = withoutPlacement(placements, 0);
  assert.equal(alone.follows, null);
  assert.deepEqual([alone.x, alone.aim], [right.x, right.aim]);
});

test("space hardware: band groups, amp power per speaker, a library stack copied in", () => {
  const design = paSpace();
  const [sub, top] = design.speakers;
  // the PA boxes are active: a channel per band
  assert.deepEqual(channelGroups(top), [[SPEAKER_BAND.mid], [SPEAKER_BAND.high]]);
  assert.deepEqual(channelGroups(sub), [[SPEAKER_BAND.low]]);
  // a mirror pair shares its speakers: each speaker's figures once, a figure per group
  const power = ampPowerGroups(design);
  assert.deepEqual(
    power.map((s) => [s.speaker.id, s.groups.map((g) => g.bands)]),
    [
      [sub.id, [[SPEAKER_BAND.low]]],
      [top.id, [[SPEAKER_BAND.mid], [SPEAKER_BAND.high]]],
    ],
  );
  // a band's power set in the space's copy of the speaker: the model reads it
  const weak = withAmpPower(sub, [SPEAKER_BAND.low], 10);
  assert.equal(weak.bands[0].ampW, 10);
  assert.deepEqual(withAmpPower(sub, [], 10), sub);
  const headroom = (speakers: typeof design.speakers) =>
    spaceModel({ ...design, speakers }).headroomDb;
  assert.ok(headroom([weak, top]) < headroom([sub, top]));
  // a stack from the library, held already under its id but changed: a numbered copy beside it
  const changed = {
    stack: { ...design.stacks[0], notes: "changed" },
    speakers: design.speakers,
  };
  const copy = withStack(design, changed);
  assert.notEqual(copy.stack.id, design.stacks[0].id);
  assert.equal(copy.stacks.length, 2);
  assert.equal(copy.speakers.length, design.speakers.length);
  assert.equal(design.space.placements[0].item.kind, SPACE_ITEM.stack);
});

test("space edits: a placement keeps where it stands when it starts or stops following", () => {
  const design = paSpace();
  const { placements } = design.space;
  const right = resolvedPlacement(placements, 1);
  // on its own: where its lead put it, not its stored spot under the lead
  const [, alone] = withFollows(placements, 1, null);
  assert.equal(alone.follows, null);
  assert.deepEqual(
    [alone.x, alone.y, alone.liftIn, alone.aim, alone.mirror, alone.item],
    [right.x, right.y, right.liftIn, right.aim, right.mirror, right.item],
  );
  // a speaker alone, set to follow the stack: it takes the stack
  const speakerAlone = {
    ...alone,
    item: { kind: SPACE_ITEM.speaker, id: design.speakers[1].id },
    x: 5,
  };
  const list = [placements[0], speakerAlone];
  const [, following] = withFollows(list, 1, 0);
  assert.equal(following.follows, 0);
  assert.deepEqual(following.item, placements[0].item);
  assert.equal(following.x, -placements[0].x);
});

test("space edits: a smaller room keeps the placements, and the listener inside", () => {
  const design = paSpace();
  const { venue } = design.space;
  const shrunk = fittedSpace({
    ...design.space,
    venue: {
      ...venue,
      room: { ...venue.room, widthFt: 16, lengthFt: 20 },
      listener: { x: 0, y: 30 },
    },
  });
  // the stacks at ±9 ft stand against the side walls of a 16 ft room
  assert.deepEqual(
    shrunk.placements.map((p) => p.x),
    [-8, 8],
  );
  assert.deepEqual(shrunk.venue.listener, { x: 0, y: 20 });
});

test("space: a design that names no room gets one 20 ft wide, 30 ft long and 12 ft high", () => {
  const { room } = homeVenue(6, { x: 0, y: 15 }, SEATED_EAR_FT);
  assert.deepEqual([room.widthFt, room.lengthFt, room.ceilingFt], [20, 30, 12]);
});
