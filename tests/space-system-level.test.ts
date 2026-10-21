// The Space page plays every placement at its Gain and the System gain. Calculate gains sets them once: the bands each
// main plays most meet their targets at the reference, and System gain keeps every band under its limit. The band on
// show changes the map and the per-band figures only: never the gain, the listener's level or the band line.
import { afterEach, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { emptySpace, spaceDraft } from "../src/pages/space/spaceSaves";
import {
  bandTargets,
  referenceLevelsNow,
  useSpace,
  withCalculatedGains,
  withItemPlaced,
} from "../src/pages/space/useSpace";
import { spaceModelLaidOut } from "../src/lib/speaker/spaceCoverage";
import { bandHeadrooms } from "../src/lib/speaker/spaceGains";
import { keysOf } from "../src/lib/records";
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

/** A stack placed in the room, measured at `levelRef`, aiming at `targetDb`. */
function placedSpace(levelRef: CoverageLevelRef, targetDb: number) {
  const options = placeOptions({
    openStack: emptyStack(),
    openSpeaker: emptySpeaker(),
    savedStacks: [],
    savedSpeakers: [],
  });
  const placed = withItemPlaced(emptySpace(), options[0].item());
  return {
    ...placed,
    space: { ...placed.space, venue: { ...placed.space.venue, levelRef, targetDb } },
  };
}

const BANDS: CoverageBand[] = [...(Object.keys(COVERAGE_BANDS) as CoverageBand[]), "one"];

/** A System gain under the limit, dB. */
const SYSTEM_DB = -6;

for (const levelRef of [COVERAGE_LEVEL_REF.listener, COVERAGE_LEVEL_REF.stacks]) {
  test(`${levelRef}: switching the band changes neither the level nor the band line`, () => {
    const sub = figures(levelRef, "sub", 105, { systemDb: SYSTEM_DB });
    expect(sub.gain).toBe(SYSTEM_DB);
    for (const band of BANDS) {
      const s = figures(levelRef, band, 105, { systemDb: SYSTEM_DB });
      expect(s.gain, `${band}: gain`).toBe(sub.gain);
      expect(s.bandLevels, `${band}: each band at the listener`).toEqual(sub.bandLevels);
      expect(s.listenerDb, `${band}: listener`).toBe(sub.listenerDb);
      expect(s.response, `${band}: response`).toEqual(sub.response);
      // what is per band: the band's own target
      expect(s.target).not.toBeNaN();
    }
  });

  test(`${levelRef}: Calculate gains meets the target and keeps every band under its limit`, async () => {
    /** each band's level against its target at the reference after Calculate gains, dB, and the least headroom */
    const after = async (targetDb: number) => {
      const { design, limit } = await withCalculatedGains(placedSpace(levelRef, targetDb));
      const model = spaceModelLaidOut(design);
      const { systemDb } = design.space.venue;
      const levels = referenceLevelsNow(design, model) ?? {};
      const targets = bandTargets(design);
      const rel = keysOf(COVERAGE_BANDS).flatMap((b) => {
        const db = levels[b];
        return db === undefined ? [] : [db + systemDb - targets[b]];
      });
      const least = Math.min(...bandHeadrooms(model, systemDb).map((h) => h.headroomDb));
      return { rel, least, limit, systemDb };
    };
    // a quiet target: a band meets it, none goes past it, and nothing holds System gain down
    const quiet = await after(95);
    expect(quiet.systemDb).toBe(0);
    expect(quiet.limit).toBeNull();
    expect(Math.max(...quiet.rel)).toBeCloseTo(0, 0);
    // a target past the limit: System gain comes down, every band under its limit, and the note names the band
    const loud = await after(140);
    expect(loud.systemDb).toBeLessThan(0);
    expect(loud.least).toBeGreaterThanOrEqual(-0.1);
    expect(loud.limit?.belowDb).toBeCloseTo(-loud.systemDb, 5);
    expect(loud.limit?.limit?.band).toBeTruthy();
    expect(Math.max(...loud.rel)).toBeLessThan(0);
  });
}

test("the Target level alone does not change the gain", () => {
  expect(figures(COVERAGE_LEVEL_REF.listener, "sub", 95).gain).toBe(
    figures(COVERAGE_LEVEL_REF.listener, "sub", 115).gain,
  );
});

test("the lowest band is the lowest band", () => {
  const lo = Object.values(COVERAGE_BANDS).map((b) => b.lo);
  expect(COVERAGE_BANDS.sub.lo).toBe(Math.min(...lo));
});

test("a new space starts at the default coverage layout's 105 dB target, at full power", () => {
  expect(SPACE_HOME_TARGET_DB).toBe(105);
  expect(emptySpace().space.venue.targetDb).toBe(SPACE_HOME_TARGET_DB);
  expect(emptySpace().space.venue.systemDb).toBe(0);
  expect(SPACE_HOME_TARGET_DB).toBe(LISTENER_TARGET_DB);
});

test("moving the listener changes only its readouts", () => {
  const start = figures(COVERAGE_LEVEL_REF.listener, "sub");
  const listenerMoved = figures(COVERAGE_LEVEL_REF.listener, "sub", 105, {
    listener: { x: 4, y: 20 },
  });
  expect(listenerMoved.gain).toBe(start.gain);
  expect(listenerMoved.listenerDb).not.toBe(start.listenerDb);
});
