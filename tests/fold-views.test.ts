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
import { foldRoom } from "../src/lib/speaker/foldHorn";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD, FOLD_WALL, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
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
      chambers: [{ ...chamber, load: { kind: CHAMBER_LOAD.horn, horn } }],
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

  test("the drivers are drawn in the cutaway only, as the other horn drivers are", () => {
    const scene = buildSpeakerScene({ spec: drawn, cutaway: false });
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldDriver)).toHaveLength(0);
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldBoard)).toHaveLength(2);
  });

  test("with no drawing the scene builds with no boards, no drawn drivers and no mouth", () => {
    const scene = buildSpeakerScene({ spec, cutaway: true });
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldBoard)).toHaveLength(0);
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldDriver)).toHaveLength(0);
    expect(meshes(scene, SPEAKER_MESH_NAMES.foldMouth)).toHaveLength(0);
  });

  test("a mouth in the top or the bottom is a plate in the chamber", () => {
    const fold = { ...twoBoards(spec), mouth: { wall: FOLD_WALL.top, fromIn: 2, toIn: 12 } };
    const withTop = folded(fold);
    const scene = buildSpeakerScene({ spec: withTop, cutaway: true });
    const [plate] = meshes(scene, SPEAKER_MESH_NAMES.foldMouth);
    expect(plate).toBeDefined();
    expect(inside(scene, withTop, plate)).toBe(true);
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

  test("no driver is drawn on the baffle", () => {
    expect(html(folded(twoBoards(folded())))).not.toContain("<circle");
  });
});
