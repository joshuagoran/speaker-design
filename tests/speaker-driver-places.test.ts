// Where a speaker's drivers stand (lib/speaker/speakerLayout `driverSpots`): in a horn-loaded chamber, stacked and centered
// in the bay behind the throat whatever the spec's position says; on any baffle, inside the clear face, off every other
// driver and every port, slot or mouth. No setting puts a driver outside its baffle or the horn bay, or over another
// opening, and the page's edits keep it so (`settledCabinet`).
import { describe, expect, test } from "vite-plus/test";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import {
  baffleOpenings,
  driverFootprint,
  driverFrame,
  driversOnBaffle,
  driverSpots,
  hornFlare,
  onTop,
  settledCabinet,
  speakerLayout,
  type EdgeBox,
  type PlacedChamber,
} from "../src/lib/speaker/speakerLayout";
import { CHAMBER_LOAD } from "../src/constants/speakerSpec";
import type { SpeakerCabinet, SpeakerChamber, SpeakerDriver } from "../src/types";

/** How far two boxes may overlap before a test counts it, in. */
const EPS = 1e-6;

/** A seeded run of numbers in [0, 1): the same probes every time. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Each of a chamber's drivers' frame (what it covers) and cutout, one pair of boxes per driver, in the front view. */
function driverBoxes(
  placed: PlacedChamber,
): { driver: SpeakerDriver; box: EdgeBox; cutout: EdgeBox }[] {
  const around = (
    s: { xIn: number; yIn: number },
    { w, h }: { w: number; h: number },
  ): EdgeBox => ({
    x0: s.xIn - w / 2,
    x1: s.xIn + w / 2,
    y0: s.yIn - h / 2,
    y1: s.yIn + h / 2,
  });
  return placed.chamber.drivers.flatMap((driver) => {
    if (onTop(driver) || !placed.spots.has(driver)) return [];
    return driverSpots(placed, driver).map((s) => ({
      driver,
      box: around(s, driverFrame(driver, placed.clear)),
      cutout: around(s, driverFootprint(driver, placed.clear)),
    }));
  });
}

const overlap = (a: EdgeBox, b: EdgeBox) =>
  a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/** The specs of the templates that have a chamber with drivers on its baffle. */
const BAFFLE_TEMPLATES = SPEAKER_TEMPLATES.filter((template) =>
  templateSpeaker(template).cabinet.chambers.some(
    (c) => c.drivers.length > 0 && driversOnBaffle(c) && c.load.kind === CHAMBER_LOAD.direct,
  ),
);

describe("a horn-loaded chamber's drivers", () => {
  const HORN_TEMPLATES = [
    SPEAKER_TEMPLATE.paV2SubBinOne,
    SPEAKER_TEMPLATE.paV2SubBinTwo,
    SPEAKER_TEMPLATE.paV2MidBox,
  ];

  for (const template of HORN_TEMPLATES)
    test(`${template}: stacked and centered in the bay, whatever their positions say`, () => {
      const { cabinet } = templateSpeaker(template);
      /** the drivers set far off the throat, then as the template has them */
      const moved: SpeakerCabinet = {
        ...cabinet,
        chambers: cabinet.chambers.map((c) => ({
          ...c,
          drivers: c.drivers.map((d, i) => ({ ...d, position: { xIn: 40 + i, yIn: -30 - i } })),
        })),
      };
      for (const c of [cabinet, moved]) {
        const [placed] = speakerLayout(c).chambers;
        const flare = hornFlare(c, placed);
        const bay = flare?.path.bay;
        expect(bay, "the horn has a bay behind the throat").toBeTruthy();
        if (!bay) continue;
        const boxes = driverBoxes(placed);
        expect(boxes.length).toBe(placed.chamber.drivers.length);
        // inside the bay, on its center line, stacked without overlap
        for (const { box } of boxes) {
          expect(box.x0).toBeGreaterThanOrEqual(bay.x - EPS);
          expect(box.x1).toBeLessThanOrEqual(bay.x + bay.w + EPS);
          expect(box.y0).toBeGreaterThanOrEqual(bay.y - EPS);
          expect(box.y1).toBeLessThanOrEqual(bay.y + bay.h + EPS);
          expect((box.x0 + box.x1) / 2).toBeCloseTo(bay.x + bay.w / 2, 6);
        }
        boxes.forEach((a, i) =>
          boxes.slice(i + 1).forEach((b) => expect(overlap(a.box, b.box)).toBe(false)),
        );
        // centered up the bay, the first at the bottom
        const lo = Math.min(...boxes.map((b) => b.box.y0)),
          hi = Math.max(...boxes.map((b) => b.box.y1));
        expect((lo + hi) / 2).toBeCloseTo(bay.y + bay.h / 2, 6);
        // the bay itself is inside the chamber's clear face
        expect(bay.x).toBeGreaterThanOrEqual(placed.clear.x - 1e-3);
        expect(bay.x + bay.w).toBeLessThanOrEqual(placed.clear.x + placed.clear.w + 1e-3);
        expect(bay.y).toBeGreaterThanOrEqual(placed.clear.y - 1e-3);
        expect(bay.y + bay.h).toBeLessThanOrEqual(placed.clear.y + placed.clear.h + 1e-3);
      }
      // the same places either way: the spec's position is not read
      const a = driverSpots(speakerLayout(cabinet).chambers[0], cabinet.chambers[0].drivers[0]);
      const b = driverSpots(speakerLayout(moved).chambers[0], moved.chambers[0].drivers[0]);
      expect(b).toEqual(a);
    });

  test("settling a horn chamber leaves its positions alone", () => {
    const { cabinet } = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
    expect(settledCabinet(cabinet)).toBe(cabinet);
  });
});

describe("a baffle's drivers", () => {
  test("the templates with drivers on a baffle are covered", () => {
    expect(BAFFLE_TEMPLATES.length).toBeGreaterThan(3);
  });

  for (const template of BAFFLE_TEMPLATES)
    test(`${template}: no position puts a driver off its baffle or over another opening`, () => {
      const random = seeded(7);
      const { cabinet } = templateSpeaker(template);
      cabinet.chambers.forEach((chamber, ci) => {
        if (!driversOnBaffle(chamber)) return;
        chamber.drivers.forEach((_, di) => {
          // the corners and the middle, far outside the baffle, and some at random
          const probes = [
            [0, 0],
            [-100, -100],
            [100, -100],
            [-100, 100],
            [100, 100],
            [0, 100],
            [-100, 0],
            ...Array.from({ length: 12 }, () => [
              (random() - 0.5) * 2 * chamber.dims.w,
              random() * chamber.dims.h,
            ]),
          ];
          for (const [xIn, yIn] of probes) {
            const probe: SpeakerCabinet = {
              ...cabinet,
              chambers: cabinet.chambers.map((c, k): SpeakerChamber =>
                k === ci
                  ? {
                      ...c,
                      drivers: c.drivers.map((d, j) =>
                        j === di ? { ...d, position: { xIn, yIn } } : d,
                      ),
                    }
                  : c,
              ),
            };
            const placed = speakerLayout(probe).chambers[ci];
            const openings = baffleOpenings(probe, placed);
            const boxes = driverBoxes(placed);
            const where = `${template} chamber ${ci + 1} driver ${di + 1} at ${xIn.toFixed(1)}, ${yIn.toFixed(1)}`;
            const { clear } = placed;
            for (const { box, cutout } of boxes) {
              // on the baffle: its cutout inside the clear face (a wider part is centered, it cannot fit)
              if (cutout.x1 - cutout.x0 <= clear.w + EPS) {
                expect(cutout.x0, where).toBeGreaterThanOrEqual(clear.x - EPS);
                expect(cutout.x1, where).toBeLessThanOrEqual(clear.x + clear.w + EPS);
              }
              if (cutout.y1 - cutout.y0 <= clear.h + EPS) {
                expect(cutout.y0, where).toBeGreaterThanOrEqual(clear.y - EPS);
                expect(cutout.y1, where).toBeLessThanOrEqual(clear.y + clear.h + EPS);
              }
              // off every port, slot, radiator and mouth
              for (const opening of openings) expect(overlap(box, opening), where).toBe(false);
            }
            // off every other driver
            boxes.forEach((a, i) =>
              boxes.slice(i + 1).forEach((b) => expect(overlap(a.box, b.box), where).toBe(false)),
            );
            // the page's settled cabinet holds the same places as its positions
            const settled = settledCabinet(probe);
            const again = speakerLayout(settled).chambers[ci];
            for (const d of probe.chambers[ci].drivers) {
              const k = probe.chambers[ci].drivers.indexOf(d);
              expect(driverSpots(again, settled.chambers[ci].drivers[k]), where).toEqual(
                driverSpots(placed, d),
              );
            }
          }
        });
      });
    });

  test("a typed position past the baffle is kept on it, and settling is stable", () => {
    const { cabinet } = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
    const [chamber] = cabinet.chambers;
    const off: SpeakerCabinet = {
      ...cabinet,
      chambers: [
        {
          ...chamber,
          drivers: chamber.drivers.map((d) => ({ ...d, position: { xIn: 500, yIn: -500 } })),
        },
      ],
    };
    const settled = settledCabinet(off);
    expect(settled).not.toBe(off);
    const [placed] = speakerLayout(settled).chambers;
    const [{ cutout }] = driverBoxes(placed);
    expect(cutout.x1).toBeLessThanOrEqual(placed.clear.x + placed.clear.w + EPS);
    expect(cutout.y0).toBeGreaterThanOrEqual(placed.clear.y - EPS);
    // the stored position is where the driver stands: nothing moves again
    expect(settledCabinet(settled)).toBe(settled);
  });

  test("a position that is fine stays where it is", () => {
    for (const template of BAFFLE_TEMPLATES) {
      const { cabinet } = templateSpeaker(template);
      expect(settledCabinet(cabinet), template).toBe(cabinet);
    }
  });
});
