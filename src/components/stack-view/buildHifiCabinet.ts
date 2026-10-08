import * as THREE from "three";
import type { SceneContext } from "./sceneContext";
import type { Dims3 } from "../../types";

/** The Hi-fi cabinet's meshes: the painted front (its flat face and its edges) and the shell behind it. */
export const HIFI_CABINET_MESH_NAMES = {
  baffle: "hifiBaffle",
  shell: "hifiShell",
} as const;

/** The quarter-round's segments. */
const ROUNDOVER_SEGMENTS = 10;
/** With sharp edges, how far in the flat face stops: the edge band's front lip meets it there, so they don't overlap. */
const SHARP_EDGE_LIP_IN = 0.02;
/**
 * How far the flat face reaches under the edge band, so no crack opens at the seam, and how far it sits behind the
 * front plane, so the band in front of it hides its cut edge there.
 */
const FACE_OVERLAP_IN = 0.005;
const FACE_SET_BACK_IN = 0.01;
/** How far inside the panels the dark inside lining sits, so it draws over their inner faces. */
const LINING_GAP_IN = 0.05;

/** Holes in the box's panels, each in its panel's own coordinates (see `buildHifiCabinet`). */
export interface HifiCabinetHoles {
  baffle: THREE.Path[];
  back: THREE.Path[];
  /** the side panels, by side: −1 the left (−x), +1 the right */
  sides: Record<-1 | 1, THREE.Path[]>;
}

/**
 * The Hi-fi box (butt-jointed, as the Cutlist page builds it): the baffle covering the whole front, its four front
 * edges rounded over by `roundover` (sharp at 0), painted; the sides, top, bottom and back in the cabinet finish, and,
 * outside the cutaway, a dark lining inside so the openings look into a closed box. A roundover deeper than the baffle
 * is drawn on a front that thick (the Hi-fi page's fix: a doubled baffle).
 *
 * Units: inches; the box centered on x = 0 and z = 0, its bottom on y = 0, the front face at z = d / 2. Holes: the
 * baffle's and the back's in (x, y), the sides' in (z, y).
 */
export function buildHifiCabinet(
  ctx: SceneContext,
  { dim, roundover, holes }: { dim: Dims3; roundover: number; holes: HifiCabinetHoles },
): { group: THREE.Group; frontZ: number; shellFrontZ: number } {
  const { w, h, d } = dim;
  const T = ctx.wall;
  // the roundover can't take more than the box's half width or height, or its depth less a wall
  const r = Math.max(0, Math.min(roundover, w / 2 - 0.05, h / 2 - 0.05, d - 2 * T));
  const front = Math.max(T, r);
  const zf = d / 2,
    shellFrontZ = zf - front;
  const group = new THREE.Group();
  const { baffle, shell } = ctx.materials;

  // the baffle's flat face, with the drivers' and vents' holes, painted through (its outer edge meets the edge band, so
  // a sliver of it there must read as the band)
  const e = (r > 0 ? r : SHARP_EDGE_LIP_IN) - FACE_OVERLAP_IN;
  const face = new THREE.Shape();
  face.moveTo(-w / 2 + e, e);
  face.lineTo(w / 2 - e, e);
  face.lineTo(w / 2 - e, h - e);
  face.lineTo(-w / 2 + e, h - e);
  face.closePath();
  face.holes.push(...holes.baffle);
  const flat = new THREE.Mesh(
    new THREE.ExtrudeGeometry(face, { depth: front, bevelEnabled: false, curveSegments: 32 }),
    baffle,
  );
  flat.position.z = zf - front - FACE_SET_BACK_IN;
  flat.name = HIFI_CABINET_MESH_NAMES.baffle;
  group.add(flat);

  // the baffle's edges: the quarter-round (or, sharp, a lip out to the corner) and the straight edge back to the shell
  const edge = new THREE.Mesh(edgeBand(w, h, zf, r, front), baffle);
  edge.name = HIFI_CABINET_MESH_NAMES.baffle;
  group.add(edge);

  // The shell behind it. Where separate panels meet on an outside face, their edges draw along the seam (a broken
  // line in the render), so the outside is built without such seams: the back is one slab the box's full width and
  // height, and the sides, top and bottom one ring drawn along the box in front of it, its end faces (against the
  // baffle and the back, never seen) not drawn. Radiators on the sides need holes the ring can't take: then the sides
  // run full height as their own panels, the top and bottom between them, and the back between all four.
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const slab = (
    shape: THREE.Shape,
    thickness: number,
    faces: THREE.Material = shell,
    edges: THREE.Material = shell,
  ) => {
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: false,
        curveSegments: 32,
      }),
      [faces, edges],
    );
    m.name = HIFI_CABINET_MESH_NAMES.shell;
    group.add(m);
    return m;
  };
  const rect = (u0: number, v0: number, u1: number, v1: number, cut: THREE.Path[] = []) => {
    const s = new THREE.Shape();
    s.moveTo(u0, v0);
    s.lineTo(u1, v0);
    s.lineTo(u1, v1);
    s.lineTo(u0, v1);
    s.closePath();
    s.holes.push(...cut);
    return s;
  };
  const depth = shellFrontZ + d / 2;
  if (holes.sides[-1].length + holes.sides[1].length === 0) {
    const inside = new THREE.Path();
    inside.moveTo(-w / 2 + T, T);
    inside.lineTo(w / 2 - T, T);
    inside.lineTo(w / 2 - T, h - T);
    inside.lineTo(-w / 2 + T, h - T);
    inside.closePath();
    const ring = slab(rect(-w / 2, 0, w / 2, h, [inside]), depth - T, hidden);
    ring.position.z = -d / 2 + T;
    const back = slab(rect(-w / 2, 0, w / 2, h, holes.back), T);
    back.position.z = -d / 2;
  } else {
    // sides: drawn in (z, y), extruded toward −x from their outer face
    for (const side of [-1, 1] as const) {
      const m = slab(rect(-d / 2, 0, shellFrontZ, h, holes.sides[side]), T);
      m.rotation.y = -Math.PI / 2; // local (u, v, w) -> world (−w, v, u)
      m.position.x = side > 0 ? w / 2 : -w / 2 + T;
    }
    // top and bottom: drawn in (x, z), extruded downward from their top face
    for (const top of [T, h]) {
      const m = slab(rect(-w / 2 + T, -d / 2, w / 2 - T, shellFrontZ), T);
      m.rotation.x = Math.PI / 2; // local (u, v, w) -> world (u, −w, v)
      m.position.y = top;
    }
    const back = slab(rect(-w / 2 + T, T, w / 2 - T, h - T, holes.back), T);
    back.position.z = -d / 2;
  }

  // the dark inside, seen through the openings (left out of the cutaway, which shows the inside)
  if (!ctx.cutaway && depth > 2 * T) {
    const lining = new THREE.Mesh(
      new THREE.BoxGeometry(
        w - 2 * T - 2 * LINING_GAP_IN,
        h - 2 * T - 2 * LINING_GAP_IN,
        depth - T - 2 * LINING_GAP_IN,
      ),
      new THREE.MeshStandardMaterial({
        color: ctx.materials.black.color,
        roughness: 1,
        side: THREE.BackSide,
      }),
    );
    lining.position.set(0, h / 2, (-d / 2 + T + shellFrontZ) / 2);
    lining.name = HIFI_CABINET_MESH_NAMES.shell;
    group.add(lining);
  }
  ctx.group.add(group);
  return { group, frontZ: zf, shellFrontZ };
}

/**
 * The baffle's edges round its four sides, as one band of quads with smooth normals: from the flat face's edge
 * (inset `r`) a quarter-round out to the box's outline `r` back, then straight back to `front` behind the face; with
 * sharp edges (`r` 0) a narrow lip in the face's plane, then straight back. The corners meet in miters, as a router's
 * roundovers do.
 */
function edgeBand(w: number, h: number, zf: number, r: number, front: number) {
  // the profile: [inset from the outline, z, normal outward, normal forward], in smooth runs
  type Point = [inset: number, z: number, out: number, fwd: number];
  const runs: Point[][] = [];
  if (r > 0)
    runs.push(
      Array.from({ length: ROUNDOVER_SEGMENTS + 1 }, (_, k): Point => {
        const a = (k / ROUNDOVER_SEGMENTS) * (Math.PI / 2);
        return [r * (1 - Math.sin(a)), zf - r * (1 - Math.cos(a)), Math.sin(a), Math.cos(a)];
      }),
    );
  else
    runs.push([
      [SHARP_EDGE_LIP_IN, zf, 0, 1],
      [0, zf, 0, 1],
    ]);
  if (front > r + 1e-6)
    runs.push([
      [0, zf - r, 1, 0],
      [0, zf - front, 1, 0],
    ]);
  // the four sides, each as its outward normal and its two corners (as signs of x and y from the box's center)
  const sides = [
    { n: [0, -1], a: [-1, -1], b: [1, -1] },
    { n: [1, 0], a: [1, -1], b: [1, 1] },
    { n: [0, 1], a: [1, 1], b: [-1, 1] },
    { n: [-1, 0], a: [-1, 1], b: [-1, -1] },
  ] as const;
  const pos: number[] = [],
    nrm: number[] = [];
  const corner = ([sx, sy]: readonly [number, number], [s, z]: Point) => [
    sx * (w / 2 - s),
    h / 2 + sy * (h / 2 - s),
    z,
  ];
  const normal = ([nx, ny]: readonly [number, number], [, , out, fwd]: Point) => [
    nx * out,
    ny * out,
    fwd,
  ];
  for (const run of runs)
    for (let i = 0; i + 1 < run.length; i++)
      for (const { n, a, b } of sides) {
        const p = run[i],
          q = run[i + 1];
        // two triangles facing out: (a p, b q, b p) and (a p, a q, b q)
        const tri = [
          [a, p],
          [b, q],
          [b, p],
          [a, p],
          [a, q],
          [b, q],
        ] as const;
        for (const [c, pt] of tri) {
          pos.push(...corner(c, pt));
          nrm.push(...normal(n, pt));
        }
      }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return geo;
}
