// A drawn (folded) horn's boards in the Speaker cutlist (lib/speaker/speakerBuild `speakerCutParts`): one row per board,
// its long edge by the chamber's clear width, with each end's cut in its note; the boards count in the wood and the
// weight, and the mouth's opening goes on the wall it is in.
import { describe, expect, test } from "vite-plus/test";
import { FOLD_WALL, HORN_PATH } from "../src/constants/speakerSpec";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { cutRows } from "../src/lib/pa/cutlist";
import { panelLbPerSqFt } from "../src/lib/panel";
import { foldRoom } from "../src/lib/speaker/foldHorn";
import { cabinetBuild, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import type { CutPart, FoldBoard, HornFold, SidePoint, SpeakerSpec } from "../src/types";

const pt = (zIn: number, yIn: number): SidePoint => ({ zIn, yIn });
const board = (a: SidePoint, b: SidePoint): FoldBoard => ({ a, b });

/** the sub bin's side section is 29 in deep and 18.125 in high, 45 in wide, with 3/4 in walls */
const BIN = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);
const MOUTH = { wall: FOLD_WALL.baffle, fromIn: 8, toIn: 18 };
const foldOf = (boards: FoldBoard[], mouth: HornFold["mouth"] = MOUTH): HornFold => ({
  boards,
  drivers: null,
  mouth,
});

/** the sub bin with its horn folded, and `fold` drawn in it (none: not drawn yet) */
function folded(fold?: HornFold): SpeakerSpec {
  return {
    ...BIN,
    cabinet: {
      ...BIN.cabinet,
      chambers: BIN.cabinet.chambers.map((c) =>
        c.load.kind === "horn"
          ? { ...c, load: { ...c.load, horn: { ...c.load.horn, path: HORN_PATH.folded, fold } } }
          : c,
      ),
    },
  };
}

const partsOf = (spec: SpeakerSpec) => speakerCutParts(spec.cabinet, "butt").parts;
const hornBoards = (spec: SpeakerSpec) => partsOf(spec).filter((p) => p.part === "hornBoard");
const areaOf = (parts: CutPart[]) => parts.reduce((sum, p) => sum + p.qty * p.a * p.b, 0);

/** a level board from the baffle, and an upright one joined to its far end: an L */
const L = foldOf([board(pt(0, 5), pt(20, 5)), board(pt(20, 5), pt(20, 15))]);

describe("a drawn horn's boards in the cutlist", () => {
  test("an L of two boards gives two horn boards with 45° miters at the corner", () => {
    const boards = hornBoards(folded(L));
    expect(boards).toHaveLength(2);
    const room = foldRoom(BIN.cabinet, BIN.cabinet.chambers[0]);
    for (const p of boards) {
      // the long edge by the clear width, of the walls' plywood
      expect(p.b).toBeCloseTo(room.widthIn, 9);
      expect(p.t).toBe(BIN.cabinet.panel.thicknessIn);
      expect(p.qty).toBe(1);
    }
    expect(boards[0].a).toBeGreaterThan(20);
    expect(boards[1].a).toBeGreaterThan(10);
    expect(boards[0].note).toBe(
      "Horn board 1: square to the baffle at one end, 45° miter to board 2 at the other",
    );
    expect(boards[1].note).toBe(
      "Horn board 2: 45° miter to board 1 at one end, square at the other",
    );
  });

  test("a board butting another's face shows a square butt, or a bevel when slanted", () => {
    const level = board(pt(0, 5), pt(20, 5));
    const face = 5 + BIN.cabinet.panel.thicknessIn / 2;
    const square = hornBoards(folded(foldOf([level, board(pt(10, face), pt(10, 15))])));
    expect(square[1].note).toBe(
      "Horn board 2: square butt on board 1 at one end, square at the other",
    );
    const slanted = hornBoards(folded(foldOf([level, board(pt(10, face), pt(20, face + 10))])));
    expect(slanted[1].note).toBe(
      "Horn board 2: 45° bevel butt on board 1 at one end, square at the other",
    );
  });

  test("a board that meets nothing at either end is square at both", () => {
    const [only] = hornBoards(folded(foldOf([board(pt(5, 9), pt(20, 9))])));
    expect(only.note).toBe("Horn board 1: square at both ends");
  });

  test("the totals grow with the boards: rows, wood, sheets and weight", () => {
    const bare = folded(foldOf([]));
    const spec = folded(L);
    const added = hornBoards(spec);
    expect(partsOf(spec)).toHaveLength(partsOf(bare).length + 2);
    expect(areaOf(partsOf(spec)) - areaOf(partsOf(bare))).toBeCloseTo(areaOf(added), 9);
    // each board is its own row on the Cutlist page (rows are the sheets' pieces)
    expect(cutRows(partsOf(spec)).filter((p) => p.part === "hornBoard")).toHaveLength(2);
    const rate = panelLbPerSqFt(BIN.cabinet.panel.thicknessIn, BIN.cabinet.panel.material);
    const grew = cabinetBuild(spec.cabinet).lb - cabinetBuild(bare.cabinet).lb;
    expect(grew).toBeCloseTo((areaOf(added) * rate) / 144, 9);
    expect(grew).toBeGreaterThan(0);
    const wood = (s: SpeakerSpec) => cabinetBuild(s.cabinet).chambers[0].lb.wood;
    expect(wood(spec)).toBeGreaterThan(wood(bare));
  });

  test("a folded horn with no fold drawn, or a straight horn, adds no boards", () => {
    expect(hornBoards(folded())).toHaveLength(0);
    expect(hornBoards(BIN)).toHaveLength(0);
    expect(cabinetBuild(folded().cabinet).lb).toBeCloseTo(
      cabinetBuild(folded(foldOf([])).cabinet).lb,
      9,
    );
  });

  test("a mouth in the baffle puts its opening on the baffle", () => {
    const baffle = partsOf(folded(L)).find((p) => p.part === "baffle");
    expect(baffle?.note).toContain("horn mouth: 45 × 10″ opening");
    expect(partsOf(folded()).find((p) => p.part === "baffle")?.note).not.toContain("horn mouth");
  });
});
