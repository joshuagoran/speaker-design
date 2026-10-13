// The Speaker page's 3D scene (stack-view/buildSpeakerScene) for every port kind, in the PA frame (the PA sub template,
// its baffle set back between the walls), the Hi-fi box (the Hi-fi 2-way template) and the PA tower (its sub chamber in
// one shell with the others): each kind adds its vent's meshes inside its chamber, and its openings are open on the
// right panel where the layout puts them (a ray through each opening's center passes the panel). Plain slots the
// clear width once drew nothing in the frame: the baffle can't hold a hole its own width, so it starts above them.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  buildSpeakerScene,
  SPEAKER_GROUP_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { HIFI_MESH_NAMES } from "../src/components/stack-view/buildHifiScene";
import { VENT_MESH_NAME } from "../src/components/stack-view/buildBraces";
import { BAFFLE_THICKNESS_IN } from "../src/components/stack-view/buildCabinet";
import { subVentHoles, subVentPlan } from "../src/components/stack-view/buildSubwoofer";
import {
  portRule,
  PORT_RULE,
  roundPortsAt,
  slotOpeningsAt,
  speakerLayout,
  type PlacedChamber,
} from "../src/lib/speaker/speakerLayout";
import { baffleInsetIn } from "../src/lib/speaker/chamberAir";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE, type SpeakerTemplate } from "../src/constants/speakerStarts";
import { PANEL } from "../src/constants/cutParts";
import { CABINET_CONSTRUCTION, PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import type { SpeakerPort, SpeakerSpec, VentPanel } from "../src/types";

/** How far past a panel's face a ray's first hit must be to count as through it, in. */
const PAST_IN = 1e-3;
/** How far a round port's flange may stand proud of its panel, in. */
const FLANGE_IN = 0.05;

/** The template with its first vented chamber's port set to `port`. */
function withPort(template: SpeakerTemplate, port: SpeakerPort): { spec: SpeakerSpec; i: number } {
  const spec = templateSpeaker(template);
  const i = spec.cabinet.chambers.findIndex((c) => c.vent.kind === VENT_KIND.vented);
  if (i < 0) throw new Error(`no vented chamber in ${template}`);
  const chambers = spec.cabinet.chambers.map((c, k) =>
    k === i && c.vent.kind === VENT_KIND.vented ? { ...c, vent: { ...c.vent, port } } : c,
  );
  return { spec: { ...spec, cabinet: { ...spec.cabinet, chambers } }, i };
}

/** Each port kind the page sets, by name. */
const PORTS: [string, SpeakerPort][] = [
  ["plain slot", { shape: PORT_SHAPE.slot, n: 1, h: 2, len: 6 }],
  ["two stacked plain slots", { shape: PORT_SHAPE.slot, n: 2, h: 1.5, len: 6 }],
  ["plain slot, set long side", { shape: PORT_SHAPE.slot, n: 1, h: 1.5, w: 5, len: 6 }],
  [
    "plain slot, folded up the back",
    { shape: PORT_SHAPE.slot, n: 1, h: 1.5, len: 24, folded: true },
  ],
  ["letterbox", { shape: PORT_SHAPE.slot, n: 1, h: 2, len: 10, fins: 2 }],
  [
    "two side ducts",
    { shape: PORT_SHAPE.duct, n: 2, throat: 1.5, len: 12, div: 0.75, divider: "3/4" },
  ],
  [
    "one side duct",
    { shape: PORT_SHAPE.duct, n: 1, throat: 1.5, len: 12, div: 0.75, divider: "3/4" },
  ],
  ["round tube", { shape: PORT_SHAPE.round, n: 1, dia: 2, len: 4 }],
  ["round tubes with elbows", { shape: PORT_SHAPE.round, n: 2, dia: 2, len: 20, elbows: 2 }],
  ["flared tubes", { shape: PORT_SHAPE.round, n: 2, dia: 3, len: 8, flared: true }],
  [
    "round tube on the back",
    {
      shape: PORT_SHAPE.round,
      n: 1,
      dia: 2,
      len: 4,
      position: { panel: PANEL.back, xIn: 0, yIn: 6 },
    },
  ],
];

const TEMPLATES = [
  SPEAKER_TEMPLATE.paSubBox,
  SPEAKER_TEMPLATE.hifiTwoWay,
  SPEAKER_TEMPLATE.paTowerBaffleHorn,
] as const;

/** Each opening's center on its panel, in the scene's coordinates, from the layout (or, the PA's vents, its plan). */
function openings(
  spec: SpeakerSpec,
  placed: PlacedChamber,
): { panel: VentPanel; x: number; y: number }[] {
  const t = spec.cabinet.panel.thicknessIn;
  const rule = portRule(placed.chamber);
  if (!rule) return [];
  if (rule.rule === PORT_RULE.pa) {
    const plan = subVentPlan(rule.sub, placed.dims, rule.portStyle, rule.portGeom, t);
    // the letterbox's mouths between its fins, along the floor
    const mouths = plan.bandH
      ? plan.fins.openings.map((x) => ({ x: placed.cx + x, y: placed.y0 + t + plan.ductH / 2 }))
      : [];
    const holes = subVentHoles(plan, placed.dims, t, {
      x: placed.cx,
      plinth: placed.y0,
      baffleCy: 0,
    }).map((path) => {
      const pts = path.getPoints();
      return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      };
    });
    return [...mouths, ...holes].map((o) => ({ panel: PANEL.baffle, ...o }));
  }
  const { port } = rule;
  if (port.shape === PORT_SHAPE.slot)
    return slotOpeningsAt(placed, port, t).map((o) => ({
      panel: PANEL.baffle,
      x: placed.cx + o.x,
      y: placed.y0 + o.y + o.h / 2,
    }));
  const { panel, spots } = roundPortsAt(placed, port);
  return spots.map((s) => ({ panel, x: placed.cx + s.x, y: placed.y0 + s.y }));
}

function meshes(g: THREE.Object3D, names: readonly string[]) {
  const out: THREE.Mesh[] = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => o instanceof THREE.Mesh && names.includes(o.name) && out.push(o));
  return out;
}

const VENT_NAMES = [VENT_MESH_NAME, HIFI_MESH_NAMES.port, HIFI_MESH_NAMES.slotShelf];

describe("each port kind in the Speaker page's 3D view", () => {
  for (const template of TEMPLATES)
    for (const [name, port] of PORTS) {
      const label = `${template}: ${name}`;
      // two side ducts in the 9″ Hi-fi box overlap its woofer's cutout (a design that doesn't fit, not a port kind)
      const overlaps = template === SPEAKER_TEMPLATE.hifiTwoWay && port.shape === PORT_SHAPE.duct;
      test.skipIf(overlaps)(label, () => {
        const { spec, i } = withPort(template, port);
        const { cabinet } = spec;
        const t = cabinet.panel.thicknessIn;
        const layout = speakerLayout(cabinet);
        const placed = layout.chambers[i];
        const g = buildSpeakerScene({ spec, cutaway: false });
        g.updateMatrixWorld(true);
        // the cabinet and its vent, the drivers left out (a small box's woofer may stand in front of a duct's mouth)
        const cabinetParts: THREE.Object3D[] = [];
        const collect = (o: THREE.Object3D) => {
          if (o.name === SPEAKER_GROUP_NAMES.driver) return;
          if (o instanceof THREE.Mesh) cabinetParts.push(o);
          o.children.forEach(collect);
        };
        collect(g);
        const chambers: THREE.Object3D[] = [];
        g.traverse((o) => o.name === SPEAKER_GROUP_NAMES.chamber && chambers.push(o));
        const chamber = chambers[i];
        // its vent's meshes, inside its chamber
        const vent = meshes(chamber, VENT_NAMES);
        expect(vent.length, label).toBeGreaterThan(0);
        const box = new THREE.Box3();
        for (const m of vent) box.expandByObject(m);
        const front = layout.size.d / 2,
          back = front - placed.dims.d;
        expect(box.min.x, label).toBeGreaterThanOrEqual(placed.x0 - 1e-6);
        expect(box.max.x, label).toBeLessThanOrEqual(placed.x0 + placed.dims.w + 1e-6);
        expect(box.min.y, label).toBeGreaterThanOrEqual(placed.y0 - 1e-6);
        expect(box.max.y, label).toBeLessThanOrEqual(placed.y0 + placed.dims.h + 1e-6);
        // a round port's flange stands proud of its panel
        expect(box.min.z, label).toBeGreaterThanOrEqual(back - FLANGE_IN);
        expect(box.max.z, label).toBeLessThanOrEqual(front + FLANGE_IN);
        // a plain slot: a shelf over each opening, its underside on the opening's top (folded: the PA fold's roof)
        if (port.shape === PORT_SHAPE.slot && port.fins === undefined && !port.folded) {
          const shelves = meshes(chamber, [HIFI_MESH_NAMES.slotShelf])
            .map((m) => new THREE.Box3().setFromObject(m).min.y)
            .sort((a, b) => a - b);
          const tops = slotOpeningsAt(placed, port, t).map((o) => placed.y0 + o.y + o.h);
          expect(shelves.length, label).toBe(tops.length);
          shelves.forEach((y, k) => expect(y, label).toBeCloseTo(tops[k], 6));
        }
        // each opening open through its panel: a ray through its center first meets something behind the panel
        const frame = cabinet.construction === CABINET_CONSTRUCTION.frameInset;
        const baffleInner =
          front - (frame ? baffleInsetIn(cabinet) + BAFFLE_THICKNESS_IN : t) - PAST_IN;
        const backInner = back + t + PAST_IN;
        const at = openings(spec, placed);
        expect(at.length, label).toBeGreaterThan(0);
        for (const o of at) {
          const onBack = o.panel === PANEL.back;
          const ray = new THREE.Raycaster(
            new THREE.Vector3(o.x, o.y, onBack ? back - 10 : front + 10),
            new THREE.Vector3(0, 0, onBack ? 1 : -1),
          );
          const [hit] = ray.intersectObjects(cabinetParts, false);
          const where = `${label} at (${o.x.toFixed(2)}, ${o.y.toFixed(2)}) on the ${o.panel}`;
          if (onBack) expect(hit ? hit.point.z : Infinity, where).toBeGreaterThan(backInner);
          else expect(hit ? hit.point.z : -Infinity, where).toBeLessThan(baffleInner);
        }
      });
    }
});
