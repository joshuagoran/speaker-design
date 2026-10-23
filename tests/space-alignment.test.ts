// What a space asks of the processing ahead of its amps (lib/speaker/spaceAlignment, spaceHardware): the alignment list
// against the delays and levels the model plays, a mirrored pair's rows, a fill's delay, the amp power figures, the texts.
import { UNIT_SYSTEM } from "../src/constants/units";
import { test } from "vite-plus/test";
import assert from "node:assert";
import { configs } from "./pa-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { spaceModel } from "./helpers";
import { ampPowerGroups, withAmpPower } from "../src/lib/speaker/spaceHardware";
import { delayDistanceIn, delayText, spaceAlignment } from "../src/lib/speaker/spaceAlignment";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { spacePlacement } from "../src/lib/speaker/specParts";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { SPACE_ITEM, SPEAKER_BAND } from "../src/constants/speakerSpec";
import { NO_DELAY_MS, SPACE_TEXT } from "../src/constants/space";
import { HIFI_DRIVE } from "../src/constants/hifiEngine";
import type { SpaceDesign } from "../src/types";

/** The PA design's space: one mirrored placement (0) of one stack, nothing set on it. */
function paSpace(): SpaceDesign {
  const read = layersFromPa(paDesign(configs[0]), { id: "draft", name: "PA design" }, PA_FLOOR);
  return { space: read.space, stacks: [read.stack], speakers: read.speakers };
}

/** The design with `set` applied to placement `k`'s own level and delay. */
const withFeed = (
  design: SpaceDesign,
  k: number,
  set: { levelDb?: number; delayMs?: number },
): SpaceDesign => ({
  ...design,
  space: {
    ...design.space,
    placements: design.space.placements.map((p, i) => (i === k ? { ...p, ...set } : p)),
  },
});

/** The PA space with a fill placed down the room (placement 1), playing a typed `delayMs` later. */
function withFill(delayMs: number): SpaceDesign {
  const design = paSpace();
  const fill = speakerFromFill(DEFAULT_FILL, { id: "fill", name: "Fill" });
  const item = { kind: SPACE_ITEM.speaker, id: fill.id } as const;
  return withFeed(
    {
      ...design,
      speakers: [...design.speakers, fill],
      space: {
        ...design.space,
        placements: [
          ...design.space.placements,
          { ...spacePlacement({ x: 0, y: 30 }, item, 60), fill: true },
        ],
      },
    },
    1,
    { delayMs },
  );
}

/**
 * Every voice the model plays against the list: each is in exactly one row, whose level (less its band's own) and
 * delay are what the model gives that voice.
 */
function assertListMatchesModel(design: SpaceDesign) {
  const model = spaceModel(design);
  const rows = spaceAlignment(model);
  assert.ok(model.feeds.length > 0);
  for (const feed of model.feeds) {
    const member = Number(feed.id.split("/")[1]);
    const mine = rows.filter(
      (r) =>
        r.placement === feed.placement &&
        r.member === member &&
        r.bands.some((b) => b.id === feed.band),
    );
    assert.equal(mine.length, 1, `${feed.id} is in ${mine.length} rows`);
    const [row] = mine;
    const box = model.placements.find((p) => p.item.placement.source === feed.placement);
    const speaker = box?.response?.members[member]?.speaker;
    assert.ok(speaker);
    const band = row.bands.length === 1 ? speaker.bands.find((b) => b.id === feed.band) : undefined;
    assert.ok(
      Math.abs(row.delayMs - feed.delayMs) < 1e-9,
      `${feed.id}: ${row.delayMs} vs ${feed.delayMs}`,
    );
    // the feed's gain holds its box's level at a gain of 0 too: the settings leave it out
    const gainDb = 20 * Math.log10(Math.abs(feed.gain)) - (model.placements[feed.box]?.fullDb ?? 0);
    assert.ok(
      Math.abs(row.gainDb - (gainDb + (band?.levelDb ?? 0))) < 1e-9,
      `${feed.id}: ${row.gainDb} vs ${gainDb}`,
    );
  }
  return rows;
}

test("space alignment: a mirrored pair is one placement: one row per band, in the stack's order", () => {
  const design = paSpace();
  const model = spaceModel(design);
  // two boxes in the model, one placement in the list
  assert.equal(model.placements.length, 2);
  const rows = assertListMatchesModel(design);
  assert.ok(rows.every((r) => r.placement === 0));
  assert.deepEqual(
    rows.map((r) => [r.member, r.bands.map((b) => b.id)]),
    [
      [0, [SPEAKER_BAND.low]],
      [1, [SPEAKER_BAND.mid]],
      [1, [SPEAKER_BAND.high]],
    ],
  );
  // the sub's low-pass is the crossover to the top's high-pass
  const [sub, topMid] = rows;
  assert.ok(sub.lowpass && topMid.highpass);
  assert.equal(sub.highpass?.hz ?? null, design.speakers[0].bands[0].highpass?.hz ?? null);
  // no placement delay: all of a row's delay is the crossover's
  assert.ok(rows.every((r) => r.delayMs === r.crossoverDelayMs));
});

test("space alignment: a mirrored pair's two boxes share one delay and level: one row per band", () => {
  const base = paSpace();
  const same = spaceAlignment(spaceModel(base));
  // the placement later and down 2 dB: both boxes play so, still one row per band
  const set = withFeed(base, 0, { delayMs: 0.5, levelDb: -2 });
  const rows = assertListMatchesModel(set);
  assert.equal(rows.length, same.length);
  assert.ok(rows.every((r) => r.placement === 0));
  rows.forEach((r, i) => {
    assert.ok(Math.abs(r.delayMs - 0.5 - same[i].delayMs) < 1e-9);
    assert.ok(Math.abs(r.gainDb + 2 - same[i].gainDb) < 1e-9);
    assert.ok(Math.abs(r.delayMs - r.crossoverDelayMs - 0.5) < 1e-9);
  });
  // the feeds of both boxes carry the shared settings
  const model = spaceModel(set);
  const [first, second] = model.placements.map((p) => p.item.placement);
  assert.deepEqual([first.levelDb, first.delayMs], [second.levelDb, second.delayMs]);
});

test("space alignment: a fill's placement delay adds to its box's rows, apart from the crossover delay", () => {
  const design = withFill(12);
  const rows = assertListMatchesModel(design);
  const fill = rows.filter((r) => r.placement === 1);
  assert.ok(fill.length > 0);
  for (const r of fill) {
    assert.ok(Math.abs(r.delayMs - r.crossoverDelayMs - 12) < 1e-9);
    assert.ok(r.delayMs >= 12);
  }
  // the mains' rows carry no placement delay
  const mains = rows.filter((r) => r.placement === 0);
  assert.ok(mains.length > 0);
  assert.ok(mains.every((r) => r.delayMs === r.crossoverDelayMs));
  // a fill with no delay of its own has none of its own in its rows
  const none = spaceAlignment(spaceModel(withFill(0))).filter((r) => r.placement === 1);
  assert.ok(none.every((r) => r.delayMs === r.crossoverDelayMs));
});

test("space hardware: amp power per speaker in placement order, shared by a mirrored pair and a speaker placed twice", () => {
  const design = withFill(0);
  const [sub, top, fill] = design.speakers;
  const power = ampPowerGroups(design);
  assert.deepEqual(
    power.map((s) => s.speaker.id),
    [sub.id, top.id, fill.id],
  );
  // each group's figure is its first band's
  for (const { speaker, groups } of power)
    for (const { bands, watts } of groups)
      assert.equal(watts, speaker.bands.find((b) => b.id === bands[0])?.ampW ?? 0);
  // the fill placed a second time: its figures are still listed once
  const twice = {
    ...design,
    space: {
      ...design.space,
      placements: [
        ...design.space.placements,
        spacePlacement({ x: 4, y: 30 }, { kind: SPACE_ITEM.speaker, id: fill.id }, 60),
      ],
    },
  };
  assert.equal(ampPowerGroups(twice).length, 3);
  // a figure set in the space's copy of the speaker shows in the list
  const set = { ...design, speakers: [withAmpPower(sub, [SPEAKER_BAND.low], 1234), top, fill] };
  const [first] = ampPowerGroups(set);
  assert.deepEqual(first.groups, [{ bands: [SPEAKER_BAND.low], watts: 1234 }]);
  // a space that places nothing has no figures
  assert.deepEqual(ampPowerGroups({ ...design, space: { ...design.space, placements: [] } }), []);
});

test("space alignment: a delay as the distance sound travels in it, and as words", () => {
  // 1 ms is about 13.5 in; the distance grows with the delay
  assert.ok(Math.abs(delayDistanceIn(1) - 13.5) < 0.1);
  assert.equal(delayDistanceIn(0), 0);
  assert.ok(Math.abs(delayDistanceIn(10) - 10 * delayDistanceIn(1)) < 1e-9);
  // under the smallest delay, no delay; at it and above, the time and the distance
  assert.equal(delayText(0, UNIT_SYSTEM.us), SPACE_TEXT.noDelay);
  assert.equal(delayText(NO_DELAY_MS - 0.01, UNIT_SYSTEM.us), SPACE_TEXT.noDelay);
  assert.equal(
    delayText(2, UNIT_SYSTEM.us),
    SPACE_TEXT.delayIs("2.00", `${Math.round(delayDistanceIn(2))} in`),
  );
  assert.equal(delayText(2, UNIT_SYSTEM.us), SPACE_TEXT.delayIs("2.00", "27 in"));
  assert.equal(delayText(2, UNIT_SYSTEM.metric), SPACE_TEXT.delayIs("2.00", "686 mm"));
  assert.notEqual(delayText(NO_DELAY_MS, UNIT_SYSTEM.us), SPACE_TEXT.noDelay);
});

test("DSP sheet: each row's Gain holds System gain; a box's passive bands are one row with their Pads", () => {
  const base = paSpace();
  const quiet = { ...base, space: { ...base.space, venue: { ...base.space.venue, systemDb: -4 } } };
  const full = spaceAlignment(spaceModel(base));
  spaceAlignment(spaceModel(quiet)).forEach((r, i) =>
    assert.ok(Math.abs(r.gainDb + 4 - (full[i]?.gainDb ?? 0)) < 1e-9),
  );
  // the top's two bands made passive, one set above 0 dB: one row, its Pads 0 dB or less
  const topId = base.speakers[1]?.id;
  const passive: SpaceDesign = {
    ...base,
    speakers: base.speakers.map((s) =>
      s.id === topId
        ? {
            ...s,
            bands: s.bands.map((b, i) => ({
              ...b,
              drive: HIFI_DRIVE.passive,
              levelDb: i ? -4 : 3,
            })),
          }
        : s,
    ),
  };
  const rows = spaceAlignment(spaceModel(passive)).filter((r) => r.member === 1);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    rows[0]?.pads.map((p) => p.padDb),
    [0, -4],
  );
  assert.ok(full.filter((r) => r.member === 1).every((r) => r.pads.length === 0));
});
