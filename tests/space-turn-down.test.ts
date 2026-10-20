// The Space page turns the space down once, so that the lowest band reaches the Target level at the reference. The band
// on show changes the map and the per-band figures only: never the turn-down, the listener's level or the band line.
import { afterEach, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { emptySpace, spaceDraft } from "../src/pages/space/spaceSaves";
import { useSpace, withItemPlaced } from "../src/pages/space/useSpace";
import { placeOptions } from "../src/pages/space/placeOptions";
import { emptyStack } from "../src/pages/stack/stackSaves";
import { emptySpeaker } from "../src/pages/speaker/useSpeakerPage";
import { PAGE_DRAFT_KEYS } from "../src/constants/pageDrafts";
import { COVERAGE_LEVEL_REF } from "../src/constants/coverageLevel";
import { SPACE_HOME_TARGET_DB } from "../src/constants/space";
import { COVERAGE_BANDS } from "../src/lib/acoustics/coverage";
import { LISTENER_TARGET_DB } from "../src/lib/acoustics/coverageLayout";
import type { CoverageBand, CoverageLevelRef, SpaceVenue } from "../src/types";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

/**
 * The space hook's figures for a stack placed in the room, measured at `levelRef`, with `band` on show (and the venue
 * changed by `venueOver`).
 */
function figures(
  levelRef: CoverageLevelRef,
  band: CoverageBand,
  targetDb = 105,
  venueOver: Partial<SpaceVenue> = {},
) {
  const options = placeOptions({
    openStack: emptyStack(),
    openSpeaker: emptySpeaker(),
    savedStacks: [],
    savedSpeakers: [],
  });
  const placed = withItemPlaced(emptySpace(), options[0].item());
  const { venue } = placed.space;
  const draft = spaceDraft.toDraft({
    ...placed,
    space: { ...placed.space, venue: { ...venue, levelRef, targetDb, ...venueOver } },
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => (k === PAGE_DRAFT_KEYS.space ? JSON.stringify(draft) : null),
      setItem: () => {},
    },
    configurable: true,
  });
  let out: ReturnType<typeof useSpace> | undefined;
  function Probe() {
    out = useSpace(band);
    return null;
  }
  renderToString(createElement(Probe));
  if (!out) throw new Error("the hook did not render");
  return out;
}

const BANDS: CoverageBand[] = [...(Object.keys(COVERAGE_BANDS) as CoverageBand[]), "one"];

for (const levelRef of [COVERAGE_LEVEL_REF.listener, COVERAGE_LEVEL_REF.stacks])
  test(`${levelRef}: switching the band changes neither the turn-down nor the band line`, () => {
    const sub = figures(levelRef, "sub");
    // a target low enough to turn the space down, so the turn-down is a real figure
    expect(sub.turn.gain).toBeLessThan(0);
    // the lowest band reaches the target at the reference
    expect(sub.turn.atLimit !== null && sub.turn.atLimit + sub.turn.gain).toBeCloseTo(
      sub.turn.target,
      6,
    );
    for (const band of BANDS) {
      const s = figures(levelRef, band);
      expect(s.turn, `${band}: turn-down`).toEqual(sub.turn);
      expect(s.gain, `${band}: gain`).toBe(sub.gain);
      expect(s.bandLevels, `${band}: each band at the listener`).toEqual(sub.bandLevels);
      expect(s.listenerDb, `${band}: listener`).toBe(sub.listenerDb);
      expect(s.response, `${band}: response`).toEqual(sub.response);
      // what is per band: the band's own target
      expect(s.target).not.toBeNaN();
    }
  });

test("the lowest band is the lowest band", () => {
  const lo = Object.values(COVERAGE_BANDS).map((b) => b.lo);
  expect(COVERAGE_BANDS.sub.lo).toBe(Math.min(...lo));
});

test("a new space starts at the default coverage layout's 105 dB target", () => {
  expect(SPACE_HOME_TARGET_DB).toBe(105);
  expect(emptySpace().space.venue.targetDb).toBe(SPACE_HOME_TARGET_DB);
  expect(SPACE_HOME_TARGET_DB).toBe(LISTENER_TARGET_DB);
});

test("measured at the alignment point: moving the listener changes only its readouts, moving the point the turn-down", () => {
  const start = figures(COVERAGE_LEVEL_REF.listener, "sub");
  const listenerMoved = figures(COVERAGE_LEVEL_REF.listener, "sub", 105, {
    listener: { x: 4, y: 20 },
  });
  expect(listenerMoved.turn).toEqual(start.turn);
  expect(listenerMoved.listenerDb).not.toBe(start.listenerDb);
  const pointMoved = figures(COVERAGE_LEVEL_REF.listener, "sub", 105, {
    alignAt: { x: 4, y: 20 },
  });
  expect(pointMoved.turn.atLimit).not.toBe(start.turn.atLimit);
});
