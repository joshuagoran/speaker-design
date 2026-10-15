// The Hornresp reader (lib/acoustics/network/hornrespRecord): every committed record read onto the network presets
// against Hornresp's own results; the records it cannot map yet; a hand-written offset-driver record (SKRAM, its rear
// chamber's volume a placeholder: structural checks only); and the tapped and offset-driver reference records in
// tools/hornresp/records, whose Hornresp results come later (their checks are skipped placeholders until then).
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { readHornrespRecord } from "../src/lib/acoustics/network/hornrespRecord";
import { presetModel } from "../src/lib/acoustics/network/presets";
import {
  HORN_LAYOUT,
  MISSING_VALUE,
  NETWORK_PART,
  NOT_SUPPORTED_YET,
} from "../src/constants/acousticNetwork";
import { GRAMS_PER_KG } from "../src/constants/units";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import type { HornLayout, HornrespReading } from "../src/types";
import { HORNRESP_DIR, resultsOf } from "./hornresp-records";

/** Hornresp's results the network must meet: SPL in dB; Ze and excursion relative (as tests/hornresp.test.ts). */
const SPL_TOLERANCE = 0.02,
  CIRCUIT_TOLERANCE = 1e-3;
/** Hornresp exports excursion to 6 decimals (mm): half a step is its rounding */
const EXCURSION_ROUNDING_MM = 5e-7;
/** The committed records, each once (tests/hornresp/<name>.txt). */
const RECORDS = [
  "sub-sealed-exp",
  "sub-bin-vented",
  "sub-bin-eighth",
  "sub-direct-vented",
  "mid-vented",
  "mid-pair",
  "sub-bin-le",
  "mid-le",
  "mid-pair-le",
] as const;
/** The hand-written SKRAM record, and the reference records waiting on Hornresp's results. */
const LAYOUTS_DIR = path.join(import.meta.dirname, "hornresp-layouts");
const REFERENCE_DIR = path.join(import.meta.dirname, "..", "tools", "hornresp", "records");
/**
 * The reference records and their layouts. The records leave the layout out (Hornresp may reject a key it does not
 * know), so the reader takes it from here; tools/hornresp/README.md says how to set it in Hornresp.
 */
const REFERENCES: { name: string; layout: HornLayout }[] = [
  { name: "th-thorn10", layout: HORN_LAYOUT.tapped },
  { name: "th-15", layout: HORN_LAYOUT.tapped },
  { name: "od-skram", layout: HORN_LAYOUT.offsetDriver },
];

/** A reading that must succeed. */
function readOk(reading: HornrespReading) {
  assert.ok(reading.ok, reading.ok ? "" : reading.reason);
  return reading;
}
/** A committed record's text. */
const recordText = (name: string) =>
  fs.readFileSync(path.join(HORNRESP_DIR, `${name}.txt`), "latin1");

for (const name of RECORDS) {
  test(`the reader maps ${name} and matches Hornresp's results`, () => {
    const reading = readOk(readHornrespRecord(recordText(name)));
    assert.strictEqual(reading.design.layout, HORN_LAYOUT.frontLoaded);
    const hornresp = resultsOf(
      fs.readFileSync(path.join(HORNRESP_DIR, `${name}-results.txt`), "utf8"),
    );
    const model = presetModel(
      reading.preset,
      hornresp.map((p) => p.f),
      reading.volts,
    );
    assert.ok(model);
    hornresp.forEach((expected, i) => {
      const point = model.curve[i];
      const at = `${name} at ${expected.f.toFixed(1)} Hz`;
      assert.ok(
        Math.abs(point.powerSpl - expected.spl) <= SPL_TOLERANCE,
        `${at}: SPL ${point.powerSpl} vs ${expected.spl}`,
      );
      assert.ok(
        Math.abs(point.ze / expected.ze - 1) <= CIRCUIT_TOLERANCE,
        `${at}: Ze ${point.ze} vs ${expected.ze}`,
      );
      assert.ok(
        Math.abs(point.xmm - expected.xmm) <=
          CIRCUIT_TOLERANCE * expected.xmm + EXCURSION_ROUNDING_MM,
        `${at}: excursion ${point.xmm} vs ${expected.xmm}`,
      );
    });
  });
}

/** A committed record with one line's value changed (the first line with that key). */
const withValue = (text: string, key: string, value: string) =>
  text.replace(new RegExp(`^${key} = .*$`, "m"), `${key} = ${value}`);

test("the reader names what it cannot model yet", () => {
  const base = recordText("mid-vented");
  const reasonFor = (text: string) => {
    const reading = readHornrespRecord(text);
    assert.ok(!reading.ok, "the record should not map");
    return reading.reason;
  };
  const unsupported: [string, string, string][] = [
    ["Rg", "4.00", "Rg"],
    ["Ang", "4.0 x Pi", "solid angle"],
    ["Semi-Inductance Model Flag", "1", "semi-inductance"],
    ["End Correction Flag", "1", "End Correction Flag"],
    ["Acoustic Path Length", "12.0", "path length"],
    ["Added Mass", "50.00", "passive radiator"],
    ["High Pass Frequency", "30", "high-pass"],
    ["Band 2 Frequency", "80", "equalizer"],
    ["Nd", "2", "Nd"],
    ["Vrc", "0.00", "open rear"],
  ];
  for (const [key, value, named] of unsupported) {
    const reason = reasonFor(withValue(base, key, value));
    assert.ok(reason.startsWith(NOT_SUPPORTED_YET), `${key}: ${reason}`);
    assert.ok(reason.includes(named), `${key}: ${reason}`);
  }
  // a section of another flare
  const tractrix = reasonFor(base.replace("Exp = 35.00", "Tra = 35.00"));
  assert.ok(tractrix.startsWith(NOT_SUPPORTED_YET) && tractrix.includes("Tra"), tractrix);
  // both layout flags
  assert.ok(reasonFor(`${base}\nOD = 1\nTH = 1\n`).includes("OD and TH"));
  // a tapped horn needs two sections, and no vent
  assert.ok(reasonFor(`${base}\nTH = 1\n`).startsWith(NOT_SUPPORTED_YET));
  // a missing value
  const missing = reasonFor(base.replace(/^Sd = .*$/m, ""));
  assert.strictEqual(missing, `${MISSING_VALUE}Sd`);
});

test("the reader takes a hand-written offset-driver record: SKRAM (structural: its rear chamber is a placeholder)", () => {
  const reading = readOk(
    readHornrespRecord(fs.readFileSync(path.join(LAYOUTS_DIR, "skram-od.txt"), "latin1")),
  );
  const { design, preset } = reading;
  assert.strictEqual(design.layout, HORN_LAYOUT.offsetDriver);
  if (design.layout !== HORN_LAYOUT.offsetDriver) return;
  // the driver taps at S2: a 27.28 cm closed stub before it, 100.75 cm of horn after it, both parabolic
  assert.strictEqual(design.tap, 1);
  assert.deepStrictEqual(
    design.segments.map((s) => [s.profile, s.s1, s.s2, s.length]),
    [
      [HORN_PROFILE.parabolic, 488, 575.2, 27.28],
      [HORN_PROFILE.parabolic, 575.2, 1195.5, 100.75],
    ],
  );
  assert.deepStrictEqual(design.rear, { liters: 100, port: { area: 732, length: 79.54 } });
  assert.strictEqual(design.throatChamber, 0);
  assert.strictEqual(design.angle, 2);
  // Hornresp's Mmd comes back as the moving mass the network drives: Mms less one side's air load
  const driverPart = preset.network.parts[preset.driver];
  assert.ok(driverPart.kind === NETWORK_PART.driver);
  near(design.driver.Mms - driverPart.airMassOff * GRAMS_PER_KG, 422.82, 1e-9, "moving mass, g");
  near(design.driver.Xmax, 15, 0, "Xmax");
  // the network: a closed end, the tap, the mouth, the rear chamber and the vent's exit
  assert.strictEqual(preset.network.nodeCount, 5);
  assert.ok(preset.fb !== null && preset.fb > 20 && preset.fb < 80, `vent tuning ${preset.fb} Hz`);
  const freqs = Array.from({ length: 60 }, (_, i) => 10 * Math.pow(50, i / 59));
  const model = presetModel(preset, freqs, reading.volts);
  assert.ok(model);
  for (const point of model.curve)
    assert.ok(
      [point.spl, point.powerSpl, point.xmm, point.ze, point.portSpeed].every(Number.isFinite),
      `finite at ${point.f.toFixed(1)} Hz`,
    );
  // read as front-loaded instead, the stub becomes horn: a different design
  const frontLoaded = readOk(
    readHornrespRecord(fs.readFileSync(path.join(LAYOUTS_DIR, "skram-od.txt"), "latin1"), {
      layout: HORN_LAYOUT.frontLoaded,
    }),
  );
  assert.strictEqual(frontLoaded.design.layout, HORN_LAYOUT.frontLoaded);
});

/** Asserts that two numbers differ by at most `tolerance`. */
function near(actual: number, expected: number, tolerance: number, what: string) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);
}

for (const reference of REFERENCES) {
  const text = () => fs.readFileSync(path.join(REFERENCE_DIR, `${reference.name}.txt`), "latin1");
  test(`the reader maps the reference record ${reference.name} (${reference.layout})`, () => {
    const reading = readOk(readHornrespRecord(text(), { layout: reference.layout }));
    assert.strictEqual(reading.design.layout, reference.layout);
    const freqs = Array.from({ length: 40 }, (_, i) => 10 * Math.pow(40, i / 39));
    const model = presetModel(reading.preset, freqs, reading.volts);
    assert.ok(model);
    for (const point of model.curve)
      assert.ok(Number.isFinite(point.powerSpl) && Number.isFinite(point.xmm));
  });
  // Placeholder: Hornresp's results for this record come from a Hornresp run (tools/hornresp/README.md). Once
  // tests/hornresp/<name>-results.txt exists, drop the skip: the check is the committed records' (above), with the
  // layout from REFERENCES. The tapped horn's sides (front at S2, rear at S3) and the OD and TH flags' record keys
  // are to be confirmed by that run.
  test.skip(`the reader matches Hornresp's results: ${reference.name} (waits on Hornresp's results)`, () => {
    const reading = readOk(readHornrespRecord(text(), { layout: reference.layout }));
    const hornresp = resultsOf(
      fs.readFileSync(path.join(HORNRESP_DIR, `${reference.name}-results.txt`), "utf8"),
    );
    const model = presetModel(
      reading.preset,
      hornresp.map((p) => p.f),
      reading.volts,
    );
    assert.ok(model);
    hornresp.forEach((expected, i) => {
      near(model.curve[i].powerSpl, expected.spl, SPL_TOLERANCE, `SPL at ${expected.f} Hz`);
      near(model.curve[i].ze / expected.ze, 1, CIRCUIT_TOLERANCE, `Ze at ${expected.f} Hz`);
    });
  });
}
