// The horn's drawn path (lib/speaker/hornGeometry, read by the 3D view, the side and front drawings and the bracing's
// keep-out): its areas are the model's (the throat's, each segment's end, the mouth's, and every step between by the
// segment's flare law), its length is the segments', and it sits inside the box's clear room, folded or not. A path
// that does not fit says so, and is drawn as it is.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { hornPath, type HornPath, type HornPathInput } from "../src/lib/speaker/hornGeometry";
import { hornFlare, slotOpeningsAt, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD, PORT_SHAPE, SLOT_PLACE } from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { CM_PER_IN, CM2_PER_IN2 } from "../src/constants/units";
import type { HornSegment } from "../src/types";

const EPS = 1e-6;

/** A box 20 in wide and 24 high, 30 deep, with a 12 × 10 in mouth in its middle. */
const BOX: Pick<HornPathInput, "mouth" | "clear" | "depthIn" | "wallIn"> = {
  mouth: { x: -6, y: 7, w: 12, h: 10 },
  clear: { x: -10, y: 0, w: 20, h: 24 },
  depthIn: 30,
  wallIn: 0.75,
};
/** The mouth's area, cm², and a cone's cutout in the bay: two 8 in cones side by side. */
const MOUTH_CM2 = 12 * 10 * CM2_PER_IN2;
const DRIVERS = { x: -8.25, y: 8, w: 16.5, h: 8 };

const seg = (
  profile: HornSegment["profile"],
  s1: number,
  s2: number,
  length: number,
): HornSegment => ({
  profile,
  s1,
  s2,
  length,
});

/** Designs of one to three segments, each flare law and a straight duct among them. */
const DESIGNS: Record<string, HornSegment[]> = {
  "one conical": [seg(HORN_PROFILE.conical, 200, MOUTH_CM2, 40)],
  "one exponential": [seg(HORN_PROFILE.exponential, 200, MOUTH_CM2, 40)],
  "conical then exponential": [
    seg(HORN_PROFILE.conical, 200, 500, 15),
    seg(HORN_PROFILE.exponential, 500, MOUTH_CM2, 25),
  ],
  "three, with a straight duct": [
    seg(HORN_PROFILE.exponential, 200, 400, 12),
    seg(HORN_PROFILE.conical, 400, 400, 8),
    seg(HORN_PROFILE.conical, 400, MOUTH_CM2, 20),
  ],
};

const input = (segments: HornSegment[], extra: Partial<HornPathInput> = {}): HornPathInput => ({
  ...BOX,
  segments,
  areaScale: 1,
  drivers: DRIVERS,
  folded: false,
  ...extra,
});

/** The path, or a failed test. */
const pathOf = (i: HornPathInput): HornPath => {
  const path = hornPath(i);
  assert.ok(path, "the path draws");
  return path;
};

/** A segment's area `u` of the way along it (0 to 1), in², by its flare law as the model takes it. */
const lawArea = (s: HornSegment, u: number) => {
  const [a, b] = [s.s1 / CM2_PER_IN2, s.s2 / CM2_PER_IN2];
  if (Math.abs(a / b - 1) < 1e-4) return a;
  if (s.profile === HORN_PROFILE.exponential) return a * (b / a) ** u;
  return (Math.sqrt(a) + (Math.sqrt(b) - Math.sqrt(a)) * u) ** 2;
};

/** The distance along the path where each segment starts, in. */
const startsOf = (segments: readonly HornSegment[]) =>
  segments.map((_, i) => segments.slice(0, i).reduce((sum, g) => sum + g.length, 0) / CM_PER_IN);

/** Whether every section, turn and the bay is inside the box's clear room. */
function insideRoom(path: HornPath, i: HornPathInput) {
  const { clear, depthIn } = i;
  const within = (cx: number, cy: number, w: number, h: number) =>
    cx - w / 2 >= clear.x - EPS &&
    cx + w / 2 <= clear.x + clear.w + EPS &&
    cy - h / 2 >= clear.y - EPS &&
    cy + h / 2 <= clear.y + clear.h + EPS;
  for (const leg of path.legs)
    for (const s of leg.sections) {
      assert.ok(within(s.cx, s.cy, s.w, s.h), `section at ${s.s} in is inside the face`);
      assert.ok(s.z >= -EPS && s.z <= depthIn + EPS, `section at ${s.s} in is inside the depth`);
    }
  for (const t of path.turns) {
    assert.ok(within(t.cx, (t.y0 + t.y1) / 2, t.w, t.y1 - t.y0), "a turn is inside the face");
    assert.ok(t.z0 >= -EPS && t.z1 <= depthIn + EPS, "a turn is inside the depth");
  }
  if (path.bay) {
    const b = path.bay;
    assert.ok(within(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h), "the bay is inside the face");
    assert.ok(b.z0 >= -EPS && b.z1 <= depthIn + EPS, "the bay is inside the depth");
  }
}

test("horn geometry: the areas are the model's, at the throat, the mouth and every segment's end", () => {
  for (const [name, segments] of Object.entries(DESIGNS)) {
    const i = input(segments);
    const path = pathOf(i);
    assert.equal(path.legs.length, 1, `${name}: a straight path is one leg`);
    assert.equal(path.folds, 0);
    const sections = path.legs[0].sections;
    const area = (k: number) => sections[k].w * sections[k].h;
    // the throat and the mouth
    assert.ok(Math.abs(area(0) - segments[0].s1 / CM2_PER_IN2) < EPS, `${name}: throat area`);
    assert.ok(
      Math.abs(area(sections.length - 1) - segments[segments.length - 1].s2 / CM2_PER_IN2) < EPS,
      `${name}: mouth area`,
    );
    const mouth = sections[sections.length - 1];
    assert.ok(Math.abs(mouth.w - i.mouth.w) < EPS && Math.abs(mouth.h - i.mouth.h) < EPS, name);
    // every section, and so every segment's two ends, follows its segment's law
    const starts = startsOf(segments);
    for (const sec of sections) {
      const k = starts.findLastIndex((s) => s <= sec.s + 1e-9);
      const u = (sec.s - starts[k]) / (segments[k].length / CM_PER_IN);
      // at a joint the section is the end of the segment before or the start of the next, as a step has both
      const laws = [lawArea(segments[k], u), ...(k > 0 ? [lawArea(segments[k - 1], 1)] : [])];
      assert.ok(
        laws.some((a) => Math.abs(sec.w * sec.h - a) < 1e-6 * a),
        `${name}: area at ${sec.s.toFixed(2)} in`,
      );
    }
    for (let k = 0; k < segments.length; k++) {
      const [a, b] = [starts[k], starts[k] + segments[k].length / CM_PER_IN];
      for (const [at, cm2] of [
        [a, segments[k].s1],
        [b, segments[k].s2],
      ] as const)
        assert.ok(
          sections.some(
            (s) => Math.abs(s.s - at) < 1e-9 && Math.abs(s.w * s.h - cm2 / CM2_PER_IN2) < 1e-6,
          ),
          `${name}: a section holds segment ${k + 1}'s ${at === a ? "start" : "end"} area`,
        );
    }
  }
});

test("horn geometry: the path is the segments' length, the mouth is on the baffle and the walls are flat panels", () => {
  for (const [name, segments] of Object.entries(DESIGNS)) {
    const i = input(segments);
    const path = pathOf(i);
    const sum = segments.reduce((total, g) => total + g.length, 0) / CM_PER_IN;
    assert.ok(Math.abs(path.pathIn - sum) < EPS, `${name}: the path is the segments' length`);
    const sections = path.legs[0].sections;
    const [throat, mouth] = [sections[0], sections[sections.length - 1]];
    assert.ok(Math.abs(mouth.s - sum) < EPS && Math.abs(mouth.z) < EPS, `${name}: mouth at z 0`);
    assert.ok(
      Math.abs(throat.s) < EPS && Math.abs(throat.z - sum) < EPS,
      `${name}: throat at the far end`,
    );
    // a section's place along the path is its place along the depth, one for one
    for (const s of sections) assert.ok(Math.abs(s.z - (sum - s.s)) < EPS, name);
    // the top and the bottom are flat, the mouth's height apart; the axis is through the mouth's middle
    for (const s of sections) {
      assert.ok(Math.abs(s.h - i.mouth.h) < EPS, `${name}: constant height`);
      assert.ok(Math.abs(s.cy - (i.mouth.y + i.mouth.h / 2)) < EPS, `${name}: axis`);
      assert.ok(Math.abs(s.cx - (i.mouth.x + i.mouth.w / 2)) < EPS, `${name}: axis`);
    }
    // a conical segment is straight panels between its ends: two sections, no steps between
    sections.forEach((s, k) => {
      if (k > 0) assert.ok(s.s >= sections[k - 1].s - EPS, `${name}: sections run throat to mouth`);
    });
  }
  const conical = pathOf(input(DESIGNS["one conical"])).legs[0].sections.length;
  assert.equal(conical > 2, true, "a flaring segment is sampled, so its walls follow the law");
  const straight = pathOf(input([seg(HORN_PROFILE.conical, 400, 400, 20)])).legs[0].sections;
  assert.equal(straight.length, 2, "a straight duct is one panel between its ends");
});

test("horn geometry: the path fits the box's inside, and the bay of the drivers sits behind the throat", () => {
  for (const [name, segments] of Object.entries(DESIGNS)) {
    const i = input(segments);
    const path = pathOf(i);
    assert.ok(path.fits, `${name}: fits`);
    insideRoom(path, i);
    assert.ok(path.needs.depthIn <= i.depthIn + EPS, name);
    const [throat] = path.legs[0].sections;
    assert.ok(path.bay, name);
    assert.ok(Math.abs(path.bay.z0 - throat.z) < EPS, `${name}: the bay starts at the throat`);
    assert.ok(path.bay.z1 > path.bay.z0, `${name}: and runs behind it`);
  }
});

test("horn geometry: a path too long for the box is reported, and drawn as long as it is", () => {
  const long = [seg(HORN_PROFILE.conical, 200, MOUTH_CM2, 100)];
  const i = input(long);
  const path = pathOf(i);
  assert.equal(path.fits, false);
  const lengthIn = 100 / CM_PER_IN;
  assert.ok(path.needs.depthIn >= lengthIn - EPS, "it needs at least its own length");
  assert.ok(path.needs.depthIn > path.room.depthIn, "it needs more depth than the box has");
  const throat = path.legs[0].sections[0];
  assert.ok(
    Math.abs(throat.z - lengthIn) < EPS,
    "its throat is where the length puts it, past the back wall",
  );
});

test("horn geometry: a folded path runs in legs that add up to the path, in the box, joined at equal areas", () => {
  for (const [name, segments] of Object.entries(DESIGNS)) {
    // a box too shallow to run straight, tall enough to stack the legs
    const i = input(segments, {
      folded: true,
      depthIn: 20,
      clear: { x: -10, y: 0, w: 20, h: 40 },
      mouth: { x: -6, y: 15, w: 12, h: 10 },
    });
    const path = pathOf(i);
    assert.ok(path.folds >= 1, `${name}: folds`);
    assert.equal(path.legs.length, path.folds + 1);
    assert.equal(path.turns.length, path.folds);
    assert.ok(
      path.fits,
      `${name}: fits (needs ${JSON.stringify(path.needs)}, has ${JSON.stringify(path.room)})`,
    );
    insideRoom(path, i);
    // the legs' lengths along the depth are the path
    const lengths = path.legs.map((leg) => {
      const [a, b] = [leg.sections[0], leg.sections[leg.sections.length - 1]];
      assert.ok(
        Math.abs(Math.abs(a.z - b.z) - (b.s - a.s)) < EPS,
        `${name}: a leg's depth is its length`,
      );
      return b.s - a.s;
    });
    assert.ok(
      Math.abs(lengths.reduce((a, b) => a + b, 0) - path.pathIn) < 1e-6,
      `${name}: legs add up`,
    );
    // each leg starts where the one before ended, at the same area and the same distance along the path
    path.legs.slice(1).forEach((leg, k) => {
      const [end, start] = [path.legs[k].sections.at(-1), leg.sections[0]];
      assert.ok(end && Math.abs(end.s - start.s) < EPS, `${name}: legs meet along the path`);
      assert.ok(
        Math.abs(end.w * end.h - start.w * start.h) < 1e-6,
        `${name}: legs meet at one area`,
      );
      assert.ok(Math.abs(end.z - start.z) < EPS, `${name}: legs meet at one depth`);
    });
    // the first section is the throat's area, the last the mouth's, on the baffle
    const [first, last] = [path.legs[0].sections[0], path.legs.at(-1)?.sections.at(-1)];
    assert.ok(Math.abs(first.w * first.h - segments[0].s1 / CM2_PER_IN2) < EPS, name);
    assert.ok(last && Math.abs(last.z) < EPS && Math.abs(last.w - i.mouth.w) < EPS, name);
    assert.ok(
      last && Math.abs(last.cy - (i.mouth.y + i.mouth.h / 2)) < EPS,
      `${name}: the mouth is where set`,
    );
    // no two legs share any air: each leg's span up the box is its own
    const spans = path.legs.map((leg) => [
      Math.min(...leg.sections.map((s) => s.cy - s.h / 2)),
      Math.max(...leg.sections.map((s) => s.cy + s.h / 2)),
    ]);
    spans.forEach(([a0, a1], p) =>
      spans
        .slice(p + 1)
        .forEach(([b0, b1]) => assert.ok(a1 <= b0 + EPS || b1 <= a0 + EPS, `${name}: legs apart`)),
    );
  }
});

test("horn geometry: the PA v2 boxes draw their settings' areas, with the side slots beside the mouth", () => {
  for (const template of [
    SPEAKER_TEMPLATE.paV2SubBinOne,
    SPEAKER_TEMPLATE.paV2SubBinTwo,
    SPEAKER_TEMPLATE.paV2MidBox,
  ]) {
    const spec = templateSpeaker(template);
    const [placed] = speakerLayout(spec.cabinet).chambers;
    const { load, vent } = placed.chamber;
    assert.ok(load.kind === CHAMBER_LOAD.horn, template);
    const flare = hornFlare(spec.cabinet, placed);
    assert.ok(flare, template);
    const { segments } = load.horn;
    const scale = (flare.mouth.w * flare.mouth.h * CM2_PER_IN2) / segments[segments.length - 1].s2;
    const sections = flare.path.legs[0].sections;
    const first = sections[0],
      last = sections[sections.length - 1];
    assert.ok(
      Math.abs(first.w * first.h * CM2_PER_IN2 - segments[0].s1 * scale) < 1e-6,
      `${template}: throat`,
    );
    assert.ok(
      Math.abs(last.w * last.h * CM2_PER_IN2 - segments[segments.length - 1].s2 * scale) < 1e-6,
      template,
    );
    assert.ok(flare.path.fits, `${template}: the horn fits`);
    // the slots: one up each front side, on the baffle beside the mouth, never over it
    assert.ok(vent.kind === "vented" && vent.port.shape === PORT_SHAPE.slot, template);
    assert.equal(vent.port.place, SLOT_PLACE.sides, template);
    const t = spec.cabinet.panel.thicknessIn;
    const openings = slotOpeningsAt(placed, vent.port, t).map((o) => ({
      x0: placed.cx + o.x - o.w / 2,
      x1: placed.cx + o.x + o.w / 2,
      y0: placed.y0 + o.y,
      y1: placed.y0 + o.y + o.h,
      side: o.side,
    }));
    assert.deepEqual(
      openings.map((o) => o.side ?? 0).sort((a, b) => a - b),
      [-1, 1],
      `${template}: one slot each side`,
    );
    const [left, right] = [openings.find((o) => o.side === -1), openings.find((o) => o.side === 1)];
    assert.ok(left && right);
    assert.ok(
      left.x0 >= placed.clear.x - EPS && right.x1 <= placed.clear.x + placed.clear.w + EPS,
      template,
    );
    assert.ok(
      left.x1 <= flare.mouth.x + EPS && right.x0 >= flare.mouth.x + flare.mouth.w - EPS,
      `${template}: beside the mouth`,
    );
    assert.ok(
      left.y1 <= placed.clear.y + placed.clear.h + EPS && left.y0 >= placed.clear.y - EPS,
      template,
    );
    // the mouth is the settings' (the sub bins' fills the face beside the slots), never the whole clear face
    assert.ok(flare.mouth.w < placed.clear.w, template);
  }
});
