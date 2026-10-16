// The Speaker page's Horn settings (src/pages/speaker/hornSections, HornSettings): editing a flare section changes the
// response, the 3D flare and the cutlist; sections chain as they are added and removed; the settings' in² and in
// convert to the spec's cm² and cm and back; a size that is not positive and finite is a named gap, never NaN; the PA
// v2 templates still model.
import { straightPath } from "./horn-room";
import { zigzagBoards } from "../src/lib/speaker/foldLayouts";
import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import {
  joinsNext,
  shownIn2,
  shownInOfCm,
  specSize,
  stepCount,
  stepsIn,
  stepsLatched,
  withSectionAdded,
  withSectionProfile,
  withSectionRemoved,
  withCompressionRatio,
  withSectionSize,
  withStepsSmoothed,
} from "../src/pages/speaker/hornSections";
import { compressionRatio, conesAreaCm2 } from "../src/lib/speaker/hornThroat";
import { SPEAKER_TEXT } from "../src/constants/speakerPage";
import { hornText } from "../src/pages/speaker/speakerText";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { speakerCutParts } from "../src/lib/speaker/speakerBuild";
import {
  buildSpeakerScene,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CHAMBER_LOAD, HORN_DRIVE, HORN_ENGINE_GAP, HORN_PATH } from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { CM_PER_IN } from "../src/constants/units";
import type { HornSegment, SpeakerHorn, SpeakerSpec } from "../src/types";
import type * as THREE from "three";

/** How many sections the tests cut the bin's flare into. */
const BIN_SECTIONS = 4;

/**
 * The two-18″ PA v2 sub bin (the template the Horn settings were built on), its one straight-sided flare cut into four
 * parabolic sections of equal length: the same horn (its area grows linearly), with sections to edit.
 */
const BIN = withHorn(templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo), (h) => {
  const [flare] = h.segments;
  const areaAt = (i: number) => flare.s1 + ((flare.s2 - flare.s1) * i) / BIN_SECTIONS;
  return {
    ...h,
    segments: Array.from({ length: BIN_SECTIONS }, (_, i) => ({
      profile: flare.profile,
      s1: areaAt(i),
      s2: areaAt(i + 1),
      length: flare.length / BIN_SECTIONS,
    })),
  };
});

/** The spec's one horn. */
function hornOf(spec: SpeakerSpec): SpeakerHorn {
  const [chamber] = spec.cabinet.chambers;
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn, "a horn-loaded chamber");
  return chamber.load.horn;
}

/** The spec with its one horn edited, as the Horn settings edit it. */
function withHorn(spec: SpeakerSpec, edit: (h: SpeakerHorn) => SpeakerHorn): SpeakerSpec {
  const [chamber, ...rest] = spec.cabinet.chambers;
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn);
  return {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [{ ...chamber, load: { ...chamber.load, horn: edit(chamber.load.horn) } }, ...rest],
    },
  };
}

/** The spec with its horn's sections edited. */
const withSegments = (spec: SpeakerSpec, edit: (s: readonly HornSegment[]) => HornSegment[]) =>
  withHorn(spec, (h) => ({ ...h, segments: edit(h.segments) }));

const responseOf = (spec: SpeakerSpec) => speakerResponse(spec, { feed: spec.input });
const flareOf = (spec: SpeakerSpec) =>
  hornFlare(spec.cabinet, speakerLayout(spec.cabinet).chambers[0]);

/** The 3D view's flare meshes. */
function flareMeshes(spec: SpeakerSpec) {
  const out: THREE.Object3D[] = [];
  buildSpeakerScene({ spec, cutaway: false }).traverse(
    (o) => o.name === SPEAKER_MESH_NAMES.hornFlare && out.push(o),
  );
  return out;
}

/** The cutlist's horn mouth note. */
const mouthNote = (spec: SpeakerSpec) =>
  speakerCutParts(spec.cabinet, "butt")
    .parts.map((p) => p.note)
    .find((n) => n.includes("horn mouth"));

/** The largest level difference between two responses' sums, dB. */
const maxDiff = (a: SpeakerSpec, b: SpeakerSpec) => {
  const [ra, rb] = [responseOf(a).sum, responseOf(b).sum];
  return Math.max(...ra.map((p, i) => Math.abs(p.spl - rb[i].spl)));
};

const finiteResponse = (spec: SpeakerSpec) =>
  responseOf(spec).sum.every((p) => Number.isFinite(p.spl) && Number.isFinite(p.f));

test("speaker horn: the PA v2 templates still model", () => {
  for (const template of [
    SPEAKER_TEMPLATE.paV2SubBinOne,
    SPEAKER_TEMPLATE.paV2SubBinTwo,
    SPEAKER_TEMPLATE.paV2MidBox,
  ]) {
    const spec = templateSpeaker(template);
    const r = responseOf(spec);
    assert.deepEqual(r.chambers[0].gaps, [], template);
    assert.ok(r.chambers[0].fb !== null, `${template}: tuned`);
    assert.ok(finiteResponse(spec), template);
    assert.ok(flareOf(spec), `${template}: the flare draws`);
  }
});

test("speaker horn: editing a section changes the response, the 3D flare and the cutlist", () => {
  const segments = hornOf(BIN).segments;
  const last = segments.length - 1;
  // a mouth 25% smaller (the bin's mouth already fills the face beside its slots): the last section's end area
  const smaller = withSegments(BIN, (s) =>
    withSectionSize(s, last, "s2", shownIn2(s[last].s2) * 0.75),
  );
  assert.ok(maxDiff(BIN, smaller) > 0.1, "the response changes");
  const [before, after] = [flareOf(BIN), flareOf(smaller)];
  assert.ok(before && after);
  assert.ok(after.mouth.w * after.mouth.h < before.mouth.w * before.mouth.h, "the mouth shrinks");
  assert.notEqual(mouthNote(smaller), mouthNote(BIN), "the cutlist's mouth opening follows");
  // a longer first section: the path grows, and so does the 3D flare
  const longer = withSegments(BIN, (s) =>
    withSectionSize(s, 0, "length", shownInOfCm(s[0].length) + 4),
  );
  assert.ok(maxDiff(BIN, longer) > 0.1);
  const lengthIn = (spec: SpeakerSpec) => flareOf(spec)?.path?.pathIn ?? 0;
  assert.ok(Math.abs(lengthIn(longer) - lengthIn(BIN) - 4) < 0.01, "4 in more flare");
  // a profile change reaches the engine too
  const exp = withSegments(BIN, (s) => withSectionProfile(s, 0, HORN_PROFILE.exponential));
  assert.equal(hornOf(exp).segments[0].profile, HORN_PROFILE.exponential);
  assert.ok(maxDiff(BIN, exp) > 0);
  // the compression ratio: it sets the throat (the first section's start), the one figure both fields edit
  const drivers = BIN.cabinet.chambers[0].drivers;
  const cones = conesAreaCm2(drivers);
  assert.ok(Math.abs((compressionRatio(cones, segments) ?? 0) - 2) < 1e-9, "the bin starts at 2:1");
  const loaded = withSegments(BIN, (s) => withCompressionRatio(s, cones, 4));
  assert.ok(Math.abs((compressionRatio(cones, hornOf(loaded).segments) ?? 0) - 4) < 1e-9);
  assert.equal(hornOf(loaded).segments[0].s1, cones / 4, "a quarter of the cones' area");
  assert.deepEqual(hornOf(loaded).segments.slice(1), segments.slice(1), "the other sections stay");
  assert.ok(maxDiff(BIN, loaded) > 0.1, "the response changes");
  const [wide, narrow] = [flareOf(BIN), flareOf(loaded)];
  assert.ok(wide && narrow);
  assert.ok(
    Math.abs(
      straightPath(narrow).legs[0].sections[0].w * 2 - straightPath(wide).legs[0].sections[0].w,
    ) < 1e-9,
    "the walls start half as far apart",
  );
  // a folded path is its boards: the passage between them plays, not the sections
  const folded = withHorn(BIN, (h) => ({ ...h, path: HORN_PATH.folded }));
  const fold = flareOf(folded)?.fold;
  assert.ok(fold && fold.layout.segments.length > 0, "the boards make a passage");
  assert.equal(flareOf(folded)?.path, null, "no straight path");
  assert.ok(maxDiff(BIN, folded) > 0, "the boards' passage plays");
});

test("speaker horn: a shown area typed back in keeps the joint (the PA v2 bin's 489.6 in²)", () => {
  const segments = hornOf(BIN).segments;
  const shown = shownIn2(segments[0].s2);
  assert.equal(shown, 489.6, "the bin's first joint as the field shows it, to the tenth");
  // typed into the second section's start: no step, and it snaps to the first section's end
  const start = withSectionSize(segments, 1, "s1", shown);
  assert.ok(!stepsIn(start, 1));
  assert.equal(start[1].s1, segments[0].s2);
  // typed into the first section's end: the second section still follows it
  const end = withSectionSize(segments, 0, "s2", shown);
  assert.ok(joinsNext(end, 0));
  assert.equal(end[1].s1, end[0].s2);
  const moved = withSectionSize(end, 0, "s2", 700);
  assert.equal(moved[1].s1, specSize("s2", 700), "still chained after the retype");
  // a real step (0.1 in² apart, the fields' last digit) stays a step
  assert.ok(stepsIn(withSectionSize(segments, 1, "s1", shown + 0.1), 1));
});

test("speaker horn: typing an end area keystroke by keystroke doesn't join a stepped pair", () => {
  const segments = withSectionSize(hornOf(BIN).segments, 1, "s1", 50);
  assert.ok(stepsIn(segments, 1), "a step: the second section starts at 50 in²");
  // "500" typed into the first section's end, one keystroke at a time; the joint as it was when the field took focus
  const joined = joinsNext(segments, 0);
  assert.equal(joined, false);
  let typed = segments;
  for (const v of [5, 50, 500]) typed = withSectionSize(typed, 0, "s2", v, joined);
  assert.equal(shownIn2(typed[0].s2), 500);
  assert.equal(shownIn2(typed[1].s1), 50, "the second section keeps its start");
  // a chained pair follows every keystroke
  const chained = hornOf(BIN).segments;
  let follow = chained;
  for (const v of [5, 50, 500]) follow = withSectionSize(follow, 0, "s2", v, joinsNext(chained, 0));
  assert.equal(shownIn2(follow[1].s1), 500);
});

test("speaker horn: sections chain as they are edited, added and removed", () => {
  const segments = hornOf(BIN).segments;
  const n = segments.length;
  assert.ok(n >= 2, "the bin's flare has steps");
  // a new end area moves the next section's start with it
  const edited = withSectionSize(segments, 0, "s2", 300);
  assert.equal(edited[0].s2, specSize("s2", 300));
  assert.equal(edited[1].s1, edited[0].s2);
  assert.ok(!stepsIn(edited, 1));
  // a start area typed apart from the previous end is a step
  const stepped = withSectionSize(segments, 1, "s1", 100);
  assert.equal(stepped[0].s2, segments[0].s2, "the previous section keeps its end");
  assert.ok(stepsIn(stepped, 1));
  // added at the mouth: it starts at the last end, with its profile and length
  const added = withSectionAdded(segments);
  assert.ok(added);
  assert.equal(added.length, n + 1);
  assert.equal(added[n].s1, segments[n - 1].s2);
  assert.equal(added[n].profile, segments[n - 1].profile);
  assert.ok(added[n].s2 > added[n].s1);
  assert.equal(withSectionAdded([]), null);
  const addedSpec = withSegments(BIN, () => added);
  assert.deepEqual(responseOf(addedSpec).chambers[0].gaps, []);
  const jointsOf = (spec: SpeakerSpec) =>
    new Set(flareOf(spec)?.path?.legs.flatMap((l) => l.sections.map((sec) => sec.s.toFixed(6))));
  const ends = [
    0,
    ...segments.map(
      (_, i) => segments.slice(0, i + 1).reduce((a, g) => a + g.length, 0) / CM_PER_IN,
    ),
  ];
  assert.ok(
    ends.every((e) => jointsOf(BIN).has(e.toFixed(6))),
    "the path has a section at every segment's end",
  );
  assert.equal(jointsOf(addedSpec).size > jointsOf(BIN).size, true, "the new section is drawn");
  assert.equal(flareMeshes(addedSpec).length, 1, "the 3D view draws the straight path as one duct");
  assert.ok(maxDiff(BIN, addedSpec) > 0.1);
  // removed: the next section starts where the removed one did, so the path stays joined
  const removedFirst = withSectionRemoved(segments, 0);
  assert.equal(removedFirst.length, n - 1);
  assert.equal(removedFirst[0].s1, segments[0].s1, "the throat stays the throat");
  const removedMid = withSectionRemoved(segments, 1);
  assert.equal(removedMid[1].s1, segments[0].s2);
  assert.ok(removedMid.every((_, i) => !stepsIn(removedMid, i)));
  const removedSpec = withSegments(BIN, (s) => withSectionRemoved(s, n - 1));
  assert.equal(flareMeshes(removedSpec).length, 1);
  assert.ok(finiteResponse(removedSpec));
});

test("speaker horn: in² and in round-trip to the spec's cm² and cm, and the spec survives a save", () => {
  // areas show to the tenth, lengths to the hundredth
  for (const typed of [0.3, 12.5, 178.4, 1234.6])
    assert.equal(shownIn2(specSize("s1", typed)), typed);
  assert.equal(shownIn2(specSize("s1", 178.37)), 178.4);
  for (const typed of [0.25, 12.5, 178.37, 1234.56])
    assert.equal(shownInOfCm(specSize("length", typed)), typed);
  assert.equal(specSize("length", 1), CM_PER_IN);
  assert.equal(specSize("s2", 1), CM_PER_IN * CM_PER_IN);
  const edited = withSegments(BIN, (s) =>
    withSectionSize(withSectionAdded(s) ?? [], 0, "length", 7.5),
  );
  // the library stores the spec as JSON
  const saved: SpeakerSpec = JSON.parse(JSON.stringify(edited));
  assert.deepEqual(saved, edited);
  assert.equal(maxDiff(saved, edited), 0);
  assert.equal(shownInOfCm(hornOf(saved).segments[0].length), 7.5);
});

test("speaker horn: a size that is not positive and finite is a named gap, never NaN", () => {
  const bad: [string, (s: readonly HornSegment[]) => HornSegment[]][] = [
    ["zero start area", (s) => withSectionSize(s, 0, "s1", 0)],
    ["negative end area", (s) => withSectionSize(s, 0, "s2", -10)],
    ["zero length", (s) => withSectionSize(s, 0, "length", 0)],
    ["NaN length", (s) => s.map((x, i) => (i === 0 ? { ...x, length: Number.NaN } : x))],
    ["infinite area", (s) => s.map((x, i) => (i === 0 ? { ...x, s2: Infinity } : x))],
  ];
  for (const [what, edit] of bad) {
    const spec = withSegments(BIN, edit);
    const r = responseOf(spec);
    assert.deepEqual(r.chambers[0].gaps, [HORN_ENGINE_GAP.segment], what);
    assert.ok(finiteResponse(spec), `${what}: no NaN`);
    assert.equal(flareOf(spec), null, `${what}: no flare drawn`);
    assert.equal(flareMeshes(spec).length, 0, what);
    assert.ok(!(mouthNote(spec) ?? "").includes("NaN"), what);
  }
});

test("speaker horn: a tapped horn whose drivers sit on no board is the engine's named gap", () => {
  const room = { depthIn: 20, heightIn: 20, wallIn: 0.75, widthIn: 20 };
  const tapped = withHorn(BIN, (h) => ({
    ...h,
    drive: { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 2 },
    boards: zigzagBoards(room, 4, false),
  }));
  assert.deepEqual(responseOf(tapped).chambers[0].gaps, [HORN_ENGINE_GAP.taps]);
  assert.ok(finiteResponse(tapped));
  assert.match(hornText(hornOf(BIN)), /^front-loaded horn, \d+ sections, [\d.]+ in, straight$/);
});

test("speaker horn: smooth by default; Steps off snaps each start area back to the previous end", () => {
  // the templates and a new section have no steps
  for (const template of [
    SPEAKER_TEMPLATE.paV2SubBinOne,
    SPEAKER_TEMPLATE.paV2SubBinTwo,
    SPEAKER_TEMPLATE.paV2MidBox,
  ])
    assert.equal(stepCount(hornOf(templateSpeaker(template)).segments), 0, template);
  const segments = hornOf(BIN).segments;
  assert.equal(stepCount(withSectionAdded(segments) ?? []), 0, "a new section starts smooth");
  // two steps made with Steps on
  const stepped = withSectionSize(withSectionSize(segments, 1, "s1", 100), 3, "s1", 900);
  assert.equal(stepCount(stepped), 2);
  assert.equal(SPEAKER_TEXT.hornSteps(stepCount(stepped)), "Steps: 2");
  // Steps off: every start back to the previous end, the ends as they were
  const smooth = withStepsSmoothed(stepped);
  assert.equal(stepCount(smooth), 0);
  assert.equal(SPEAKER_TEXT.hornSteps(stepCount(smooth)), "Steps: none");
  smooth.forEach((s, i) => {
    assert.equal(s.s2, stepped[i].s2);
    if (i > 0) assert.equal(s.s1, smooth[i - 1].s2);
  });
  assert.equal(smooth[0].s1, segments[0].s1, "the throat stays");
  assert.deepEqual(withStepsSmoothed(segments), segments, "a smooth horn stays as it is");
  assert.deepEqual(responseOf(withSegments(BIN, () => smooth)).sum, responseOf(BIN).sum);
});

test("speaker horn: a step shows a note that names the two sections", () => {
  const stepped = withSectionSize(hornOf(BIN).segments, 1, "s1", 100);
  const notes = stepped.flatMap((_, i) =>
    stepsIn(stepped, i) ? [SPEAKER_TEXT.hornStep(i + 1)] : [],
  );
  assert.deepEqual(notes, [
    "Section 2 starts at a different area than section 1 ends. This makes a step in the horn.",
  ]);
  assert.equal(stepsIn(withStepsSmoothed(stepped), 1), false, "no note once smooth");
});

test("speaker horn: Steps stays on when a step is typed back to smooth; only Off turns it off", () => {
  const segments = hornOf(BIN).segments;
  // smooth and never turned on: off
  assert.equal(stepsLatched(false, segments), false);
  // a step: on, whatever it was
  const stepped = withSectionSize(segments, 1, "s1", 100);
  let on = stepsLatched(false, stepped);
  assert.equal(on, true);
  // the start area typed back down to the previous end: no step, but Steps stays on (the field stays)
  const typedBack = withSectionSize(stepped, 1, "s1", shownIn2(segments[0].s2));
  assert.equal(stepCount(typedBack), 0);
  on = stepsLatched(on, typedBack);
  assert.equal(on, true);
  // the user's Off: off, and the sections smooth
  assert.equal(stepsLatched(false, withStepsSmoothed(typedBack)), false);
});
