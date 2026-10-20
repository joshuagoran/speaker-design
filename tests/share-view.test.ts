// The shared view (src/hooks/usePageDraft, src/pages/share): a link's design shows in place of the page's own and never
// writes its draft; a reload keeps it; "Save a copy" gives every item a new id, keeps what names what, and replaces
// no saved item.
import { afterEach, test } from "vite-plus/test";
import assert from "node:assert";
import { runSteps } from "./render-steps";
import {
  readShared,
  sharedChanged,
  withEdit,
  withShared,
  withSharedSaved,
  withoutShared,
  type DraftState,
} from "../src/hooks/usePageDraft";
import { PAGE_DRAFT_KEYS, PAGE_SHARED_KEYS } from "../src/constants/pageDrafts";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { STACK_PRESETS, presetLayers } from "../src/pages/stack/stackPresets";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { speakerDraft } from "../src/pages/speaker/useSpeakerPage";
import { stackDraft, stackFromSaved, stackSnapshot } from "../src/pages/stack/stackSaves";
import { spaceDraft, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { spaceFromStart, useSpace } from "../src/pages/space/useSpace";
import { remapSpace, remapSpeaker, remapStack } from "../src/lib/io/remapIds";
import { saveSpaceCopy, saveSpeakerCopy, saveStackCopy } from "../src/pages/share/saveCopy";
import { clearPageDrafts, clearSharedViews } from "../src/lib/savedDraft";
import type { SavedConfigData, SpaceDesign, StackDesign } from "../src/types";

/** Session and local storage as these tests set them: maps that record what is written. */
function useStorages(local: Record<string, string>, session: Record<string, string>) {
  const writes: string[] = [];
  const area = (items: Record<string, string>, label: string) => ({
    getItem: (k: string) => items[k] ?? null,
    setItem: (k: string, v: string) => {
      writes.push(`${label}:${k}`);
      items[k] = v;
    },
    removeItem: (k: string) => {
      writes.push(`${label}:${k}`);
      Reflect.deleteProperty(items, k);
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: area(local, "local"),
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: area(session, "session"),
    configurable: true,
  });
  return writes;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "sessionStorage");
});

const PRESET = STACK_PRESETS[0] ?? "paStack";
const SPACE: SpaceDesign = spaceFromStart(PRESET);
const STACK: StackDesign = {
  stack: presetLayers(PRESET, { id: "draft", name: "A stack" }).stack,
  speakers: presetLayers(PRESET, { id: "draft", name: "A stack" }).speakers,
};

/** A value as a store keeps it: through JSON (undefined fields gone). */
const throughJson = <T>(v: T): T => JSON.parse(JSON.stringify(v));

test("a shared view holds a design and leaves the page's own, and so its draft, as it was", () => {
  const own = spaceFromStart(PRESET);
  const start: DraftState<SpaceDesign> = { own, shared: null };
  const opened = withShared(start, SPACE, "Bass is boomy");
  assert.equal(opened.own, own, "the own design is the same value, so no draft is written");
  assert.equal(opened.shared?.note, "Bass is boomy");
  // every change goes to the shared design
  const edited = withEdit(opened, (d) => ({ ...d, space: { ...d.space, name: "Fixed" } }));
  assert.equal(edited.own, own);
  assert.equal(edited.shared?.design.space.name, "Fixed");
  assert.equal(edited.shared?.original.space.name, SPACE.space.name);
  const replaced = withEdit(edited, SPACE);
  assert.equal(replaced.own, own);
  assert.equal(replaced.shared?.design, SPACE);
  // closing is back to the own design, unchanged
  const closed = withoutShared(edited);
  assert.equal(closed.own, own);
  assert.equal(closed.shared, null);
  // with no shared view, a change is the own design's
  const own2 = withEdit(closed, (d) => ({ ...d, space: { ...d.space, name: "Mine" } }));
  assert.equal(own2.own.space.name, "Mine");
  assert.equal(own2.shared, null);
});

test("the shared view tells a change, and a copy saved counts as the new start", () => {
  const draft = spaceDraft;
  const opened = withShared<SpaceDesign>({ own: spaceFromStart(PRESET), shared: null }, SPACE, "");
  assert.ok(opened.shared);
  assert.equal(sharedChanged(draft, opened.shared), false);
  const edited = withEdit(opened, (d) => ({ ...d, space: { ...d.space, name: "Fixed" } }));
  assert.ok(edited.shared);
  assert.equal(sharedChanged(draft, edited.shared), true);
  const saved = withSharedSaved(edited);
  assert.ok(saved.shared);
  assert.equal(sharedChanged(draft, saved.shared), false);
  assert.equal(saved.shared.design, edited.shared.design);
  // a change back is no change
  const back = withEdit(edited, SPACE);
  assert.ok(back.shared);
  assert.equal(sharedChanged(draft, back.shared), false);
});

test("a reload keeps the shared view, and the page's own draft stays", () => {
  const own: SpaceDesign = {
    ...spaceFromStart(PRESET),
    space: { ...SPACE.space, id: "mine", name: "Mine" },
  };
  const shared: SpaceDesign = { ...SPACE, space: { ...SPACE.space, name: "Their room" } };
  const local = { [PAGE_DRAFT_KEYS.space]: JSON.stringify(spaceDraft.toDraft(own)) };
  const session = {
    [PAGE_SHARED_KEYS.space]: JSON.stringify({
      note: "Bass is boomy",
      design: spaceDraft.toDraft(shared),
      original: spaceDraft.toDraft(SPACE),
    }),
  };
  const before = { ...local };
  const writes = useStorages(local, session);
  let name = "";
  let note: string | null = "";
  let changed = false;
  runSteps(useSpace, [
    (page) => {
      name = page.design.space.name;
      note = page.sharedView.note;
      changed = page.sharedView.changed();
    },
  ]);
  assert.equal(name, "Their room");
  assert.equal(note, "Bass is boomy");
  assert.equal(changed, true, "the change made before the reload is still a change");
  assert.deepEqual(local, before, "the draft is as it was");
  assert.ok(!writes.some((w) => w.startsWith("local:")), writes.join());
});

test("with no shared view stored, a page shows its own design; a broken one is dropped", () => {
  const local = { [PAGE_DRAFT_KEYS.space]: JSON.stringify(spaceDraft.toDraft(SPACE)) };
  const sessions: Record<string, string>[] = [
    {},
    { [PAGE_SHARED_KEYS.space]: "{not json" },
    { [PAGE_SHARED_KEYS.space]: JSON.stringify({ note: 5, design: {}, original: {} }) },
    { [PAGE_SHARED_KEYS.space]: JSON.stringify({ note: "", design: null, original: null }) },
    { [PAGE_SHARED_KEYS.space]: JSON.stringify(null) },
  ];
  for (const session of sessions) {
    useStorages({ ...local }, { ...session });
    assert.equal(readShared(spaceDraft), null);
    let note: string | null = "x";
    runSteps(useSpace, [
      (page) => {
        note = page.sharedView.note;
      },
    ]);
    assert.equal(note, null);
  }
  // storage that is missing is no matter
  Reflect.deleteProperty(globalThis, "sessionStorage");
  assert.equal(readShared(spaceDraft), null);
});

test("each page keeps its shared view under its own session key, never the draft's", () => {
  const drafts = [speakerDraft, stackDraft, spaceDraft];
  assert.equal(new Set(drafts.map((d) => d.sharedKey)).size, 3);
  for (const d of drafts) {
    assert.ok(!Object.values(PAGE_DRAFT_KEYS).includes(d.sharedKey as never), d.sharedKey);
    assert.notEqual(d.sharedKey, d.key);
  }
});

test("clearing the drafts clears the shared views too", () => {
  const local = { [PAGE_DRAFT_KEYS.space]: "{}" };
  const session = { [PAGE_SHARED_KEYS.space]: "{}", [PAGE_SHARED_KEYS.stack]: "{}" };
  useStorages(local, session);
  clearPageDrafts();
  assert.deepEqual(local, {});
  assert.deepEqual(session, {});
});

test("clearing the shared views leaves the drafts, and says whether there was one", () => {
  const local = { [PAGE_DRAFT_KEYS.space]: "{}" };
  const session = { [PAGE_SHARED_KEYS.space]: "{}" };
  useStorages(local, session);
  assert.equal(clearSharedViews(), true);
  assert.deepEqual(session, {});
  assert.deepEqual(local, { [PAGE_DRAFT_KEYS.space]: "{}" });
  assert.equal(clearSharedViews(), false);
});

// ---- New ids ----

/** The ids a design holds, every item's. */
const idsOf = (d: SpaceDesign) => [
  d.space.id,
  ...d.stacks.map((s) => s.id),
  ...d.speakers.map((s) => s.id),
];

/** The design with every id set to "x": two designs that differ only in their ids are equal then. */
function withoutIds(d: SpaceDesign): unknown {
  const text = JSON.stringify(d);
  let out = text;
  for (const id of idsOf(d)) out = out.split(`"${id}"`).join('"x"');
  return JSON.parse(out);
}

/** A counter's ids: "n1", "n2"... */
const counter = () => {
  let n = 0;
  return () => `n${++n}`;
};

test("new ids for a space: every item has its own, and what names an item follows it", () => {
  const before = JSON.stringify(SPACE);
  const copy = remapSpace(SPACE, counter());
  assert.equal(JSON.stringify(SPACE), before, "the design is not changed");
  const ids = idsOf(copy);
  assert.equal(new Set(ids).size, ids.length, "no two items share an id");
  for (const id of ids) assert.ok(!idsOf(SPACE).includes(id), `${id} is new`);
  const stackIds = copy.stacks.map((s) => s.id);
  const speakerIds = copy.speakers.map((s) => s.id);
  for (const stack of copy.stacks)
    for (const member of stack.members)
      assert.ok(speakerIds.includes(member.speakerId), `a member of ${stack.name} names a speaker`);
  assert.ok(copy.space.placements.length > 0);
  for (const p of copy.space.placements)
    assert.ok(
      (p.item.kind === SPACE_ITEM.stack ? stackIds : speakerIds).includes(p.item.id),
      "a placement names its item",
    );
  // nothing else changed: the same names, numbers and places
  assert.deepStrictEqual(withoutIds(copy), withoutIds(SPACE));
});

test("new ids for a space that places a speaker on its own and a stack that shares it", () => {
  const stack = SPACE.stacks[0];
  const [first] = SPACE.speakers;
  const [placement] = SPACE.space.placements;
  assert.ok(stack && first && placement);
  const mixed: SpaceDesign = {
    ...SPACE,
    space: {
      ...SPACE.space,
      placements: [
        placement,
        { ...placement, item: { kind: SPACE_ITEM.speaker, id: first.id }, mirrored: false },
      ],
    },
  };
  const copy = remapSpace(mixed, counter());
  const [stackPlace, speakerPlace] = copy.space.placements;
  assert.ok(stackPlace && speakerPlace);
  assert.ok(copy.stacks.some((s) => s.id === stackPlace.item.id));
  const speaker = copy.speakers.find((s) => s.id === speakerPlace.item.id);
  assert.equal(speaker?.name, first.name);
  // the speaker the stack names and the one placed alone are one item, with one new id
  assert.ok(copy.stacks.some((s) => s.members.some((m) => m.speakerId === speakerPlace.item.id)));
});

test("new ids for a stack and for a speaker", () => {
  const copy = remapStack(STACK, counter());
  const ids = [copy.stack.id, ...copy.speakers.map((s) => s.id)];
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(!["draft", ...STACK.speakers.map((s) => s.id)].includes(id));
  for (const m of copy.stack.members) assert.ok(copy.speakers.some((s) => s.id === m.speakerId));
  assert.equal(copy.stack.members.length, STACK.stack.members.length);
  const speaker = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const again = remapSpeaker(speaker, counter());
  assert.notEqual(again.id, speaker.id);
  assert.deepStrictEqual({ ...again, id: speaker.id }, speaker);
});

// ---- Save a copy ----

/** A library that records what is written to it: its id, name and data, in order. */
function fakeLibrary(failAt = Infinity) {
  const written: { id: string; name: string; data: SavedConfigData }[] = [];
  return {
    written,
    overwrite: async (id: string, name: string, data: SavedConfigData) => {
      if (written.length >= failAt) return false;
      written.push({ id, name, data });
      return true;
    },
  };
}

test("save a copy of a space: a Space, each Stack and each Speaker, all under new ids", async () => {
  const before = JSON.stringify(SPACE);
  const [speakers, stacks, spaces] = [fakeLibrary(), fakeLibrary(), fakeLibrary()];
  assert.ok(await saveSpaceCopy(SPACE, { speakers, stacks, spaces }, counter()));
  assert.equal(JSON.stringify(SPACE), before, "the shared design is not changed");
  assert.equal(spaces.written.length, 1);
  assert.equal(stacks.written.length, SPACE.stacks.length);
  assert.equal(speakers.written.length, SPACE.speakers.length);
  const taken = idsOf(SPACE);
  const all = [...spaces.written, ...stacks.written, ...speakers.written];
  assert.equal(new Set(all.map((w) => w.id)).size, all.length, "every item is a new document");
  for (const w of all) assert.ok(!taken.includes(w.id), `${w.id} replaces nothing`);
  // the saved space opens, and its stacks and speakers are the saved ones
  const [space] = spaces.written;
  assert.ok(space);
  const opened = spaceFromSaved({ id: space.id, name: space.name, ...space.data });
  assert.ok(opened);
  assert.deepStrictEqual(
    opened.stacks.map((s) => s.id).sort(),
    stacks.written.map((w) => w.id).sort(),
  );
  assert.deepStrictEqual(
    opened.speakers.map((s) => s.id).sort(),
    speakers.written.map((w) => w.id).sort(),
  );
  assert.deepStrictEqual(
    withoutIds(opened),
    throughJson(withoutIds({ ...SPACE, ...usedOf(SPACE) })),
  );
  // a saved stack names the saved speakers, and a saved space is what the copy holds
  for (const w of stacks.written) {
    const members = JSON.stringify(Reflect.get(w.data, "stack"));
    assert.ok(speakers.written.some((x) => members.includes(`"${x.id}"`)));
  }
  assert.deepStrictEqual(spaceSnapshot(opened), space.data);
});

/** What a space keeps of its lists when it is saved. */
const usedOf = (d: SpaceDesign) => ({ stacks: d.stacks, speakers: d.speakers });

test("save a copy of a stack and of a speaker", async () => {
  const [speakers, stacks, spaces] = [fakeLibrary(), fakeLibrary(), fakeLibrary()];
  assert.ok(await saveStackCopy(STACK, { speakers, stacks, spaces }, counter()));
  assert.equal(spaces.written.length, 0);
  assert.equal(stacks.written.length, 1);
  assert.equal(speakers.written.length, STACK.speakers.length);
  const [saved] = stacks.written;
  assert.ok(saved);
  const opened = stackFromSaved({ id: saved.id, name: saved.name, ...saved.data });
  assert.ok(opened);
  assert.deepStrictEqual(stackSnapshot(opened), saved.data);
  assert.deepStrictEqual(
    opened.speakers.map((s) => s.id).sort(),
    speakers.written.map((w) => w.id).sort(),
  );
  for (const w of [...stacks.written, ...speakers.written])
    assert.ok(!["draft", ...STACK.speakers.map((s) => s.id)].includes(w.id));
  const one = fakeLibrary();
  const speaker = templateSpeaker(SPEAKER_TEMPLATE.th18);
  assert.ok(await saveSpeakerCopy(speaker, { speakers: one, stacks, spaces }, counter()));
  assert.equal(one.written.length, 1);
  assert.notEqual(one.written[0]?.id, speaker.id);
  assert.equal(one.written[0]?.name, speaker.name);
});

test("a copy that fails stops there: nothing later is written, and the answer is no", async () => {
  const [speakers, stacks, spaces] = [fakeLibrary(1), fakeLibrary(), fakeLibrary()];
  assert.equal(await saveSpaceCopy(SPACE, { speakers, stacks, spaces }, counter()), false);
  assert.equal(speakers.written.length, 1);
  assert.equal(stacks.written.length, 0);
  assert.equal(
    spaces.written.length,
    0,
    "the space is saved last, so it never points at a missing item",
  );
});
