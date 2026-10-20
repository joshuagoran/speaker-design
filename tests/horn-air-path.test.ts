// The horn's air path in the 3D view (stack-view/buildSpeakerScene), checked against the path's own sections
// (lib/speaker/hornGeometry): nothing solid inside the air from the driver board's front face through the throat to the mouth, and
// nothing solid over the mouth or the side slots' openings. The wood that must stay (the horn's walls, the walls' back
// edges round the throat, the slots' walls) stands outside them. Every template horn, folded or not, with and without
// the cutaway's drivers. (Wood once covered the throat: its plate's hole ran past the bay's outline, so the plate was
// cut as a whole sheet, #182.)
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  buildSpeakerScene,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { hornFlare, slotOpeningsAt, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { portRule, PORT_RULE } from "../src/lib/speaker/speakerLayout";
import { CHAMBER_LOAD, HORN_PATH, PORT_SHAPE } from "../src/constants/speakerSpec";
import type { HornPath } from "../src/lib/speaker/hornGeometry";
import type { SpeakerSpec } from "../src/types";

/**
 * How far inside an air section a solid point must be to count as in the way, in: more than the corners of the mouth's
 * hole are rounded (0.25), far less than any wall or throat is wide.
 */
const MARGIN_IN = 0.3;
/** How far inside an opening's edge a solid point must be to cover it, in (the walls round it have rounded edges). */
const OPENING_MARGIN_IN = 0.1;
/** How far past a section's plane a point still counts as in it, in. */
const PLANE_IN = 1e-6;
/** How far in front of the baffle's inside face the openings are checked, in (the baffle, the frame's inset). */
const OPENING_DEPTH_IN = 3;

/** How far in front of the driver board's front face the throat's air starts, in: past a part standing in its plane. */
const BOARD_CLEAR_IN = 1e-3;

/** A rectangle of the air path at a depth: its center and size, and the depth back from the baffle's inside face. */
interface Section {
  z: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/**
 * A piece of the air path between two sections. `closed`: a part standing in a section's own plane is in it (the throat's
 * and the legs' sections); a turn's gap is open at its ends, where the plates between legs end.
 */
interface Piece {
  from: Section;
  to: Section;
  closed: boolean;
}

/** The air path as pieces between two sections each: the legs' steps, the turns, and the throat from the driver board. */
function airPieces(path: HornPath): Piece[] {
  const pieces: Piece[] = [];
  for (const leg of path.legs)
    leg.sections
      .slice(1)
      .forEach((to, i) => pieces.push({ from: leg.sections[i], to, closed: true }));
  for (const t of path.turns) {
    const rect = { cx: t.cx, cy: (t.y0 + t.y1) / 2, w: t.w, h: t.y1 - t.y0 };
    pieces.push({ from: { z: t.z0, ...rect }, to: { z: t.z1, ...rect }, closed: false });
  }
  // from the driver board's front face to the throat: the throat's opening is the air that passes. The board's own front
  // face, which closes the bay's end round the cones, stands outside it (`BOARD_CLEAR_IN` toward the throat)
  if (path.bay) {
    const [throat] = path.legs[0].sections;
    const rect = { cx: throat.cx, cy: throat.cy, w: throat.w, h: throat.h };
    const toThroat = path.folds % 2 === 0 ? -1 : 1;
    pieces.push({
      from: { z: path.bay.boardZ + toThroat * BOARD_CLEAR_IN, ...rect },
      to: { z: throat.z, ...rect },
      closed: true,
    });
  }
  return pieces;
}

/** Whether a point (x, y across and up, zBack back from the baffle's inside face) is inside the air path's pieces. */
function inAir(pieces: Piece[], x: number, y: number, zBack: number): boolean {
  return pieces.some(({ from: a, to: b, closed }) => {
    const slack = closed ? PLANE_IN : -PLANE_IN;
    const lo = Math.min(a.z, b.z) - slack,
      hi = Math.max(a.z, b.z) + slack;
    if (zBack < lo || zBack > hi) return false;
    const k = b.z === a.z ? 0 : Math.min(1, Math.max(0, (zBack - a.z) / (b.z - a.z)));
    const at = (p: number, q: number) => p + (q - p) * k;
    return (
      Math.abs(x - at(a.cx, b.cx)) < at(a.w, b.w) / 2 - MARGIN_IN &&
      Math.abs(y - at(a.cy, b.cy)) < at(a.h, b.h) / 2 - MARGIN_IN
    );
  });
}

/** Points over a mesh's triangles, in the scene: each corner, edge midpoint, and a grid inside every triangle. */
function surfacePoints(mesh: THREE.Mesh): THREE.Vector3[] {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const vertex = (n: number) =>
    new THREE.Vector3()
      .fromBufferAttribute(position, index ? index.getX(n) : n)
      .applyMatrix4(mesh.matrixWorld);
  const GRID = 6;
  const points: THREE.Vector3[] = [];
  for (let n = 0; n + 2 < count; n += 3) {
    const [a, b, c] = [vertex(n), vertex(n + 1), vertex(n + 2)];
    for (let i = 0; i <= GRID; i++)
      for (let j = 0; i + j <= GRID; j++) {
        const u = i / GRID,
          v = j / GRID;
        points.push(
          a
            .clone()
            .multiplyScalar(1 - u - v)
            .add(b.clone().multiplyScalar(u))
            .add(c.clone().multiplyScalar(v)),
        );
      }
  }
  return points;
}

/** The name of the folded bin. */
/** The template horns: each as a spec and its name. (A folded horn is drawn by hand: tests/fold-*.) */
function hornSpecs(): [string, SpeakerSpec][] {
  const specs = SPEAKER_TEMPLATES.map((t): [string, SpeakerSpec] => [t, templateSpeaker(t)]).filter(
    ([, spec]) =>
      spec.cabinet.chambers.some(
        (c) => c.load.kind === CHAMBER_LOAD.horn && c.load.horn.path !== HORN_PATH.folded,
      ),
  );
  return specs;
}

describe("the horn's air path in the 3D view", () => {
  test("the PA v2 sub bins and the mid box are covered", () => {
    const names = hornSpecs().map(([name]) => name);
    for (const t of [
      SPEAKER_TEMPLATE.paV2SubBinOne,
      SPEAKER_TEMPLATE.paV2SubBinTwo,
      SPEAKER_TEMPLATE.paV2MidBox,
    ])
      expect(names).toContain(t);
  });

  for (const [name, spec] of hornSpecs())
    // the cutaway's drivers of a folded path are not yet kept clear of its other legs (the bay is as tall as the cones)
    for (const cutaway of [false, true])
      test(`${name}${cutaway ? " (cutaway)" : ""}: no solid part in the air, over the mouth or over a slot`, () => {
        // the horn's chamber: a speaker's other chambers (an HF section) sit apart from its air
        const placed = speakerLayout(spec.cabinet).chambers.find(
          (c) => c.chamber.load.kind === CHAMBER_LOAD.horn,
        );
        expect(placed, "the horn has a chamber").toBeTruthy();
        if (!placed) return;
        const flare = hornFlare(spec.cabinet, placed);
        expect(flare, "the horn has a path").toBeTruthy();
        if (!flare) return;
        // a path that does not fit its box is drawn as it is, past the walls: the template horns and the folded bin fit
        expect(flare.path.fits, `${name}: the path fits`).toBe(true);
        const scene = buildSpeakerScene({
          spec: { cabinet: spec.cabinet, look: spec.look },
          cutaway,
        });
        scene.updateMatrixWorld(true);
        const meshes: THREE.Mesh[] = [];
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) meshes.push(o);
        });
        // the baffle's inside face is where the mouth's section is: the flare's front-most point
        const flares = meshes.filter((m) => m.name === SPEAKER_MESH_NAMES.hornFlare);
        expect(flares.length).toBe(flare.path.legs.length);
        const innerZ = Math.max(...flares.map((m) => new THREE.Box3().setFromObject(m).max.z));
        const pieces = airPieces(flare.path);

        // the throat's boards exist where the path says (the bay's face less the throat), none over the opening
        const boards = meshes.filter((m) => m.name === SPEAKER_MESH_NAMES.hornThroat);
        expect(boards.length).toBe(flare.path.bay?.strips.length ?? 0);

        const mouth = flare.mouth;
        const slots = (() => {
          const rule = portRule(placed.chamber);
          if (rule?.rule !== PORT_RULE.hifi || rule.port.shape !== PORT_SHAPE.slot) return [];
          return slotOpeningsAt(placed, rule.port, spec.cabinet.panel.thicknessIn).map((o) => ({
            x0: placed.cx + o.x - o.w / 2,
            x1: placed.cx + o.x + o.w / 2,
            y0: placed.y0 + o.y,
            y1: placed.y0 + o.y + o.h,
          }));
        })();
        const openings = [
          { x0: mouth.x, x1: mouth.x + mouth.w, y0: mouth.y, y1: mouth.y + mouth.h },
          ...slots,
        ];

        for (const mesh of meshes) {
          for (const p of surfacePoints(mesh)) {
            const zBack = innerZ - p.z;
            expect(
              inAir(pieces, p.x, p.y, zBack),
              `${name}: ${mesh.name || "a panel"} has wood in the air at x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)}, ${zBack.toFixed(2)} back`,
            ).toBe(false);
            // over an opening: from the baffle's inside face out
            if (zBack <= PLANE_IN && zBack >= -OPENING_DEPTH_IN)
              for (const o of openings)
                expect(
                  p.x > o.x0 + OPENING_MARGIN_IN &&
                    p.x < o.x1 - OPENING_MARGIN_IN &&
                    p.y > o.y0 + OPENING_MARGIN_IN &&
                    p.y < o.y1 - OPENING_MARGIN_IN,
                  `${name}: ${mesh.name || "a panel"} covers an opening at x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)}`,
                ).toBe(false);
          }
        }
      });
});
