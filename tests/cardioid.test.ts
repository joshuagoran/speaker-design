import { test } from "vite-plus/test";
import assert from "node:assert";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/acoustics/coverageLayout";
import { COVERAGE_GRID_COLS } from "../src/lib/acoustics/coverage";
import { spaceGridRequest, spaceLevelAt } from "../src/lib/speaker/spaceCoverage";
import { spaceModel } from "./helpers";
import { emptySpace } from "../src/pages/space/spaceSaves";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import type { SpaceDesign, SpacePlacement } from "../src/types";

const C = 343,
  FT = 0.3048;
/**
 * A gradient cardioid pair: two subs 5 ft apart front to back, the rear one inverted and delayed by the spacing over the
 * speed of sound. Behind the pair the two arrive together, opposite in polarity, and cancel; in front they do not.
 */
test("cardioid: the rear sub inverted and delayed cuts the sound behind the pair by 12 dB or more, 40–80 Hz", () => {
  const t = SPEAKER_TEMPLATES.find((s) => JSON.stringify(s).includes("paSubBox"));
  const sub = templateSpeaker(t ?? SPEAKER_TEMPLATES[1]);
  const base = emptySpace();
  const room = { ...DEFAULT_COVERAGE_LAYOUT.room, outdoors: true, widthFt: 40, lengthFt: 60 };
  const D_FT = 5,
    FRONT_Y = 25;
  const place = (y: number, over: Partial<SpacePlacement> = {}): SpacePlacement => ({
    item: { kind: SPACE_ITEM.speaker, id: sub.id },
    x: 0,
    y,
    liftIn: 0,
    aim: { yawDeg: 0, pitchDeg: 0 },
    mirrored: false,
    levelDb: 0,
    delayMs: 0,
    fill: false,
    upsideDown: false,
    invertPolarity: false,
    ...over,
  });
  const design = (placements: SpacePlacement[]): SpaceDesign => ({
    ...base,
    speakers: [sub],
    stacks: [],
    space: {
      ...base.space,
      placements,
      venue: { ...base.space.venue, room, listener: { x: 0, y: 50 } },
    },
  });
  const delayMs = ((D_FT * FT) / C) * 1000;
  const cardioid = design([
    place(FRONT_Y),
    place(FRONT_Y - D_FT, { invertPolarity: true, delayMs }),
  ]);
  const delayOnly = design([place(FRONT_Y), place(FRONT_Y - D_FT, { delayMs })]);
  const frontToBack = (d: SpaceDesign, f: number) => {
    const req = spaceGridRequest(spaceModel(d), d.space.venue, "one", f, COVERAGE_GRID_COLS);
    return (
      spaceLevelAt(req, { x: 0, y: FRONT_Y + 20 }) -
      spaceLevelAt(req, { x: 0, y: FRONT_Y - D_FT - 17.5 })
    );
  };
  for (const f of [40, 50, 63, 80]) {
    assert.ok(
      frontToBack(cardioid, f) >= 12,
      `cardioid at ${f} Hz: ${frontToBack(cardioid, f).toFixed(1)} dB`,
    );
    // without the flip, the pair turns around: louder behind
    assert.ok(frontToBack(delayOnly, f) < 0, `delay only at ${f} Hz`);
  }
});
