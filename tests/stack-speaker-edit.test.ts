// A Stack's speaker edited on the Speaker page (src/pages/stack/stackSpeakerEdit, useStackSpeakerEdit): the edit saves
// to the library (the save under its id, or a new one), then every member that named it names the save; signed out,
// only the Stack's copy changes. The Speaker page shows the speaker in place of its own design, and goes back to it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { saveStackSpeaker, withStackSpeaker } from "../src/pages/stack/stackSpeakerEdit";
import { useStackSpeakerEdit } from "../src/pages/stack/useStackSpeakerEdit";
import { stackFromStart } from "../src/pages/stack/stackPresets";
import { useState } from "react";
import { DRAFT_SPEAKER_ID, useSpeakerPage } from "../src/pages/speaker/useSpeakerPage";
import { useStack } from "../src/pages/stack/useStack";
import { STACK_EDIT_TEXT } from "../src/constants/stackSpeakerEdit";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import type { ConfigStore } from "../src/components/saved-configs/useConfigStore";
import { SAVE_ROW_TEXT } from "../src/constants/saveRow";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { STACK_PRESET } from "../src/constants/stackPresets";
import type { StackEditNoticeProps } from "../src/pages/speaker/StackEditNotice";
import { runSteps } from "./render-steps";
import type { ConfigDb, SavedConfig, SpeakerSpec, StackDesign } from "../src/types";

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

/** A database that stands for a signed-in user: the edit hook reads only whether there is one. */
const SIGNED_IN_DB: ConfigDb = {
  collection: () => {
    throw new Error("the edit hook saves through the store");
  },
};

/** What the edit hook did: the pages it went to, the Stack's whole replaces, its messages, and the speaker page's calls. */
interface EditRun {
  stackNow: StackDesign;
  pages: string[];
  replaces: number;
  flashes: string[];
  closed: number;
  detached: string[];
  notices: StackEditNoticeProps[];
}

/**
 * Runs the edit hook for `held` (a speaker of `design`), edited as `edited`, through `steps`: each step gets the hook
 * and `rerender`, which renders it again with the Stack page's `round` given.
 */
function runEdit(
  design: StackDesign,
  held: SpeakerSpec,
  edited: SpeakerSpec,
  signedIn: { store: ReturnType<typeof memoryStore>["store"] } | null,
  steps: ((
    hook: ReturnType<typeof useStackSpeakerEdit>,
    rerender: (round: number) => void,
  ) => void)[],
): EditRun {
  const result: EditRun = {
    stackNow: design,
    pages: [],
    replaces: 0,
    flashes: [],
    closed: 0,
    detached: [],
    notices: [],
  };
  const edit = { stackName: design.stack.name, speakerId: held.id };
  let open = true;
  runSteps(
    () => {
      const [round, setRound] = useState(0);
      const hook = useStackSpeakerEdit({
        speakerPage: {
          spec: edited,
          store: {
            ...(signedIn?.store ?? memoryStore().store),
            db: signedIn ? SIGNED_IN_DB : null,
            cfgMsg: "",
          },
          stackEditView: {
            edit: open ? edit : null,
            isOpen: (e) => open && e === edit,
            open: () => {},
            close: () => {
              if (open) result.closed++;
              open = false;
            },
            detachOwn: (id) => result.detached.push(id),
          },
        },
        stack: {
          design,
          round,
          setDesign: (next) => {
            result.replaces++;
            result.stackNow = typeof next === "function" ? next(result.stackNow) : next;
          },
          store: { flash: (m) => result.flashes.push(m) },
        },
        goTo: (page) => result.pages.push(page),
      });
      if (hook.notice) result.notices.push(hook.notice);
      return { hook, rerender: setRound };
    },
    steps.map(
      (step) =>
        ({
          hook,
          rerender,
        }: {
          hook: ReturnType<typeof useStackSpeakerEdit>;
          rerender: (round: number) => void;
        }) =>
          step(hook, rerender),
    ),
  );
  return result;
}

/** Lets the save's awaits finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("stack speaker edit: signed out, Return to Stack changes only the Stack's copy and goes back", async () => {
  const design = sharedStack("doc1");
  const held = design.speakers[0];
  const run = runEdit(design, held, { ...held, name: "Edited box" }, null, [() => {}]);
  const [shown] = run.notices;
  assert.ok(shown);
  assert.equal(shown.canSave, false);
  shown.onSave();
  await settle();
  assert.deepEqual(run.pages, ["stack"]);
  assert.equal(run.closed, 1);
  // a whole replace: the members now name the saved speaker's id
  assert.equal(run.replaces, 1);
  assert.deepEqual(
    run.stackNow.stack.members.slice(0, 2).map((m) => m.speakerId),
    ["doc1", "doc1"],
  );
  assert.equal(run.stackNow.speakers.find((s) => s.id === "doc1")?.name, "Edited box");
  // nothing saved: the own design keeps its id
  assert.deepEqual(run.detached, []);
});

test("stack speaker edit: signed in, the own design with the save's id is detached", async () => {
  const design = sharedStack("doc1");
  const held = design.speakers[0];
  const { store, writes } = memoryStore([{ id: "doc1", name: held.name }]);
  const run = runEdit(design, held, { ...held, name: "Edited box" }, { store }, [() => {}]);
  run.notices[0]?.onSave();
  await settle();
  assert.deepEqual(writes, ["overwrite doc1"]);
  assert.deepEqual(run.detached, ["doc1"]);
  assert.deepEqual(run.pages, ["stack"]);
});

test("stack speaker edit: a Stack without the speaker is not changed, and the Stack page says so", async () => {
  const design = preset();
  const gone = { ...templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay), id: "gone" };
  const { store, writes } = memoryStore();
  const run = runEdit(design, gone, gone, { store }, [() => {}]);
  run.notices[0]?.onSave();
  await settle();
  // saved to the library, but the Stack stays as it was
  assert.deepEqual(writes, ["create new1"]);
  assert.equal(run.replaces, 0);
  assert.equal(run.stackNow, design);
  assert.deepEqual(run.flashes, [STACK_EDIT_TEXT.boxRemoved(gone.name, true)]);
  assert.deepEqual(run.pages, ["stack"]);
});

test("stack speaker edit: another stack on the Stack page ends the edit; a save that resolves after goes nowhere", async () => {
  const design = sharedStack("doc1");
  const held = design.speakers[0];
  let save: (() => void) | undefined;
  const run = runEdit(design, held, held, null, [
    (hook, rerender) => {
      save = hook.notice?.onSave;
      rerender(1);
    },
    // the round's render ends the edit and renders again
    () => {},
    (hook) => assert.equal(hook.notice, null),
  ]);
  assert.equal(run.closed, 1);
  save?.();
  await settle();
  assert.deepEqual(run.pages, []);
  assert.equal(run.replaces, 0);
});

test("stack speaker edit: the edit has its own slot, so a link's speaker is back after it", () => {
  const linked = { ...templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay), name: "Linked box" };
  const stackSpeaker = { ...preset().speakers[0], name: "Stack's box" };
  const seen: string[] = [];
  runSteps(useSpeakerPage, [
    (page) => page.sharedView.open(linked),
    (page) => {
      seen.push(page.spec.name);
      page.stackEditView.open(stackSpeaker, { stackName: "My Stack", speakerId: stackSpeaker.id });
    },
    (page) => {
      seen.push(page.spec.name);
      page.setSpec({ ...page.spec, name: "Stack's box, edited" });
    },
    (page) => {
      seen.push(page.spec.name);
      page.stackEditView.close();
    },
    (page) => {
      seen.push(page.spec.name);
      assert.equal(page.sharedView.active, true);
      assert.equal(page.stackEditView.edit, null);
    },
  ]);
  assert.deepEqual(seen, ["Linked box", "Stack's box", "Stack's box, edited", "Linked box"]);
});

test("stack speaker edit: detaching gives the own design the draft id only where it has the save's id", () => {
  const ids: string[] = [];
  runSteps(useSpeakerPage, [
    (page) => page.setOpenId("doc1"),
    (page) => page.stackEditView.detachOwn("doc2"),
    (page) => {
      ids.push(page.spec.id);
      page.stackEditView.detachOwn("doc1");
    },
    (page) => ids.push(page.spec.id),
  ]);
  assert.deepEqual(ids, ["doc1", DRAFT_SPEAKER_ID]);
});

test("stack speaker edit: a whole replace of the Stack starts its optimizer over", () => {
  const rounds: number[] = [];
  runSteps(useStack, [
    (stack) => {
      rounds.push(stack.round);
      stack.setDesign((d) => d);
    },
    (stack) => rounds.push(stack.round),
  ]);
  assert.deepEqual(rounds, [0, 1]);
});
