// The Speaker page's build settings from the PA page: the wall panels' size and the side ducts' dividers' size, and
// the horn exit check. A PA design's speaker carries the PA page's choices, and the Speaker
// page's settings build the same box as the PA page's.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { PA_FLOOR, speakerAndFeed } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { cabinetBuild, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import {
  withDuctDivider,
  withMeasuredWalls,
  withWallPanel,
} from "../src/lib/speaker/cabinetPanels";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { panelIn } from "../src/lib/build/panel";
import { PLYWOOD_MATERIAL } from "../src/constants/panelSizes";
import {
  DRIVER_KIND,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPEAKER_PART,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import { hornExitsDiffer, mismatchedHornExit } from "../src/lib/speaker/driverParts";
import { CD_OPTIONS, HORN_OPTIONS } from "../src/lib/data";
import type {
  PaPlannerDesign,
  PanelNominal,
  SideDuctPort,
  SpeakerDriver,
  SpeakerSpec,
} from "../src/types";

/** The PA page's starting design at a wall size, its bracing style set (else it follows the walls). */
const paAt = (panel: PanelNominal, more: Partial<PaPlannerDesign> = {}): PaPlannerDesign => ({
  ...defaultPaDesign(),
  braceStyle: "ribs",
  panel,
  wall: panelIn(panel, PLYWOOD_MATERIAL, {}),
  ...more,
});

/** The PA page's starting design with two side ducts, their dividers at a size (on the vent at its thickness). */
const ductsAt = (divider: PanelNominal, panel: PanelNominal = "3/4"): PaPlannerDesign => {
  const d = paAt(panel);
  const div = panelIn(divider, PLYWOOD_MATERIAL, {});
  return { ...d, portStyle: "vslots", divider, cVent: { ...d.cVent, div } };
};

/** A spec's first chamber's side ducts. */
function ductsOf(spec: SpeakerSpec): SideDuctPort {
  const { vent } = spec.cabinet.chambers[0];
  assert.ok(vent.kind === VENT_KIND.vented && vent.port.shape === PORT_SHAPE.duct);
  return vent.port;
}

/** The spec with its first chamber's side ducts replaced. */
const withDucts = (spec: SpeakerSpec, port: SideDuctPort): SpeakerSpec => ({
  ...spec,
  cabinet: {
    ...spec.cabinet,
    chambers: spec.cabinet.chambers.map((c, i) =>
      i === 0 && c.vent.kind === VENT_KIND.vented ? { ...c, vent: { ...c.vent, port } } : c,
    ),
  },
});

/** A PA design's sub, as the Speaker page reads it. */
const subOf = (design: PaPlannerDesign): SpeakerSpec =>
  speakerAndFeed(layersFromPa(design, { id: "pa", name: "PA" }, PA_FLOOR), SPEAKER_PART.sub).spec;

test("build settings: a PA design's speaker uses its wall panels, as the Speaker page's setting builds them", () => {
  const thick = subOf(paAt("3/4"));
  const thin = subOf(paAt("1/2"));
  assert.equal(thin.cabinet.panel.nominal, "1/2");
  assert.equal(thin.cabinet.panel.thicknessIn, panelIn("1/2", PLYWOOD_MATERIAL, {}));
  assert.ok(
    cabinetBuild(thin.cabinet).lb < cabinetBuild(thick.cabinet).lb,
    "thinner walls weigh less",
  );
  // the Speaker page's Wall panels set to ½″ on the ¾″ design's sub: the PA page's ½″ box
  const set = { ...thick.cabinet, panel: withWallPanel(thick.cabinet.panel, "1/2") };
  assert.deepStrictEqual(set.panel, thin.cabinet.panel);
  assert.deepStrictEqual(cabinetBuild(set), cabinetBuild(thin.cabinet));
  assert.deepStrictEqual(speakerCutParts(set, "butt"), speakerCutParts(thin.cabinet, "butt"));
  // the same size keeps a measured thickness
  const measured = { ...thin.cabinet.panel, thicknessIn: 0.47 };
  assert.equal(withWallPanel(measured, "1/2"), measured);
});

test("build settings: the spec keeps its panel sizes through a save and an open", () => {
  const spec = subOf(paAt("5/8"));
  const opened: SpeakerSpec = JSON.parse(JSON.stringify(spec));
  assert.deepStrictEqual(opened.cabinet.panel, spec.cabinet.panel);
  assert.deepStrictEqual(cabinetBuild(opened.cabinet), cabinetBuild(spec.cabinet));
  assert.equal(
    speakerResponse(opened).chambers[0].netLiters,
    speakerResponse(spec).chambers[0].netLiters,
  );
});

test("build settings: a PA design's side ducts carry its divider size, as the Speaker page's setting sets it", () => {
  const half = subOf(ductsAt("1/2"));
  const thick = subOf(ductsAt("3/4"));
  assert.equal(ductsOf(half).divider, "1/2");
  assert.equal(ductsOf(thick).divider, "3/4");
  assert.equal(ductsOf(thick).div, panelIn("3/4", PLYWOOD_MATERIAL, {}));
  // the Speaker page's Dividers set to ¾″ on the ½″ design's sub: the PA page's ¾″ ducts, in the duct and net-air models
  const set = withDucts(half, withDuctDivider(ductsOf(half), "3/4", half.cabinet.panel));
  assert.deepStrictEqual(ductsOf(set), ductsOf(thick));
  const [setRun, thickRun] = [speakerResponse(set), speakerResponse(thick)];
  assert.equal(setRun.chambers[0].netLiters, thickRun.chambers[0].netLiters);
  assert.equal(setRun.chambers[0].fb, thickRun.chambers[0].fb);
  assert.ok(
    (thickRun.chambers[0].fb ?? 0) < (speakerResponse(half).chambers[0].fb ?? 0),
    "tunes lower",
  );
  assert.deepStrictEqual(cabinetBuild(set.cabinet), cabinetBuild(thick.cabinet));
});

test("build settings: dividers of the walls' size share the walls' measured thickness, as on the PA page", () => {
  const measured = 0.7;
  const plain = subOf(ductsAt("3/4"));
  // the Cutlist page measures the ¾″ walls: the ¾″ dividers take it too, as the PA page's one ¾″ measurement
  const set = withMeasuredWalls(plain.cabinet, measured);
  assert.equal(set.panel.thicknessIn, measured);
  assert.equal(ductsOf({ ...plain, cabinet: set }).div, measured);
  const paDesign = ductsAt("3/4");
  const pa = subOf({ ...paDesign, wall: measured, cVent: { ...paDesign.cVent, div: measured } });
  assert.deepStrictEqual(set, pa.cabinet);
  // dividers of another size keep their default thickness (the Cutlist page measures only the walls)
  const half = subOf(ductsAt("1/2"));
  const halfSet = withMeasuredWalls(half.cabinet, measured);
  assert.deepStrictEqual(ductsOf({ ...half, cabinet: halfSet }), ductsOf(half));
  // the measurement cleared: the walls and their size's dividers back at the default
  assert.deepStrictEqual(
    withMeasuredWalls(set, panelIn("3/4", PLYWOOD_MATERIAL, {})),
    plain.cabinet,
  );
  // a divider size picked to match the walls takes their current thickness; another size its default
  assert.equal(withDuctDivider(ductsOf(half), "3/4", set.panel).div, measured);
  assert.equal(
    withDuctDivider(ductsOf(half), "5/8", set.panel).div,
    panelIn("5/8", PLYWOOD_MATERIAL, {}),
  );
});

test("build settings: the horn exit check fires on a compression driver whose horn's throat differs", () => {
  const cd = CD_OPTIONS[0];
  const matched = HORN_OPTIONS.find((h) => h.exit === cd.exit);
  const other = HORN_OPTIONS.find((h) => h.exit !== cd.exit);
  assert.ok(matched && other, "the catalog has a matched and a mismatched horn");
  const on = (hornId: string): SpeakerDriver => ({
    kind: DRIVER_KIND.compression,
    driverId: cd.id,
    count: 1,
    position: { xIn: 0, yIn: 0 },
    bands: ["horn"],
    horn: { hornId, placement: HORN_PLACEMENT.top, mount: null },
  });
  assert.equal(hornExitsDiffer(other, cd), true);
  assert.equal(hornExitsDiffer(matched, cd), false);
  assert.deepStrictEqual(mismatchedHornExit(on(other.id)), { horn: other, driver: cd });
  assert.equal(mismatchedHornExit(on(matched.id)), null);
  assert.equal(mismatchedHornExit({ ...on(other.id), horn: null }), null);
});
