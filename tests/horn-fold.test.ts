// The folded horn path (lib/speaker/hornFold): the automatic folds (zigzag and, for a tapped horn, spiral), the runs
// fitted to the path, the sections split at the taps, the run edits and wall names (pages/speaker/foldRuns), and the
// horn boards in the cutlist. Known built designs are in known-folds.test.ts.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { withGoalHorn, withHornDrive } from "../src/pages/speaker/chamberLoad";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { speakerCutParts } from "../src/lib/speaker/speakerBuild";
import { fittedRuns, spiralFolds } from "../src/lib/speaker/hornFold";
import { splitSegmentsAt, segmentAreaAt } from "../src/lib/acoustics/hornSegments";
import {
  withRunAdded,
  withRunEdited,
  withRunRemoved,
  wallName,
} from "../src/pages/speaker/foldRuns";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
import { HORN_GOALS_DEFAULT } from "../src/constants/hornGoals";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { SPEAKER_TEXT } from "../src/constants/speakerPage";
import { CM_PER_IN } from "../src/constants/units";
import type { HornRun, HornSegment, SpeakerCabinet, SpeakerChamber } from "../src/types";

/** The two-18″ PA v2 sub bin. */
const BIN_SPEC = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
const [BIN] = BIN_SPEC.cabinet.chambers;

/** The chamber with its horn's path folded. */
function folded(chamber: SpeakerChamber): SpeakerChamber {
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn, "a horn-loaded chamber");
  return {
    ...chamber,
    load: { ...chamber.load, horn: { ...chamber.load.horn, path: HORN_PATH.folded } },
  };
}

/** The bin's cabinet with its one chamber replaced. */
const cabinetWith = (chamber: SpeakerChamber): SpeakerCabinet => ({
  ...BIN_SPEC.cabinet,
  chambers: [chamber],
});

/** The chamber's horn layout in its cabinet. */
function flareOf(chamber: SpeakerChamber) {
  const cabinet = cabinetWith(chamber);
  const flare = hornFlare(cabinet, speakerLayout(cabinet).chambers[0]);
  assert.ok(flare?.fold && flare.foldInput, "a folded layout");
  return { flare, fold: flare.fold, input: flare.foldInput };
}

test("horn fold: the bin's front-loaded horn folds automatically and fits the box", () => {
  const { flare, fold } = flareOf(folded(BIN));
  assert.ok(flare.runs.length >= 1);
  assert.ok(
    fold.fits,
    `outside ${fold.outside}, crossing ${JSON.stringify(fold.crossing)}, sharp ${fold.sharpTurn}`,
  );
  assert.equal(fold.mount, null);
  // the runs add up to the sections' length
  const runsIn = fold.runs.reduce((sum, r) => sum + (r.s1 - r.s0), 0);
  assert.ok(Math.abs(runsIn - fold.pathIn) < 0.05, `${runsIn} in of ${fold.pathIn} in`);
});

/** The bin as a folded tapped horn, laid out by Design from goals. */
const TAPPED_START = folded(withHornDrive(BIN, HORN_DRIVE.tapped));
const FOUND = withGoalHorn(
  cabinetWith(TAPPED_START),
  TAPPED_START,
  speakerLayout(cabinetWith(TAPPED_START)).chambers[0],
  HORN_DRIVE.tapped,
  HORN_GOALS_DEFAULT,
);

test("horn fold: Design from goals gives a folded tapped horn a spiral that fits, with its drivers by the start", () => {
  const found = FOUND;
  assert.ok(found);
  assert.ok(found.fit.spreadDb < 6, `spread ${found.fit.spreadDb} dB`);
  const { fold } = flareOf(found.chamber);
  assert.ok(
    fold.fits,
    `outside ${fold.outside}, crossing ${JSON.stringify(fold.crossing)}, sharp ${fold.sharpTurn}`,
  );
  // the drivers sit on the start's run, the mouth's leg across the board
  const spot = fold.mount;
  assert.ok(spot);
  assert.equal(spot.run, 0);
  assert.equal(spot.across, fold.runs.length - 1);
  assert.ok(spot.taps.front !== null && spot.taps.rear !== null);
  assert.ok(spot.taps.front < spot.taps.rear);
});

test("horn fold: a spiral has an odd number of legs after the start and no layout for a path too short", () => {
  assert.ok(FOUND);
  const { input } = flareOf(FOUND.chamber);
  const runs = spiralFolds(input);
  assert.ok(runs);
  // the start, the inner legs and their turns, the riser, the mouth's leg: an even count of runs
  assert.equal(runs.length % 2, 1);
  const short = input.segments.map((s) => ({ ...s, length: s.length / 20 }));
  assert.equal(spiralFolds({ ...input, segments: short }), null);
});

test("horn fold: the first run takes up the difference from the path's length, never below a minimum", () => {
  const runs: HornRun[] = [
    { lengthCm: 30, angleDeg: 0 },
    { lengthCm: 20, angleDeg: 90 },
    { lengthCm: 50, angleDeg: 180 },
  ];
  const fitted = fittedRuns(runs, 120 / CM_PER_IN);
  assert.ok(Math.abs(fitted[0].lengthIn - 50 / CM_PER_IN) < 1e-9);
  assert.deepEqual(
    fitted.slice(1).map((r) => r.lengthIn),
    [20 / CM_PER_IN, 50 / CM_PER_IN],
  );
  assert.ok(fittedRuns(runs, 10 / CM_PER_IN)[0].lengthIn > 0);
});

test("horn fold: the sections split at the taps along their own flare", () => {
  const segments: HornSegment[] = [
    { profile: HORN_PROFILE.exponential, s1: 300, s2: 1200, length: 100 },
    { profile: HORN_PROFILE.conical, s1: 1200, s2: 2000, length: 50 },
  ];
  const { segments: split, boundaries } = splitSegmentsAt(segments, [40, 100.02, 200]);
  assert.equal(split.length, 3);
  assert.deepEqual(boundaries, [1, 2, 3]);
  assert.ok(Math.abs(split[0].length - 40) < 1e-9);
  assert.ok(Math.abs(split[0].s2 - segmentAreaAt(segments[0], 40)) < 1e-6);
  assert.equal(split[1].s1, split[0].s2);
  assert.ok(Math.abs(split.reduce((sum, s) => sum + s.length, 0) - 150) < 1e-9);
});

test("horn fold: run edits and wall names", () => {
  const runs: HornRun[] = [
    { lengthCm: 40, angleDeg: 0 },
    { lengthCm: 20, angleDeg: 90 },
  ];
  assert.deepEqual(withRunEdited(runs, 1, { angleDeg: 100 })[1], { lengthCm: 20, angleDeg: 100 });
  assert.deepEqual(withRunAdded(runs).at(-1), { lengthCm: 10, angleDeg: 180 });
  assert.deepEqual(withRunRemoved(runs, 0), [runs[1]]);
  // a run toward the back (0°): its left wall is the upper one; a run up (90°): its left wall faces the front
  assert.equal(wallName(0, 1), SPEAKER_TEXT.wallUpper);
  assert.equal(wallName(0, -1), SPEAKER_TEXT.wallLower);
  assert.equal(wallName(Math.PI / 2, 1), SPEAKER_TEXT.wallFront);
  assert.equal(wallName(Math.PI / 2, -1), SPEAKER_TEXT.wallBack);
});

test("horn fold: the cutlist lists the horn boards, the cutouts on the drivers' board", () => {
  assert.ok(FOUND);
  const { fold } = flareOf(FOUND.chamber);
  const parts = speakerCutParts(cabinetWith(FOUND.chamber), "butt").parts;
  const boards = parts.filter((p) => p.part === "hornBoard");
  assert.ok(boards.length > 0);
  assert.ok(boards.length <= fold.boards.length);
  assert.equal(boards.filter((p) => p.note.includes("cutout")).length, 1);
});
