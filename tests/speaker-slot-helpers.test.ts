// The slot and tube helpers the Speaker page's vent settings stand on: the fins' count and layout, the fold's clamp, the
// elbow count, the horn's compression ratio, and a slot's kind and position (the settings keep what they can).
import { expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  foldedRearWallIn,
  maxFoldedSlotIn,
  maxSlotFins,
  minFoldedSlotIn,
  slotFinLayout,
  slotFinsOf,
  slotFolds,
} from "../src/lib/acoustics/boxModels";
import { ELBOW_COUNTS, elbowCountOf } from "../src/lib/build/tubeFold";
import { withCompressionRatio } from "../src/pages/speaker/hornSections";
import { withSlotKind, withSlotPlace } from "../src/lib/speaker/slotPort";
import { chamberVentModel } from "../src/lib/speaker/chamberAir";
import { chamberClearFace } from "../src/lib/speaker/chamberAir";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { PortFields } from "../src/pages/speaker/ChamberSettings";
import { SLOT_PLACE_NAMES } from "../src/constants/speakerPage";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import {
  PA_SLOT_FINS,
  PORT_SHAPE,
  SLOT_KIND,
  SLOT_PLACE,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type { SpeakerSlotPort } from "../src/types";

const T = 0.75;

test("maxSlotFins: each opening keeps the ply's width and half the slot's height", () => {
  // least opening = max(0.75, 2.25 / 2) = 1.125: (22.37 - 1.125) / (0.75 + 1.125) = 11.3
  expect(maxSlotFins(22.37, T, 2.25)).toBe(11);
  // a thin slot is held by the ply: least = 0.75, (10 - 0.75) / 1.5 = 6.2
  expect(maxSlotFins(10, T, 0.5)).toBe(6);
  // the clamp at small widths: no room for a fin, never negative
  expect(maxSlotFins(1, T, 2.25)).toBe(0);
  expect(maxSlotFins(0, T, 2.25)).toBe(0);
});

test("slotFinsOf: the vent's count held to the most, else the default of two", () => {
  expect(slotFinsOf({ fins: undefined, slotH: 2.25 }, 22.37, T)).toBe(PA_SLOT_FINS);
  expect(PA_SLOT_FINS).toBe(2);
  // the default stays two, whatever the width (the PA page's results do not change)
  expect(slotFinsOf({ fins: undefined, slotH: 2.25 }, 1, T)).toBe(2);
  expect(slotFinsOf({ fins: 0, slotH: 2.25 }, 22.37, T)).toBe(0);
  expect(slotFinsOf({ fins: 3, slotH: 2.25 }, 22.37, T)).toBe(3);
  // a set count is held to the most the width takes
  expect(slotFinsOf({ fins: 20, slotH: 2.25 }, 22.37, T)).toBe(11);
  expect(slotFinsOf({ fins: 4, slotH: 2.25 }, 1, T)).toBe(0);
});

test("slotFinLayout: equal openings, fins between them, centered across", () => {
  const none = slotFinLayout(10, 1, 0);
  expect(none.open).toBe(10);
  expect(none.centers).toEqual([]);
  expect(none.openings).toEqual([0]);

  const two = slotFinLayout(10, 1, 2);
  expect(two.open).toBeCloseTo(8 / 3, 10);
  expect(two.centers).toHaveLength(2);
  expect(two.openings).toHaveLength(3);
  // symmetric about the center line, one opening's width and a fin apart
  expect(two.centers[0]).toBeCloseTo(-two.centers[1], 10);
  expect(two.centers[1] - two.centers[0]).toBeCloseTo(two.open + 1, 10);
  expect(two.openings[1]).toBeCloseTo(0, 10);
  // the openings and the fins fill the width
  expect(3 * two.open + 2 * 1).toBeCloseTo(10, 10);
});

test("slotFolds: only a slot longer than the straight run folds, and its rear wall is clamped", () => {
  const box = { d: 18, h: 32 };
  const slotH = 2.25;
  const straight = box.d - T - slotH; // 15
  expect(slotFolds(box, { slotH, len: straight }, T)).toBe(false);
  expect(slotFolds(box, { slotH, len: straight + 0.01 }, T)).toBe(true);
  // the wall is the length past the box's depth, never under the least rise (1 in) nor over the most
  const most = box.h - 2 * T - 2 * slotH; // 26
  expect(foldedRearWallIn(box, { slotH, len: 16 }, T)).toBe(1);
  expect(foldedRearWallIn(box, { slotH, len: 30 }, T)).toBeCloseTo(30 - (box.d - T), 10);
  expect(foldedRearWallIn(box, { slotH, len: 60 }, T)).toBe(most);
  // the buildable folded lengths run from the least rise to the most
  expect(minFoldedSlotIn(box, T)).toBeCloseTo(box.d - T + 1, 10);
  expect(maxFoldedSlotIn(box, slotH, T)).toBeCloseTo(box.d - T + most, 10);
});

test("elbowCountOf: the nearest count the tube rules know", () => {
  expect(ELBOW_COUNTS.map(elbowCountOf)).toEqual([0, 1, 2]);
  expect(elbowCountOf(0.4)).toBe(0);
  expect(elbowCountOf(0.6)).toBe(1);
  expect(elbowCountOf(1.4)).toBe(1);
  expect(elbowCountOf(1.6)).toBe(2);
  // a tie goes to the fewer elbows
  expect(elbowCountOf(0.5)).toBe(0);
  expect(elbowCountOf(1.5)).toBe(1);
  // out of range: the end counts
  expect(elbowCountOf(-3)).toBe(0);
  expect(elbowCountOf(9)).toBe(2);
});

test("withCompressionRatio: only the throat changes, and the input stays", () => {
  const segments = [
    { profile: HORN_PROFILE.parabolic, s1: 1000, s2: 4000, length: 40 },
    { profile: HORN_PROFILE.parabolic, s1: 4000, s2: 6000, length: 10 },
  ];
  const before = structuredClone(segments);
  const set = withCompressionRatio(segments, 2000, 4);
  expect(set[0]).toEqual({ ...segments[0], s1: 500 });
  expect(set[1]).toEqual(segments[1]);
  expect(segments).toEqual(before);
  expect(withCompressionRatio([], 2000, 4)).toEqual([]);
});

const slot = (extra: Partial<SpeakerSlotPort> = {}): SpeakerSlotPort => ({
  shape: PORT_SHAPE.slot,
  n: 2,
  h: 1.5,
  len: 9,
  folded: true,
  ...extra,
});

test("slot position: Floor and Front sides round-trip and survive a kind switch", () => {
  expect(Object.keys(SLOT_PLACE_NAMES)).toEqual(Object.keys(SLOT_PLACE));
  const floor = slot();
  const sides = withSlotPlace(floor, SLOT_PLACE.sides);
  expect(sides.place).toBe(SLOT_PLACE.sides);
  // the other settings stay
  expect(sides).toEqual({ ...floor, place: SLOT_PLACE.sides });
  // back to the floor: the same slot as before
  expect(withSlotPlace(sides, SLOT_PLACE.floor)).toEqual(floor);

  // a kind switch keeps the position, to the divided slot and back
  const divided = withSlotKind(sides, SLOT_KIND.letterbox);
  expect(divided.fins).toBe(PA_SLOT_FINS);
  expect(divided.place).toBe(SLOT_PLACE.sides);
  const open = withSlotKind(divided, SLOT_KIND.plain);
  expect(open.fins).toBeUndefined();
  expect(open.place).toBe(SLOT_PLACE.sides);
  // the sizes the kinds share stay; the open slot's own settings reset
  expect(open).toEqual({ shape: PORT_SHAPE.slot, n: 1, h: 1.5, len: 9, place: SLOT_PLACE.sides });
  // a floor slot gains no position
  expect("place" in withSlotKind(floor, SLOT_KIND.plain)).toBe(false);
  // a count change keeps it too (the settings spread the slot)
  expect({ ...sides, n: 3 }.place).toBe(SLOT_PLACE.sides);
});

test("slot position: the settings show the toggle for an open slot, set to the slot's position, and no long side", () => {
  const render = (port: SpeakerSlotPort) =>
    renderToStaticMarkup(
      createElement(PortFields, {
        port,
        walls: { nominal: "3/4", thicknessIn: T },
        chamber: { dims: { w: 24, h: 32, d: 18 }, drivers: [] },
        clearW: 22.5,
        onChange: () => {},
      }),
    );
  const { floor, sides } = SLOT_PLACE_NAMES;
  const onFloor = render(slot());
  expect(onFloor).toContain(floor);
  expect(onFloor).toContain(sides);
  expect(onFloor).toMatch(/aria-pressed="true"[^>]*>Floor|Floor<\/button>/);
  // an open slot runs the whole clear face: the settings have no long side to set
  const up = render(slot({ place: SLOT_PLACE.sides }));
  for (const html of [onFloor, up]) {
    expect(html).not.toContain("long side");
    expect(html).not.toContain('value="30.5"');
    expect(html).not.toContain('value="22.5"');
  }
  // a divided slot has no position
  expect(render(slot({ fins: 2, folded: undefined }))).not.toContain(sides);
});

test("slot position: an open slot runs the clear face, its height up the sides; a divided slot is always on the floor", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);
  const chamber = spec.cabinet.chambers.find(
    (c) => c.vent.kind === VENT_KIND.vented && c.vent.port.shape === PORT_SHAPE.slot,
  );
  if (!chamber || chamber.vent.kind !== VENT_KIND.vented) throw new Error("no slot chamber");
  const { port } = chamber.vent;
  if (port.shape !== PORT_SHAPE.slot) throw new Error("not a slot");
  const face = chamberClearFace(spec.cabinet, chamber);
  const withPort = (p: SpeakerSlotPort) => ({
    ...chamber,
    vent: { ...chamber.vent, port: p },
  });
  const model = (p: SpeakerSlotPort) => chamberVentModel(spec.cabinet, withPort(p));

  // up the sides: the clear height
  const up = { ...port, place: SLOT_PLACE.sides };
  expect(model(up)?.areaIn2).toBeCloseTo(port.n * port.h * face.h, 8);
  // on the floor: the clear width
  const onFloor = { ...port, place: undefined };
  expect(model(onFloor)?.areaIn2).toBeCloseTo(port.n * port.h * face.w, 8);
  // a divided slot is on the floor whatever its position
  const divided = { ...onFloor, n: 1, fins: 2 };
  expect(model({ ...divided, place: SLOT_PLACE.sides })).toEqual(model(divided));
});
