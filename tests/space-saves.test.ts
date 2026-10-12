// The Space page's saves (src/pages/space/spaceSaves) and placement edits: a space saved and opened again is the same
// space, with the same model; a mirror pair follows its lead; the hardware numbers its channels.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { resolvedPlacement } from "../src/lib/speaker/spaceLayout";
import { spaceModel, spaceOutputs } from "../src/lib/speaker/spaceCoverage";
import { assignChannel, channelGroups, numberChannels } from "../src/lib/speaker/spaceHardware";
import { emptySpace, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { withStack, withoutPlacement } from "../src/pages/space/useSpace";
import { SPACE_ITEM, SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { SavedConfig, SpaceDesign } from "../src/types";

/** A PA design's space, with a tilt, a lift, a level and a delay set, so every field goes round. */
function paSpace(): SpaceDesign {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
  const [left, right] = read.space.placements;
  return {
    space: {
      ...read.space,
      placements: [
        { ...left, liftIn: 12, aim: { yawDeg: 15, pitchDeg: -5 }, delayMs: 0.5 },
        { ...right, levelDb: -2 },
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
  // its own feed stays
  assert.equal(right.levelDb, -2);
  const [alone] = withoutPlacement(placements, 0);
  assert.equal(alone.follows, null);
  assert.deepEqual([alone.x, alone.aim], [right.x, right.aim]);
});

test("space hardware: band groups, channel numbers in order, a library stack copied in", () => {
  const design = paSpace();
  const [sub, top] = design.speakers;
  // the PA boxes are active: a channel per band
  assert.deepEqual(channelGroups(top), [[SPEAKER_BAND.mid], [SPEAKER_BAND.high]]);
  assert.deepEqual(channelGroups(sub), [[SPEAKER_BAND.low]]);
  // moving the left sub to the mid amp renumbers the channels through the space
  const moved = numberChannels(
    design.space.placements.map((p, k) =>
      k === 0 ? { ...p, channels: assignChannel(p.channels, 0, [SPEAKER_BAND.low], "mid") } : p,
    ),
  );
  const onMid = moved.flatMap((p) =>
    p.channels.filter((c) => c.amp === "mid").map((c) => c.channel),
  );
  assert.deepEqual(onMid, [0, 1, 2]);
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
