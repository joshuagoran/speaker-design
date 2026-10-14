// The Space page's saves (src/pages/space/spaceSaves) and placement edits: a space saved and opened again is the same
// space, with the same model; a mirrored pair is one placement; the hardware numbers its channels.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { homeVenue } from "../src/lib/speaker/specParts";
import { expandPlacements } from "../src/lib/speaker/spaceLayout";
import { spaceModel, spaceOutputs } from "../src/lib/speaker/spaceCoverage";
import { ampPowerGroups, channelGroups, withAmpPower } from "../src/lib/speaker/spaceHardware";
import {
  emptySpace,
  spaceDraft,
  spaceFromSaved,
  spaceSnapshot,
} from "../src/pages/space/spaceSaves";
import { fittedSpace, withStack } from "../src/pages/space/useSpace";
import { SPACE_ITEM, SPEAKER_BAND } from "../src/constants/speakerSpec";
import { SEATED_EAR_FT } from "../src/constants/space";
import type { SavedConfig, SpaceDesign } from "../src/types";

/** A PA design's space (one mirrored placement), with a tilt, a lift, a level and a delay set, so every field goes round. */
function paSpace(): SpaceDesign {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
  const [left] = read.space.placements;
  return {
    space: {
      ...read.space,
      placements: [
        { ...left, liftIn: 12, aim: { yawDeg: 15, pitchDeg: -5 }, levelDb: -2, delayMs: 0.5 },
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

test("space edits: a mirrored pair is one placement that stands twice, the image sharing its level and delay", () => {
  const { placements } = paSpace().space;
  assert.equal(placements.length, 1);
  assert.equal(placements[0].mirrored, true);
  const [asSet, right] = expandPlacements(placements);
  assert.deepEqual(
    [right.x, right.y, right.liftIn, right.aim, right.mirror],
    [-placements[0].x, placements[0].y, 12, { yawDeg: -15, pitchDeg: -5 }, true],
  );
  // it plays at the placement's level and delay
  assert.deepEqual([right.levelDb, right.delayMs], [-2, 0.5]);
  assert.deepEqual([asSet.levelDb, asSet.delayMs], [-2, 0.5]);
});

test("space hardware: band groups, amp power per speaker, a library stack copied in", () => {
  const design = paSpace();
  const [sub, top] = design.speakers;
  // the PA boxes are active: a channel per band
  assert.deepEqual(channelGroups(top), [[SPEAKER_BAND.mid], [SPEAKER_BAND.high]]);
  assert.deepEqual(channelGroups(sub), [[SPEAKER_BAND.low]]);
  // a mirrored pair shares its speakers: each speaker's figures once, a figure per group
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
  // the stack at -9 ft stands against the side wall of a 16 ft room, and its mirror image against the other
  assert.deepEqual(
    expandPlacements(shrunk.placements).map((p) => p.x),
    [-8, 8],
  );
  assert.deepEqual(shrunk.venue.listener, { x: 0, y: 20 });
});

test("space: a design that names no room gets one 20 ft wide, 30 ft long and 12 ft high", () => {
  const { room } = homeVenue(6, { x: 0, y: 15 }, SEATED_EAR_FT);
  assert.deepEqual([room.widthFt, room.lengthFt, room.ceilingFt], [20, 30, 12]);
});

test("space saves: a save or draft from the follower model (`follows`, no `mirrored`) is not read", () => {
  const design = paSpace();
  /** the design's save document with `placements` stored as they are (the document's fields are untyped) */
  const saved = (placements: readonly object[]): SavedConfig => {
    const doc = asDoc(design, "doc1", "Club");
    return { ...doc, space: { ...design.space, placements } };
  };
  const [placement] = design.space.placements;
  assert.ok(spaceFromSaved(saved([placement])));
  const { mirrored: _mirrored, ...old } = placement;
  assert.equal(spaceFromSaved(saved([{ ...old, follows: null }])), null);
  assert.equal(spaceFromSaved(saved([{ ...placement, follows: 0 }])), null);
  assert.equal(spaceFromSaved(saved([old])), null);
  // a draft in the browser reads the same way: dropped
  assert.equal(spaceDraft.fromDraft(saved([{ ...old, follows: null }])), null);
});

test("space hardware: a mirrored pair places its one item, so its speakers are listed once", () => {
  const design = paSpace();
  const [sub, top] = design.speakers;
  const [placement] = design.space.placements;
  assert.equal(expandPlacements(design.space.placements).length, 2);
  const only = { ...placement, item: { kind: SPACE_ITEM.speaker, id: sub.id } };
  const power = ampPowerGroups({ ...design, space: { ...design.space, placements: [only] } });
  assert.deepEqual(
    power.map((s) => s.speaker.id),
    [sub.id],
  );
  assert.ok(!power.some((s) => s.speaker.id === top.id));
});

test("space saves: a venue whose level reference or balance is not a known one is not read", () => {
  const design = paSpace();
  const withVenue = (over: Record<string, unknown>) =>
    asDoc(
      { ...design, space: { ...design.space, venue: { ...design.space.venue, ...over } } },
      "doc1",
      "Club",
    );
  assert.ok(spaceFromSaved(withVenue({})));
  // an old balance id, and a reference that is only a string
  assert.equal(spaceFromSaved(withVenue({ balance: "paMusic" })), null);
  assert.equal(spaceFromSaved(withVenue({ levelRef: "somewhere" })), null);
  // a draft in the browser reads the same way: dropped
  assert.ok(spaceDraft.fromDraft(withVenue({})));
  assert.equal(spaceDraft.fromDraft(withVenue({ balance: "paMusic" })), null);
});
