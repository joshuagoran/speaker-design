// A fill's delay and level against the mains (lib/speaker/fillAlign): the PA stack preset's space with the Fills page's
// fill down the room, aligned for a listener past it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { fillAlignment } from "../src/lib/speaker/fillAlign";
import { spaceModel } from "../src/lib/speaker/spaceCoverage";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { startLayers } from "../src/pages/stack/stackPresets";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { FILL_PRECEDENCE_MS } from "../src/constants/space";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { METERS_PER_FOOT } from "../src/constants/units";
import type { SpaceDesign } from "../src/types";

/** The PA stack preset's space with a fill `fillY` ft down the room, and the listener `listenerY` ft down it. */
function withFill(fillY: number, listenerY: number): SpaceDesign {
  const read = startLayers(
    STACK_PRESET.paStack,
    { id: "test", name: "test" },
    { pa: defaultPaDesign("stack"), floor: DEFAULT_COVERAGE_LAYOUT },
  );
  const fill = speakerFromFill(DEFAULT_FILL, { id: "fill", name: "Fill" });
  return {
    stacks: [read.stack],
    speakers: [...read.speakers, fill],
    space: {
      ...read.space,
      placements: [
        ...read.space.placements,
        spacePlacement({ x: 0, y: fillY }, { kind: SPACE_ITEM.speaker, id: fill.id }, 60, []),
      ],
      venue: { ...read.space.venue, listener: { x: 0, y: listenerY } },
    },
  };
}

/** Placement `k` with its delay and level set. */
const applied = (design: SpaceDesign, k: number, set: { delayMs: number; levelDb: number }) => ({
  ...design,
  space: {
    ...design.space,
    placements: design.space.placements.map((p, i) => (i === k ? { ...p, ...set } : p)),
  },
});

test("fill alignment: a fill closer to the listener waits for the mains, then plays at their level", () => {
  const design = withFill(30, 40);
  const k = design.space.placements.length - 1;
  const align = (d: SpaceDesign) =>
    fillAlignment(spaceModel(d), d.space.venue, d.space.placements, k);
  const first = align(design);
  assert.ok(first);
  // the mains are about 37 ft from the listener, the fill 10 ft: about 24 ms later, and the precedence margin
  const [main] = design.space.placements;
  const pathMs = (dy: number, dx: number) =>
    (Math.hypot(dx, dy) * METERS_PER_FOOT * 1000) / SPEED_OF_SOUND;
  const rough = pathMs(40 - main.y, main.x) - pathMs(10, 0) + FILL_PRECEDENCE_MS;
  assert.ok(Math.abs(first.delayMs - rough) < 3, `${first.delayMs} ms, about ${rough} ms`);
  // aligned, the fill plays at the mains' level: a second alignment changes nothing
  const again = align(applied(design, k, first));
  assert.ok(again);
  assert.ok(Math.abs(again.levelDb - first.levelDb) < 0.01, `${again.levelDb} vs ${first.levelDb}`);
  assert.ok(Math.abs(again.delayMs - first.delayMs) < 1e-9);
});

test("fill alignment: a fill farther than the mains never plays early", () => {
  const design = withFill(30, 10);
  const k = design.space.placements.length - 1;
  const aligned = fillAlignment(spaceModel(design), design.space.venue, design.space.placements, k);
  assert.ok(aligned);
  assert.equal(aligned.delayMs, 0);
});

test("fill alignment: nothing to align to without mains", () => {
  const design = withFill(30, 40);
  const alone: SpaceDesign = {
    ...design,
    space: { ...design.space, placements: design.space.placements.slice(-1) },
  };
  assert.equal(
    fillAlignment(spaceModel(alone), alone.space.venue, alone.space.placements, 0),
    null,
  );
});
