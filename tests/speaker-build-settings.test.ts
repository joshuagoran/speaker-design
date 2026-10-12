// The Speaker page's build settings from the PA page: the wall panels' size. A PA design's speaker carries the PA
// page's choice, and the Speaker page's setting builds the same box as the PA page's.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { PA_FLOOR, speakerAndFeed } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { cabinetBuild, speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { withWallPanel } from "../src/lib/speaker/cabinetPanels";
import { defaultPaDesign } from "../src/pages/speaker/speakerTemplates";
import { panelIn } from "../src/lib/panel";
import { PLYWOOD_MATERIAL } from "../src/constants/panelSizes";
import { SPEAKER_PART } from "../src/constants/speakerSpec";
import type { PaPlannerDesign, PanelNominal, SpeakerSpec } from "../src/types";

/** The PA page's starting design at a wall size, its bracing style set (else it follows the walls). */
const paAt = (panel: PanelNominal, more: Partial<PaPlannerDesign> = {}): PaPlannerDesign => ({
  ...defaultPaDesign(),
  braceStyle: "ribs",
  panel,
  wall: panelIn(panel, PLYWOOD_MATERIAL, {}),
  ...more,
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
