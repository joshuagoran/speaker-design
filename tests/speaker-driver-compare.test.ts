// The Speaker page's driver comparison (lib/speaker/driverCompare): the options a driver entry gets, each row's numbers
// from the page's own model, Use, and the table's sort order.
import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  compareRows,
  driverOptions,
  optionKey,
  ownOption,
  runOption,
  sortRows,
  withOption,
  type DriverCompareRun,
} from "../src/lib/speaker/driverCompare";
import { evaluateSpeaker, speakerF3 } from "../src/lib/speaker/optimize/evaluate";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { cabinetBuild } from "../src/lib/speaker/speakerBuild";
import { speakerPrice } from "../src/lib/speaker/speakerTotals";
import { HIFI_WOOFERS } from "../src/lib/data";
import { byId } from "../src/lib/tables";
import { chamberClearFace } from "../src/lib/speaker/chamberAir";
import { driverAcrossIn } from "../src/lib/speaker/speakerLayout";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { DRIVER_KIND } from "../src/constants/speakerSpec";
import { DRIVER_COMPARE_SORT, SORT_DIRECTION } from "../src/constants/driverCompare";
import { SPEAKER_PROBLEM, SPEAKER_PROBLEM_TEXT } from "../src/constants/speakerOptimizer";
import { upperFirst } from "../src/lib/format";
import type { DriverCompareOption, DriverCompareTarget, SpeakerSpec } from "../src/types";

/** The Hi-fi 2-way template and its woofer entry. */
function hifiWoofer(): { spec: SpeakerSpec; target: DriverCompareTarget } {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.hifiTwoWay);
  const chamber = spec.cabinet.chambers.findIndex((c) =>
    c.drivers.some((d) => d.kind === DRIVER_KIND.woofer),
  );
  const entry = spec.cabinet.chambers[chamber]?.drivers.findIndex(
    (d) => d.kind === DRIVER_KIND.woofer,
  );
  assert.ok(chamber >= 0 && entry !== undefined && entry >= 0, "the template has a woofer");
  return { spec, target: { chamber, entry } };
}

const entryOf = (spec: SpeakerSpec, t: DriverCompareTarget) => {
  const d = spec.cabinet.chambers[t.chamber]?.drivers[t.entry];
  assert.ok(d, "the entry exists");
  return d;
};

/** Every option's run, by key. */
function runsOf(
  spec: SpeakerSpec,
  t: DriverCompareTarget,
  options: readonly DriverCompareOption[],
) {
  const runs = new Map<string, DriverCompareRun>();
  for (const o of options) runs.set(optionKey(o), runOption(spec, t, o));
  return runs;
}

const DRIVER_FIT_TEXT = upperFirst(SPEAKER_PROBLEM_TEXT[SPEAKER_PROBLEM.driverFit]);

test("a Hi-fi 2-way woofer's options: yours, and only woofers that fit or are marked as not fitting", () => {
  const { spec, target } = hifiWoofer();
  const own = entryOf(spec, target);
  const options = driverOptions(own);
  assert.equal(optionKey(options[0] ?? ownOption(own)), optionKey(ownOption(own)), "yours first");
  assert.ok(options.length > 1, "the catalog has other woofers");
  const face = chamberClearFace(spec.cabinet, spec.cabinet.chambers[target.chamber]);
  const room = Math.min(face.w, face.h);
  const runs = runsOf(spec, target, options);
  const rows = compareRows(options, (o) => runs.get(optionKey(o)), {
    kind: own.kind,
    yours: optionKey(ownOption(own)),
    nameOf: (o) => o.driverId,
    limits: { budget: null, maxLb: null },
    sizeLocks: {},
  });
  assert.equal(rows.length, options.length, "every option has a row");
  for (const r of rows) {
    const w = byId(HIFI_WOOFERS, r.option.driverId);
    assert.ok(w, `${r.option.driverId} is a woofer`);
    const across = driverAcrossIn({ ...own, driverId: w.id });
    const marked = r.problems.some((p) => p.text === DRIVER_FIT_TEXT && !p.yoursToo);
    if (across > room) assert.ok(marked && r.fails, `${w.id} doesn't fit and is marked`);
    else assert.ok(!marked, `${w.id} fits and isn't marked`);
  }
  assert.ok(
    rows.some((r) => r.fails),
    "a size too big for the box is listed, marked",
  );
});

test("every row's numbers come from the page's model: yours matches the page's results", () => {
  const { spec, target } = hifiWoofer();
  const own = entryOf(spec, target);
  const run = runOption(spec, target, ownOption(own));
  // the page's own runs (useSpeakerPage)
  const response = speakerResponse(spec, { feed: spec.input });
  const limits = speakerLimits(spec, response, { feed: spec.input });
  assert.equal(run.metrics.musicDb, limits.musicDb);
  assert.equal(run.metrics.lb, cabinetBuild(spec.cabinet).lb);
  assert.equal(run.metrics.price, speakerPrice(spec.cabinet).dollars);
  assert.equal(run.metrics.f3, speakerF3(response));
  assert.equal(run.bandDb, response.bands.find((b) => b.id === own.bands[0])?.passbandDb);
  assert.deepEqual(run.sum, response.sum);
  // another option: its run is the page's on the design with it put in
  const other = driverOptions(own)[1];
  assert.ok(other);
  const swapped = evaluateSpeaker(withOption(spec, target, other));
  const otherRun = runOption(spec, target, other);
  assert.deepEqual(otherRun.metrics, swapped.metrics);
  assert.deepEqual(otherRun.sum, swapped.response.sum);
});

test("Use puts the driver into the entry and keeps its count and band", () => {
  const { spec, target } = hifiWoofer();
  const own = entryOf(spec, target);
  const other = driverOptions(own)[1];
  assert.ok(other);
  const used = entryOf(withOption(spec, target, other), target);
  assert.equal(used.driverId, other.driverId);
  assert.equal(used.kind, own.kind);
  assert.equal(used.count, own.count);
  assert.deepEqual(used.bands, own.bands);
  // yours again: back as it was, and the option list still has the one it opened on
  const back = withOption(withOption(spec, target, other), target, ownOption(own));
  assert.deepEqual(entryOf(back, target), own);
  const origin = { ...ownOption(own), kind: own.kind };
  assert.ok(driverOptions(used, origin).some((o) => optionKey(o) === optionKey(origin)));
});

test("sort order: yours first, then failing options last, by maximum output", () => {
  const { spec, target } = hifiWoofer();
  const own = entryOf(spec, target);
  const options = driverOptions(own);
  const runs = runsOf(spec, target, options);
  const mine = runs.get(optionKey(ownOption(own)));
  assert.ok(mine);
  // a budget at your price: the dearer options fail it, yours doesn't
  const rows = compareRows(options, (o) => runs.get(optionKey(o)), {
    kind: own.kind,
    yours: optionKey(ownOption(own)),
    nameOf: (o) => o.driverId,
    limits: { budget: mine.metrics.price, maxLb: null },
    sizeLocks: {},
  });
  assert.ok(
    rows.some((r) => r.fails),
    "some option fails the budget",
  );
  assert.ok(
    rows.some((r) => !r.fails && !r.yours),
    "some option passes",
  );
  const sorted = sortRows(rows, DRIVER_COMPARE_SORT.max, SORT_DIRECTION.descending);
  assert.ok(sorted[0]?.yours, "yours first");
  const rest = sorted.slice(1);
  const firstFail = rest.findIndex((r) => r.fails);
  assert.ok(
    rest.slice(firstFail).every((r) => r.fails),
    "no passing option after a failing one",
  );
  const passing = rest.slice(0, firstFail).map((r) => r.run.metrics.musicDb ?? -Infinity);
  assert.deepEqual(
    passing,
    [...passing].sort((a, b) => b - a),
    "the passing options by maximum output, highest first",
  );
  // reversed, yours still first and the failing ones still last
  const up = sortRows(rows, DRIVER_COMPARE_SORT.max, SORT_DIRECTION.ascending);
  assert.ok(up[0]?.yours);
  assert.ok(up.at(-1)?.fails);
});

test("every template's driver entries have options to compare, a template's own driver too", () => {
  for (const id of Object.values(SPEAKER_TEMPLATE)) {
    const spec = templateSpeaker(id);
    spec.cabinet.chambers.forEach((c) =>
      c.drivers.forEach((d) => {
        const options = driverOptions(d);
        assert.deepEqual(options[0], ownOption(d), `${id} ${d.driverId}: yours first`);
        assert.ok(options.length > 1, `${id} ${d.driverId}: has other options`);
        // a horn-loaded part keeps a horn in every option
        if (d.horn)
          assert.ok(
            options.every((o) => o.hornId !== null),
            `${id} ${d.driverId}: horns`,
          );
      }),
    );
  }
});

test("the part the comparison opened on stays an option only while the entry is its kind", () => {
  const { spec, target } = hifiWoofer();
  const own = entryOf(spec, target);
  const origin = { driverId: "opened-on", hornId: null, kind: own.kind };
  assert.ok(driverOptions(own, origin).some((o) => o.driverId === origin.driverId));
  const other = { ...origin, kind: DRIVER_KIND.sub };
  assert.ok(!driverOptions(own, other).some((o) => o.driverId === origin.driverId));
});

test("sort: a row with no number goes last, either way", () => {
  const { spec, target } = hifiWoofer();
  const own = entryOf(spec, target);
  const options = driverOptions(own).slice(0, 4);
  const runs = runsOf(spec, target, options);
  const rows = compareRows(options, (o) => runs.get(optionKey(o)), {
    kind: own.kind,
    yours: optionKey(ownOption(own)),
    nameOf: (o) => o.driverId,
    limits: { budget: null, maxLb: null },
    sizeLocks: {},
  });
  const blank = rows.find((r) => !r.yours && !r.fails);
  assert.ok(blank, "an option that passes");
  const withBlank = rows.map((r) =>
    r === blank ? { ...r, run: { ...r.run, metrics: { ...r.run.metrics, f3: null } } } : r,
  );
  for (const dir of Object.values(SORT_DIRECTION)) {
    const passing = sortRows(withBlank, DRIVER_COMPARE_SORT.f3, dir).filter(
      (r) => !r.yours && !r.fails,
    );
    assert.equal(passing.at(-1)?.id, blank.id, `${dir}: no F3 last`);
  }
});
