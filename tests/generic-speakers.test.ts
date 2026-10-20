// The generic Speaker templates (src/pages/speaker/speakerTemplates, lib/defaults GENERIC_*): each approximates the
// common commercial PA box of its kind, not one product. Each builds with no model gaps, fits as it is set, and lands
// in its target bands: the published specs such boxes share, within 15 % (Hz, L, degrees) or 3 dB.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { evaluateSpeaker } from "../src/lib/speaker/optimize/evaluate";
import { chamberFitChips } from "../src/lib/speaker/fitChips";
import { passbandDb } from "../src/lib/speaker/speakerResponse";
import { isDrawn } from "../src/lib/speaker/foldHorn";
import {
  baffleOpenings,
  driverFrame,
  driverSpots,
  hornFlare,
  onTop,
  speakerLayout,
  type EdgeBox,
} from "../src/lib/speaker/speakerLayout";
import { HORN_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { SPEAKER_START_NAMES, SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import { CHAMBER_LOAD, DRIVER_KIND, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
import type { FrequencyPoint, SpeakerSpec } from "../src/types";

/** How far a frequency, a volume or a coverage angle may miss its target, as a share of it. */
const SHARE_SLACK = 0.15;
/** How far a level may miss its target, dB. */
const DB_SLACK = 3;
/**
 * A maker's peak figure over the level the page gives for music (`SpeakerLimits.musicDb`, its continuous level), dB:
 * makers rate peak power at four times the continuous.
 */
const PEAK_OVER_MUSIC_DB = 6;

/** A target band: one figure, or a range, before the slack. */
type Target = readonly [low: number, high: number];

/** What one template must reach. Low points: the response's −N dB points below its passband, Hz. */
interface Targets {
  /** the net air of its first chamber, L; for a horn box, the outside volume */
  liters?: Target;
  low: Partial<Record<3 | 6 | 10, Target>>;
  /** the highest frequency still within 6 dB of the passband, Hz */
  high6?: Target;
  peakDb: Target;
  /** the HF horn's catalog coverage, degrees */
  coverage?: { h: Target; v?: Target };
}

/**
 * The targets, from the published specs such boxes share. Measured when the templates were set (Oct 2026):
 * - 18″ sub: 148 L, −3/−6/−10 dB at 37.5/35.0/32.4 Hz, music 127.4 dB (133.4 peak);
 * - dual 18″ sub: 301 L, −3 dB at 34.0 Hz, music 131.5 dB (137.5 peak);
 * - 12″ top: 63 L, −6 dB at 49.3 Hz to 20 kHz, music 124.8 dB (130.8 peak), 80° × 50°;
 * - 15″ top: 84 L, −6 dB at 45.1 Hz to 20 kHz, music 125.8 dB (131.8 peak), 80° × 60°;
 * - 12″ wedge: 50 L, −6 dB at 51.2 Hz to 20 kHz, music 124.6 dB (130.6 peak), 80° × 50°;
 * - 18″ horn sub: 382 L outside, −6 dB from 45.5 to 104 Hz, music 131.5 dB (137.5 peak);
 * - 12″ horn top: −6 dB at 153 Hz to 20 kHz, music 131.1 dB (137.1 peak), 60° × 40°.
 */
const TARGETS = {
  [SPEAKER_TEMPLATE.genericSub18]: {
    liters: [150, 150],
    low: { 3: [40, 40], 10: [35, 35] },
    peakDb: [133, 133],
  },
  [SPEAKER_TEMPLATE.genericDualSub18]: {
    liters: [300, 300],
    low: { 3: [38, 38] },
    peakDb: [139, 139],
  },
  [SPEAKER_TEMPLATE.genericTop12]: {
    liters: [60, 60],
    low: { 6: [50, 50] },
    high6: [20000, 20000],
    peakDb: [132, 132],
    coverage: { h: [75, 90] },
  },
  [SPEAKER_TEMPLATE.genericTop15]: {
    liters: [80, 90],
    low: { 6: [45, 45] },
    high6: [20000, 20000],
    peakDb: [133, 133],
    coverage: { h: [90, 90], v: [60, 60] },
  },
  [SPEAKER_TEMPLATE.genericWedge12]: {
    liters: [45, 50],
    low: { 6: [50, 50] },
    high6: [20000, 20000],
    peakDb: [132, 132],
    coverage: { h: [75, 90] },
  },
  [SPEAKER_TEMPLATE.genericHornSub18]: {
    liters: [300, 400],
    low: { 6: [45, 45] },
    high6: [120, 120],
    peakDb: [136, 138],
  },
  [SPEAKER_TEMPLATE.genericHornTop12]: {
    low: { 6: [150, 150] },
    high6: [20000, 20000],
    peakDb: [135, 135],
    coverage: { h: [60, 60], v: [40, 40] },
  },
} as const satisfies Partial<Record<keyof typeof SPEAKER_TEMPLATE, Targets>>;

/** Whether `x` is in the target band, with `slack` as a share (`share`) or in its own units. */
function assertIn(x: number, [low, high]: Target, what: string, share: boolean) {
  const lo = share ? low * (1 - SHARE_SLACK) : low - DB_SLACK;
  const hi = share ? high * (1 + SHARE_SLACK) : high + DB_SLACK;
  assert.ok(
    x >= lo && x <= hi,
    `${what}: ${x.toFixed(1)} is outside ${lo.toFixed(1)}–${hi.toFixed(1)}`,
  );
}

/** Where a curve first reaches `db` below its passband, Hz, between grid points on a log scale. */
function lowPointHz(curve: readonly FrequencyPoint[], db: number): number {
  const edge = passbandDb(curve) - db;
  const i = curve.findIndex((o) => o.spl >= edge);
  if (i <= 0) return curve[0].f;
  const a = curve[i - 1],
    b = curve[i];
  const t = (edge - a.spl) / (b.spl - a.spl);
  return Math.exp(Math.log(a.f) + t * (Math.log(b.f) - Math.log(a.f)));
}

/** The highest frequency within `db` of a curve's passband, Hz (a grid point). */
function highPointHz(curve: readonly FrequencyPoint[], db: number): number {
  const edge = passbandDb(curve) - db;
  return curve.findLast((o) => o.spl >= edge)?.f ?? 0;
}

/** Whether two boxes on a baffle overlap. */
const overlap = (a: EdgeBox, b: EdgeBox) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Each chamber's baffle drivers' frames (what each covers) clear each other and every opening; fails on the first. */
function assertBafflesClear(spec: SpeakerSpec, name: string) {
  for (const placed of speakerLayout(spec.cabinet).chambers) {
    const frames = placed.chamber.drivers.flatMap((driver) =>
      onTop(driver) || !placed.spots.has(driver)
        ? []
        : driverSpots(placed, driver).map((s): EdgeBox => {
            const { w, h } = driverFrame(driver, placed.clear);
            return { x0: s.xIn - w / 2, x1: s.xIn + w / 2, y0: s.yIn - h / 2, y1: s.yIn + h / 2 };
          }),
    );
    const openings = baffleOpenings(spec.cabinet, placed);
    frames.forEach((a, i) => {
      for (const b of frames.slice(i + 1))
        assert.ok(!overlap(a, b), `${name}: two drivers overlap`);
      for (const o of openings) assert.ok(!overlap(a, o), `${name}: a driver is over an opening`);
    });
  }
}

/** The HF horn of a spec's compression driver: its catalog row. */
function hfHorn(spec: SpeakerSpec) {
  const driver = spec.cabinet.chambers
    .flatMap((c) => c.drivers)
    .find((d) => d.kind === DRIVER_KIND.compression);
  assert.ok(driver?.horn, `${spec.name}: no HF horn`);
  return byIdOrThrow(HORN_OPTIONS, driver.horn.hornId, CATALOG_TABLE_NAMES.horns);
}

test("generic speakers: each fits as it is set and lands in its targets", () => {
  for (const [template, targets] of Object.entries(TARGETS) as [keyof typeof TARGETS, Targets][]) {
    const spec = templateSpeaker(template);
    const name = SPEAKER_START_NAMES[template];
    const ev = evaluateSpeaker(spec);
    // modeled whole, and buildable: each driver and horn fits where it is set, each vent fits, no fit check warns
    assert.deepEqual(ev.response.gaps, [], name);
    assert.ok(ev.facts.chambers.every(Boolean), `${name}: a chamber has a model gap`);
    assert.ok(ev.facts.drivers.flat().every(Boolean), `${name}: a driver does not fit`);
    assert.ok(ev.facts.vents.every(Boolean), `${name}: a vent does not fit`);
    for (const [severity, title] of chamberFitChips(spec.cabinet, ev.build).flat())
      assert.equal(severity, "ok", `${name}: ${title}`);
    assert.deepEqual(ev.warnings, [], `${name}: a band limits first at its crossover`);
    assertBafflesClear(spec, name);
    // the size
    if (targets.liters) {
      const [first] = spec.cabinet.chambers;
      const liters =
        first.load.kind === CHAMBER_LOAD.horn
          ? ev.metrics.volumeL
          : ev.response.chambers[0].netLiters;
      assertIn(liters, targets.liters, `${name} L`, true);
    }
    // the response as the page shows it, with its input range
    const { sum } = ev.response;
    for (const [db, target] of Object.entries(targets.low))
      assertIn(lowPointHz(sum, Number(db)), target, `${name} −${db} dB`, true);
    if (targets.high6) assertIn(highPointHz(sum, 6), targets.high6, `${name} top −6 dB`, true);
    assert.ok(ev.limits.musicDb !== null, name);
    assertIn(ev.limits.musicDb + PEAK_OVER_MUSIC_DB, targets.peakDb, `${name} peak dB`, false);
    if (targets.coverage) {
      const { hf } = hfHorn(spec);
      assert.ok(hf, name);
      assertIn(hf.covH, targets.coverage.h, `${name} horizontal`, true);
      if (targets.coverage.v)
        assertIn(hf.covV ?? hf.covH, targets.coverage.v, `${name} vertical`, true);
    }
  }
});

test("generic speakers: the horn sub's horn is the engine's folded front-loaded design, drawn", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.genericHornSub18);
  const [chamber] = spec.cabinet.chambers;
  assert.ok(chamber.load.kind === CHAMBER_LOAD.horn);
  const { horn } = chamber.load;
  assert.equal(horn.path, HORN_PATH.folded);
  assert.equal(horn.drive.kind, HORN_DRIVE.front);
  assert.ok(isDrawn(horn.fold), "the fold is drawn");
});

test("generic speakers: the horn top's mid horn fits its box, its mouth unclipped", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.genericHornTop12);
  const [placed] = speakerLayout(spec.cabinet).chambers;
  const flare = hornFlare(spec.cabinet, placed);
  assert.ok(flare && !flare.mouthClipped, "the mouth fits");
  assert.ok(flare.path.fits, "the path fits the box");
});
