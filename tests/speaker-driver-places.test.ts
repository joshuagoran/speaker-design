// Where a speaker's drivers stand (lib/speaker/speakerLayout `driverSpots`): in a horn-loaded chamber, stacked and centered
// in the bay behind the throat whatever the spec's position says; on any baffle, inside the clear face, off every other
// driver and every port, slot or mouth. No setting puts a driver outside its baffle or the horn bay, or over another
// opening, and the page's edits keep it so (`settledCabinet`).
import { describe, expect, test } from "vite-plus/test";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { speakerFromHifi } from "../src/lib/speaker/hifiSpec";
import { DEFAULT_HIFI, DEFAULT_HIFI_LOOK } from "../src/lib/defaults";
import { speakerCutParts } from "../src/lib/speaker/speakerBuild";
import {
  buildSpeakerScene,
  SPEAKER_MESH_NAMES,
} from "../src/components/stack-view/buildSpeakerScene";
import * as THREE from "three";
import {
  baffleOpenings,
  driverFootprint,
  driverFrame,
  driversOnBaffle,
  driverSpots,
  hornFlare,
  MAX_PERMUTED,
  nearestFree,
  onTop,
  orders,
  SCAN_STEP_IN,
  settledCabinet,
  speakerLayout,
  type EdgeBox,
  type PlacedChamber,
} from "../src/lib/speaker/speakerLayout";
import { CHAMBER_LOAD, DRIVER_KIND, HORN_DRIVE, VENT_KIND } from "../src/constants/speakerSpec";
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

describe("the search for a free place (nearestFree)", () => {
  const face = { x: 0, y: 0, w: 10, h: 10 };
  const frame = { w: 2, h: 2 };
  const part = { size: frame, frame };
  const box = (x0: number, y0: number, x1: number, y1: number): EdgeBox => ({ x0, y0, x1, y1 });

  test("a place that is free stays where it is wanted, kept inside the face", () => {
    expect(nearestFree(face, part, { x: 4, y: 6 }, [])).toEqual({ x: 4, y: 6, free: true });
    expect(nearestFree(face, part, { x: -50, y: 50 }, [])).toEqual({ x: 1, y: 9, free: true });
  });

  test("no valid spot: the wanted place kept inside the face, and free is false", () => {
    // one box over the whole face
    const full = [box(-1, -1, 11, 11)];
    expect(nearestFree(face, part, { x: 4, y: 6 }, full)).toEqual({ x: 4, y: 6, free: false });
    expect(nearestFree(face, part, { x: 99, y: -99 }, full)).toEqual({ x: 9, y: 1, free: false });
    // boxes that leave a gap narrower than the part
    const bars = [box(0, 0, 10, 4.5), box(0, 5.5, 10, 10)];
    expect(nearestFree(face, part, { x: 5, y: 5 }, bars).free).toBe(false);
  });

  test("beside a box in the way: touching its edge, on the wanted line", () => {
    const found = nearestFree(face, part, { x: 5, y: 5 }, [box(4, 4, 6, 6)]);
    expect(found.free).toBe(true);
    const acrossBeside = (found.x === 7 || found.x === 3) && found.y === 5;
    const upBeside = (found.y === 7 || found.y === 3) && found.x === 5;
    expect(acrossBeside || upBeside).toBe(true);
  });

  test("the grid scan finds a place no box edge leads to", () => {
    // a wall down the right and a block at the left: every place beside a box is blocked or off the face, so the only
    // free places are in the pocket at the left, above and below the block
    const taken = [box(2.5, 0, 10, 10), box(0, 4, 2.5, 6)];
    const found = nearestFree(face, part, { x: 8, y: 5 }, taken);
    expect(found.free).toBe(true);
    expect(found.x).toBeGreaterThanOrEqual(1);
    expect(found.x).toBeLessThanOrEqual(1.5);
    expect(found.y <= 3 || found.y >= 7).toBe(true);
    // on the scan's steps from the face's corner
    const steps = (found.y - 1) / SCAN_STEP_IN;
    expect(steps).toBeCloseTo(Math.round(steps), 9);
    const covered = box(found.x - 1, found.y - 1, found.x + 1, found.y + 1);
    for (const b of taken) expect(overlap(covered, b)).toBe(false);
  });

  test("a part wider than the face is centered across it", () => {
    const wide = { size: { w: 14, h: 2 }, frame: { w: 14, h: 2 } };
    expect(nearestFree(face, wide, { x: 1, y: 5 }, []).x).toBe(5);
  });
});

describe("the orders the drivers are placed in", () => {
  test("up to the limit, every order once, the spec's first", () => {
    for (let n = 0; n <= MAX_PERMUTED; n++) {
      const items = Array.from({ length: n }, (_, i) => i);
      const all = [...orders(items)];
      const factorial = items.reduce((product, _, i) => product * (i + 1), 1);
      expect(all).toHaveLength(factorial);
      expect(all[0]).toEqual(items);
      expect(new Set(all.map((order) => order.join(","))).size).toBe(all.length);
      for (const order of all) expect([...order].sort((a, b) => a - b)).toEqual(items);
    }
  });

  test("past the limit, only the spec's order and its reverse", () => {
    const items = Array.from({ length: MAX_PERMUTED + 1 }, (_, i) => i);
    expect([...orders(items)]).toEqual([items, [...items].reverse()]);
  });

  /** The Hi-fi speaker's tweeter and woofer on one baffle, as wide as both and no more (one row: no room to stack). */
  function narrowBaffle() {
    const speaker = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, {
      id: "orders",
      name: "orders",
    });
    const [chamber] = speaker.cabinet.chambers;
    const woofer = chamber.drivers.find((d) => d.kind === DRIVER_KIND.woofer);
    const tweeter = chamber.drivers.find((d) => d.kind === DRIVER_KIND.tweeter);
    if (!woofer || !tweeter) throw new Error("the Hi-fi design has a woofer and a tweeter");
    const make = (w: number, h: number): SpeakerCabinet => ({
      ...speaker.cabinet,
      chambers: [
        {
          ...chamber,
          dims: { ...chamber.dims, w, h },
          vent: { kind: VENT_KIND.sealed },
          // the woofer wants the middle, the tweeter the far left
          drivers: [
            { ...woofer, position: { xIn: 0, yIn: 0 } },
            { ...tweeter, position: { xIn: -100, yIn: 0 } },
          ],
        },
      ],
    });
    const open = { w: 100, h: 100 };
    const wantW = driverFrame(woofer, open).w + driverFrame(tweeter, open).w + 0.5;
    const wantH = Math.max(driverFrame(woofer, open).h, driverFrame(tweeter, open).h) + 0.1;
    // one pass to read how the walls turn the box into a clear face, then the box that gives the face wanted
    const probe = speakerLayout(make(30, 30)).chambers[0].clear;
    const cabinet = make(30 + wantW - probe.w, 30 + wantH - probe.h);
    expect(speakerLayout(cabinet).chambers[0].clear.w).toBeCloseTo(wantW, 9);
    return cabinet;
  }

  test("a driver placed first can leave the next no room: another order fits both", () => {
    const cabinet = narrowBaffle();
    const [placed] = speakerLayout(cabinet).chambers;
    const { clear } = placed;
    const [woofer, tweeter] = cabinet.chambers[0].drivers;
    const openings = baffleOpenings(cabinet, placed);
    const want = (d: SpeakerDriver) => ({
      x: placed.cx + d.position.xIn,
      y: placed.y0 + d.position.yIn,
    });
    const part = (d: SpeakerDriver) => ({
      size: driverFootprint(d, clear),
      frame: driverFrame(d, clear),
    });
    const frameBox = (d: SpeakerDriver, at: { x: number; y: number }): EdgeBox => {
      const { w, h } = driverFrame(d, clear);
      return { x0: at.x - w / 2, x1: at.x + w / 2, y0: at.y - h / 2, y1: at.y + h / 2 };
    };
    // the spec's order alone: the woofer takes the middle and the tweeter finds no free place
    const first = nearestFree(clear, part(woofer), want(woofer), openings);
    expect(first.free).toBe(true);
    const second = nearestFree(clear, part(tweeter), want(tweeter), [
      ...openings,
      frameBox(woofer, first),
    ]);
    expect(second.free, "the spec's order leaves the tweeter no room").toBe(false);
    // the layout tries the other order: both stand inside the face, off each other, the tweeter on the left
    const boxes = driverBoxes(placed);
    expect(boxes).toHaveLength(2);
    expect(overlap(boxes[0].box, boxes[1].box)).toBe(false);
    for (const { cutout } of boxes) {
      expect(cutout.x0).toBeGreaterThanOrEqual(clear.x - EPS);
      expect(cutout.x1).toBeLessThanOrEqual(clear.x + clear.w + EPS);
    }
    expect(boxes[1].box.x1).toBeLessThanOrEqual(boxes[0].box.x0 + EPS);
  });

  test("more drivers than the limit still stand apart where they fit", () => {
    const speaker = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "many", name: "many" });
    const [chamber] = speaker.cabinet.chambers;
    const tweeter = chamber.drivers.find((d) => d.kind === DRIVER_KIND.tweeter);
    if (!tweeter) throw new Error("the Hi-fi design has a tweeter");
    const count = MAX_PERMUTED + 2;
    const cabinet: SpeakerCabinet = {
      ...speaker.cabinet,
      chambers: [
        {
          ...chamber,
          dims: { ...chamber.dims, w: 40, h: 40 },
          // all of them want the same place
          drivers: Array.from({ length: count }, () => ({
            ...tweeter,
            position: { xIn: 0, yIn: 0 },
          })),
        },
      ],
    };
    const [placed] = speakerLayout(cabinet).chambers;
    const boxes = driverBoxes(placed);
    expect(boxes).toHaveLength(count);
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => expect(overlap(a.box, b.box)).toBe(false)),
    );
    const once = settledCabinet(cabinet);
    expect(settledCabinet(once)).toBe(once);
  });
});

describe("a baffle with no room left", () => {
  /** The Hi-fi baffle with more woofers on it than it holds. */
  function crowded(): SpeakerCabinet {
    const speaker = speakerFromHifi(DEFAULT_HIFI, DEFAULT_HIFI_LOOK, { id: "full", name: "full" });
    const [chamber] = speaker.cabinet.chambers;
    const woofer = chamber.drivers.find((d) => d.kind === DRIVER_KIND.woofer);
    if (!woofer) throw new Error("the Hi-fi design has a woofer");
    return {
      ...speaker.cabinet,
      chambers: [
        {
          ...chamber,
          drivers: Array.from({ length: 4 }, (_, i) => ({
            ...woofer,
            position: { xIn: i, yIn: i },
          })),
        },
      ],
    };
  }

  test("the drivers are kept inside the face, and settling twice changes nothing", () => {
    const cabinet = crowded();
    const [placed] = speakerLayout(cabinet).chambers;
    const boxes = driverBoxes(placed);
    // no order fits them: the face really is full
    expect(boxes.some((a, i) => boxes.slice(i + 1).some((b) => overlap(a.box, b.box)))).toBe(true);
    for (const { cutout } of boxes) {
      expect(cutout.x0).toBeGreaterThanOrEqual(placed.clear.x - EPS);
      expect(cutout.x1).toBeLessThanOrEqual(placed.clear.x + placed.clear.w + EPS);
    }
    const once = settledCabinet(cabinet);
    expect(settledCabinet(once)).toBe(once);
    const spotsOf = (cab: SpeakerCabinet) => [...speakerLayout(cab).chambers[0].spots.values()];
    expect(spotsOf(once)).toEqual(spotsOf(cabinet));
  });
});

describe("a back-loaded horn's drivers are on its baffle, with no driver board", () => {
  const BAFFLE = "#ff00aa",
    CABINET = "#2266aa";
  /** The PA sub bin with its horn back-loaded (the cones on the baffle), or front-loaded as it is. */
  function bin(back: boolean) {
    const { cabinet, look } = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);
    return {
      look,
      cabinet: {
        ...cabinet,
        chambers: cabinet.chambers.map((c): SpeakerChamber => {
          if (!back || c.load.kind !== CHAMBER_LOAD.horn) return c;
          const horn = { ...c.load.horn, drive: { kind: HORN_DRIVE.back } } as const;
          return { ...c, load: { ...c.load, horn } };
        }),
      },
    };
  }

  test("the drivers stand on the baffle and the horn has no bay", () => {
    const { cabinet } = bin(true);
    expect(driversOnBaffle(cabinet.chambers[0])).toBe(true);
    const flare = hornFlare(cabinet, speakerLayout(cabinet).chambers[0]);
    expect(flare).not.toBeNull();
    expect(flare?.path.bay).toBeNull();
    // the front-loaded horn has one
    const front = bin(false).cabinet;
    expect(hornFlare(front, speakerLayout(front).chambers[0])?.path.bay).toBeTruthy();
  });

  test("no driver board row in the cutlist", () => {
    const rows = (cabinet: SpeakerCabinet) =>
      speakerCutParts(cabinet, "butt").parts.filter((p) => p.part === "driverBoard");
    expect(rows(bin(false).cabinet)).toHaveLength(1);
    expect(rows(bin(true).cabinet)).toHaveLength(0);
  });

  test("no board in the 3D view, and the baffle keeps its color", () => {
    const meshes = (back: boolean) => {
      const { cabinet, look } = bin(back);
      const scene = buildSpeakerScene({
        spec: { cabinet, look: { ...look, cabFinish: CABINET, baffleColor: BAFFLE } },
        cutaway: false,
      });
      const out: THREE.Mesh[] = [];
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) out.push(o);
      });
      return out;
    };
    const isBoard = (m: THREE.Mesh) => m.name === SPEAKER_MESH_NAMES.driverBoard;
    expect(meshes(false).filter(isBoard).length).toBeGreaterThan(0);
    expect(meshes(true).filter(isBoard)).toHaveLength(0);
    /** the meshes whose first material is the baffle's color */
    const painted = (list: THREE.Mesh[]) =>
      list.filter((m) => {
        const material = Array.isArray(m.material) ? m.material[0] : m.material;
        return material instanceof THREE.MeshStandardMaterial
          ? `#${material.color.getHexString()}` === BAFFLE
          : false;
      });
    // the baffle panel itself is painted as the baffle (a front-loaded horn's cabinet-colored front has none)
    expect(painted(meshes(true)).length).toBeGreaterThan(0);
  });
});
