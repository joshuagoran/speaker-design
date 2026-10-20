// The saving row's actions (src/components/saved-configs/saveActions) on a store held in memory: Save updates the save
// the design is open in, or makes one; Save as always makes one, under a free name; deleting the open save closes it.
// The pages' starts are new designs (open in no save), and a page's draft keeps the save it is open in.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  deleteSave,
  freeName,
  nameAfterRename,
  oneAtATime,
  openSave,
  saveDesign,
  saveDesignAs,
} from "../src/components/saved-configs/saveActions";
import type { ConfigStore } from "../src/components/saved-configs/useConfigStore";
import { SAVE_ROW_TEXT } from "../src/constants/saveRow";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { EMPTY_START } from "../src/constants/stackPresets";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import {
  DRAFT_SPEAKER_ID,
  speakerDraft,
  useSpeakerPage,
} from "../src/pages/speaker/useSpeakerPage";
import { STACK_PRESETS, designStartOptions, stackFromStart } from "../src/pages/stack/stackPresets";
import { DRAFT_STACK_ID, stackDraft } from "../src/pages/stack/stackSaves";
import { useStack } from "../src/pages/stack/useStack";
import { DRAFT_SPACE_ID, spaceDraft } from "../src/pages/space/spaceSaves";
import { spaceFromStart, useSpace } from "../src/pages/space/useSpace";
import { runSteps } from "./render-steps";
import type { SavedConfig } from "../src/types";

/**
 * A store held in memory: its saves, and the writes the row makes. `fails` makes every write fail; the list (`saved`)
 * holds the newest `listed` saves, as the real store holds the newest 50; `whileWriting` runs inside each write.
 */
function memoryStore(fails = false, listed = Infinity, whileWriting = () => {}) {
  let made = 0;
  let docs: SavedConfig[] = [];
  const store: Pick<ConfigStore, "saved" | "create" | "overwrite" | "exists" | "remove"> = {
    saved: [],
    create: async (name, data) => {
      whileWriting();
      if (fails) return null;
      const id = `doc${++made}`;
      docs = [...docs, { ...data, id, name }];
      store.saved = docs.slice(-listed);
      return id;
    },
    overwrite: async (id, name, data) => {
      whileWriting();
      if (fails) return false;
      docs = docs.map((c) => (c.id === id ? { ...data, id, name } : c));
      store.saved = docs.slice(-listed);
      return true;
    },
    exists: async (id) => (fails ? null : docs.some((c) => c.id === id)),
    remove: async (id) => {
      if (fails) return false;
      docs = docs.filter((c) => c.id !== id);
      store.saved = docs.slice(-listed);
      return true;
    },
  };
  return { store, all: () => docs };
}

/** The save under `id`. */
const saveOf = (store: Pick<ConfigStore, "saved">, id: string): SavedConfig | undefined =>
  store.saved?.find((c) => c.id === id);

test("Save with no save open makes one, which the design is then open in", async () => {
  const { store } = memoryStore();
  const id = await saveDesign(store, DRAFT_SPEAKER_ID, "Bookshelf", { summary: "first" });
  assert.ok(id);
  assert.equal(store.saved?.length, 1);
  assert.deepEqual(openSave(store.saved, id), { summary: "first", id, name: "Bookshelf" });
});

test("Save with a save open updates that save: the count stays, and it holds the edit and the name", async () => {
  const { store } = memoryStore();
  const id = await saveDesign(store, DRAFT_STACK_ID, "Left", { summary: "first" });
  assert.ok(id);
  await saveDesign(store, DRAFT_STACK_ID, "Other", { summary: "other" });
  assert.equal(await saveDesign(store, id, "Left side", { summary: "edited" }), id);
  assert.equal(store.saved?.length, 2);
  assert.deepEqual(saveOf(store, id), { summary: "edited", id, name: "Left side" });
});

test("Save with the open save deleted elsewhere makes a new one", async () => {
  const { store } = memoryStore();
  const id = await saveDesign(store, DRAFT_SPACE_ID, "Hall", {});
  assert.ok(id);
  await store.remove(id);
  const again = await saveDesign(store, id, "Hall", {});
  assert.ok(again && again !== id);
  assert.equal(store.saved?.length, 1);
});

test("Save as always makes a new save, under a free name, and a failed write opens none", async () => {
  const { store } = memoryStore();
  const id = await saveDesign(store, DRAFT_SPEAKER_ID, "Sub", { summary: "a" });
  assert.ok(id);
  const copy = await saveDesignAs(store, id, "Sub", { summary: "b" });
  assert.ok(copy);
  assert.notEqual(copy.id, id);
  assert.equal(copy.name, SAVE_ROW_TEXT.copyName("Sub"));
  assert.equal(store.saved?.length, 2);
  assert.deepEqual(saveOf(store, id), { summary: "a", id, name: "Sub" });
  const third = await saveDesignAs(store, copy.id, "Sub", {});
  assert.equal(third?.name, SAVE_ROW_TEXT.copyName(SAVE_ROW_TEXT.copyName("Sub")));
  assert.equal((await saveDesignAs(store, DRAFT_SPEAKER_ID, "Top", {}))?.name, "Top");
  assert.equal(freeName([], "Top"), "Top");
  assert.equal(await saveDesignAs(memoryStore(true).store, DRAFT_SPEAKER_ID, "Sub", {}), null);
  assert.equal(await saveDesign(memoryStore(true).store, DRAFT_SPEAKER_ID, "Sub", {}), null);
});

test("deleting the open save closes it; deleting another, or a failed delete, does not", async () => {
  const { store } = memoryStore();
  const open = await saveDesign(store, DRAFT_SPEAKER_ID, "A", {});
  const other = await saveDesign(store, DRAFT_SPEAKER_ID, "B", {});
  assert.ok(open && other);
  assert.equal(await deleteSave(store, other, open), false);
  assert.equal(store.saved?.length, 1);
  assert.equal(await deleteSave(memoryStore(true).store, open, open), false);
  assert.equal(await deleteSave(store, open, open), true);
  assert.equal(store.saved?.length, 0);
});

test("Save updates an open save past the list, or with the list not loaded, and remakes only a deleted one", async () => {
  const { store, all } = memoryStore(false, 1);
  const old = await saveDesign(store, DRAFT_SPEAKER_ID, "Old", { summary: "a" });
  await saveDesign(store, DRAFT_SPEAKER_ID, "New", {});
  assert.ok(old);
  assert.equal(openSave(store.saved, old), null);
  assert.equal(await saveDesign(store, old, "Old edited", { summary: "b" }), old);
  store.saved = null;
  assert.equal(await saveDesign(store, old, "Old again", { summary: "c" }), old);
  assert.equal(all().length, 2);
  assert.deepEqual(
    all().find((c) => c.id === old),
    { summary: "c", id: old, name: "Old again" },
  );
  await store.remove(old);
  const again = await saveDesign(store, old, "Old", {});
  assert.ok(again && again !== old);
  assert.equal(all().length, 2);
  assert.equal(await saveDesign(memoryStore(true).store, "doc9", "Old", {}), null);
});

test("a save resolving after the page opened another design leaves that design's id alone", async () => {
  let openId = DRAFT_SPACE_ID;
  const { store, all } = memoryStore(false, Infinity, () => (openId = "doc7"));
  assert.equal(await saveDesign(store, DRAFT_SPACE_ID, "Hall", {}, () => openId), null);
  openId = DRAFT_SPACE_ID;
  assert.equal(await saveDesignAs(store, DRAFT_SPACE_ID, "Hall", {}, () => openId), null);
  assert.equal(all().length, 2);
  const steady = memoryStore().store;
  assert.ok(await saveDesign(steady, DRAFT_SPACE_ID, "Hall", {}, () => DRAFT_SPACE_ID));
});

test("one store call at a time: a double click makes one save, and the row hears busy and done", async () => {
  const { store, all } = memoryStore();
  const heard: boolean[] = [];
  const run = oneAtATime((busy) => heard.push(busy));
  const save = () => run(() => saveDesign(store, DRAFT_STACK_ID, "Left", {}));
  const [first, second] = await Promise.all([save(), save()]);
  assert.ok(first);
  assert.equal(second, undefined);
  assert.equal(all().length, 1);
  assert.deepEqual(heard, [true, false]);
  assert.ok(await save());
  assert.equal(all().length, 2);
});

test("renaming the open save renames the name box only while it holds the old name", () => {
  assert.equal(nameAfterRename("Left", true, "Left", "Left side"), "Left side");
  assert.equal(nameAfterRename("Left typed", true, "Left", "Left side"), "Left typed");
  assert.equal(nameAfterRename("Left", false, "Left", "Left side"), "Left");
});

test("every start is a new design, open in no save", () => {
  const saved: SavedConfig[] = [{ id: "doc1", name: "Saved" }];
  for (const template of Object.values(SPEAKER_TEMPLATE)) {
    assert.equal(templateSpeaker(template).id, DRAFT_SPEAKER_ID);
  }
  for (const { id: start } of designStartOptions("")) {
    assert.equal(stackFromStart(start).stack.id, DRAFT_STACK_ID);
    assert.equal(spaceFromStart(start).space.id, DRAFT_SPACE_ID);
  }
  assert.equal(openSave(saved, DRAFT_SPEAKER_ID), null);
  assert.equal(stackFromStart(EMPTY_START).stack.members.length, 0);
  assert.equal(spaceFromStart(EMPTY_START).space.placements.length, 0);
});

/** A value as the browser keeps it: through JSON. */
const throughJson = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

test("a page's draft keeps the save the design is open in", () => {
  const spec = { ...templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay), id: "doc1" };
  assert.equal(speakerDraft.fromDraft(throughJson(speakerDraft.toDraft(spec)))?.id, "doc1");
  const stack = stackFromStart(STACK_PRESETS[0]);
  const openStack = { ...stack, stack: { ...stack.stack, id: "doc2" } };
  assert.equal(stackDraft.fromDraft(throughJson(stackDraft.toDraft(openStack)))?.stack.id, "doc2");
  const space = spaceFromStart(STACK_PRESETS[0]);
  const openSpace = { ...space, space: { ...space.space, id: "doc3" } };
  assert.equal(spaceDraft.fromDraft(throughJson(spaceDraft.toDraft(openSpace)))?.space.id, "doc3");
});

test("each page sets and clears the save its design is open in, and keeps the design", () => {
  const ids: string[] = [];
  runSteps(useSpeakerPage, [
    (page) => page.setOpenId("doc1"),
    (page) => {
      ids.push(page.spec.id);
      page.setOpenId(null);
    },
    (page) => ids.push(page.spec.id),
  ]);
  runSteps(useStack, [
    (page) => page.setOpenId("doc2"),
    (page) => {
      ids.push(page.design.stack.id);
      page.setOpenId(null);
    },
    (page) => ids.push(page.design.stack.id),
  ]);
  runSteps(useSpace, [
    (page) => page.setOpenId("doc3"),
    (page) => {
      ids.push(page.design.space.id);
      page.setOpenId(null);
    },
    (page) => ids.push(page.design.space.id),
  ]);
  assert.deepEqual(ids, ["doc1", DRAFT_SPEAKER_ID, "doc2", DRAFT_STACK_ID, "doc3", DRAFT_SPACE_ID]);
});
