// The pages' working designs kept in the browser (src/hooks/usePageDraft): a valid draft is restored, an invalid one is
// dropped, storage that throws leaves the page on its empty design, and the Speaker, Stack and Space pages read back a
// changed design.
import { afterEach, test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { runSteps } from "./render-steps";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { readDraft, usePageDraft, type PageDraft } from "../src/hooks/usePageDraft";
import { PAGE_DRAFT_KEYS } from "../src/constants/pageDrafts";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { speakerDraft, useSpeakerPage } from "../src/pages/speaker/useSpeakerPage";
import { stackDraft } from "../src/pages/stack/stackSaves";
import { useStack } from "../src/pages/stack/useStack";
import { spaceDraft } from "../src/pages/space/spaceSaves";
import { useSpace } from "../src/pages/space/useSpace";

/** The browser's storage, as these tests set it: a map, or a store that throws. */
function useStorage(items: Record<string, string>, throws = false) {
  const store = {
    getItem: (k: string) => {
      if (throws) throw new Error("storage is off");
      return items[k] ?? null;
    },
    setItem: (k: string, v: string) => {
      if (throws) throw new Error("storage is off");
      items[k] = v;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

/** A draft of a number: stored as `{ n }`, read back only when `n` is a number. */
const counter: PageDraft<number> = {
  key: "test.draft",
  empty: () => 0,
  toDraft: (n) => ({ n }),
  fromDraft: (raw) => {
    const n: unknown = typeof raw === "object" && raw !== null ? Reflect.get(raw, "n") : null;
    return typeof n === "number" ? n : null;
  },
};

/** The design the hook starts a page on. */
function startedOn<T>(draft: PageDraft<T>): T {
  let first: T | undefined;
  runSteps(
    () => usePageDraft(draft),
    [
      ([design]) => {
        first = design;
      },
    ],
  );
  assert.ok(first !== undefined);
  return first;
}

test("a valid draft is restored", () => {
  useStorage({ [counter.key]: JSON.stringify({ n: 7 }) });
  assert.equal(startedOn(counter), 7);
});

test("a draft that does not parse or fit is dropped for the empty design", () => {
  useStorage({ [counter.key]: "{not json" });
  assert.equal(readDraft(counter), 0);
  useStorage({ [counter.key]: JSON.stringify({ n: "seven" }) });
  assert.equal(readDraft(counter), 0);
  useStorage({ [counter.key]: JSON.stringify(null) });
  assert.equal(readDraft(counter), 0);
  useStorage({ [counter.key]: JSON.stringify({ n: 1 }) });
  const throwing: PageDraft<number> = {
    ...counter,
    fromDraft: () => {
      throw new Error("a shape from before");
    },
  };
  assert.equal(readDraft(throwing), 0);
});

test("storage that is empty or throws leaves the empty design", () => {
  useStorage({});
  assert.equal(startedOn(counter), 0);
  useStorage({}, true);
  assert.equal(startedOn(counter), 0);
  Reflect.deleteProperty(globalThis, "localStorage");
  assert.equal(startedOn(counter), 0);
});

/** A PA design's layers, so the stack and the space hold members, placements and speakers. */
const paLayers = () =>
  layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);

/** A value as a store keeps it: through JSON (undefined fields gone). */
const throughJson = <T>(v: T): T => JSON.parse(JSON.stringify(v));

test("the Speaker page's changed design is read back", () => {
  const changed = {
    ...templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay),
    id: "saved1",
    name: "Bookshelf",
  };
  const items: Record<string, string> = {};
  useStorage(items);
  items[PAGE_DRAFT_KEYS.speaker] = JSON.stringify(speakerDraft.toDraft(changed));
  let read: unknown;
  runSteps(useSpeakerPage, [
    (page) => {
      read = page.spec;
    },
  ]);
  assert.deepEqual(read, throughJson(changed));
});

test("the Stack page's changed design is read back", () => {
  const { stack, speakers } = paLayers();
  const changed = { stack: { ...stack, name: "Left side", notes: "on the stage" }, speakers };
  const items: Record<string, string> = {};
  useStorage(items);
  items[PAGE_DRAFT_KEYS.stack] = JSON.stringify(stackDraft.toDraft(changed));
  let read: unknown;
  runSteps(useStack, [
    (page) => {
      read = page.design;
    },
  ]);
  assert.deepEqual(read, throughJson(changed));
});

test("the Space page's changed design is read back", () => {
  const { space, stack, speakers } = paLayers();
  const changed = { space: { ...space, name: "Hall" }, stacks: [stack], speakers };
  const items: Record<string, string> = {};
  useStorage(items);
  items[PAGE_DRAFT_KEYS.space] = JSON.stringify(spaceDraft.toDraft(changed));
  let read: unknown;
  runSteps(useSpace, [
    (page) => {
      read = page.design;
    },
  ]);
  assert.deepEqual(read, throughJson(changed));
});
