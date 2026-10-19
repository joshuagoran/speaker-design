// Offset and tapped horns on the Speaker page: a chamber reads into the network's designs and models (lib/speaker/
// hornDesign, speakerResponse); the drive splits sections and keeps taps on them (pages/speaker/hornSections); a
// starting layout sized from the goals (lib/speaker/hornGoals, pages/speaker/chamberLoad withGoalHorn); a Hornresp
// record read onto the horn (pages/speaker/hornrespImport).
import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import {
  hornGoalCheck,
  hornRoom,
  withGoalHorn,
  withHornDrive,
} from "../src/pages/speaker/chamberLoad";
import { areaAtShare, driveAfterRemoval, withDriveKind } from "../src/pages/speaker/hornSections";
import { hornFromRecord } from "../src/pages/speaker/hornrespImport";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { hornGoalFit } from "../src/lib/speaker/hornGoals";
import { speakerResponse, SPEAKER_RESPONSE_FREQUENCIES } from "../src/lib/speaker/speakerResponse";
import { speakerLayout } from "../src/lib/speaker/speakerLayout";
import { frontChamber, throatCones } from "../src/lib/speaker/hornThroat";
import { hornLayoutNetwork, presetModel } from "../src/lib/acoustics/network/presets";
import { segmentsAirLiters } from "../src/lib/acoustics/hornSegments";
import { readHornrespRecord } from "../src/lib/acoustics/network/hornrespRecord";
import { MIN_NET_L } from "../src/lib/speaker/speakerBuild";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  SPEAKER_RESPONSE_VOLTS,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import { HORN_LAYOUT } from "../src/constants/acousticNetwork";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { HORN_GOAL_LIMIT, HORN_GOALS_DEFAULT } from "../src/constants/hornGoals";
import { CM_PER_IN } from "../src/constants/units";
import type { HornSegment, SpeakerChamber, SpeakerHorn, SpeakerSpec } from "../src/types";
import { roomOf } from "./horn-room";
import { tracedHorn } from "../src/lib/speaker/foldHorn";

/** The two-18″ PA v2 sub bin: one horn-loaded chamber with a vent. */
const BIN_SPEC = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
const [BIN] = BIN_SPEC.cabinet.chambers;
const PLACED = speakerLayout(BIN_SPEC.cabinet).chambers[0];

/** The chamber's horn. */
function hornOf(chamber: SpeakerChamber): SpeakerHorn {
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn, "a horn-loaded chamber");
  return chamber.load.horn;
}

/** The bin as a tapped horn: three sections, the fronts after the first, the backs after the second, sealed. */
const TAPPED = withHornDrive(BIN, HORN_DRIVE.tapped);

/** The spec with its one chamber replaced. */
const specWith = (chamber: SpeakerChamber): SpeakerSpec => ({
  ...BIN_SPEC,
  cabinet: { ...BIN_SPEC.cabinet, chambers: [chamber] },
});

/** A reference record's text (tools/hornresp/records/<name>.txt). */
const recordText = (name: string) =>
  fs.readFileSync(
    path.join(import.meta.dirname, "..", "tools", "hornresp", "records", `${name}.txt`),
    "latin1",
  );

test("horn drive: a tapped horn splits the flare into three sections, the same horn, and seals the chamber", () => {
  const horn = hornOf(TAPPED);
  assert.equal(horn.segments.length, 3);
  assert.deepEqual(horn.drive, { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 });
  assert.equal(TAPPED.vent.kind, VENT_KIND.sealed);
  const before = hornOf(BIN).segments;
  const length = (list: readonly HornSegment[]) => list.reduce((sum, s) => sum + s.length, 0);
  assert.ok(Math.abs(length(horn.segments) - length(before)) < 1e-9, "the same path length");
  assert.ok(
    Math.abs(segmentsAirLiters(horn.segments) - segmentsAirLiters(before)) < 1e-6,
    "the same air",
  );
  assert.equal(horn.segments[0].s1, before[0].s1);
  assert.equal(horn.segments.at(-1)?.s2, before.at(-1)?.s2);
  // an offset horn needs two sections; it keeps the vent
  const offset = withHornDrive(BIN, HORN_DRIVE.offset);
  assert.deepEqual(hornOf(offset).drive, { kind: HORN_DRIVE.offset, tap: 1 });
  assert.equal(offset.vent, BIN.vent);
});

test("horn drive: each flare law's middle splits a section into two of the same law", () => {
  for (const profile of Object.values(HORN_PROFILE)) {
    const section: HornSegment = { profile, s1: 400, s2: 1600, length: 100 };
    const [a, b] = withDriveKind(
      { ...hornOf(BIN), segments: [section], drive: { kind: HORN_DRIVE.front } },
      HORN_DRIVE.offset,
    ).segments;
    assert.ok(Math.abs(segmentsAirLiters([a, b]) - segmentsAirLiters([section])) < 1e-9, profile);
    assert.equal(a.s2, areaAtShare(section, 0.5));
  }
  assert.equal(
    areaAtShare({ profile: HORN_PROFILE.parabolic, s1: 400, s2: 1600, length: 1 }, 0.5),
    1000,
  );
  assert.equal(
    areaAtShare({ profile: HORN_PROFILE.exponential, s1: 400, s2: 1600, length: 1 }, 0.5),
    800,
  );
  assert.equal(
    areaAtShare({ profile: HORN_PROFILE.conical, s1: 400, s2: 1600, length: 1 }, 0.5),
    900,
  );
});

test("horn drive: removing a section moves the taps after it back one, kept between sections and in order", () => {
  const drive = { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 3 } as const;
  // five sections to four
  assert.deepEqual(driveAfterRemoval(drive, 2, 4), { ...drive, rearTap: 2 });
  assert.deepEqual(driveAfterRemoval(drive, 3, 4), drive);
  // the first section goes: the front stays after the new first section
  assert.deepEqual(driveAfterRemoval(drive, 0, 4), { ...drive, frontTap: 1, rearTap: 2 });
  // four sections to three, the taps meeting: the back moves past the front
  const close = { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 } as const;
  assert.deepEqual(driveAfterRemoval(close, 1, 3), close);
  assert.deepEqual(driveAfterRemoval({ kind: HORN_DRIVE.offset, tap: 2 }, 1, 2), {
    kind: HORN_DRIVE.offset,
    tap: 1,
  });
});

test("tapped horn: the chamber reads into the network's tapped design, its two passages as wide as the cones", () => {
  const read = hornDesignOf(TAPPED, { count: 1, angle: 2 }, roomOf(TAPPED));
  assert.ok(read.ok && read.design.layout === HORN_LAYOUT.tapped);
  const { design } = read;
  const cones = throatCones(TAPPED.drivers);
  assert.ok(cones);
  const area = cones.cone.Sd * cones.count;
  assert.deepEqual(design.frontChamber, {
    liters: frontChamber(cones.cone, cones.count).liters,
    area,
  });
  // the chamber's net air with its stuffing is the rear passage
  assert.equal(design.rearChamber?.area, area);
  assert.equal(
    design.rearChamber?.liters,
    (TAPPED.netLiters ?? 0) * (1 + TAPPED.stuffingPct / 100),
  );
  assert.deepEqual([design.frontTap, design.rearTap], [1, 2]);
  // a vent, taps out of order or at the ends: named gaps
  const gapOf = (chamber: SpeakerChamber) => {
    const result = hornDesignOf(chamber, { count: 1, angle: 2 }, roomOf(chamber));
    return result.ok ? null : result.gap;
  };
  assert.equal(gapOf({ ...TAPPED, vent: BIN.vent }), HORN_ENGINE_GAP.tappedVent);
  const withDrive = (drive: SpeakerHorn["drive"]): SpeakerChamber => ({
    ...TAPPED,
    load: { kind: CHAMBER_LOAD.horn, horn: { ...hornOf(TAPPED), drive } },
  });
  assert.equal(
    gapOf(withDrive({ kind: HORN_DRIVE.tapped, frontTap: 2, rearTap: 1 })),
    HORN_ENGINE_GAP.taps,
  );
  assert.equal(
    gapOf(withDrive({ kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 3 })),
    HORN_ENGINE_GAP.taps,
  );
  assert.equal(gapOf(withDrive({ kind: HORN_DRIVE.offset, tap: 0 })), HORN_ENGINE_GAP.taps);
  assert.equal(gapOf(withDrive({ kind: HORN_DRIVE.offset, tap: 2 })), null);
});

test("tapped and offset horns: the Speaker model plays the network's response", () => {
  for (const chamber of [TAPPED, withHornDrive(BIN, HORN_DRIVE.offset)]) {
    const spec = specWith(chamber);
    const response = speakerResponse(spec);
    assert.deepEqual(response.chambers[0].gaps, []);
    const netLiters = response.chambers[0].netLiters;
    const read = hornDesignOf(
      chamber,
      { count: 1, angle: 2 },
      {
        ...roomOf(chamber, PLACED.clear),
        netLiters,
      },
    );
    assert.ok(read.ok && read.design.layout !== HORN_LAYOUT.frontLoaded);
    const preset = hornLayoutNetwork(read.design);
    assert.ok(preset);
    const model = presetModel(preset, SPEAKER_RESPONSE_FREQUENCIES, SPEAKER_RESPONSE_VOLTS);
    assert.ok(model && model.curve.every((p) => Number.isFinite(p.spl)));
    const drive = response.chambers[0].drive;
    assert.ok(drive && drive.every((d) => Number.isFinite(d.xmm) && d.throat !== undefined));
  }
});

test("horn goals: the fit's maximum output is the lower of the power and Xmax limits", () => {
  const read = hornDesignOf(TAPPED, { count: 1, angle: 2 }, roomOf(TAPPED));
  assert.ok(read.ok);
  const cones = throatCones(TAPPED.drivers);
  assert.ok(cones);
  const fit = hornGoalFit(read.design, HORN_GOALS_DEFAULT, cones.parts.ts);
  assert.ok(fit);
  assert.ok(fit.spreadDb >= 0 && Number.isFinite(fit.maxOutDb));
  assert.ok(fit.maxOutHz >= HORN_GOALS_DEFAULT.lowHz && fit.maxOutHz <= HORN_GOALS_DEFAULT.highHz);
  // with almost no power the power rating limits it everywhere
  const weak = hornGoalFit(read.design, HORN_GOALS_DEFAULT, { ...cones.parts.ts, aes: 0.01 });
  assert.equal(weak?.limit, HORN_GOAL_LIMIT.power);
  // no power or no travel has no fit; nor has an empty band
  assert.equal(hornGoalFit(read.design, HORN_GOALS_DEFAULT, { ...cones.parts.ts, aes: 0 }), null);
  const still = { ...read.design, driver: { ...read.design.driver, Xmax: 0 } };
  assert.equal(hornGoalFit(still, HORN_GOALS_DEFAULT, cones.parts.ts), null);
  // the page's check gives no fit while the net air is not known yet
  assert.equal(hornGoalCheck(BIN_SPEC.cabinet, TAPPED, PLACED, undefined)?.fit, null);
  assert.equal(
    hornGoalFit(read.design, { ...HORN_GOALS_DEFAULT, highHz: 30 }, cones.parts.ts),
    null,
  );
});

test("horn goals: a tapped horn sized for 40–100 Hz plays flat in the box and stays in its air", () => {
  // folded: a straight horn stays within the chamber's depth, too short for 40 Hz
  const tappedFolded: SpeakerChamber = {
    ...TAPPED,
    load: { kind: CHAMBER_LOAD.horn, horn: { ...hornOf(TAPPED), path: HORN_PATH.folded } },
  };
  const found = withGoalHorn(
    BIN_SPEC.cabinet,
    tappedFolded,
    PLACED,
    HORN_DRIVE.tapped,
    HORN_GOALS_DEFAULT,
  );
  assert.ok(found);
  const horn = hornOf(found.chamber);
  assert.equal(horn.segments.length, 3);
  assert.deepEqual(horn.drive, { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 });
  assert.ok(horn.segments.every((s) => s.profile === HORN_PROFILE.parabolic && s.s2 >= s.s1));
  assert.equal(found.chamber.vent.kind, VENT_KIND.sealed);
  assert.deepEqual(horn.goals, HORN_GOALS_DEFAULT);
  assert.ok(found.fit.spreadDb < 6, `spread ${found.fit.spreadDb} dB`);
  assert.ok(found.fit.lowEdgeDb > -3, `low edge ${found.fit.lowEdgeDb} dB`);
  // the page's check reads the same horn, and the horn fits the chamber's air
  const check = hornGoalCheck(
    BIN_SPEC.cabinet,
    found.chamber,
    PLACED,
    found.chamber.netLiters ?? 0,
  );
  assert.ok(check?.fit && Math.abs(check.fit.spreadDb - found.fit.spreadDb) < 0.5);
  assert.equal(check.overAir, null);
  // the same goals give the same horn
  assert.deepEqual(
    withGoalHorn(BIN_SPEC.cabinet, tappedFolded, PLACED, HORN_DRIVE.tapped, HORN_GOALS_DEFAULT)
      ?.chamber,
    found.chamber,
  );
});

test("horn goals: a front-loaded horn shares the air with its rear chamber; folded, its vent is drawn", () => {
  const found = withGoalHorn(BIN_SPEC.cabinet, BIN, PLACED, HORN_DRIVE.front, HORN_GOALS_DEFAULT);
  assert.ok(found);
  // a straight horn keeps the chamber's vent; a folded one's vent is drawn in its side view, so the chamber's goes
  if (hornOf(found.chamber).path === HORN_PATH.folded)
    assert.equal(found.chamber.vent.kind, VENT_KIND.sealed);
  else assert.equal(found.chamber.vent, BIN.vent);
  assert.equal(hornOf(found.chamber).segments.length, 1);
  assert.ok((found.chamber.netLiters ?? 0) > MIN_NET_L);
  assert.ok(found.fit.spreadDb < 6, `spread ${found.fit.spreadDb} dB`);
});

test("horn goals: a folded horn gets boards whose traced passage is the drive's", () => {
  const folded: SpeakerChamber = {
    ...TAPPED,
    load: { kind: CHAMBER_LOAD.horn, horn: { ...hornOf(TAPPED), path: HORN_PATH.folded } },
  };
  const found = withGoalHorn(
    BIN_SPEC.cabinet,
    folded,
    PLACED,
    HORN_DRIVE.tapped,
    HORN_GOALS_DEFAULT,
  );
  assert.ok(found);
  const horn = hornOf(found.chamber);
  assert.equal(horn.path, HORN_PATH.folded);
  assert.ok(horn.fold && horn.fold.boards.length > 0, "boards placed");
  assert.equal(found.chamber.vent.kind, VENT_KIND.sealed);
  assert.equal(tracedHorn(BIN_SPEC.cabinet, found.chamber)?.drive?.kind, HORN_DRIVE.tapped);
});

test("Hornresp import: a tapped record sets the sections, the taps and a sealed chamber", () => {
  const text = recordText("th-thorn10");
  const reading = readHornrespRecord(text);
  assert.ok(reading.ok);
  const read = hornFromRecord(text, hornOf(BIN), 30);
  assert.ok(read.ok);
  assert.deepEqual(read.horn.segments, reading.design.segments);
  assert.deepEqual(read.horn.drive, { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 });
  assert.equal(read.vent.kind, VENT_KIND.sealed);
  // the record has no rear chamber: the build's floor
  assert.equal(read.netLiters, MIN_NET_L);
  // its path (200 cm) is longer than 30 in: folded; the chamber's other horn settings stay
  assert.equal(read.horn.path, "folded");
  assert.equal(read.horn.doubleBoard, hornOf(BIN).doubleBoard);
  // the chambers' record: its rear chamber is the net air
  const chambers = hornFromRecord(recordText("th-thorn10-chambers"), null, 100);
  assert.ok(chambers.ok && chambers.netLiters === 6 && chambers.horn.path === "straight");
  // its front chamber is not used: the cones and the walls set it
  assert.ok(chambers.frontChamberDropped && !read.frontChamberDropped);
});

test("Hornresp import: an offset record keeps its tap, rear chamber and vent area", () => {
  const read = hornFromRecord(recordText("od-skram"), null, 30);
  assert.ok(read.ok);
  assert.deepEqual(read.horn.drive, { kind: HORN_DRIVE.offset, tap: 1 });
  assert.equal(read.netLiters, 120);
  assert.ok(read.vent.kind === VENT_KIND.vented && read.vent.port.shape === "round");
  const { port } = read.vent;
  // one tube of the record's 732 cm², to the hundredth of an inch
  const areaCm2 = Math.PI * Math.pow((port.dia * CM_PER_IN) / 2, 2);
  assert.ok(Math.abs(areaCm2 / 732 - 1) < 0.002, `${areaCm2} cm²`);
  // a record the reader cannot read says why
  const broken = hornFromRecord("not a record", null, 30);
  assert.ok(!broken.ok && broken.reason.length > 0);
});

test("horn goals: Design from goals keeps the path the user picked", () => {
  const folded: SpeakerChamber = {
    ...BIN,
    load: { kind: CHAMBER_LOAD.horn, horn: { ...hornOf(BIN), path: HORN_PATH.folded } },
  };
  for (const chamber of [BIN, folded]) {
    const found = withGoalHorn(
      BIN_SPEC.cabinet,
      chamber,
      PLACED,
      HORN_DRIVE.front,
      HORN_GOALS_DEFAULT,
    );
    assert.ok(found);
    assert.equal(hornOf(found.chamber).path, hornOf(chamber).path);
  }
  // a straight horn stays within the chamber's depth
  const straight = withGoalHorn(
    BIN_SPEC.cabinet,
    BIN,
    PLACED,
    HORN_DRIVE.front,
    HORN_GOALS_DEFAULT,
  );
  const lengthCm = hornOf(straight?.chamber ?? BIN).segments.reduce((sum, s) => sum + s.length, 0);
  assert.ok(lengthCm <= hornRoom(BIN_SPEC.cabinet, BIN, PLACED).depthIn * CM_PER_IN + 1e-6);
});
