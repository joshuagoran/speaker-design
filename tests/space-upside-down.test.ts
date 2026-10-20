// A placement stood upside down on the Space page (lib/speaker/spaceLayout `placementFrame`): the box turns over about
// its front-to-back axis, so what is near its top comes near its bottom. Its spot, aim and lift stay as set; the lift is
// still the gap under it. Coupling and loading read the turned box; an old save or link reads as upright.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { bandOfPart } from "../src/lib/speaker/spaceCoverage";
import { spaceCoupling } from "../src/lib/speaker/spaceCoupling";
import { boxLoadings } from "../src/lib/speaker/spaceLoading";
import { spaceLayout, type PlacedItem } from "../src/lib/speaker/spaceLayout";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { spacePlacement, stackMember } from "../src/lib/speaker/specParts";
import { emptySpace, spaceFromSaved, spaceSnapshot } from "../src/pages/space/spaceSaves";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { spaceEnvelope } from "../src/lib/io/shareLink";
import { readEnvelope } from "../src/lib/io/shareChecks";
import { openEnvelope } from "../src/pages/share/openShare";
import { COUPLED_CEILING, COUPLED_FLOOR, DRIVER_PART } from "../src/constants/space";
import { SPACE_ITEM } from "../src/constants/speakerSpec";
import { SHARE_KIND } from "../src/constants/share";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { INCHES_PER_FOOT, RAD } from "../src/constants/units";
import type { SpaceDesign, SpacePlacement, SpeakerSpec, StackSpec } from "../src/types";

/** A tower with its horn in the baffle near the top; a horn sub bin (a horn-loaded mouth); a monitor. */
const TOWER: SpeakerSpec = { ...templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn), id: "tower" };
const BIN: SpeakerSpec = { ...templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne), id: "bin" };
const MONITOR: SpeakerSpec = { ...templateSpeaker(SPEAKER_TEMPLATE.monitorHorn), id: "monitor" };
/** The monitor tilted 10° up in a stack of its own. */
const TILTED: StackSpec = {
  id: "tilted",
  name: "Tilted",
  notes: "",
  members: [
    {
      ...stackMember(MONITOR.id, MONITOR.input),
      pose: { xIn: 0, yIn: 0, zIn: 0, on: null, pitchDeg: 10 },
    },
  ],
};
const TOWER_ITEM = { kind: SPACE_ITEM.speaker, id: TOWER.id } as const;
const BIN_ITEM = { kind: SPACE_ITEM.speaker, id: BIN.id } as const;
const TILTED_ITEM = { kind: SPACE_ITEM.stack, id: TILTED.id } as const;
/** The tower's height, in. */
const TOWER_H = speakerLayout(TOWER.cabinet).size.h;
const BIN_H = speakerLayout(BIN.cabinet).size.h;

const BASE = emptySpace();
const ROOM = BASE.space.venue.room;

const spaceOf = (placements: SpacePlacement[]): SpaceDesign => ({
  ...BASE,
  space: { ...BASE.space, placements },
  stacks: [TILTED],
  speakers: [TOWER, BIN, MONITOR],
});

const laidOut = (placements: SpacePlacement[]) => spaceLayout(spaceOf(placements), bandOfPart);

/** A placement at (x, y) ft, lifted `liftIn`, upside down or not. */
const at = (
  item: SpacePlacement["item"],
  x: number,
  liftIn: number,
  upsideDown: boolean,
  mirrored = false,
): SpacePlacement => ({ ...spacePlacement({ x, y: 6 }, item, liftIn, { mirrored }), upsideDown });

/** The HF driver's height above the floor, in. */
const hfHeightIn = (item: PlacedItem) => {
  const hf = item.drivers.find((d) => d.part === DRIVER_PART.hf);
  assert.ok(hf, "the tower has an HF driver");
  return hf.at.z * INCHES_PER_FOOT;
};

/** The box's corners' span on the floor and in height, ft. */
const extent = (item: PlacedItem) => {
  const corners = item.boxes.flatMap((b) => b.corners);
  const span = (k: "x" | "y" | "z") => [
    Math.min(...corners.map((c) => c[k])),
    Math.max(...corners.map((c) => c[k])),
  ];
  return { x: span("x"), y: span("y"), z: span("z") };
};

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;
const nearAll = (a: number[], b: number[]) => a.every((v, k) => near(v, b[k]));

test("upside down: the horn near the top comes near the bottom, on the same footprint", () => {
  const [upright] = laidOut([at(TOWER_ITEM, 2, 0, false)]);
  const [over] = laidOut([at(TOWER_ITEM, 2, 0, true)]);
  const hfUp = hfHeightIn(upright);
  assert.ok(hfUp > TOWER_H * 0.7, "the horn is near the top");
  assert.ok(near(hfHeightIn(over), TOWER_H - hfUp));
  const e1 = extent(upright),
    e2 = extent(over);
  assert.ok(nearAll(e1.x, e2.x) && nearAll(e1.y, e2.y) && nearAll(e1.z, e2.z));
  // the driver still points the same way
  assert.deepEqual(
    over.drivers.map((d) => [d.yaw, d.pitch]),
    upright.drivers.map((d) => [d.yaw, d.pitch]),
  );
});

test("upside down: the lift is still the gap under the box", () => {
  const [over] = laidOut([at(TOWER_ITEM, 0, 30, true)]);
  const { z } = extent(over);
  assert.ok(near(z[0] * INCHES_PER_FOOT, 30));
  assert.ok(near(z[1] * INCHES_PER_FOOT, 30 + TOWER_H));
  assert.ok(
    near(hfHeightIn(over), 30 + TOWER_H - hfHeightIn(laidOut([at(TOWER_ITEM, 0, 0, false)])[0])),
  );
});

test("upside down: a box tilted up in its stack aims down", () => {
  const [upright] = laidOut([at(TILTED_ITEM, 0, 0, false)]);
  const [over] = laidOut([at(TILTED_ITEM, 0, 0, true)]);
  assert.ok(near(upright.drivers[0].pitch, 10 * RAD));
  assert.ok(near(over.drivers[0].pitch, -10 * RAD));
  assert.ok(near(upright.boxes[0].pitch, -over.boxes[0].pitch));
});

test("upside down: a mirrored pair's image is upside down too", () => {
  const [asSet, image] = laidOut([at(TOWER_ITEM, -4, 0, true, true)]);
  assert.ok(image.placement.image && image.placement.upsideDown);
  assert.ok(near(hfHeightIn(image), hfHeightIn(asSet)));
  assert.ok(hfHeightIn(image) < TOWER_H * 0.3, "the image's horn is near its bottom");
  assert.ok(
    nearAll(
      extent(image).x,
      extent(asSet)
        .x.map((v) => -v)
        .reverse(),
    ),
  );
});

test("upside down: flown at the ceiling it couples with the ceiling, not the floor; on the floor, the floor", () => {
  const ceilingLift = ROOM.ceilingFt * INCHES_PER_FOOT - BIN_H;
  const coupled = (placement: SpacePlacement) => {
    const items = laidOut([placement]);
    return { items, boxes: spaceCoupling(items, ROOM).boxes };
  };
  const flown = coupled(at(BIN_ITEM, 0, ceilingLift, true));
  assert.deepEqual(flown.boxes[0].surfaces, [COUPLED_CEILING]);
  assert.deepEqual(flown.boxes[0].members[0].surfaces, [COUPLED_CEILING]);
  assert.deepEqual(coupled(at(BIN_ITEM, 0, 0, true)).boxes[0].surfaces, [COUPLED_FLOOR]);
  // its horn takes its load from the ceiling as it would from the floor
  const loading = (c: ReturnType<typeof coupled>) => boxLoadings(c.items, c.boxes)[0][0];
  assert.deepEqual(loading(flown), loading(coupled(at(BIN_ITEM, 0, 0, true))));
});

test("upside down: an old save or link without it reads as upright", () => {
  const design = spaceOf([at(TOWER_ITEM, 0, 0, false)]);
  const { upsideDown: _upsideDown, ...old } = design.space.placements[0];
  const snapshot = spaceSnapshot(design);
  const saved = { ...snapshot, space: { ...snapshot.space, placements: [old] } };
  const opened = spaceFromSaved({ ...saved, id: "doc", name: "Old", savedAt: 1 });
  assert.equal(opened?.space.placements[0].upsideDown, false);
  // a link: the check takes it without the field, or with a boolean, and not with anything else
  const envelope = spaceEnvelope(design);
  /** the link's envelope as it reads back (JSON drops undefined fields), with the placement and `extra` */
  const withPlacement = (extra: object): unknown =>
    JSON.parse(
      JSON.stringify({
        ...envelope,
        spaces: [{ ...envelope.spaces[0], placements: [{ ...old, ...extra }] }],
      }),
    );
  const read = readEnvelope(withPlacement({}));
  assert.ok(read.ok);
  const shared = openEnvelope(read.envelope);
  assert.ok(shared?.kind === SHARE_KIND.space);
  assert.equal(shared.design.space.placements[0].upsideDown, false);
  assert.ok(!readEnvelope(withPlacement({ upsideDown: "yes" })).ok);
  assert.ok(readEnvelope(withPlacement({ upsideDown: true })).ok);
});
