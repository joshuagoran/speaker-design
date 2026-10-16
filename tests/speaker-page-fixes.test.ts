// Speaker page fixes: stuffing held to what real fill gives, flared tubes for any cone, and a horn's rear slot narrowed
// by its fins.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { stuffedLiters, tubeDriverOf } from "../src/lib/speaker/chamberAir";
import { STUFFING_MAX_PCT } from "../src/constants/speakerSteps";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { DRIVER_KIND, PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import { CM2_PER_IN2 } from "../src/constants/units";
import { driverOfKind } from "../src/pages/speaker/speakerParts";
import { frontLoadedOf, roomOf } from "./horn-room";
import type { SpeakerChamber } from "../src/types";

test("stuffing makes a box act larger by at most what packed fill gives", () => {
  assert.ok(Math.abs(stuffedLiters({ stuffingPct: 10 }, 100) - 110) < 1e-9);
  assert.ok(
    Math.abs(stuffedLiters({ stuffingPct: 300 }, 100) - 100 * (1 + STUFFING_MAX_PCT / 100)) < 1e-9,
  );
  assert.equal(stuffedLiters({ stuffingPct: -5 }, 100), 100);
});

test("flared tubes take any cone driver, laid out round the nearer of 15″ and 18″", () => {
  const [bin] = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo).cabinet.chambers;
  const woofer = driverOfKind(DRIVER_KIND.woofer, bin.drivers[0]);
  const read = tubeDriverOf({ drivers: [woofer] });
  assert.ok(read, "a woofer takes flared tubes");
  assert.ok(read.size === 15 || read.size === 18);
  assert.equal(tubeDriverOf({ drivers: [] }), null);
});

test("a horn's rear slot loses its fins' thickness from its open area", () => {
  const [bin] = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo).cabinet.chambers;
  const vent = bin.vent;
  assert.ok(vent.kind === VENT_KIND.vented, "the bin is vented");
  const slotWith = (fins: number): SpeakerChamber => ({
    ...bin,
    vent: { ...vent, port: { shape: PORT_SHAPE.slot, n: 1, h: 3, len: 12, fins } },
  });
  const areaOf = (fins: number) =>
    frontLoadedOf(hornDesignOf(slotWith(fins), { count: 1, angle: 2 }, roomOf(bin))).rear.port
      ?.area ?? 0;
  assert.ok(Math.abs(areaOf(0) - areaOf(2) - 2 * 3 * 0.75 * CM2_PER_IN2) < 1e-6);
});
