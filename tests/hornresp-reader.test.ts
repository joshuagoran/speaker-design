// The Hornresp reader (lib/acoustics/network/hornrespRecord): every committed record read onto the network presets
// against Hornresp's own results; the records it cannot map yet; a hand-written offset-driver record (SKRAM, its rear
// chamber's volume a placeholder: structural checks only); and the tapped and offset-driver reference records in
// tools/hornresp/records (as Hornresp exported them, its layout key in each) against Hornresp 60.60's results.
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { readHornrespRecord } from "../src/lib/acoustics/network/hornrespRecord";
import { presetModel } from "../src/lib/acoustics/network/presets";
import {
  HORN_LAYOUT,
  HORNRESP_KEY,
  HORNRESP_LAYOUT_KEY,
  INVALID_RECORD,
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
/** The hand-written SKRAM record, and the tapped and offset-driver reference records. */
const LAYOUTS_DIR = path.join(import.meta.dirname, "hornresp-layouts");
const REFERENCE_DIR = path.join(import.meta.dirname, "..", "tools", "hornresp", "records");
/**
 * The reference records and the layout each one's key names (tools/hornresp/README.md). th-thorn10-chambers adds
 * both tap chambers to th-thorn10; th-15-four splits th-15's last section, so its rears tap S4. th18-xoc1 is a
 * published design (TH18 by Xoc1).
 */
const REFERENCES: { name: string; layout: HornLayout }[] = [
  { name: "th-thorn10", layout: HORN_LAYOUT.tapped },
  { name: "th-thorn10-chambers", layout: HORN_LAYOUT.tapped },
  { name: "th-15", layout: HORN_LAYOUT.tapped },
  { name: "th-15-four", layout: HORN_LAYOUT.tapped },
  { name: "od-skram", layout: HORN_LAYOUT.offsetDriver },
  // a published design: four sections, a front chamber and the amplifier's output resistance (Rg 0.1 Ω)
  { name: "th18-xoc1", layout: HORN_LAYOUT.tapped },
];

/** A reading that must succeed. */
function readOk(reading: HornrespReading) {
  assert.ok(reading.ok, reading.ok ? "" : reading.reason);
  return reading;
}
/** A committed record's text. */
const recordText = (name: string) =>
  fs.readFileSync(path.join(HORNRESP_DIR, `${name}.txt`), "latin1");

/** Asserts that a reading's network meets Hornresp's results for `name` (tests/hornresp/<name>-results.txt). */
function assertMatchesHornresp(name: string, reading: HornrespReading & { ok: true }) {
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
}

for (const name of RECORDS) {
  test(`the reader maps ${name} and matches Hornresp's results`, () => {
    const reading = readOk(readHornrespRecord(recordText(name)));
    assert.strictEqual(reading.design.layout, HORN_LAYOUT.frontLoaded);
    assertMatchesHornresp(name, reading);
  });
}

/** A committed record with one line's value changed (the first line with that key). */
const withValue = (text: string, key: string, value: string) =>
  text.replace(new RegExp(`^${key} = .*$`, "m"), `${key} = ${value}`);

test("the reader takes the amplifier's output resistance (Rg) in series with the coil", () => {
  const base = readOk(readHornrespRecord(recordText("mid-vented")));
  const withRg = readOk(
    readHornrespRecord(withValue(recordText("mid-vented"), HORNRESP_KEY.sourceResistance, "4.00")),
  );
  assert.equal(base.losses.sourceResistance, 0);
  assert.equal(withRg.losses.sourceResistance, 4);
  const at = (reading: HornrespReading & { ok: true }) =>
    presetModel(reading.preset, [60], reading.volts)?.curve[0];
  const [plain, damped] = [at(base), at(withRg)];
  assert.ok(plain && damped);
  // the resistance takes some of the drive: quieter; the driver's own impedance leaves it out
  assert.ok(damped.spl < plain.spl - 0.5, `${damped.spl} vs ${plain.spl}`);
  assert.ok(Math.abs(damped.ze - plain.ze) < 0.5 * plain.ze);
});

test("the reader names what it cannot model yet", () => {
  const base = recordText("mid-vented");
  const reasonFor = (text: string) => {
    const reading = readHornrespRecord(text);
    assert.ok(!reading.ok, "the record should not map");
    return reading.reason;
  };
  const unsupported: [string, string, string][] = [
    [HORNRESP_KEY.angle, "4.0 x Pi", "solid angle"],
    [HORNRESP_KEY.semiInductance, "1", "semi-inductance"],
    [HORNRESP_KEY.endCorrection, "1", HORNRESP_KEY.endCorrection],
    [HORNRESP_KEY.pathLength, "12.0", "path length"],
    [HORNRESP_KEY.addedMass, "50.00", "passive radiator"],
    [HORNRESP_KEY.highPass, "30", "high-pass"],
    ["Band 2 Frequency", "80", "equalizer"],
    [HORNRESP_LAYOUT_KEY.frontLoaded, "2", HORNRESP_LAYOUT_KEY.frontLoaded],
    [HORNRESP_KEY.rearVolume, "0.00", "open rear"],
  ];
  for (const [key, value, named] of unsupported) {
    const reason = reasonFor(withValue(base, key, value));
    assert.ok(reason.startsWith(NOT_SUPPORTED_YET), `${key}: ${reason}`);
    assert.ok(reason.includes(named), `${key}: ${reason}`);
  }
  // a section of another flare
  const tractrix = reasonFor(base.replace("Exp = 35.00", "Tra = 35.00"));
  assert.ok(tractrix.startsWith(NOT_SUPPORTED_YET) && tractrix.includes("Tra"), tractrix);
  // another of Hornresp's layouts, named by the driver count line's key
  const ripole = reasonFor(base.replace(/^Nd = 1$/m, "OD3 = 1"));
  assert.ok(ripole.startsWith(NOT_SUPPORTED_YET) && ripole.includes("OD3"), ripole);
  // a tapped horn needs three or four sections (this record has one)
  const tapped = reasonFor(base.replace(/^Nd = 1$/m, "TH = 1"));
  assert.ok(tapped.startsWith(NOT_SUPPORTED_YET) && tapped.includes("three sections"), tapped);
  // a missing value
  const missing = reasonFor(base.replace(/^Sd = .*$/m, ""));
  assert.strictEqual(missing, `${MISSING_VALUE}${HORNRESP_KEY.coneArea}`);
});

test("the reader names a record's values it cannot read", () => {
  const base = recordText("mid-vented");
  const reasonFor = (text: string) => {
    const reading = readHornrespRecord(text);
    assert.ok(!reading.ok, "the record should not map");
    return reading.reason;
  };
  /** asserts that `text` gives an invalid-record reason that names `named` */
  const assertInvalid = (text: string, named: string) => {
    const reason = reasonFor(text);
    assert.ok(reason.startsWith(INVALID_RECORD) && reason.includes(named), reason);
  };
  // a value that is not a number, in a horn row and in the driver
  assertInvalid(withValue(base, "Exp", "abc"), "Exp = abc");
  assertInvalid(withValue(base, "S2", "wide"), "S2 = wide");
  assertInvalid(withValue(base, HORNRESP_KEY.forceFactor, "strong"), HORNRESP_KEY.forceFactor);
  // a blank length, and a row whose lines are out of order
  assertInvalid(withValue(base, "Exp", ""), "Exp =");
  assertInvalid(base.replace(/^Exp = .*$/m, ""), "row 1");
  // a negative length
  assertInvalid(withValue(base, "Exp", "-35.00"), "Exp = -35.00");
  // driver values that must be positive
  for (const key of [
    HORNRESP_KEY.coneArea,
    HORNRESP_KEY.movingMass,
    HORNRESP_KEY.compliance,
    HORNRESP_KEY.mechanicalResistance,
  ]) {
    assertInvalid(withValue(base, key, "0.00"), key);
    assertInvalid(withValue(base, key, "-1.00"), key);
  }
  // a row keyed with the wrong areas
  assertInvalid(base.replace(/^S2 = 1400\.00$/m, "S3 = 1400.00"), "S2");
  // a row that does not start where the row before it ends
  const lines = referenceText("th-15").split(/\r?\n/);
  /** the second row's start: the second S2 line */
  const secondStart = lines.findIndex(
    (line, i) => line.startsWith("S2 = ") && lines.slice(0, i).some((l) => l.startsWith("S2 = ")),
  );
  assert.ok(secondStart > 0);
  lines[secondStart] = "S2 = 650.00";
  assertInvalid(lines.join("\n"), "row 2 starts at S2 = 650");
});

test("the reader takes the caller's layout for a record whose layout key it does not know", () => {
  const ripole = recordText("mid-vented").replace(/^Nd = 1$/m, "OD3 = 1");
  const reading = readOk(readHornrespRecord(ripole, { layout: HORN_LAYOUT.frontLoaded }));
  assert.strictEqual(reading.design.layout, HORN_LAYOUT.frontLoaded);
  assertMatchesHornresp("mid-vented", reading);
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

/** A reference record's text (tools/hornresp/records/<name>.txt). */
const referenceText = (name: string) =>
  fs.readFileSync(path.join(REFERENCE_DIR, `${name}.txt`), "latin1");

for (const reference of REFERENCES) {
  test(`the reader maps ${reference.name} (${reference.layout}) and matches Hornresp's results`, () => {
    const reading = readOk(readHornrespRecord(referenceText(reference.name)));
    assert.strictEqual(reading.design.layout, reference.layout);
    assertMatchesHornresp(reference.name, reading);
  });
}

test("the reader puts a tapped horn's rears at S3 or S4 and its chambers in passages", () => {
  const tapsOf = (name: string) => {
    const { design } = readOk(readHornrespRecord(referenceText(name)));
    assert.ok(design.layout === HORN_LAYOUT.tapped);
    return design;
  };
  // three sections: the fronts at S2, the rears at S3; four: the rears at S4
  const three = tapsOf("th-15"),
    four = tapsOf("th-15-four");
  assert.deepStrictEqual([three.frontTap, three.rearTap], [1, 2]);
  assert.deepStrictEqual([four.frontTap, four.rearTap], [1, 3]);
  assert.deepStrictEqual([three.frontChamber, three.rearChamber], [null, null]);
  // Vtc 1500 cc with Atc 300 cm²; Vrc 6 L with Lrc 20 cm, so 300 cm²
  const chambers = tapsOf("th-thorn10-chambers");
  assert.deepStrictEqual(chambers.frontChamber, { liters: 1.5, area: 300 });
  assert.deepStrictEqual(chambers.rearChamber, { liters: 6, area: 300 });
});
