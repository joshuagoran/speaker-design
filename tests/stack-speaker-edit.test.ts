// A Stack's speaker edited on the Speaker page (src/pages/stack/stackSpeakerEdit, useStackSpeakerEdit): the edit saves
// to the library (the save under its id, or a new one), then every member that named it names the save; signed out,
// only the Stack's copy changes. The Speaker page shows the speaker in place of its own design, and goes back to it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { saveStackSpeaker, withStackSpeaker } from "../src/pages/stack/stackSpeakerEdit";
import { useStackSpeakerEdit } from "../src/pages/stack/useStackSpeakerEdit";
import { stackFromStart } from "../src/pages/stack/stackPresets";
import { useSpeakerPage } from "../src/pages/speaker/useSpeakerPage";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import type { ConfigStore } from "../src/components/saved-configs/useConfigStore";
import { SAVE_ROW_TEXT } from "../src/constants/saveRow";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { STACK_PRESET } from "../src/constants/stackPresets";
import type { StackEditNoticeProps } from "../src/pages/speaker/StackEditNotice";
import { runSteps } from "./render-steps";
import type { SavedConfig, SpeakerSpec, StackDesign } from "../src/types";

/** A store held in memory, with `docs` saved at the start: its saves, and the writes made. */
function memoryStore(docs: SavedConfig[] = []) {
  let made = 0;
  const writes: string[] = [];
  const store: Pick<ConfigStore, "saved" | "create" | "overwrite" | "exists"> = {
    saved: [...docs],
    create: async (name, data) => {
      const id = `new${++made}`;
      writes.push(`create ${id}`);
      store.saved = [...(store.saved ?? []), { ...data, id, name }];
      return id;
    },
    overwrite: async (id, name, data) => {
      writes.push(`overwrite ${id}`);
      store.saved = (store.saved ?? []).map((c) => (c.id === id ? { ...data, id, name } : c));
      return true;
    },
    exists: async (id) => (store.saved ?? []).some((c) => c.id === id),
  };
  return { store, writes };
}

/** The PA stack preset: its members name preset speaker ids (no save has one). */
const preset = () => stackFromStart(STACK_PRESET.paStack);

/** A stack whose first two members share speaker `id` (a saved speaker's), and the rest keep theirs. */
function sharedStack(id: string): StackDesign {
  const design = preset();
  const first = design.speakers[0];
  const members = design.stack.members.map((m, k) => (k < 2 ? { ...m, speakerId: id } : m));
  const used = new Set(members.map((m) => m.speakerId));
  return {
    stack: { ...design.stack, members },
    speakers: [{ ...first, id }, ...design.speakers.filter((s) => used.has(s.id))],
  };
}

test("stack speaker edit: a saved speaker's edit updates that save, and both members that share it take it", async () => {
  const design = sharedStack("doc1");
  const held = design.speakers[0];
  const { store, writes } = memoryStore([{ id: "doc1", name: held.name }]);
  const edited: SpeakerSpec = { ...held, name: "Edited box", look: { ...held.look } };
  const saved = await saveStackSpeaker(store, edited);
  assert.deepEqual(writes, ["overwrite doc1"]);
  assert.equal(saved?.id, "doc1");
  assert.ok(saved);
  const next = withStackSpeaker(design, held.id, saved);
  assert.deepEqual(
    next.stack.members.slice(0, 2).map((m) => m.speakerId),
    ["doc1", "doc1"],
  );
  assert.equal(next.speakers.filter((s) => s.id === "doc1").length, 1);
  assert.equal(next.speakers.find((s) => s.id === "doc1")?.name, "Edited box");
  // the other members keep their speakers
  assert.deepEqual(next.stack.members.slice(2), design.stack.members.slice(2));
});

test("stack speaker edit: a preset speaker gets a new save, and the members point at the new id", async () => {
  const design = preset();
  const held = design.speakers[0];
  assert.ok(held.id.includes("/"), "a preset's speaker id is no save's");
  // a save under the same name: the new one takes the copy name
  const { store, writes } = memoryStore([{ id: "doc1", name: held.name }]);
  const saved = await saveStackSpeaker(store, held);
  assert.deepEqual(writes, ["create new1"]);
  assert.equal(saved?.id, "new1");
  assert.equal(saved?.name, SAVE_ROW_TEXT.copyName(held.name));
  assert.ok(saved);
  const next = withStackSpeaker(design, held.id, saved);
  const before = design.stack.members.filter((m) => m.speakerId === held.id).length;
  assert.ok(before > 0);
  assert.equal(next.stack.members.filter((m) => m.speakerId === "new1").length, before);
  assert.ok(!next.speakers.some((s) => s.id === held.id));
  assert.equal(next.speakers.length, design.speakers.length);
});

test("stack speaker edit: a saved id the store no longer holds gets a new save; a failed read saves nothing", async () => {
  const held = { ...templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay), id: "gone" };
  const { store, writes } = memoryStore();
  assert.equal((await saveStackSpeaker(store, held))?.id, "new1");
  assert.deepEqual(writes, ["create new1"]);
  const failing = { ...memoryStore().store, exists: async () => null };
  assert.equal(await saveStackSpeaker(failing, held), null);
});

test("stack speaker edit: a stack without the copy stays as it was", () => {
  const design = preset();
  const other = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  assert.equal(withStackSpeaker(design, "not-there", other), design);
});

test("stack speaker edit: the Speaker page shows the speaker in place of its own, and goes back to it", () => {
  const stackSpeaker = { ...preset().speakers[0], name: "Stack's box" };
  const seen: string[] = [];
  runSteps(useSpeakerPage, [
    (page) => {
      seen.push(page.spec.name);
      page.stackEditView.open(stackSpeaker, { stackName: "My Stack", speakerId: stackSpeaker.id });
    },
    (page) => {
      seen.push(page.spec.name);
      // not a link's speaker: the share notice stays away
      assert.equal(page.sharedView.active, false);
      assert.deepEqual(page.stackEditView.edit, {
        stackName: "My Stack",
        speakerId: stackSpeaker.id,
      });
      page.stackEditView.close();
    },
    (page) => {
      seen.push(page.spec.name);
      assert.equal(page.stackEditView.edit, null);
    },
  ]);
  assert.notEqual(seen[0], "Stack's box");
  assert.deepEqual(seen.slice(1), ["Stack's box", seen[0]]);
});

test("stack speaker edit: signed out, Return to Stack changes only the Stack's copy and goes back", async () => {
  const design = sharedStack("doc1");
  const held = design.speakers[0];
  const edited = { ...held, name: "Edited box" };
  let stackNow = design;
  const pages: string[] = [];
  let closed = false;
  const notices: StackEditNoticeProps[] = [];
  runSteps(
    () =>
      useStackSpeakerEdit({
        speakerPage: {
          spec: edited,
          store: { ...memoryStore().store, db: null, cfgMsg: "" },
          stackEditView: {
            edit: { stackName: design.stack.name, speakerId: held.id },
            open: () => {},
            close: () => {
              closed = true;
            },
          },
        },
        stack: {
          design,
          editDesign: (edit) => (stackNow = typeof edit === "function" ? edit(stackNow) : edit),
        },
        goTo: (page) => pages.push(page),
      }),
    [(hook) => void (hook.notice && notices.push(hook.notice))],
  );
  const [shown] = notices;
  assert.ok(shown);
  assert.equal(shown.canSave, false);
  shown.onSave();
  await Promise.resolve();
  assert.deepEqual(pages, ["stack"]);
  assert.ok(closed);
  assert.deepEqual(
    stackNow.stack.members.slice(0, 2).map((m) => m.speakerId),
    ["doc1", "doc1"],
  );
  assert.equal(stackNow.speakers.find((s) => s.id === "doc1")?.name, "Edited box");
});
