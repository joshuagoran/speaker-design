// The Space page with nothing placed (a new page, the empty start, the last placement removed): the default living room,
// quiet, with the room's map, 3D view and listener drawn and no level text that reads NaN or -Infinity.
import { afterEach, test } from "vite-plus/test";
import assert from "node:assert";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { SpacePage } from "../src/pages/space/SpacePage";
import { emptySpace, spaceDraft } from "../src/pages/space/spaceSaves";
import { useSpace, withItemPlaced } from "../src/pages/space/useSpace";
import { useSpeakerPage } from "../src/pages/speaker/useSpeakerPage";
import { useStack } from "../src/pages/stack/useStack";
import {
  SEATED_EAR_FT,
  SPACE_HOME_ROOM,
  SPACE_HOME_SEAT,
  SPACE_DETAILS,
  SPACE_TEXT,
} from "../src/constants/space";
import { COVERAGE_TEST_IDS } from "../src/constants/coverageTestIds";
import { UI_TEXT } from "../src/constants/uiText";
import { PAGE_DRAFT_KEYS } from "../src/constants/pageDrafts";
import { PALETTES } from "../src/styles/palette";
import { placeOptions } from "../src/pages/space/placeOptions";
import { emptyStack } from "../src/pages/stack/stackSaves";
import { emptySpeaker } from "../src/pages/speaker/useSpeakerPage";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

/** The page as the app renders it for a space design kept in the browser (none: a first visit). */
function render(stored?: unknown): string {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) =>
        stored !== undefined && k === PAGE_DRAFT_KEYS.space ? JSON.stringify(stored) : null,
      setItem: () => {},
    },
    configurable: true,
  });
  function Probe() {
    const space = useSpace();
    const stack = useStack();
    const speakerPage = useSpeakerPage();
    return createElement(SpacePage, { space, stack, speakerPage, sharedNotice: null });
  }
  return renderToString(createElement(Probe));
}

test("the default space is the living room, with nobody's sound in it and a seated listener", () => {
  const { space } = emptySpace();
  assert.deepStrictEqual(space.venue.room, SPACE_HOME_ROOM);
  assert.deepStrictEqual(space.venue.listener, SPACE_HOME_SEAT);
  assert.equal(space.venue.earFt, SEATED_EAR_FT);
  assert.deepStrictEqual(space.placements, []);
  // a page with no draft, and a draft that holds this space, start on it
  assert.deepStrictEqual(spaceDraft.empty(), emptySpace());
});

test("a first visit shows the empty room: the map and 3D view drawn, one line asking for a speaker, no NaN", () => {
  const html = render();
  assert.ok(html.includes(`data-testid="${COVERAGE_TEST_IDS.map}"`), "the map is drawn");
  assert.ok(
    html.includes(`${SPACE_HOME_ROOM.widthFt} × ${SPACE_HOME_ROOM.lengthFt} ft room`),
    "the room's size",
  );
  assert.ok(html.includes(SPACE_TEXT.quietRoom), "the quiet line");
  assert.ok(html.includes(`fill="${PALETTES.light.edge}"`), "the floor in the neutral fill");
  assert.ok(html.includes(`aria-label="${UI_TEXT.hideAimCoverage}"`), "the 3D view");
  assert.ok(!html.includes(SPACE_TEXT.noPlacements.slice(0, 20)), "no notice instead of the map");
  assert.ok(!html.includes(SPACE_TEXT.listenerVs), "no level lines");
  assert.ok(html.includes("Front wall") && !html.includes("Behind the stacks"), "wall names");
  assert.ok(!html.includes("Your current designs"), "no current-design start");
  assert.ok(html.includes(">Details<") && !html.includes("Assumptions"), "the Details fold");
  // the Details fold opens on the listener and the alignment point, each with its own lines nested under it
  const [[alignAt, alignLines]] = SPACE_DETAILS.markLines;
  assert.ok(
    html.indexOf(SPACE_DETAILS.marks) < html.indexOf(SPACE_DETAILS.map),
    "the marks group first",
  );
  assert.ok(html.includes(`<li>${alignAt}<ul`), "the alignment point's lines nested under it");
  assert.ok(html.includes(alignLines[0]), "the alignment point's first line");
  assert.ok(!html.includes(SPACE_TEXT.bandLevels), "no band levels");
  assert.ok(!html.includes(SPACE_TEXT.response), "no response chart");
  assert.ok(!/NaN|Infinity/.test(html), "no NaN or Infinity text");
});

test("a placed space has no quiet line and no NaN", () => {
  const options = placeOptions({
    openStack: emptyStack(),
    openSpeaker: emptySpeaker(),
    savedStacks: [],
    savedSpeakers: [],
  });
  const placed = withItemPlaced(emptySpace(), options[0].item());
  assert.equal(placed.space.placements.length, 1);
  const html = render(spaceDraft.toDraft(placed));
  assert.ok(!html.includes(SPACE_TEXT.quietRoom));
  assert.match(
    html,
    /Sub −?[\d.]+ dB, Kick −?[\d.]+ dB, Mid −?[\d.]+ dB, High −?[\d.]+ dB/,
    "each band target",
  );
  assert.ok(!/NaN|Infinity/.test(html), "no NaN or Infinity text");
});
