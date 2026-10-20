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
  onTop,
  speakerLayout,
  type EdgeBox,
} from "../src/lib/speaker/speakerLayout";
import { HORN_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import { SPEAKER_START_NAMES, SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import { CHAMBER_LOAD, DRIVER_KIND, HORN_DRIVE, HORN_PATH } from "../src/constants/speakerSpec";
import type { Dims3, FrequencyPoint, SpeakerSpec } from "../src/types";

/** How far a frequency, a volume or a coverage angle may miss its target, as a share of it. */
const SHARE_SLACK = 0.15;
/** How far a level may miss its target, dB. */
const DB_SLACK = 3;
/** How far an outside size may miss its target, in. */
const SIZE_SLACK_IN = 1;
/**
 * A maker's peak figure over the level the page gives for music (`SpeakerLimits.musicDb`, its continuous level), dB:
 * makers rate peak power at four times the continuous.
 */
const PEAK_OVER_MUSIC_DB = 6;

/** A target band: one figure, or a range, before the slack. */
type Target = readonly [low: number, high: number];

/** What one template must reach. Low points: the response's −N dB points below its passband, Hz. */
interface Targets {
  /** its outside width, height, and depth, in: the commercial boxes' range */
  size: Record<keyof Dims3, Target>;
  low: Partial<Record<3 | 6 | 10, Target>>;
  /** the highest frequency still within 6 dB of the passband, Hz */
  high6?: Target;
  peakDb: Target;
  /** the HF horn's catalog coverage, degrees */
  coverage?: { h: Target; v?: Target };
}

/**
 * The targets, from the published specs such boxes share. The sizes span the makers' boxes (Oct 2026): QSC KS118 and
 * KW181, EV EKX-18SP, and JBL PRX918XLF; JBL SRX828SP and RCF SUB 8006-AS; QSC K12.2, EV ELX200-12P and ETX-12P, JBL
 * PRX912, and RCF ART 912-A; QSC KW152, EV ELX200-15P and ETX-15P, JBL PRX915, and RCF ART 915-A; the Cerwin-Vega
 * EL-36. Measured when the templates were set (Oct 2026):
 * - 18″ sub: 22 × 25 × 28 in, −3/−6/−10 dB at 35.8/33.6/31.2 Hz, music 127.0 dB (133.0 peak);
 * - dual 18″ sub: 46 × 25 × 27 in, −3 dB at 34.9 Hz, music 132.6 dB (138.6 peak);
 * - 12″ top: 14.5 × 24 × 14 in, −6 dB at 52.9 Hz to 20 kHz, music 124.2 dB (130.2 peak), 80° × 50°;
 * - 15″ top: 17 × 28 × 15.5 in, −6 dB at 45.5 Hz to 20 kHz, music 125.2 dB (131.2 peak), 80° × 60°;
 * - 18″ horn sub: 24 × 36 × 36 in, −6 dB from 36.4 to 136 Hz, music 130.1 dB (136.1 peak).
 */
const TARGETS = {
  [SPEAKER_TEMPLATE.genericSub18]: {
    size: { w: [20.5, 23.9], h: [20.3, 27.3], d: [24.1, 30.9] },
    low: { 3: [40, 40], 10: [35, 35] },
    peakDb: [133, 133],
  },
  [SPEAKER_TEMPLATE.genericDualSub18]: {
    size: { w: [43.7, 47.4], h: [22.6, 27.9], d: [26.8, 27.6] },
    low: { 3: [38, 38] },
    peakDb: [139, 139],
  },
  [SPEAKER_TEMPLATE.genericTop12]: {
    size: { w: [14, 15.5], h: [23.7, 25.3], d: [13.1, 15.7] },
    low: { 6: [50, 50] },
    high6: [20000, 20000],
    peakDb: [132, 132],
    coverage: { h: [75, 90] },
  },
  [SPEAKER_TEMPLATE.genericTop15]: {
    size: { w: [16.3, 18.3], h: [27.2, 32.1], d: [15.1, 17.6] },
    low: { 6: [45, 45] },
    high6: [20000, 20000],
    peakDb: [133, 133],
    coverage: { h: [90, 90], v: [60, 60] },
  },
  [SPEAKER_TEMPLATE.genericHornSub18]: {
    size: { w: [24, 24], h: [36, 36], d: [36, 36] },
    low: { 6: [40, 40] },
    high6: [130, 130],
    peakDb: [136, 138],
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
    // the outside size
    for (const axis of ["w", "h", "d"] as const) {
      const [low, high] = targets.size[axis];
      const x = ev.metrics.sizeIn[axis];
      assert.ok(
        x >= low - SIZE_SLACK_IN && x <= high + SIZE_SLACK_IN,
        `${name} ${axis}: ${x} in is outside ${low}–${high} in`,
      );
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
