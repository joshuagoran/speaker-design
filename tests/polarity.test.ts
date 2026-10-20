// A feed's polarity (`StackMember.invertPolarity`, `SpacePlacement.invertPolarity`): inverted, its pressure turns over
// (times −1) where its level and delay are applied, so two like feeds cancel where they would sum. A mirrored pair's
// boxes share it; an old save reads as not inverted; a share link keeps it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { spaceResponse } from "../src/lib/speaker/spaceCoverage";
import { expandPlacements } from "../src/lib/speaker/spaceLayout";
import { spacePlacement, stackMember } from "../src/lib/speaker/specParts";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { emptySpace, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { stackFromSaved, stackSnapshot } from "../src/pages/stack/stackSaves";
import {
  decodeLink,
  encodeLink,
  linkFragment,
  spaceEnvelope,
  stackEnvelope,
} from "../src/lib/io/shareLink";
import { spaceModel } from "./helpers";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { SHARE_KIND } from "../src/constants/share";
import type {
  FrequencyPoint,
  SavedConfig,
  SpaceDesign,
  SpacePlacement,
  SpeakerSpec,
  StackDesign,
  StackMember,
} from "../src/types";

/** A low frequency the speaker plays, Hz. */
const LOW_HZ = 100;
/** How far below one feed alone two opposed feeds must fall, dB: a deep null. */
const NULL_DB = 40;
/** Two like feeds in phase: one alone, 6 dB louder, within this, dB. */
const SUM_TOL_DB = 0.5;

const SPEAKER: SpeakerSpec = { ...templateSpeaker(SPEAKER_TEMPLATE.monitorHorn), id: "monitor" };

/** The level at the grid point nearest `f`, dB. */
const levelAt = (curve: readonly FrequencyPoint[], f: number) =>
  curve.reduce((a, b) => (Math.abs(Math.log(b.f / f)) < Math.abs(Math.log(a.f / f)) ? b : a)).spl;

const member = (invertPolarity: boolean): StackMember => ({
  ...stackMember(SPEAKER.id, SPEAKER.input),
  invertPolarity,
});

const stackLevel = (members: StackMember[]) =>
  levelAt(stackResponse({ members }, [SPEAKER]).sum, LOW_HZ);

test("stack: two like members cancel with one inverted, and sum with neither", () => {
  const one = stackLevel([member(false)]);
  const both = stackLevel([member(false), member(false)]);
  const opposed = stackLevel([member(false), member(true)]);
  assert.ok(Math.abs(both - one - 6.02) < SUM_TOL_DB, `in phase: ${both - one} dB`);
  assert.ok(opposed < one - NULL_DB, `opposed: ${opposed} dB against ${one} dB`);
  // both inverted: in phase again
  assert.ok(Math.abs(stackLevel([member(true), member(true)]) - both) < 1e-6);
});

const BASE = emptySpace();
const ITEM = { kind: SPACE_ITEM.speaker, id: SPEAKER.id } as const;
const LISTENER = BASE.space.venue.listener;

const spaceOf = (placements: SpacePlacement[]): SpaceDesign => ({
  ...BASE,
  space: { ...BASE.space, placements },
  stacks: [],
  speakers: [SPEAKER],
});

const placed = (invertPolarity: boolean, mirrored = false): SpacePlacement => ({
  ...spacePlacement({ x: 0, y: 2 }, ITEM, 0, { mirrored }),
  delayMs: 0,
  invertPolarity,
});

const spaceLevel = (placements: SpacePlacement[]) =>
  levelAt(spaceResponse(spaceModel(spaceOf(placements)), BASE.space.venue, LISTENER), LOW_HZ);

test("space: two placements of one speaker at one spot cancel with one inverted, and sum with neither", () => {
  const one = spaceLevel([placed(false)]);
  const both = spaceLevel([placed(false), placed(false)]);
  const opposed = spaceLevel([placed(false), placed(true)]);
  assert.ok(Math.abs(both - one - 6.02) < SUM_TOL_DB, `in phase: ${both - one} dB`);
  assert.ok(opposed < one - NULL_DB, `opposed: ${opposed} dB against ${one} dB`);
});

test("space: a mirrored pair's image carries the placement's polarity", () => {
  const boxes = expandPlacements([placed(true, true)]);
  assert.deepEqual(
    boxes.map((b) => [b.image, b.invertPolarity]),
    [
      [false, true],
      [true, true],
    ],
  );
  const model = spaceModel(spaceOf([placed(true, true)]));
  assert.ok(model.feeds.length > 0);
  for (const f of model.feeds) assert.equal(f.sign, -1);
});

/** A saved document of `data`, as the store gives it back. */
const saved = (data: object): SavedConfig => ({
  ...JSON.parse(JSON.stringify(data)),
  id: "doc",
  name: "Doc",
});

/** A copy with every `invertPolarity` field dropped: a save from before it. */
const withoutPolarity = (data: object): object =>
  JSON.parse(JSON.stringify(data, (k, v: unknown) => (k === "invertPolarity" ? undefined : v)));

const STACK: StackDesign = {
  stack: { id: "s", name: "Pair", members: [member(false), member(true)], notes: "" },
  speakers: [SPEAKER],
};

test("old saves without polarity read as not inverted", () => {
  const stack = stackFromSaved(saved(withoutPolarity(stackSnapshot(STACK))));
  assert.ok(stack);
  assert.deepEqual(
    stack.stack.members.map((m) => m.invertPolarity),
    [false, false],
  );
  const space = spaceFromSaved(
    saved(
      withoutPolarity(
        spaceSnapshot({
          ...spaceOf([
            placed(true),
            spacePlacement({ x: 2, y: 2 }, { kind: SPACE_ITEM.stack, id: STACK.stack.id }, 0),
          ]),
          stacks: [STACK.stack],
        }),
      ),
    ),
  );
  assert.ok(space);
  assert.deepEqual(
    space.space.placements.map((p) => p.invertPolarity),
    [false, false],
  );
  assert.deepEqual(
    space.stacks.flatMap((s) => s.members.map((m) => m.invertPolarity)),
    [false, false],
  );
});

test("share links keep polarity", async () => {
  const stackLink = await decodeLink(
    linkFragment(SHARE_KIND.stack, await encodeLink(stackEnvelope(STACK))),
  );
  assert.ok(stackLink.ok);
  assert.deepEqual(
    stackLink.envelope.stacks[0]?.members.map((m) => m.invertPolarity),
    [false, true],
  );
  const space = spaceOf([placed(true), placed(false)]);
  const spaceLink = await decodeLink(
    linkFragment(SHARE_KIND.space, await encodeLink(spaceEnvelope(space))),
  );
  assert.ok(spaceLink.ok);
  assert.deepEqual(
    spaceLink.envelope.spaces[0]?.placements.map((p) => p.invertPolarity),
    [true, false],
  );
});
