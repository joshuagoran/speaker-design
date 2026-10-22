// One directivity on every page: the Speaker page's dispersion map and the Space page's coverage agree on a cone's
// level off its axis, at the same angle and frequency.
import { expect, test } from "vite-plus/test";
import {
  boxShadow,
  directivityAt,
  directivityGain,
  levelAtPoint,
  sceneOf,
  sceneSlots,
} from "../src/lib/acoustics/coverage";
import { speakerDispersionMap } from "../src/lib/speaker/stackDispersion";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { bandOfPart, driverPattern, spotBoxWIn } from "../src/lib/speaker/spaceCoverage";
import { layStack } from "../src/lib/speaker/spaceLayout";
import { bandCenters } from "../src/lib/speaker/stackLayout";
import { stackMember } from "../src/lib/speaker/specParts";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { DISPERSION_DISTANCE_M } from "../src/constants/chartScales";
import { METERS_PER_FOOT, METERS_PER_INCH, RAD } from "../src/constants/units";
import type { CoverageRoom } from "../src/types";

/** Open air: only the floor would reflect, and the test takes that off. */
const OUTDOORS: CoverageRoom = {
  widthFt: 80,
  lengthFt: 80,
  ceilingFt: 20,
  materials: { front: "open", back: "open", left: "open", right: "open", ceiling: "open" },
  crowd: "empty",
  outdoors: true,
};

/** The stack where its own frame is the room's, as the map lays it. */
const OWN_POSE = {
  x: 0,
  y: 0,
  liftIn: 0,
  aim: { yawDeg: 0, pitchDeg: 0 },
  image: false,
  upsideDown: false,
};

test("a cone box: the dispersion map and the Space coverage give the same level off its axis", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.genericSub18);
  const response = speakerResponse(spec, { feed: spec.input });
  const map = speakerDispersionMap(spec, response, "h");
  const { drivers } = layStack(
    { stack: { members: [stackMember(spec.id, spec.input)] }, speakers: [spec] },
    OWN_POSE,
    bandOfPart,
  );
  expect(drivers).toHaveLength(1);
  const [cone] = drivers;
  expect(cone.mouth).toBeFalsy();
  const voices = [{ id: "cone", pattern: driverPattern(cone), boxWIn: spotBoxWIn(cone) }];
  expect(voices[0].pattern.a).toBeGreaterThan(0);
  const scene = sceneOf(OUTDOORS, voices, [
    [
      {
        voice: "cone",
        x: cone.at.x * METERS_PER_FOOT,
        y: cone.at.y * METERS_PER_FOOT,
        z: cone.at.z * METERS_PER_FOOT,
        yaw: cone.yaw,
        pitch: cone.pitch,
        alignM: 0,
      },
    ],
  ]);
  const listenZ = Math.max(...bandCenters(spec).map((b) => b.y)) * METERS_PER_INCH;
  const D = DISPERSION_DISTANCE_M;
  for (const hz of [300, 1000, 3000]) {
    const i = map.freqs.findIndex((f) => f >= hz);
    const f = map.freqs[i];
    const [slot] = sceneSlots(scene, [f], true, () => ({ cone: { re: 1, im: 0 } }));
    // the direct sound alone: no floor bounce
    slot.refl.fill(0, 1);
    const spaceDb = (deg: number) =>
      levelAtPoint(scene, [slot], D * Math.sin(deg * RAD), D * Math.cos(deg * RAD), listenZ);
    for (const deg of [30, 60, 90]) {
      const row = map.angles.indexOf(deg);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(map.rows[row][i]).toBeCloseTo(spaceDb(deg) - spaceDb(0), 1);
    }
  }
});

test("behind its box, a cone or a mouth keeps its quarter-turn level less the box's shadow; a horn's own pattern falls", () => {
  const boxWIn = 20,
    f = 2000;
  const mouth = { mouth: { wIn: 20, hIn: 10, wallH: null, wallV: 40 } };
  for (const pattern of [{ a: 0.1 }, mouth]) {
    const d = directivityAt(pattern, f, boxWIn);
    expect(directivityGain(d, Math.PI * 0.75, 0)).toBeCloseTo(
      directivityGain(d, Math.PI / 2, 0) * boxShadow(f, boxWIn),
      12,
    );
  }
  expect(directivityAt({ horn: { covH: 90, covV: 40, wIn: 20, hIn: 10 } }, f, boxWIn).shadow).toBe(
    1,
  );
});
