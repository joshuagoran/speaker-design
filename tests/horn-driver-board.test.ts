// A horn-loaded chamber's driver board (lib/speaker/driverBoard): the panel at the back of the bay that the drivers mount
// on. By default one piece as thick as a wall; Double makes it two pieces glued face to face, which stand the cones one
// wall further back. The model reads it in the cutlist (its own part), the weight, the net air, the front chamber, the
// depth fit and the 3D view, where it takes the baffle color and the front panel (the frame round the mouth) the
// cabinet color.
import { describe, expect, test } from "vite-plus/test";
import * as THREE from "three";
import {
  buildSpeakerScene,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD } from "../src/constants/speakerSpec";
import {
  chamberSetbackIn,
  driverBoardIn,
  driverBoardPieces,
  driverSetbackIn,
} from "../src/lib/speaker/driverBoard";
import { cabinetBuild, chamberNetLiters, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { frontChamber, throatCones } from "../src/lib/speaker/hornThroat";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { panelLbPerSqFt } from "../src/lib/build/panel";
import { CM2_PER_IN2, CM_PER_IN } from "../src/constants/units";
import { frontLoadedOf, roomOf } from "./horn-room";
import type { SpeakerChamber, SpeakerSpec } from "../src/types";
import { CORNER_JOINT } from "../src/constants/cutParts";

/** The spec with its one horn chamber's driver board doubled, or not. */
function withBoard(spec: SpeakerSpec, doubleBoard: boolean): SpeakerSpec {
  return {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: spec.cabinet.chambers.map((c): SpeakerChamber =>
        c.load.kind === CHAMBER_LOAD.horn
          ? { ...c, load: { ...c.load, horn: { ...c.load.horn, doubleBoard } } }
          : c,
      ),
    },
  };
}

/** The sub bin's spec, its board single or doubled. */
const bin = (doubleBoard = false) =>
  withBoard(templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne), doubleBoard);

/** The driver board's cutlist rows of a spec. */
const boardRows = (spec: SpeakerSpec) =>
  speakerCutParts(spec.cabinet, CORNER_JOINT.butt).parts.filter((p) => p.part === "driverBoard");

/** The bay of a spec's one horn chamber. */
function bayOf(spec: SpeakerSpec) {
  const [placed] = speakerLayout(spec.cabinet).chambers;
  const flare = hornFlare(spec.cabinet, placed);
  if (!flare?.path.bay) throw new Error("the horn has a bay");
  return { flare, bay: flare.path.bay, placed };
}

describe("the driver board's thickness", () => {
  test("the default is one piece as thick as the walls; Double is two", () => {
    const wall = bin().cabinet.panel.thicknessIn;
    expect(driverBoardPieces({})).toBe(1);
    expect(driverBoardPieces({ doubleBoard: false })).toBe(1);
    expect(driverBoardPieces({ doubleBoard: true })).toBe(2);
    expect(driverBoardIn(wall, {})).toBe(wall);
    expect(driverBoardIn(wall, { doubleBoard: true })).toBe(2 * wall);
    expect(bayOf(bin()).bay.boardIn).toBe(wall);
    expect(bayOf(bin(true)).bay.boardIn).toBe(2 * wall);
    // the walls' thickness is the one setting: a measured wall carries the board with it
    const thick = bin();
    const measured = {
      ...thick,
      cabinet: { ...thick.cabinet, panel: { ...thick.cabinet.panel, thicknessIn: 0.72 } },
    };
    expect(bayOf(measured).bay.boardIn).toBe(0.72);
    expect(bayOf(withBoard(measured, true)).bay.boardIn).toBeCloseTo(1.44, 12);
  });

  test("the cones stand flush at the bay's end with one piece, one wall behind it with two", () => {
    const wall = bin().cabinet.panel.thicknessIn;
    const [chamber] = bin().cabinet.chambers;
    expect(driverSetbackIn(wall, {})).toBe(0);
    expect(driverSetbackIn(wall, { doubleBoard: true })).toBe(wall);
    expect(chamberSetbackIn(bin().cabinet.panel, chamber)).toBe(0);
    expect(chamberSetbackIn(bin(true).cabinet.panel, bin(true).cabinet.chambers[0])).toBe(wall);
    expect(chamberSetbackIn(bin().cabinet.panel, { load: { kind: CHAMBER_LOAD.direct } })).toBe(0);
  });
});

describe("the driver board in the cutlist and the weight", () => {
  test("a board of its own: one piece as thick as the walls, two when doubled", () => {
    const spec = bin();
    const { bay } = bayOf(spec);
    const [one] = boardRows(spec);
    expect(boardRows(spec)).toHaveLength(1);
    expect(one.qty).toBe(1);
    expect(one.t).toBe(spec.cabinet.panel.thicknessIn);
    expect([one.a, one.b]).toEqual([bay.w, bay.h]);
    const double = bin(true);
    const [two] = boardRows(double);
    expect(boardRows(double)).toHaveLength(1);
    expect(two.qty).toBe(2);
    expect(two.t).toBe(one.t);
    expect([two.a, two.b]).toEqual([one.a, one.b]);
    expect(two.note).toContain("glue");
    expect(one.note).not.toContain("glue");
  });

  test("a direct chamber has no board", () => {
    const spec = bin();
    const direct: SpeakerSpec = {
      ...spec,
      cabinet: {
        ...spec.cabinet,
        chambers: spec.cabinet.chambers.map((c) => ({ ...c, load: { kind: CHAMBER_LOAD.direct } })),
      },
    };
    expect(boardRows(direct)).toHaveLength(0);
  });

  test("a doubled board weighs one more piece, less its cutouts", () => {
    const one = bin(),
      two = bin(true);
    const { bay } = bayOf(one);
    const [chamber] = one.cabinet.chambers;
    const cones = throatCones(chamber.drivers);
    if (!cones) throw new Error("the bin has cones");
    const holesIn2 = (cones.cone.Sd * cones.count) / CM2_PER_IN2;
    const { thicknessIn, material } = one.cabinet.panel;
    const piece = ((bay.w * bay.h - holesIn2) * panelLbPerSqFt(thicknessIn, material)) / 144;
    const gain =
      cabinetBuild(two.cabinet).chambers[0].lb.wood - cabinetBuild(one.cabinet).chambers[0].lb.wood;
    expect(gain).toBeCloseTo(piece, 9);
    expect(cabinetBuild(two.cabinet).lb).toBeGreaterThan(cabinetBuild(one.cabinet).lb);
  });

  test("the board's wood leaves the rear chamber's air", () => {
    const one = cabinetBuild(bin().cabinet).chambers[0];
    const two = cabinetBuild(bin(true).cabinet).chambers[0];
    expect(one.woodL).toBeGreaterThan(0);
    expect(two.woodL).toBeGreaterThan(one.woodL);
    // a second piece's wood and its cutouts' air (the front chamber's) are not counted twice
    const { bay } = bayOf(bin());
    const [chamber] = bin().cabinet.chambers;
    const cones = throatCones(chamber.drivers);
    if (!cones) throw new Error("the bin has cones");
    const wall = bin().cabinet.panel.thicknessIn;
    const pieceL =
      ((bay.w * bay.h - (cones.cone.Sd * cones.count) / CM2_PER_IN2) * wall * 16.387) / 1000;
    expect(two.woodL - one.woodL).toBeCloseTo(pieceL, 9);
  });
});

describe("the driver board in the net air", () => {
  /** the sub bin with its net air Auto */
  const auto = (doubleBoard: boolean): SpeakerSpec => {
    const spec = bin(doubleBoard);
    return {
      ...spec,
      cabinet: {
        ...spec.cabinet,
        chambers: spec.cabinet.chambers.map((c) => ({ ...c, netLiters: null })),
      },
    };
  };
  const airOf = (spec: SpeakerSpec) => chamberNetLiters(spec.cabinet, spec.cabinet.chambers[0], 0);

  test("the board and the cutouts' air come off the clear volume; a doubled board takes a piece more", () => {
    const one = auto(false),
      two = auto(true);
    const oneBuild = cabinetBuild(one.cabinet).chambers[0];
    expect(airOf(one)).toBeCloseTo(
      oneBuild.clearL - oneBuild.ventL - oneBuild.hornL - oneBuild.woodL - oneBuild.recessL,
      9,
    );
    expect(airOf(two)).toBeLessThan(airOf(one));
    // the second piece's wood, less its cutouts, and the cutouts' air in front of the cones
    const twoBuild = cabinetBuild(two.cabinet).chambers[0];
    expect(twoBuild.woodL + twoBuild.hornL - (oneBuild.woodL + oneBuild.hornL)).toBeCloseTo(
      airOf(one) - airOf(two),
      9,
    );
  });
});

describe("the driver board in the front chamber and the depth fit", () => {
  test("a doubled board adds its cutouts' air to the front chamber", () => {
    const [chamber] = bin().cabinet.chambers;
    const cones = throatCones(chamber.drivers);
    if (!cones) throw new Error("the bin has cones");
    const wall = bin().cabinet.panel.thicknessIn;
    const face = { w: 20, h: 20 };
    const read = (spec: SpeakerSpec) => {
      const [c] = spec.cabinet.chambers;
      const result = hornDesignOf(
        c,
        { count: 1, angle: 2 },
        {
          ...roomOf(c, face),
          setbackIn: chamberSetbackIn(spec.cabinet.panel, c),
        },
      );
      return frontLoadedOf(result).throatChamber;
    };
    const one = read(bin()),
      two = read(bin(true));
    expect(one).toBe(frontChamber(cones.cone, cones.count).liters);
    expect(two).toBe(frontChamber(cones.cone, cones.count, wall).liters);
    // the added air: each cone's area times a wall, in liters
    expect(two - one).toBeCloseTo((cones.cone.Sd * cones.count * wall * CM_PER_IN) / 1000, 9);
  });

  test("the response model takes the doubled board's front chamber", () => {
    const one = speakerResponse(bin());
    const two = speakerResponse(bin(true));
    expect(one.chambers[0].gaps).toEqual([]);
    expect(two.chambers[0].gaps).toEqual([]);
    // more air in front of the cones moves the response
    expect(two.sum.some((p, i) => p.spl !== one.sum[i].spl)).toBe(true);
  });

  test("a doubled board stands the cones and their bodies one wall further back and needs that much depth", () => {
    const wall = bin().cabinet.panel.thicknessIn;
    const one = bayOf(bin()),
      two = bayOf(bin(true));
    expect(one.bay.coneZ).toBe(one.bay.boardZ);
    expect(two.bay.boardZ).toBeCloseTo(one.bay.boardZ, 12);
    expect(two.bay.coneZ - two.bay.boardZ).toBeCloseTo(wall, 12);
    expect(two.bay.bodyZ - one.bay.bodyZ).toBeCloseTo(wall, 12);
    expect(two.flare.path.needs.depthIn - one.flare.path.needs.depthIn).toBeCloseTo(wall, 12);
  });

  test("a chamber that fits with one piece can fail the fit with two", () => {
    const wall = bin().cabinet.panel.thicknessIn;
    const inset = bin().cabinet.insetIn;
    const need = bayOf(bin()).flare.path.needs.depthIn;
    // the clear depth is the depth less the back, the baffle and the inset: a hair more than the single board needs
    const shallow = (doubleBoard: boolean): SpeakerSpec => {
      const spec = bin(doubleBoard);
      return {
        ...spec,
        cabinet: {
          ...spec.cabinet,
          chambers: spec.cabinet.chambers.map((c) => ({
            ...c,
            dims: { ...c.dims, d: need + 0.1 + 2 * wall + inset },
          })),
        },
      };
    };
    expect(bayOf(shallow(false)).flare.path.fits).toBe(true);
    expect(bayOf(shallow(true)).flare.path.fits).toBe(false);
  });
});

describe("the driver board in the 3D view", () => {
  const BAFFLE = "#ff00aa",
    CABINET = "#2266aa";
  /** the scene of a spec, painted so that the baffle and the cabinet differ */
  const sceneOf = (spec: SpeakerSpec, cutaway = false) => {
    const scene = buildSpeakerScene({
      spec: {
        cabinet: spec.cabinet,
        look: { ...spec.look, cabFinish: CABINET, baffleColor: BAFFLE },
      },
      cutaway,
    });
    scene.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    return meshes;
  };
  /** a mesh's face material's color, as a hex string (its first material when it has several) */
  const faceColor = (mesh: THREE.Mesh) => {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) throw new Error("a lit material");
    return `#${material.color.getHexString()}`;
  };

  for (const [name, spec] of [
    ["straight", bin()],
    ["doubled", bin(true)],
  ] as const)
    test(`${name}: the driver board is painted as the baffle, the front panel as the cabinet`, () => {
      const meshes = sceneOf(spec);
      const boards = meshes.filter((m) => m.name === SPEAKER_MESH_NAMES.driverBoard);
      expect(boards).toHaveLength(
        driverBoardPieces(
          spec.cabinet.chambers[0].load.kind === CHAMBER_LOAD.horn
            ? spec.cabinet.chambers[0].load.horn
            : {},
        ),
      );
      for (const board of boards) expect(faceColor(board)).toBe(BAFFLE);
      // the front panel: the unnamed panel nearest the front, with its faces and cut edges as materials
      const panels = meshes.filter((m) => m.name === "" && Array.isArray(m.material));
      const front = panels.reduce((a, b) =>
        new THREE.Box3().setFromObject(b).max.z > new THREE.Box3().setFromObject(a).max.z ? b : a,
      );
      expect(faceColor(front)).toBe(CABINET);
      // the baffle color is on the board alone
      const painted = meshes.filter((m) =>
        !Array.isArray(m.material) || m.material.length === 0 ? false : faceColor(m) === BAFFLE,
      );
      expect(painted.every((m) => m.name === SPEAKER_MESH_NAMES.driverBoard)).toBe(true);
    });

  test("the board is behind the bay, the pieces side by side with the cones set back by the first", () => {
    const wall = bin().cabinet.panel.thicknessIn;
    const boards = sceneOf(bin(true)).filter((m) => m.name === SPEAKER_MESH_NAMES.driverBoard);
    const boxes = boards
      .map((b) => new THREE.Box3().setFromObject(b))
      .sort((a, b) => b.max.z - a.max.z);
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box.max.z - box.min.z).toBeCloseTo(wall, 9);
    // the pieces touch face to face
    expect(boxes[0].min.z).toBeCloseTo(boxes[1].max.z, 9);
  });

  test("the cutaway paints the board as the baffle too", () => {
    const meshes = sceneOf(bin(), true);
    const boards = meshes.filter((m) => m.name === SPEAKER_MESH_NAMES.driverBoard);
    expect(boards).toHaveLength(1);
    expect(faceColor(boards[0])).toBe(BAFFLE);
  });
});
