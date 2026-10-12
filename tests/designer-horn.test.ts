// The Designer's Horn settings (src/pages/designer/hornSections, HornSettings): editing a flare section changes the
// response, the 3D flare and the cutlist; sections chain as they are added and removed; the settings' in² and in
// convert to the spec's cm² and cm and back; a size that is not positive and finite is a named gap, never NaN; the PA
// v2 templates still model.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/designer/designerTemplates";
import {
  joinsNext,
  shownIn2,
  shownInOfCm,
  specSize,
  stepsIn,
  withSectionAdded,
  withSectionProfile,
  withSectionRemoved,
  withSectionSize,
} from "../src/pages/designer/hornSections";
import { hornText } from "../src/pages/designer/designerText";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { speakerCutParts } from "../src/lib/speaker/speakerBuild";
import {
  buildSpeakerScene,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import { DESIGNER_TEMPLATE } from "../src/constants/designerStarts";
import {
  CHAMBER_LOAD,
  HORN_DRIVE,
  HORN_ENGINE_GAP,
  HORN_PATH,
  SPEAKER_MODEL_GAP,
} from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { CM_PER_IN } from "../src/constants/units";
import type { HornSegment, SpeakerHorn, SpeakerSpec } from "../src/types";
import type * as THREE from "three";

/** The two-18″ PA v2 sub bin: the template the Horn settings were built on. */
const BIN = templateSpeaker(DESIGNER_TEMPLATE.paV2SubBinTwo);

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

test("designer horn: the PA v2 templates still model", () => {
  for (const template of [
    DESIGNER_TEMPLATE.paV2SubBinOne,
    DESIGNER_TEMPLATE.paV2SubBinTwo,
    DESIGNER_TEMPLATE.paV2MidBox,
  ]) {
    const spec = templateSpeaker(template);
    const r = responseOf(spec);
    assert.deepEqual(r.chambers[0].gaps, [], template);
    assert.ok(r.chambers[0].fb !== null, `${template}: tuned`);
    assert.ok(finiteResponse(spec), template);
    assert.ok(flareOf(spec), `${template}: the flare draws`);
  }
});

test("designer horn: editing a section changes the response, the 3D flare and the cutlist", () => {
  const segments = hornOf(BIN).segments;
  const last = segments.length - 1;
  // a mouth 25% larger: the last section's end area
  const bigger = withSegments(BIN, (s) =>
    withSectionSize(s, last, "s2", shownIn2(s[last].s2) * 1.25),
  );
  assert.ok(maxDiff(BIN, bigger) > 0.1, "the response changes");
  const [before, after] = [flareOf(BIN), flareOf(bigger)];
  assert.ok(before && after);
  assert.ok(after.mouth.w * after.mouth.h > before.mouth.w * before.mouth.h, "the mouth grows");
  assert.notEqual(mouthNote(bigger), mouthNote(BIN), "the cutlist's mouth opening follows");
  // a longer first section: the path grows, and so does the 3D flare
  const longer = withSegments(BIN, (s) =>
    withSectionSize(s, 0, "length", shownInOfCm(s[0].length) + 4),
  );
  assert.ok(maxDiff(BIN, longer) > 0.1);
  const lengthIn = (spec: SpeakerSpec) =>
    (flareOf(spec)?.segments ?? []).reduce((sum, s) => sum + s.length, 0);
  assert.ok(Math.abs(lengthIn(longer) - lengthIn(BIN) - 4) < 0.01, "4 in more flare");
  // a profile change reaches the engine too
  const exp = withSegments(BIN, (s) => withSectionProfile(s, 0, HORN_PROFILE.exponential));
  assert.equal(hornOf(exp).segments[0].profile, HORN_PROFILE.exponential);
  assert.ok(maxDiff(BIN, exp) > 0);
  // the throat chamber
  const throat = withHorn(BIN, (h) => ({ ...h, throatChamber: 5 }));
  assert.ok(maxDiff(BIN, throat) > 0.1);
  // a folded path: the same sound, the flare drawn as a placeholder
  const folded = withHorn(BIN, (h) => ({ ...h, path: HORN_PATH.folded }));
  assert.equal(maxDiff(BIN, folded), 0);
  assert.equal(flareOf(folded)?.placeholder, true);
});

test("designer horn: a shown area typed back in keeps the joint (the PA v2 bin's 630.08 in²)", () => {
  const segments = hornOf(BIN).segments;
  const shown = shownIn2(segments[0].s2);
  assert.equal(shown, 630.08, "the bin's first joint as the field shows it");
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
  // a real step (0.01 in² apart) stays a step
  assert.ok(stepsIn(withSectionSize(segments, 1, "s1", shown + 0.01), 1));
});

test("designer horn: typing an end area keystroke by keystroke doesn't join a stepped pair", () => {
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

test("designer horn: sections chain as they are edited, added and removed", () => {
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
  assert.equal(flareOf(addedSpec)?.segments.length, n + 1);
  assert.equal(flareMeshes(addedSpec).length, n + 1, "the 3D view draws the new section");
  assert.ok(maxDiff(BIN, addedSpec) > 0.1);
  // removed: the next section starts where the removed one did, so the path stays joined
  const removedFirst = withSectionRemoved(segments, 0);
  assert.equal(removedFirst.length, n - 1);
  assert.equal(removedFirst[0].s1, segments[0].s1, "the throat stays the throat");
  const removedMid = withSectionRemoved(segments, 1);
  assert.equal(removedMid[1].s1, segments[0].s2);
  assert.ok(removedMid.every((_, i) => !stepsIn(removedMid, i)));
  const removedSpec = withSegments(BIN, (s) => withSectionRemoved(s, n - 1));
  assert.equal(flareMeshes(removedSpec).length, n - 1);
  assert.ok(finiteResponse(removedSpec));
});

test("designer horn: in² and in round-trip to the spec's cm² and cm, and the spec survives a save", () => {
  for (const typed of [0.25, 12.5, 178.37, 1234.56]) {
    assert.equal(shownIn2(specSize("s1", typed)), typed);
    assert.equal(shownInOfCm(specSize("length", typed)), typed);
  }
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

test("designer horn: a size that is not positive and finite is a named gap, never NaN", () => {
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
    assert.deepEqual(r.chambers[0].gaps, [SPEAKER_MODEL_GAP.noModel], what);
    assert.ok(finiteResponse(spec), `${what}: no NaN`);
    assert.equal(flareOf(spec), null, `${what}: no flare drawn`);
    assert.equal(flareMeshes(spec).length, 0, what);
    assert.ok(!(mouthNote(spec) ?? "").includes("NaN"), what);
  }
  for (const throatChamber of [-1, Infinity, Number.NaN]) {
    const spec = withHorn(BIN, (h) => ({ ...h, throatChamber }));
    assert.deepEqual(responseOf(spec).chambers[0].gaps, [SPEAKER_MODEL_GAP.noModel]);
    assert.ok(finiteResponse(spec));
  }
});

test("designer horn: a drive other than front-loaded is the engine's named gap", () => {
  const tapped = withHorn(BIN, (h) => ({
    ...h,
    drive: { kind: HORN_DRIVE.tapped, frontTap: 1, rearTap: 0 },
  }));
  assert.deepEqual(responseOf(tapped).chambers[0].gaps, [HORN_ENGINE_GAP.tapped]);
  assert.ok(finiteResponse(tapped));
  assert.match(hornText(hornOf(BIN)), /^front-loaded horn, \d+ sections, [\d.]+ in, straight$/);
});
