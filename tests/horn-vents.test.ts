import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { HORN_PORT_SHAPES, hornVentKinds } from "../src/lib/speaker/hornDesign";
import { hornPort, hornVentFrom } from "../src/pages/speaker/hornVents";
import { withChamberLoad, hornRoom } from "../src/pages/speaker/chamberLoad";
import { evaluateSpeaker } from "../src/lib/speaker/optimize/evaluate";
import { DEFAULT_PORTS, DEFAULT_VENTS } from "../src/pages/speaker/speakerParts";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  PORT_SHAPE,
  SLOT_PLACE,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import { PANEL } from "../src/constants/cutParts";
import type { SpeakerSpec } from "../src/types";

const midBox = templateSpeaker(SPEAKER_TEMPLATE.paV2MidBox);
const [chamber] = midBox.cabinet.chambers;
const duct = { ...DEFAULT_VENTS.vented, port: DEFAULT_PORTS.duct };

test("horn vents: a tapped horn takes none; the others take a round port or slots", () => {
  assert.deepEqual(hornVentKinds(HORN_DRIVE.tapped), [VENT_KIND.sealed]);
  assert.deepEqual(hornVentKinds(HORN_DRIVE.front), [VENT_KIND.sealed, VENT_KIND.vented]);
  assert.ok(!hornVentKinds(HORN_DRIVE.offset).includes(VENT_KIND.radiator));
  assert.deepEqual(HORN_PORT_SHAPES, [PORT_SHAPE.round, PORT_SHAPE.slot]);
});

test("horn vents: every vent the rule takes is modeled on a straight horn", () => {
  assert.ok(chamber);
  for (const vent of [
    DEFAULT_VENTS.sealed,
    hornPort(chamber, 20, PORT_SHAPE.slot),
    hornPort(chamber, 20, PORT_SHAPE.round),
  ]) {
    const spec: SpeakerSpec = {
      ...midBox,
      cabinet: { ...midBox.cabinet, chambers: [{ ...chamber, vent }] },
    };
    assert.deepEqual(evaluateSpeaker(spec).response.chambers[0]?.gaps, []);
  }
});

test("horn vents: the starting slots are two, at the front sides, and the round port is on the back", () => {
  assert.ok(chamber);
  const slots = hornPort(chamber, 20, PORT_SHAPE.slot);
  assert.ok(slots.port.shape === PORT_SHAPE.slot);
  assert.equal(slots.port.n, 2);
  assert.equal(slots.port.place, SLOT_PLACE.sides);
  assert.ok(slots.port.h > 0 && slots.port.len > 0);
  const round = hornPort(chamber, 20, PORT_SHAPE.round);
  assert.ok(round.port.shape === PORT_SHAPE.round);
  assert.equal(round.port.position?.panel, PANEL.back);
});

test("horn vents: turning into a horn keeps a port as the horn's, and seals what the horn can't take", () => {
  assert.ok(chamber);
  assert.equal(hornVentFrom(duct, chamber, 20).kind, VENT_KIND.sealed);
  assert.equal(hornVentFrom(DEFAULT_VENTS.radiator, chamber, 20).kind, VENT_KIND.sealed);
  const round = hornVentFrom(DEFAULT_VENTS.vented, chamber, 20);
  assert.ok(round.kind === VENT_KIND.vented && round.port.shape === PORT_SHAPE.round);
  const box = { ...chamber, load: { kind: CHAMBER_LOAD.direct }, vent: duct, netLiters: null };
  const horn = withChamberLoad(
    box,
    CHAMBER_LOAD.horn,
    hornRoom(midBox.cabinet, box, undefined),
    undefined,
  );
  assert.equal(horn.vent.kind, VENT_KIND.sealed);
});
