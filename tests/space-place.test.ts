// The Space page's Place list (src/pages/space/placeOptions) and placing from it (useSpace withItemPlaced): a preset, a
// template, the stack open now and the speaker open now each add a placement with their speakers, with nothing saved.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { emptySpace } from "../src/pages/space/spaceSaves";
import { placeOptions, type PlaceOption, type PlaceSources } from "../src/pages/space/placeOptions";
import { withItemPlaced } from "../src/pages/space/useSpace";
import { emptyStack } from "../src/pages/stack/stackSaves";
import { STACK_PRESETS, presetLayers } from "../src/pages/stack/stackPresets";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { emptySpeaker } from "../src/pages/speaker/useSpeakerPage";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { STACK_START_DESIGN_NAMES } from "../src/constants/stackPresets";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { PLACE_ID, PLACE_ID_PREFIX, SPACE_TEXT } from "../src/constants/space";
import type { SpaceDesign } from "../src/types";

/** Nothing open and nothing saved: what a signed-out visitor has. */
const NOTHING: PlaceSources = {
  openStack: emptyStack(),
  openSpeaker: emptySpeaker(),
  savedStacks: [],
  savedSpeakers: [],
};

/** The option with this id. */
function optionOf(options: readonly PlaceOption[], id: string): PlaceOption {
  const found = options.find((o) => o.id === id);
  if (!found) throw new Error(`No Place option ${id}`);
  return found;
}

/** The stack preset's layers under the id the Place list gives it. */
const presetOf = (preset: (typeof STACK_PRESETS)[number]) =>
  presetLayers(preset, { id: preset, name: STACK_START_DESIGN_NAMES[preset] });

/** The space with one choice placed, and its new placement. */
function placed(options: readonly PlaceOption[], id: string, from: SpaceDesign = emptySpace()) {
  const next = withItemPlaced(from, optionOf(options, id).item());
  return { next, placement: next.space.placements[from.space.placements.length] };
}

test("place list: with nothing open or saved it lists every stack preset and every speaker template but the empty one", () => {
  const options = placeOptions(NOTHING);
  const ids = options.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    options.filter((o) => o.group === SPACE_TEXT.placeGroups.stackPresets).length,
    STACK_PRESETS.length,
  );
  const templates = options.filter((o) => o.group === SPACE_TEXT.placeGroups.speakerTemplates);
  assert.equal(templates.length, SPEAKER_TEMPLATES.length - 1);
  assert.ok(!ids.some((id) => id.endsWith(SPEAKER_TEMPLATE.empty)));
  // an empty stack and an empty speaker are open, so there is no "Open now" group
  assert.ok(!options.some((o) => o.group === SPACE_TEXT.placeGroups.open));
  assert.ok(!options.some((o) => o.group === SPACE_TEXT.placeGroups.savedStacks));
});

test("place list: every stack preset places its stack with all its speakers", () => {
  const options = placeOptions(NOTHING);
  for (const preset of STACK_PRESETS) {
    const layers = presetOf(preset);
    const { next, placement } = placed(options, `${PLACE_ID_PREFIX.stackPreset}${preset}`);
    assert.equal(next.space.placements.length, 1, preset);
    assert.deepEqual(placement.item, { kind: SPACE_ITEM.stack, id: layers.stack.id }, preset);
    assert.equal(next.stacks.length, 1, preset);
    assert.deepEqual(next.stacks[0].members, layers.stack.members, preset);
    assert.deepEqual(
      next.speakers.map((s) => s.id),
      layers.speakers.map((s) => s.id),
      preset,
    );
  }
});

test("place list: every speaker template places its speaker alone", () => {
  const options = placeOptions(NOTHING);
  for (const template of SPEAKER_TEMPLATES.filter((t) => t !== SPEAKER_TEMPLATE.empty)) {
    const { next, placement } = placed(options, `${PLACE_ID_PREFIX.speakerTemplate}${template}`);
    assert.deepEqual(placement.item, { kind: SPACE_ITEM.speaker, id: template }, template);
    assert.equal(next.stacks.length, 0, template);
    assert.equal(next.speakers.length, 1, template);
    assert.deepEqual(next.speakers[0], { ...templateSpeaker(template), id: template }, template);
  }
});

test("place list: the stack and the speaker open now are listed, and each places with its speakers", () => {
  const openStack = presetOf(STACK_PRESETS[0]);
  const openSpeaker = templateSpeaker(SPEAKER_TEMPLATE.fill);
  const options = placeOptions({ ...NOTHING, openStack, openSpeaker });
  const open = options.filter((o) => o.group === SPACE_TEXT.placeGroups.open);
  assert.deepEqual(
    open.map((o) => o.name),
    [SPACE_TEXT.openStack(openStack.stack.name), SPACE_TEXT.openSpeaker(openSpeaker.name)],
  );
  const stackPlaced = placed(options, PLACE_ID.openStack);
  assert.deepEqual(stackPlaced.placement.item, {
    kind: SPACE_ITEM.stack,
    id: openStack.stack.id,
  });
  assert.equal(stackPlaced.next.speakers.length, openStack.speakers.length);
  const speakerPlaced = placed(options, PLACE_ID.openSpeaker);
  assert.deepEqual(speakerPlaced.placement.item, {
    kind: SPACE_ITEM.speaker,
    id: openSpeaker.id,
  });
  assert.deepEqual(speakerPlaced.next.speakers, [openSpeaker]);
});

test("place list: saved stacks and speakers are listed under the ids of their documents", () => {
  const stackDesign = presetOf(STACK_PRESETS[0]);
  const { id: _id, name: _name, ...spec } = templateSpeaker(SPEAKER_TEMPLATE.fill);
  const options = placeOptions({
    ...NOTHING,
    savedStacks: [{ id: "doc1", name: "My stack", design: stackDesign }],
    savedSpeakers: [{ id: "doc2", name: "My fill", spec }],
  });
  const stack = placed(options, `${PLACE_ID_PREFIX.savedStack}doc1`);
  assert.deepEqual(stack.placement.item, { kind: SPACE_ITEM.stack, id: "doc1" });
  const speaker = placed(options, `${PLACE_ID_PREFIX.savedSpeaker}doc2`);
  assert.deepEqual(speaker.placement.item, { kind: SPACE_ITEM.speaker, id: "doc2" });
  assert.equal(speaker.next.speakers[0].name, "My fill");
});

test("place list: placing again adds another placement and reuses the speakers it holds", () => {
  const options = placeOptions(NOTHING);
  const once = placed(options, `${PLACE_ID_PREFIX.stackPreset}paStack`).next;
  const twice = placed(options, `${PLACE_ID_PREFIX.stackPreset}paStack`, once).next;
  assert.equal(twice.space.placements.length, 2);
  assert.equal(twice.stacks.length, 1);
  assert.equal(twice.speakers.length, once.speakers.length);
});
