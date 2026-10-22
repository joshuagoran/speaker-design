// A drawn (folded) horn in the Speaker page's 3D view and front view: each board of its side section is a panel inside the
// chamber, the drivers sit on their board, the mouth is where it opens, and the scene rebuilds when the drawing changes.
import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import * as THREE from "three";
import {
  buildSpeakerScene,
  speakerSceneKey,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { SpeakerFront } from "../src/components/drawings/SpeakerFront";
import { BAFFLE_THICKNESS_IN } from "../src/components/stack-view/buildCabinet";
import { panelPieces } from "../src/components/stack-view/wallCuts";
import { baffleInsetIn } from "../src/lib/speaker/chamberAir";
import { foldRoom } from "../src/lib/speaker/foldHorn";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import {
  CABINET_CONSTRUCTION,
  CHAMBER_LOAD,
  FOLD_WALL,
  HORN_DRIVE,
  HORN_PATH,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type { HornFold, SpeakerSpec } from "../src/types";

/** the sub bin's one chamber */
const bin = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);

/** the bin with its horn set to a folded one, drawn as `fold` (absent: not drawn yet) */
function folded(fold?: HornFold): SpeakerSpec {
  const [chamber] = bin.cabinet.chambers;
  if (chamber.load.kind !== CHAMBER_LOAD.horn) throw new Error("the sub bin has a horn");
  const horn = {
    ...chamber.load.horn,
    drive: { kind: HORN_DRIVE.front },
    path: HORN_PATH.folded,
    fold,
  };
  return {
    ...bin,
    cabinet: {
      ...bin.cabinet,
      // sealed: a drawn horn's vent is its drawing's, and the bin's own side ducts would overlap the mouth's hole
      chambers: [
        { ...chamber, vent: { kind: VENT_KIND.sealed }, load: { kind: CHAMBER_LOAD.horn, horn } },
      ],
    },
  };
}

/** two boards across the chamber's depth, the drivers on the first, the mouth on the top part of the baffle */
function twoBoards(spec: SpeakerSpec): HornFold {
  const room = foldRoom(spec.cabinet, spec.cabinet.chambers[0]);
  const { depthIn, heightIn } = room;
  return {
    boards: [
      { a: { zIn: 0, yIn: heightIn * 0.45 }, b: { zIn: depthIn * 0.9, yIn: heightIn * 0.45 } },
      { a: { zIn: depthIn, yIn: heightIn * 0.2 }, b: { zIn: depthIn * 0.1, yIn: heightIn * 0.2 } },
    ],
    drivers: { board: 0, along: 0.5, face: -1 },
    mouth: { wall: FOLD_WALL.baffle, fromIn: heightIn * 0.6, toIn: heightIn },
  };
}

const meshes = (group: THREE.Object3D, name: string) => {
  const found: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.name === name) found.push(o);
  });
  return found;
};

/** a mesh is inside the chamber's box, in the scene's coordinates (one chamber: centered on x = 0 and z = 0, on the floor) */
const inside = (group: THREE.Group, spec: SpeakerSpec, mesh: THREE.Mesh) => {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const [placed] = speakerLayout(spec.cabinet).chambers;
  const eps = 1e-6;
  return (
    box.min.x >= -placed.dims.w / 2 - eps &&
    box.max.x <= placed.dims.w / 2 + eps &&
    box.min.y >= -eps &&
    box.max.y <= placed.dims.h + eps &&
    box.min.z >= -placed.dims.d / 2 - eps &&
    box.max.z <= placed.dims.d / 2 + eps
  );
};

describe("a drawn horn in the 3D view", () => {
  const spec = folded();
  const drawn = folded(twoBoards(spec));

  test("one board mesh per board, inside the chamber, and a driver mesh in the cutaway", () => {
    const scene = buildSpeakerScene({ spec: drawn, cutaway: true });
    const boards = meshes(scene, SPEAKER_MESH_NAMES.foldBoard);
    expect(boards).toHaveLength(2);
    for (const board of boards) expect(inside(scene, drawn, board)).toBe(true);
    const drivers = meshes(scene, SPEAKER_MESH_NAMES.foldDriver);
    expect(drivers).toHaveLength(1);
    expect(inside(scene, drawn, drivers[0])).toBe(true);
  });

  test("the boards are a panel thick and as wide as the chamber's clear width", () => {
    const scene = buildSpeakerScene({ spec: drawn, cutaway: true });
    const [placed] = speakerLayout(drawn.cabinet).chambers;
    const [first] = meshes(scene, SPEAKER_MESH_NAMES.foldBoard);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(first);
    expect(box.max.x - box.min.x).toBeCloseTo(placed.clear.w, 6);
    // the first board is level: its thickness is its height
    expect(box.max.y - box.min.y).toBeCloseTo(drawn.cabinet.panel.thicknessIn, 6);
  });

  test("the drivers are drawn with Cutaway off too, as the other horn drivers are", () => {
    const scene = buildSpeakerScene({ spec: drawn, cutaway: false });
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldDriver)).toHaveLength(1);
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldBoard)).toHaveLength(2);
  });

  test("with no drawing the scene builds with no boards and no drawn drivers", () => {
    const scene = buildSpeakerScene({ spec, cutaway: true });
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldBoard)).toHaveLength(0);
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldDriver)).toHaveLength(0);
  });

  /** where a ray from `from` along `dir` first meets the scene, or null */
  function firstHit(scene: THREE.Group, from: THREE.Vector3, dir: THREE.Vector3) {
    scene.updateMatrixWorld(true);
    const [hit] = new THREE.Raycaster(from, dir.normalize()).intersectObject(scene, true);
    return hit?.point ?? null;
  }

  /** the baffle's inside face and the chamber's top, in the scene's z and y (one chamber, on the floor) */
  function faces(s: SpeakerSpec) {
    const [placed] = speakerLayout(s.cabinet).chambers;
    return {
      placed,
      innerZ: placed.dims.d / 2 - baffleInsetIn(s.cabinet) - BAFFLE_THICKNESS_IN,
      frontZ: placed.dims.d / 2 - baffleInsetIn(s.cabinet),
    };
  }

  test("a mouth or a vent in the top is a hole in the top panel, and one in the bottom a hole in the bottom", () => {
    const wall = { top: FOLD_WALL.top, bottom: FOLD_WALL.bottom } as const;
    for (const [name, key] of [
      ["top", "mouth"],
      ["top", "vent"],
      ["bottom", "mouth"],
      ["bottom", "vent"],
    ] as const) {
      const opening = { wall: wall[name], fromIn: 2, toIn: 12 };
      const fold: HornFold =
        key === "mouth"
          ? { ...twoBoards(spec), mouth: opening }
          : { ...twoBoards(spec), vent: opening };
      const withOpening = folded(fold);
      const { placed, innerZ } = faces(withOpening);
      // straight down (or up) through the opening's middle, from outside the box
      const up = name === "top" ? -1 : 1;
      const origin = new THREE.Vector3(0, name === "top" ? placed.dims.h + 10 : -10, innerZ - 7);
      const dir = new THREE.Vector3(0, up, 0);
      // without the opening the ray meets the panel's outside face; with it, the ray goes in past that face
      const control = folded({
        ...twoBoards(spec),
        mouth: { wall: FOLD_WALL.baffle, fromIn: 1, toIn: 3 },
      });
      const shut = firstHit(buildSpeakerScene({ spec: control, cutaway: true }), origin, dir);
      const open = firstHit(buildSpeakerScene({ spec: withOpening, cutaway: true }), origin, dir);
      // the panel's outside face (the frame's roundover stands a quarter inch past the box's size)
      expect(Math.abs((shut?.y ?? 0) - (name === "top" ? placed.dims.h : 0))).toBeLessThan(0.5);
      expect(Math.abs((open?.y ?? shut?.y ?? 0) - (shut?.y ?? 0))).toBeGreaterThan(
        withOpening.cabinet.panel.thicknessIn / 2,
      );
    }
  });

  test("a flush box takes the top opening as a hole too", () => {
    const flushed = (fold: HornFold): SpeakerSpec => {
      const base = folded(fold);
      return {
        ...base,
        cabinet: { ...base.cabinet, construction: CABINET_CONSTRUCTION.flushBox },
      };
    };
    const open = flushed({
      ...twoBoards(spec),
      vent: { wall: FOLD_WALL.top, fromIn: 2, toIn: 12 },
    });
    const shut = flushed(twoBoards(spec));
    const [placed] = speakerLayout(open.cabinet).chambers;
    const wall = open.cabinet.panel.thicknessIn;
    // the baffle's inside face is the front less the roundover or a wall; the opening is 2 to 12 in back from it
    const innerZ = placed.dims.d / 2 - Math.max(wall, open.cabinet.roundoverIn);
    const through = (s: SpeakerSpec) =>
      firstHit(
        buildSpeakerScene({ spec: s, cutaway: true }),
        new THREE.Vector3(0, placed.dims.h + 10, innerZ - 7),
        new THREE.Vector3(0, -1, 0),
      );
    expect(through(shut)?.y).toBeCloseTo(placed.dims.h, 6);
    // past the panel (what it meets first inside is a brace under it, in the cutaway)
    expect(through(open)?.y).toBeLessThan(placed.dims.h - wall / 2);
  });

  test("a mouth in the top still builds the whole perimeter: the sides and the other panel are solid", () => {
    const fold = { ...twoBoards(spec), mouth: { wall: FOLD_WALL.top, fromIn: 2, toIn: 12 } };
    const withTop = folded(fold);
    const { placed, innerZ } = faces(withTop);
    const scene = buildSpeakerScene({ spec: withTop, cutaway: true });
    // down through the top beside the opening, from the baffle's side of it, still meets the panel
    const beside = firstHit(
      scene,
      new THREE.Vector3(0, placed.dims.h + 10, innerZ - 20),
      new THREE.Vector3(0, -1, 0),
    );
    expect(beside?.y).toBeCloseTo(placed.dims.h, 6);
    // up through the bottom meets the bottom panel
    const below = firstHit(
      scene,
      new THREE.Vector3(0, -10, innerZ - 7),
      new THREE.Vector3(0, 1, 0),
    );
    expect(below?.y).toBeCloseTo(0, 6);
  });

  test("a vent in the baffle is a hole in the baffle, and one in the back a hole in the back", () => {
    const [placed] = speakerLayout(spec.cabinet).chambers;
    const { frontZ } = faces(spec);
    const midY = placed.clear.y + 1.5;
    const plain = buildSpeakerScene({ spec: drawn, cutaway: true });
    for (const wall of [FOLD_WALL.baffle, FOLD_WALL.back] as const) {
      const vented = folded({ ...twoBoards(spec), vent: { wall, fromIn: 0.5, toIn: 2.5 } });
      const scene = buildSpeakerScene({ spec: vented, cutaway: true });
      // along the depth through the opening's middle, from outside the box on the baffle's side or the back's
      const front = wall === FOLD_WALL.baffle;
      const from = new THREE.Vector3(0, midY, front ? frontZ + 10 : -placed.dims.d / 2 - 10);
      const dir = new THREE.Vector3(0, 0, front ? -1 : 1);
      const faceZ = front ? frontZ : -placed.dims.d / 2;
      expect(firstHit(plain, from, dir)?.z).toBeCloseTo(faceZ, 6);
      const hit = firstHit(scene, from, dir);
      expect(Math.abs((hit?.z ?? faceZ) - faceZ)).toBeGreaterThan(0.5);
    }
  });

  test("the scene's key changes with the drawing", () => {
    const base = speakerSceneKey({ spec: drawn, cutaway: true });
    const moved = twoBoards(spec);
    moved.boards[0] = { ...moved.boards[0], b: { zIn: 5, yIn: moved.boards[0].b.yIn } };
    expect(speakerSceneKey({ spec: folded(moved), cutaway: true })).not.toBe(base);
    expect(speakerSceneKey({ spec, cutaway: true })).not.toBe(base);
  });
});

describe("a drawn horn in the front view", () => {
  const html = (s: SpeakerSpec) => renderToString(createElement(SpeakerFront, { spec: s }));
  /** the drawing's rectangles by their attributes */
  const rects = (s: string) =>
    [...s.matchAll(/<rect ([^>]*?)>/g)].map(([, attrs]) =>
      Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])),
    );
  /** the mouth's rectangle (rounded) and the clear face's outline (unfilled), in the drawing's units */
  function mouthAndFace(s: SpeakerSpec) {
    const all = rects(html(s));
    const mouth = all.find((r) => r.rx === "2");
    const face = all.find(
      (r) => r.fill === "none" && r.stroke !== undefined && !r["stroke-dasharray"],
    );
    if (!mouth || !face) throw new Error("no mouth or no face in the drawing");
    return { mouth, face };
  }

  test("the mouth is the clear width across and its own height up the baffle", () => {
    const spec = folded();
    const drawn = folded(twoBoards(spec));
    const room = foldRoom(drawn.cabinet, drawn.cabinet.chambers[0]);
    const { mouth, face } = mouthAndFace(drawn);
    expect(+mouth.width).toBeCloseTo(+face.width, 6);
    expect(+mouth.height / +face.height).toBeCloseTo((room.heightIn * 0.4) / room.heightIn, 6);
    // from the mouth's upper edge to the face's: the mouth's top is the face's top
    expect(+mouth.y).toBeCloseTo(+face.y, 6);
  });

  test("a horn not drawn yet shows no mouth", () => {
    expect(rects(html(folded())).some((r) => r.rx === "2")).toBe(false);
  });

  test("a mouth on the bottom is not on the baffle", () => {
    const spec = folded();
    const fold = { ...twoBoards(spec), mouth: { wall: FOLD_WALL.bottom, fromIn: 0, toIn: 10 } };
    expect(rects(html(folded(fold))).some((r) => r.rx === "2")).toBe(false);
  });

  test("a vent on the baffle is a dark rectangle the clear width across; on the back, a dashed one", () => {
    const spec = folded();
    const room = foldRoom(spec.cabinet, spec.cabinet.chambers[0]);
    const onBaffle = folded({
      ...twoBoards(spec),
      vent: { wall: FOLD_WALL.baffle, fromIn: 1, toIn: 3 },
    });
    const { mouth, face } = mouthAndFace(onBaffle);
    const vent = rects(html(onBaffle)).find((r) => r.rx === "1");
    if (!vent) throw new Error("no vent in the drawing");
    expect(+vent.width).toBeCloseTo(+face.width, 6);
    expect(+vent.height / +face.height).toBeCloseTo(2 / room.heightIn, 6);
    expect(vent["stroke-dasharray"]).toBeUndefined();
    // the mouth is as it was
    expect(+mouth.width).toBeCloseTo(+face.width, 6);
    const onBack = folded({
      ...twoBoards(spec),
      vent: { wall: FOLD_WALL.back, fromIn: 1, toIn: 3 },
    });
    const behind = rects(html(onBack)).find((r) => r.rx === "1");
    expect(behind?.["stroke-dasharray"]).toBeDefined();
    expect(behind?.fill).toBe("none");
    // a vent in the top or the bottom is not on the face; no vent draws none
    const onTop = folded({ ...twoBoards(spec), vent: { wall: FOLD_WALL.top, fromIn: 1, toIn: 3 } });
    expect(rects(html(onTop)).some((r) => r.rx === "1")).toBe(false);
    expect(rects(html(folded(twoBoards(spec)))).some((r) => r.rx === "1")).toBe(false);
  });

  test("a vent on the baffle shows with the mouth on the bottom", () => {
    const spec = folded();
    const fold: HornFold = {
      ...twoBoards(spec),
      mouth: { wall: FOLD_WALL.bottom, fromIn: 0, toIn: 10 },
      vent: { wall: FOLD_WALL.baffle, fromIn: 1, toIn: 3 },
    };
    const all = rects(html(folded(fold)));
    expect(all.some((r) => r.rx === "1")).toBe(true);
    expect(all.some((r) => r.rx === "2")).toBe(false);
  });

  test("no driver is drawn on the baffle", () => {
    expect(html(folded(twoBoards(folded())))).not.toContain("<circle");
  });
});

describe("a panel with openings cut out (panelPieces)", () => {
  const panel = { x0: -10, x1: 10, z0: -15, z1: 15 };
  const area = (rects: ReturnType<typeof panelPieces>) =>
    rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0);

  test("no openings leaves the panel whole", () => {
    expect(panelPieces(panel, [])).toEqual([panel]);
  });

  test("an opening across the whole width splits the panel in two", () => {
    const pieces = panelPieces(panel, [{ x0: -10, x1: 10, z0: 0, z1: 5 }]);
    expect(pieces).toHaveLength(2);
    expect(area(pieces)).toBeCloseTo(20 * 30 - 20 * 5, 9);
  });

  test("a narrower opening leaves pieces round it, and one past the panel changes nothing", () => {
    const pieces = panelPieces(panel, [{ x0: -2, x1: 4, z0: -3, z1: 6 }]);
    expect(area(pieces)).toBeCloseTo(20 * 30 - 6 * 9, 9);
    expect(pieces.length).toBeGreaterThanOrEqual(4);
    expect(panelPieces(panel, [{ x0: 20, x1: 30, z0: 0, z1: 5 }])).toEqual([panel]);
  });
});
