// The Stack page's saves (src/pages/stack/stackSaves) and member edits: a stack saved and opened again is the same
// stack, with the same response; removing a member drops the ones on it to where it stood.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { STACKS, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { stackLayout } from "../src/lib/speaker/stackLayout";
import { stackResponse } from "../src/lib/speaker/stackResponse";
import { stackFromSaved, stackSnapshot } from "../src/pages/stack/stackSaves";
import { withSpeaker, withoutMember } from "../src/pages/stack/useStack";
import { STACK_TEXT } from "../src/constants/stack";
import { AUTO_DELAY } from "../src/constants/speakerSpec";
import type { SavedConfig, StackDesign } from "../src/types";

/** A PA design's stack, with a set delay, a mirror and notes, so every field goes round. */
function paStack(): StackDesign {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, STACKS);
  const [sub, top] = read.stack.members;
  return {
    stack: {
      ...read.stack,
      members: [sub, { ...top, mirror: true, delayMs: 0.4, levelDb: -1.5 }],
      notes: "left side",
    },
    speakers: read.speakers,
  };
}

/** A document as the config store reads it back: the save's fields, its id, name and time. */
const asDoc = (design: StackDesign, id: string, name: string): SavedConfig => ({
  ...stackSnapshot(design),
  id,
  name,
  savedAt: 1,
});

test("stack saves: a stack saved and opened is the same stack under the document's id and name", () => {
  const design = paStack();
  const opened = stackFromSaved(asDoc(design, "doc1", "Left stack"));
  assert.ok(opened);
  // as the stores keep it: undefined fields dropped
  assert.deepStrictEqual(
    opened,
    JSON.parse(
      JSON.stringify({
        stack: { ...design.stack, id: "doc1", name: "Left stack" },
        speakers: design.speakers,
      }),
    ),
  );
  // the same model numbers
  assert.deepEqual(
    stackResponse(opened.stack, opened.speakers).sum,
    stackResponse(design.stack, design.speakers).sum,
  );
  assert.equal(opened.stack.members[0].delayMs, AUTO_DELAY);
});

test("stack saves: a save keeps only the speakers its members name; a document without a stack opens nothing", () => {
  const design = paStack();
  const extra = { ...design.speakers[0], id: "unused" };
  const saved = stackSnapshot({ ...design, speakers: [...design.speakers, extra] });
  assert.deepEqual(
    saved.speakers.map((s) => s.id),
    design.speakers.map((s) => s.id),
  );
  assert.ok(saved.summary?.includes(design.speakers[0].name));
  assert.equal(stackFromSaved({ id: "x", name: "speaker", speaker: {} }), null);
  assert.equal(
    stackFromSaved({ ...asDoc(design, "y", "broken"), speakers: [{ name: "no id" }] }),
    null,
  );
});

test("stack saves: removing a member, the ones on it drop to where it stood, and later references move down", () => {
  const { stack, speakers } = paStack();
  // the top stands on the sub: take the sub out, and the top stands on the base where the sub stood
  const before = stackLayout(stack, speakers)[1].at;
  const members = withoutMember(stack.members, 0);
  assert.equal(members.length, 1);
  assert.equal(members[0].pose.on, null);
  const after = stackLayout({ members }, speakers)[0].at;
  // its pose keeps its gap over the base, the sub's height not counted (it is gone)
  assert.equal(after.y, stack.members[0].pose.yIn + stack.members[1].pose.yIn);
  assert.ok(before.y > after.y);
});

test("stack saves: adding a library speaker the stack already holds keeps the members' copy", () => {
  const { speakers } = paStack();
  const [sub] = speakers;
  // the same speaker: the stack's copy
  assert.equal(withSpeaker(speakers, sub), sub);
  // a newer copy under the same id: added under a new id and a numbered name, the old copy left as it was
  const newer = { ...sub, bands: sub.bands.map((b) => ({ ...b, levelDb: b.levelDb - 1 })) };
  const added = withSpeaker(speakers, newer);
  assert.notEqual(added.id, sub.id);
  assert.equal(added.name, STACK_TEXT.copyName(sub.name, 2));
  assert.deepEqual(added.bands, newer.bands);
  assert.equal(withSpeaker([...speakers, added], { ...newer, name: sub.name }).id, `${sub.id}/3`);
});
