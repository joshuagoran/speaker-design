// The Speaker page's results pane: each band's one color (lib/speaker/bandColor), a driver dragged on the front drawing
// (lib/speaker/driverDrag), the side and top drawings (drawings/SpeakerSide, drawings/SpeakerTop), the point a position field marks, the 3D view's
// drivers hidden and a horn chamber's inside, the bracing check and the Details fold's bullets.
import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import * as THREE from "three";
import { PALETTES, bandLine } from "../src/styles/palette";
import { bandColor } from "../src/lib/speaker/bandColor";
import {
  DRAG_STEP_IN,
  dragStart,
  draggedPosition,
  othersKey,
  unblockedPosition,
} from "../src/lib/speaker/driverDrag";
import { SpeakerSide, speakerSideFrame } from "../src/components/drawings/SpeakerSide";
import { SpeakerFront } from "../src/components/drawings/SpeakerFront";
import { SpeakerTop, speakerTopFrame } from "../src/components/drawings/SpeakerTop";
import { VIEW_PX } from "../src/components/drawings/speakerDrawing";
import {
  buildSpeakerScene,
  SPEAKER_GROUP_NAMES,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { HIFI_CABINET_MESH_NAMES } from "../src/components/stack-view/buildHifiCabinet";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { speakerDetails } from "../src/pages/speaker/speakerDetails";
import { shownView } from "../src/pages/speaker/positionFocus";
import { chamberBraceChips, chamberUnbraced } from "../src/lib/speaker/fitChips";
import { cabinetBuild } from "../src/lib/speaker/speakerBuild";
import {
  driverAcrossIn,
  driverSpots,
  hornFlare,
  speakerLayout,
} from "../src/lib/speaker/speakerLayout";
import { foldDrawing } from "../src/lib/speaker/foldHorn";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { POSITION_AXIS, SPEAKER_DETAILS_TEXT, SPEAKER_VIEW } from "../src/constants/speakerResults";
import { NO_BRACING } from "../src/constants/bracing";
import type { SpeakerCabinet } from "../src/types";
import { CABINET_CONSTRUCTION, HORN_PLACEMENT } from "../src/constants/speakerSpec";

const light = PALETTES.light;
const bands = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}` }));

describe("band colors", () => {
  test("low to high: yellow, magenta (every second dashed), cyan; one band is yellow", () => {
    expect(bandLine(light, 0, 1)).toEqual({ stroke: light.yellowLine });
    expect([0, 1, 2].map((i) => bandLine(light, i, 3))).toEqual([
      { stroke: light.yellowLine },
      { stroke: light.magenta },
      { stroke: light.cyan },
    ]);
    expect(bandLine(light, 2, 4)).toEqual({ stroke: light.magenta, dash: expect.any(String) });
  });
  test("a band's color by id: a dashed band's swatch is a ring; an unknown id is muted", () => {
    const four = bands(4);
    expect(bandColor(four, "b0", light)).toEqual({ stroke: light.yellowLine, ring: false });
    expect(bandColor(four, "b2", light).ring).toBe(true);
    expect(bandColor(four, "b3", light)).toEqual({ stroke: light.cyan, ring: false });
    expect(bandColor(four, "nope", light)).toEqual({ stroke: light.muted, ring: false });
  });
  test("the yellow line reads in the dark theme as the brand yellow", () => {
    expect(PALETTES.dark.yellowLine).toBe(PALETTES.dark.yellow);
  });
});

describe("a driver dragged on the front drawing", () => {
  const placed = { cx: 0, y0: 0, clear: { x: -5, y: 1, w: 10, h: 20 } };
  test("its group's center and the range that keeps the group on the clear face", () => {
    const { center, bounds } = dragStart(
      placed,
      [
        { xIn: -1, yIn: 8 },
        { xIn: 3, yIn: 8 },
      ],
      2,
    );
    expect(center).toEqual({ xIn: 1, yIn: 8 });
    // the group reaches 2 + 1 across: the center stays 3 in off each side; one driver high, 1 in off the top and bottom
    expect(bounds.x).toEqual([-2, 2]);
    expect(bounds.y).toEqual([2, 20]);
  });
  test("a group wider than the face stays at its middle", () => {
    const { bounds } = dragStart(placed, [{ xIn: 0, yIn: 5 }], 12);
    expect(bounds.x).toEqual([0, 0]);
  });
  test("moved by the pointer, kept inside and rounded to the step", () => {
    const bounds = { x: [-2, 2] as const, y: [2, 20] as const };
    const at = draggedPosition({ xIn: 0, yIn: 10 }, { xIn: 0.33, yIn: -1.2 }, bounds);
    expect(at.xIn % DRAG_STEP_IN).toBe(0);
    expect(at).toEqual({ xIn: 0.25, yIn: 8.75 });
    expect(draggedPosition({ xIn: 0, yIn: 10 }, { xIn: 9, yIn: 99 }, bounds)).toEqual({
      xIn: 2,
      yIn: 20,
    });
  });
  test("stops where it would push another driver aside", () => {
    const { cabinet } = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
    const placed = speakerLayout(cabinet).chambers[0];
    expect(placed).toBeDefined();
    if (!placed) return;
    // the lowest driver dragged straight up onto the one above it
    const spots = placed.chamber.drivers.map((d) =>
      dragStart(placed, driverSpots(placed, d), driverAcrossIn(d)),
    );
    const low = spots.reduce(
      (lo, s, i) => (s.center.yIn < (spots[lo]?.center.yIn ?? Infinity) ? i : lo),
      0,
    );
    const from = spots[low]?.center ?? { xIn: 0, yIn: 0 };
    const others = othersKey(cabinet, 0, low, from);
    const aim = { xIn: from.xIn, yIn: placed.dims.h };
    expect(othersKey(cabinet, 0, low, aim)).not.toBe(others);
    const at = unblockedPosition(cabinet, 0, low, others, from, aim);
    expect(at.yIn).toBeGreaterThan(from.yIn);
    expect(at.yIn).toBeLessThan(aim.yIn);
    expect(othersKey(cabinet, 0, low, at)).toBe(others);
  });
});

describe("the side drawing", () => {
  const html = (s: Parameters<typeof SpeakerSide>[0]["spec"], focus = null) =>
    renderToString(createElement(SpeakerSide, { spec: s, focus }));
  test("it spans the speaker's depth and height, the fronts lined up", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
    const frame = speakerSideFrame(spec.cabinet);
    const { size } = speakerLayout(spec.cabinet);
    expect(frame.depth).toBeGreaterThanOrEqual(size.d);
    expect(frame.maxY).toBeGreaterThanOrEqual(size.h);
    const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(html(spec));
    expect(viewBox).not.toBeNull();
  });
  test("a box chamber shows its drivers in their band's color", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
    const out = html(spec);
    for (const band of spec.bands)
      expect(out).toContain(bandColor(spec.bands, band.id, light).stroke);
  });
  test("a drawn fold shows each of its boards", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.th18);
    const drawing = foldDrawing(spec.cabinet, spec.cabinet.chambers[0]);
    expect(drawing).not.toBeNull();
    const out = html(spec);
    // a board is a four-point polygon in the wall's colors
    const boards = [...out.matchAll(/<polygon points="([^"]+)"[^>]*fill="#e6e6e6"/g)];
    expect(boards.length).toBe(drawing?.fold.boards.length);
  });
  test("a horn on the top's depth field marks the front edge", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.paMidHighBox);
    const chamber = spec.cabinet.chambers.findIndex((c) =>
      c.drivers.some((d) => d.horn?.placement === HORN_PLACEMENT.top),
    );
    const driver = spec.cabinet.chambers[chamber].drivers.findIndex(
      (d) => d.horn?.placement === HORN_PLACEMENT.top,
    );
    const marked = renderToString(
      createElement(SpeakerSide, {
        spec,
        focus: { chamber, driver, axis: POSITION_AXIS.back },
      }),
    );
    expect(marked).toContain('aria-hidden="true"');
    expect(html(spec)).not.toContain('aria-hidden="true"');
  });
});

describe("the top drawing", () => {
  const html = (s: Parameters<typeof SpeakerTop>[0]["spec"]) =>
    renderToString(createElement(SpeakerTop, { spec: s }));
  const ids = [
    SPEAKER_TEMPLATE.paSubBox,
    SPEAKER_TEMPLATE.hifiTwoWay,
    SPEAKER_TEMPLATE.th18,
    SPEAKER_TEMPLATE.paV2SubBinTwo,
  ];
  test.each(ids)("%s: it renders with its label and its drivers in their band's color", (id) => {
    const spec = templateSpeaker(id);
    const out = html(spec);
    expect(out).toMatch(/aria-label="Top view, each chamber cut through the middle, [^"]+"/);
    expect(out).toMatch(/viewBox="0 0 [\d.]+ [\d.]+"/);
    const used = spec.cabinet.chambers.flatMap((c) => c.drivers.flatMap((d) => d.bands));
    expect(used.length).toBeGreaterThan(0);
    for (const band of used) expect(out).toContain(bandColor(spec.bands, band, light).stroke);
  });
  test("a straight horn shows its legs and the front chamber (dashed)", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
    expect(speakerLayout(spec.cabinet).chambers.some((p) => hornFlare(spec.cabinet, p))).toBe(true);
    const out = html(spec);
    expect(out).toContain("<polygon");
    expect(out).toContain('stroke-dasharray="3 2"');
  });
  test("a drawn fold shows the boards the cut crosses", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.th18);
    expect(foldDrawing(spec.cabinet, spec.cabinet.chambers[0])).not.toBeNull();
    // the chamber's walls are one rect in the wall's colors; each board the cut crosses is one more
    const walls = html(spec).match(/<rect[^>]*fill="#e6e6e6"/g) ?? [];
    expect(walls.length).toBeGreaterThan(1);
  });
  test("stacked chambers take one level each, the highest at the top; every drawing fits its frame", () => {
    const tower = speakerTopFrame(templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn).cabinet);
    expect(tower.levels.map((l) => l.chambers.length)).toEqual([1, 1, 1]);
    const highest = tower.layout.chambers[tower.levels[0].chambers[0]];
    expect(highest.y0).toBe(Math.max(...tower.layout.chambers.map((c) => c.y0)));
    for (const id of ids) {
      const frame = speakerTopFrame(templateSpeaker(id).cabinet);
      expect(frame.levels.length).toBe(1);
      expect(Math.max(frame.W, frame.H)).toBeLessThanOrEqual(VIEW_PX + 1e-9);
    }
  });
});

describe("the front drawing", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  test("its drivers on the baffle drag when the page lets them, in their band's color", () => {
    const still = renderToString(createElement(SpeakerFront, { spec }));
    const moving = renderToString(createElement(SpeakerFront, { spec, onMoveDriver: () => {} }));
    expect(still).not.toContain("cursor:move");
    const groups = spec.cabinet.chambers.flatMap((c) => c.drivers).length;
    expect(moving.match(/cursor:move/g)?.length).toBe(groups);
    expect(still).toContain(bandColor(spec.bands, spec.bands[0].id, light).stroke);
  });
  test("a position field with focus marks its point: the center line across, the bottom up", () => {
    const at = (axis: (typeof POSITION_AXIS)[keyof typeof POSITION_AXIS]) =>
      renderToString(createElement(SpeakerFront, { spec, focus: { chamber: 0, driver: 0, axis } }));
    const placed = speakerLayout(spec.cabinet).chambers[0];
    const d = placed.chamber.drivers[0];
    expect(dragStart(placed, driverSpots(placed, d), driverAcrossIn(d)).center).toBeDefined();
    expect(at(POSITION_AXIS.across)).toContain('stroke-dasharray="3 2"');
    expect(at(POSITION_AXIS.up)).toContain('aria-hidden="true"');
    // the depth of a horn on the top shows on the side drawing, not here
    expect(at(POSITION_AXIS.back)).not.toContain('aria-hidden="true"');
  });
  test("the view a focused field shows: front across and up, side for the depth", () => {
    expect(shownView(SPEAKER_VIEW.side, null)).toBe(SPEAKER_VIEW.side);
    expect(shownView(SPEAKER_VIEW.top, null)).toBe(SPEAKER_VIEW.top);
    const f = { chamber: 0, driver: 0 };
    expect(shownView(SPEAKER_VIEW.side, { ...f, axis: POSITION_AXIS.up })).toBe(SPEAKER_VIEW.front);
    expect(shownView(SPEAKER_VIEW.front, { ...f, axis: POSITION_AXIS.back })).toBe(
      SPEAKER_VIEW.side,
    );
    expect(shownView(SPEAKER_VIEW.top, { ...f, axis: POSITION_AXIS.across })).toBe(
      SPEAKER_VIEW.front,
    );
  });
});

describe("the 3D view", () => {
  const named = (g: THREE.Object3D, name: string) => {
    let n = 0;
    g.traverse((o) => {
      if (o.name === name) n++;
    });
    return n;
  };
  test("hidden drivers leave the scene; the cutouts stay", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
    const shown = buildSpeakerScene({ spec, cutaway: false });
    const hidden = buildSpeakerScene({ spec, cutaway: false, drivers: false });
    expect(named(shown, SPEAKER_GROUP_NAMES.driver)).toBeGreaterThan(0);
    expect(named(hidden, SPEAKER_GROUP_NAMES.driver)).toBe(0);
    // the same panels (with their holes) either way
    expect(named(hidden, HIFI_CABINET_MESH_NAMES.baffle)).toBe(
      named(shown, HIFI_CABINET_MESH_NAMES.baffle),
    );
  });
  test("a horn chamber in a flush box shows its inside, not a dark lining", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.th18);
    expect(spec.cabinet.construction).toBe(CABINET_CONSTRUCTION.flushBox);
    const scene = buildSpeakerScene({ spec, cutaway: false });
    const dark = (o: THREE.Object3D) =>
      o.name === HIFI_CABINET_MESH_NAMES.shell &&
      o instanceof THREE.Mesh &&
      o.material instanceof THREE.MeshStandardMaterial &&
      o.material.side === THREE.BackSide;
    let linings = 0;
    scene.traverse((o) => {
      if (dark(o)) linings++;
    });
    expect(linings).toBe(0);
    expect(named(scene, SPEAKER_MESH_NAMES.foldBoard)).toBeGreaterThan(0);
    // a box chamber in a flush box keeps its lining
    let boxLinings = 0;
    buildSpeakerScene({
      spec: templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay),
      cutaway: false,
    }).traverse((o) => {
      if (dark(o)) boxLinings++;
    });
    expect(boxLinings).toBe(1);
  });
});

describe("the bracing check and the Details fold", () => {
  test("a braced chamber gets one bracing chip; an unbraced one none", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
    const chips = chamberBraceChips(spec.cabinet, cabinetBuild(spec.cabinet));
    expect(chips.map((c) => c.map((chip) => chip[3]))).toEqual([["speakerBracing"]]);
    const bare: SpeakerCabinet = {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c) => ({
        ...c,
        bracing: { ...c.bracing, braceStyle: NO_BRACING },
      })),
    };
    expect(chamberUnbraced(bare, 0)).toBe(true);
    expect(chamberBraceChips(bare, cabinetBuild(bare))).toEqual([[]]);
  });
  test("the groups follow the charts; a line shows only where it applies", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
    const build = cabinetBuild(spec.cabinet);
    const input = {
      bracing: build.chambers.map((c) => ({ unbraced: false, bracing: c.bracing })),
      fb: false,
      pricePartial: false,
      straightHorn: false,
    };
    const T = SPEAKER_DETAILS_TEXT;
    const groups = speakerDetails(input);
    expect(groups.map(([h]) => h)).toEqual([
      T.response,
      T.maxOutput,
      T.price,
      T.bracing,
      T.views,
      T.checks,
    ]);
    const lines = (g: ReturnType<typeof speakerDetails>, h: string) =>
      g.find(([head]) => head === h)?.[1] ?? [];
    expect(lines(groups, T.response)).not.toContain(T.fbLine);
    expect(lines(speakerDetails({ ...input, fb: true }), T.response)).toContain(T.fbLine);
    expect(lines(speakerDetails({ ...input, pricePartial: true }), T.price)).toContain(
      T.partialLine,
    );
    expect(lines(groups, T.views)).not.toContain(T.hornLines[0]);
    expect(lines(speakerDetails({ ...input, straightHorn: true }), T.views)).toEqual(
      expect.arrayContaining([...T.hornLines]),
    );
    const unbraced = speakerDetails({
      ...input,
      bracing: input.bracing.map((b) => ({ ...b, unbraced: true })),
    });
    expect(lines(unbraced, T.bracing)[0]).toBe(T.unbracedLine(1));
    // every bullet is one short sentence or two: 20 words at most (the docs' STE rule)
    for (const [, list] of groups)
      for (const l of list) expect(l.split(/\s+/).length).toBeLessThanOrEqual(20);
  });
});
