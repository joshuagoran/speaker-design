// A fill's delay and level against the placement it is aligned to (lib/speaker/fillAlign): the PA stack preset's space
// with the Fills page's fill down the room, aligned for a listener past it.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { fillAlignment, placementGroup, type FillSetting } from "../src/lib/speaker/fillAlign";
import {
  spaceGridRequest,
  spaceLevelAt,
  spaceModel,
  type SpaceModel,
} from "../src/lib/speaker/spaceCoverage";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { startLayers } from "../src/pages/stack/stackPresets";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/pa/coverageLayout";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { STACK_PRESET } from "../src/constants/stackPresets";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { FILL_ALIGN_BAND, FILL_PRECEDENCE_MS } from "../src/constants/space";
import { SPEED_OF_SOUND } from "../src/constants/acoustics";
import { METERS_PER_FOOT } from "../src/constants/units";
import type { FloorPoint, SpaceDesign, SpacePlacement } from "../src/types";

/** The placement the mains (the preset's stacks) start at: what every fill here aligns to. */
const MAINS = 0;

/**
 * The PA stack preset's space with fills at `fills` (each one on its own, or `pair`: followed by its mirror image), and
 * the listener `listenerY` ft down the room on the center line.
 */
function withFills(
  fills: readonly (FloorPoint & { pair?: boolean })[],
  listenerY: number,
): SpaceDesign {
  const read = startLayers(
    STACK_PRESET.paStack,
    { id: "test", name: "test" },
    { pa: defaultPaDesign("stack"), floor: DEFAULT_COVERAGE_LAYOUT },
  );
  const fill = speakerFromFill(DEFAULT_FILL, { id: "fill", name: "Fill" });
  const item = { kind: SPACE_ITEM.speaker, id: fill.id } as const;
  const placements: SpacePlacement[] = [...read.space.placements];
  for (const f of fills) {
    const at = placements.length;
    placements.push(spacePlacement(f, item, 60));
    if (f.pair) placements.push(spacePlacement(f, item, 60, { follows: at }));
  }
  return {
    stacks: [read.stack],
    speakers: [...read.speakers, fill],
    space: {
      ...read.space,
      placements,
      venue: { ...read.space.venue, listener: { x: 0, y: listenerY } },
    },
  };
}

/** The design with an alignment's delays and levels set. */
const applied = (design: SpaceDesign, set: readonly FillSetting[]): SpaceDesign => ({
  ...design,
  space: {
    ...design.space,
    placements: design.space.placements.map((p, i) => {
      const s = set.find((a) => a.placement === i);
      return s ? { ...p, delayMs: s.delayMs, levelDb: s.levelDb } : p;
    }),
  },
});

/** Placement `k` and its partners aligned to the mains, `afterMs` after them (the field's starting value). */
const align = (d: SpaceDesign, k: number, afterMs = FILL_PRECEDENCE_MS) =>
  fillAlignment(spaceModel(d), d.space.venue, d.space.placements, k, MAINS, afterMs);

/** Placement `i`'s first arrival at the listener, ms, with every delay (its members' and its own). */
function arrivalMs(model: SpaceModel, d: SpaceDesign, i: number): number {
  const { listener, earFt } = d.space.venue;
  const p = model.placements[i];
  assert.ok(p?.response);
  const { response } = p;
  return Math.min(
    ...p.item.drivers.map((dr) => {
      const r = Math.hypot(dr.at.x - listener.x, dr.at.y - listener.y, dr.at.z - earFt);
      const member = response.members[dr.member];
      assert.ok(member);
      return (
        (r * METERS_PER_FOOT * 1000) / SPEED_OF_SOUND + member.delayMs + p.item.placement.delayMs
      );
    }),
  );
}

/** The level at the listener in the fill band of the placements in `group` alone, dB. */
function levelOf(model: SpaceModel, d: SpaceDesign, group: readonly number[]): number {
  const req = spaceGridRequest(model, d.space.venue, FILL_ALIGN_BAND, 0, 1);
  return spaceLevelAt(
    {
      ...req,
      outputs: req.outputs.map((out) =>
        Object.fromEntries(
          model.feeds.flatMap((f) =>
            group.includes(f.placement) && out[f.id] ? [[f.id, out[f.id]]] : [],
          ),
        ),
      ),
    },
    d.space.venue.listener,
  );
}

test("fill alignment: a fill closer to the listener waits for the mains, then plays at their level", () => {
  const design = withFills([{ x: 0, y: 30 }], 40);
  const k = design.space.placements.length - 1;
  const first = align(design, k);
  assert.ok(first);
  assert.equal(first.length, 1);
  const [set] = first;
  // the mains are about 37 ft from the listener, the fill 10 ft: about 24 ms later, and the precedence margin
  const [main] = design.space.placements;
  const pathMs = (dy: number, dx: number) =>
    (Math.hypot(dx, dy) * METERS_PER_FOOT * 1000) / SPEED_OF_SOUND;
  const rough = pathMs(40 - main.y, main.x) - pathMs(10, 0) + FILL_PRECEDENCE_MS;
  assert.ok(Math.abs(set.delayMs - rough) < 3, `${set.delayMs} ms, about ${rough} ms`);
  // aligned, the fill plays at the mains' level: a second alignment changes nothing
  const again = align(applied(design, first), k);
  assert.ok(again);
  assert.ok(
    Math.abs(again[0].levelDb - set.levelDb) < 0.01,
    `${again[0].levelDb} vs ${set.levelDb}`,
  );
  assert.ok(Math.abs(again[0].delayMs - set.delayMs) < 1e-9);
});

test("fill alignment: a mirrored fill pair arrives just after the mains on both sides, at their level as a pair", () => {
  const design = withFills([{ x: 8, y: 30, pair: true }], 40);
  const lead = design.space.placements.length - 2;
  const pair = placementGroup(design.space.placements, lead);
  assert.deepEqual(pair, [lead, lead + 1]);
  // aligned from either side, the pair gets the same settings, on both placements
  const fromLead = align(design, lead);
  assert.ok(fromLead);
  assert.deepEqual(align(design, lead + 1), fromLead);
  assert.deepEqual(
    fromLead.map((s) => s.placement),
    pair,
  );
  const done = applied(design, fromLead);
  const model = spaceModel(done);
  const mains = placementGroup(done.space.placements, MAINS);
  const mainsMs = Math.min(...mains.map((i) => arrivalMs(model, done, i)));
  for (const i of pair) {
    const late = arrivalMs(model, done, i) - mainsMs;
    assert.ok(
      Math.abs(late - FILL_PRECEDENCE_MS) < 1e-6,
      `placement ${i}: ${late} ms after the mains`,
    );
  }
  const pairDb = levelOf(model, done, pair),
    mainsDb = levelOf(model, done, mains);
  assert.ok(Math.abs(pairDb - mainsDb) < 0.01, `pair ${pairDb} dB, mains ${mainsDb} dB`);
});

test("fill alignment: the delay after the mains sets how much later the fill arrives at the listener", () => {
  const design = withFills([{ x: 0, y: 30 }], 40);
  const k = design.space.placements.length - 1;
  for (const afterMs of [0, 10]) {
    const set = align(design, k, afterMs);
    assert.ok(set);
    const done = applied(design, set);
    const model = spaceModel(done);
    const mainsMs = Math.min(
      ...placementGroup(done.space.placements, MAINS).map((i) => arrivalMs(model, done, i)),
    );
    const late = arrivalMs(model, done, k) - mainsMs;
    assert.ok(Math.abs(late - afterMs) < 1e-6, `${afterMs} ms asked, ${late} ms after the mains`);
  }
});

test("fill alignment: two fills come out the same aligned in either order", () => {
  const design = withFills(
    [
      { x: 6, y: 25 },
      { x: -6, y: 35 },
    ],
    40,
  );
  const a = design.space.placements.length - 2,
    b = a + 1;
  const run = (order: readonly number[]) =>
    order.reduce((d, k) => {
      const set = align(d, k);
      assert.ok(set);
      return applied(d, set);
    }, design).space.placements;
  const ab = run([a, b]),
    ba = run([b, a]);
  for (const k of [a, b]) {
    assert.ok(Math.abs(ab[k].delayMs - ba[k].delayMs) < 1e-9, `delay ${k}`);
    assert.ok(Math.abs(ab[k].levelDb - ba[k].levelDb) < 1e-9, `level ${k}`);
  }
});

test("fill alignment: a fill farther than the mains never plays early", () => {
  const design = withFills([{ x: 0, y: 30 }], 10);
  const aligned = align(design, design.space.placements.length - 1);
  assert.ok(aligned);
  assert.equal(aligned[0].delayMs, 0);
});

test("fill alignment: nothing to align to without another placement", () => {
  const design = withFills([{ x: 0, y: 30 }], 40);
  const alone: SpaceDesign = {
    ...design,
    space: { ...design.space, placements: design.space.placements.slice(-1) },
  };
  assert.equal(
    fillAlignment(
      spaceModel(alone),
      alone.space.venue,
      alone.space.placements,
      0,
      0,
      FILL_PRECEDENCE_MS,
    ),
    null,
  );
  // nor to its own pair
  const paired = withFills([{ x: 8, y: 30, pair: true }], 40);
  const k = paired.space.placements.length - 1;
  assert.equal(
    fillAlignment(
      spaceModel(paired),
      paired.space.venue,
      paired.space.placements,
      k,
      k - 1,
      FILL_PRECEDENCE_MS,
    ),
    null,
  );
});
