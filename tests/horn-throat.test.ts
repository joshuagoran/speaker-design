// A front-loaded horn's throat (lib/speaker/hornThroat): the walls' back edges cover the cones' outer parts, the
// compression ratio sets the throat (the first section's start area), the front chamber is the cones' air under the
// edges, and the throat's air speed at full power is a limit, as a vent's.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  compressionRatio,
  conesAreaCm2,
  frontChamber,
  throatAreaCm2,
  throatCones,
  wallClearanceIn,
} from "../src/lib/speaker/hornThroat";
import { withCompressionRatio } from "../src/pages/speaker/hornSections";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { chamberChips } from "../src/pages/speaker/speakerChips";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { roomOf } from "./horn-room";
import { BC18NBX } from "../src/lib/data";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD, VENT_KIND } from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { LIMIT_NAMES } from "../src/constants/limits";
import {
  CONE_DISH_PER_DEPTH,
  CONE_SURROUND_RISE_SHARE,
  CONE_TRAVEL_MARGIN,
  SURROUND_RISE_PER_WIDTH,
} from "../src/constants/hornThroat";
import { CM_PER_IN, MM_PER_IN } from "../src/constants/units";
import type { SpeakerSpec } from "../src/types";

const near = (a: number, b: number, tol = 1e-9) =>
  Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

test("horn throat: the front chamber is each cone's area times the walls' clearance, and its dish", () => {
  const cone = { Sd: 1210, Xmax: 10, depthIn: 8.19 };
  const one = frontChamber(cone, 1);
  // the clearance: the surround (a share of the cone's radius) and the travel (Xmax with the margin)
  const radiusCm = Math.sqrt(1210 / Math.PI);
  const clearanceCm = CONE_SURROUND_RISE_SHARE * radiusCm + (10 * CONE_TRAVEL_MARGIN) / 10;
  assert.ok(near(one.clearanceIn, clearanceCm / CM_PER_IN), `${one.clearanceIn} in`);
  // the air: the slab in front of the cone and a third of the dish's depth
  const dishCm = 8.19 * CONE_DISH_PER_DEPTH * CM_PER_IN;
  assert.ok(near(one.liters, (1210 * (clearanceCm + dishCm / 3)) / 1000), `${one.liters} L`);
  // an 18″: the edges about an inch in front, some 6.5 L under them
  assert.ok(one.clearanceIn > 0.9 && one.clearanceIn < 1.2, `${one.clearanceIn} in`);
  assert.ok(one.liters > 5.5 && one.liters < 7.5, `${one.liters} L`);
  // the clearance passes the cone at full travel
  assert.ok(one.clearanceIn > (cone.Xmax * CONE_TRAVEL_MARGIN) / MM_PER_IN);
  // two cones: twice the air, the same clearance
  const two = frontChamber(cone, 2);
  assert.ok(near(two.liters, 2 * one.liters));
  assert.equal(two.clearanceIn, one.clearanceIn);
  // more travel, a deeper driver: more air; no travel and no depth leave only the surround
  assert.ok(frontChamber({ ...cone, Xmax: 15 }, 1).liters > one.liters);
  assert.ok(frontChamber({ ...cone, depthIn: 10 }, 1).liters > one.liters);
  const flat = frontChamber({ ...cone, Xmax: 0, depthIn: 0 }, 1);
  assert.ok(near(flat.clearanceIn, (CONE_SURROUND_RISE_SHARE * radiusCm) / CM_PER_IN));
});

test("horn throat: the chamber's cones give the engine its drivers and front chamber", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
  const [chamber] = spec.cabinet.chambers;
  const cones = throatCones(chamber.drivers);
  assert.ok(cones);
  assert.equal(cones.count, 2);
  assert.equal(cones.cone.Sd, BC18NBX.ts.Sd);
  assert.equal(cones.cone.Xmax, BC18NBX.ts.Xmax);
  assert.equal(cones.cone.depthIn, BC18NBX.depthIn, "the catalog's depth");
  assert.equal(wallClearanceIn(chamber.drivers), frontChamber(cones.cone, 1).clearanceIn);
  const result = hornDesignOf(chamber, { count: 1, angle: 2 }, roomOf(chamber));
  assert.ok(result.ok);
  assert.equal(result.design.throatChamber, frontChamber(cones.cone, 2).liters);
  // a direct chamber has no front chamber
  const direct = hornDesignOf(
    { ...chamber, load: { kind: CHAMBER_LOAD.direct } },
    { count: 1, angle: 2 },
    roomOf(chamber),
  );
  assert.ok(direct.ok);
  assert.equal(direct.design.throatChamber, 0);
  // mixed drivers: no throat cones, no clearance from a missing part
  assert.equal(throatCones([]), null);
  assert.equal(wallClearanceIn([]), 0);
});

test("horn throat: the compression ratio is the cones' area over the throat's, and sets the throat", () => {
  const segments = [
    { profile: HORN_PROFILE.parabolic, s1: 1000, s2: 4000, length: 40 },
    { profile: HORN_PROFILE.parabolic, s1: 4000, s2: 6000, length: 10 },
  ];
  assert.equal(compressionRatio(2420, segments), 2.42);
  assert.equal(compressionRatio(0, segments), null, "no cone");
  assert.equal(compressionRatio(2420, []), null, "no throat");
  assert.equal(throatAreaCm2(2420, 2), 1210);
  const set = withCompressionRatio(segments, 2420, 2);
  assert.equal(set[0].s1, 1210, "the throat");
  assert.deepEqual(set[1], segments[1], "the rest stay");
  assert.equal(compressionRatio(2420, set), 2, "it reads back");
  // the chamber's cones: each cone's Sd times its count
  const [chamber] = templateSpeaker(SPEAKER_TEMPLATE.paV2MidBox).cabinet.chambers;
  assert.equal(
    conesAreaCm2(chamber.drivers),
    chamber.drivers.reduce((sum, d) => sum + d.count * 350, 0),
  );
});

/** The spec's one horn at compression `ratio`. */
function atRatio(spec: SpeakerSpec, ratio: number): SpeakerSpec {
  const [c] = spec.cabinet.chambers;
  assert.ok(c.load.kind === CHAMBER_LOAD.horn);
  const segments = withCompressionRatio(c.load.horn.segments, conesAreaCm2(c.drivers), ratio);
  return {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [{ ...c, load: { ...c.load, horn: { ...c.load.horn, segments } } }],
    },
  };
}

const limitsOf = (spec: SpeakerSpec) =>
  speakerLimits(spec, speakerResponse(spec, { feed: spec.input }), { feed: spec.input });

test("horn throat: the throat's air speed at full power is a limit against the box's, with its check", () => {
  const base = templateSpeaker(SPEAKER_TEMPLATE.paV2MidBox);
  const [chamber] = base.cabinet.chambers;
  assert.ok(chamber.vent.kind === VENT_KIND.vented);
  const boxMax = chamber.vent.maxSpeedMs;
  // the template: inside the limit, the check passes
  const ok = limitsOf(base).chambers[0];
  assert.ok(ok?.throat, "a horn has a throat check");
  assert.equal(ok.throat.limit, boxMax, "the box's air speed limit");
  assert.ok(ok.throat.peak > 0 && ok.throat.peak < boxMax, `${ok.throat.peak} m/s`);
  const okChip = chamberChips(ok, "Mid").find((c) => c[3] === "speakerThroatSpeed");
  assert.equal(okChip?.[0], "ok");
  // the throat speed grows with the ratio: the cones' flow through a smaller opening
  const ratio = 8;
  const tight = limitsOf(atRatio(base, ratio));
  const fast = tight.chambers[0];
  assert.ok(fast?.throat && fast.throat.peak > ok.throat.peak);
  assert.ok(fast.throat.peak > boxMax, `${fast.throat.peak} m/s at ${ratio}:1`);
  const chip = chamberChips(fast, "Mid").find((c) => c[3] === "speakerThroatSpeed");
  assert.equal(chip?.[0], "warn", "the limit check fails");
  // and it sets the maximum level somewhere in the band
  assert.ok(
    tight.sum.some((p) => p.who === LIMIT_NAMES.throat),
    "the throat speed binds",
  );
  // a direct chamber has none
  const direct: SpeakerSpec = {
    ...base,
    cabinet: { ...base.cabinet, chambers: [{ ...chamber, load: { kind: CHAMBER_LOAD.direct } }] },
  };
  assert.equal(limitsOf(direct).chambers[0]?.throat, null);
});

test("horn throat: the catalog's surround width and cone depth win over the estimates", () => {
  const cone = { Sd: 1210, Xmax: 10, depthIn: 8.19 };
  const estimated = frontChamber(cone, 1);
  assert.equal(estimated.estimated, true, "no catalog figures: estimates");
  const travelCm = (10 * CONE_TRAVEL_MARGIN) / 10;
  // both from the catalog: the rise is half the surround's width, the dish its own depth
  const catalog = frontChamber({ ...cone, surroundIn: 1.5, dishDepthIn: 4 }, 1);
  assert.equal(catalog.estimated, false);
  const riseCm = 1.5 * SURROUND_RISE_PER_WIDTH * CM_PER_IN;
  assert.ok(near(catalog.clearanceIn, (riseCm + travelCm) / CM_PER_IN));
  assert.ok(near(catalog.liters, (1210 * (riseCm + travelCm + (4 * CM_PER_IN) / 3)) / 1000));
  assert.notEqual(catalog.liters, estimated.liters);
  // one figure from the catalog: it wins, the other stays an estimate
  const dishOnly = frontChamber({ ...cone, dishDepthIn: 4 }, 1);
  assert.equal(dishOnly.estimated, true);
  assert.equal(dishOnly.clearanceIn, estimated.clearanceIn, "the surround stays estimated");
  assert.ok(dishOnly.liters !== estimated.liters, "the dish is the catalog's");
  const surroundOnly = frontChamber({ ...cone, surroundIn: 1.5 }, 1);
  assert.equal(surroundOnly.estimated, true);
  assert.ok(near(surroundOnly.clearanceIn, catalog.clearanceIn), "the surround is the catalog's");
  // the PA v2 drivers' drawings give neither figure: their front chambers are estimates
  for (const template of [SPEAKER_TEMPLATE.paV2SubBinTwo, SPEAKER_TEMPLATE.paV2MidBox]) {
    const cones = throatCones(templateSpeaker(template).cabinet.chambers[0].drivers);
    assert.ok(cones);
    assert.equal(frontChamber(cones.cone, cones.count).estimated, true, template);
  }
});
