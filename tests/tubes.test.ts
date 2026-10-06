import { test } from "vite-plus/test";
import assert from "node:assert";
import {
  ELBOW_COUNTS,
  ownSpans,
  tubeElbows,
  tubeLegs,
  tubeSpan,
  tubeSpans,
  type TubeRoom,
} from "../src/lib/tubeFold";
import {
  modelTubeElbows,
  subTubeEndCorrection,
  sticksFor,
  subTubeKit,
  tubeLayout,
  tubeRoom,
  tubeWallEndCorrection,
} from "../src/lib/pa/tubes";
import {
  ventGeometry,
  ventSpeedLimit,
  ventTuning,
  FLARED_PORT_SPEED_RATIO,
} from "../src/lib/pa/calc";
import { ventShape, tubeLengthFor, ductLengthFor } from "../src/lib/pa/exactSub";
import { SHARP_BEND_CORRECTION } from "../src/data/acoustics/slot-inner-end";
import { TUBE_FLARE_RADIUS_IN, TUBE_WALL_END } from "../src/data/acoustics/tube-ends";
import { PORT_ELBOWS, PORT_PIPES, PORT_TUBES } from "../src/data/catalog/port-tubes";
import { PA_SLIDERS } from "../src/constants/paSliders";
import { ductFit, ductFitMax } from "../src/lib/pa/chips";
import { hifiBox, hifiPortElbows, hifiTubeRoom, portMaxLength } from "../src/lib/hifi/hifi";
import { HIFI_WOOFERS } from "../src/lib/data";
import { close, vent, DRV18 } from "./helpers";

const room: TubeRoom = { run: 20, rise: 25, stop: 9 };

test("tube fold: straight, then up the back wall, then forward under the lid, each mouth a diameter clear", () => {
  // straight: a diameter short of the back wall
  assert.deepEqual(tubeSpan(room, 4, 0), [0, 16]);
  // one elbow: the riser's front face behind the stop, at least a diameter up, a diameter under the lid
  assert.deepEqual(tubeSpan(room, 4, 1), [9 + 2 + 4, 20 - 2 + 25 - 4]);
  // two: the riser to the lid, the return leg at least a diameter, its mouth a diameter behind the stop
  assert.deepEqual(tubeSpan(room, 4, 2), [9 + 4 + 8 + 23, 18 + 23 + (18 - 9 - 4)]);
  assert.deepEqual(tubeSpans(room, 4), [
    [0, 39],
    [44, 46],
  ]);
  // the fewest that fit; null in the gap between counts, and past the longest
  assert.equal(tubeElbows(room, 4, 16), 0);
  assert.equal(tubeElbows(room, 4, 16.5), 1);
  assert.equal(tubeElbows(room, 4, 42), null);
  assert.equal(tubeElbows(room, 4, 45), 2);
  assert.equal(tubeElbows(room, 4, 47), null);
});

test("tube fold: the legs add up to the length, the riser against the back wall when it can be", () => {
  for (const [len, e] of [
    [12, 0],
    [30, 1],
    [16, 1],
    [45, 2],
  ] as const) {
    const l = tubeLegs(room, 4, len, e);
    close(null, l.run + l.rise + l.back, len, 1e-12, `${len}″ with ${e}`);
    assert.ok(l.gap >= 4 - 1e-9, `${len}″: the mouth keeps a diameter clear (${l.gap})`);
  }
  assert.equal(tubeLegs(room, 4, 30, 1).run, 18); // the riser's axis a radius off the back wall
  assert.equal(tubeLegs(room, 4, 16, 1).run, 12); // a short tube's riser comes forward, never in front of the stop
});

test("tube layout: one row along the bottom under the driver, spread wall to wall, flares clear of everything", () => {
  const box = { w: 24, h: 34 };
  const { tubes, driver, fits } = tubeLayout(box, "round2", { nt: 2, dia: 4 }, 0.75, 18);
  assert.ok(fits);
  // the flares (r + 3/4) a quarter inch off the side walls and the floor
  const rf = 2 + TUBE_FLARE_RADIUS_IN;
  close(null, tubes[0].x, -(22.5 / 2 - 0.25 - rf), 1e-12);
  close(null, tubes[1].x, 22.5 / 2 - 0.25 - rf, 1e-12);
  assert.ok(tubes.every((p) => p.y === rf + 0.25));
  assert.ok(driver.y > tubes[0].y);
  // too many to fit the width, or tubes under a driver with no room below it
  assert.ok(!tubeLayout(box, "round2", { nt: 4, dia: 6 }, 0.75, 18).fits);
  assert.ok(!tubeLayout({ w: 20, h: 21 }, "round2", { nt: 2, dia: 4 }, 0.75, 18).fits);
});

test("tube end correction: flanged and free ends less the flares, the wall, the neighbors and each bend", () => {
  const box = { w: 24, h: 34, d: 21 };
  const one = vent({ nt: 1, dia: 4, len: 10 });
  const r = 2,
    R = r + TUBE_FLARE_RADIUS_IN;
  const straight = subTubeEndCorrection(box, "round1", one, 0.75, DRV18, 0);
  // a lone straight tube: 0.85 r and 0.61 r at the flared mouths' size, the flares' own shortfall, the back wall
  const gap = 21 - 0.75 - 0.75 - 10;
  const ends = (0.85 + 0.61) * r * (r / R) + tubeWallEndCorrection(r, gap);
  assert.ok(
    straight < ends && straight > ends - 2 * TUBE_FLARE_RADIUS_IN,
    `${straight} vs ${ends}`,
  );
  // the wall's term is the solve's at its points and falls with the gap
  close(null, tubeWallEndCorrection(1, TUBE_WALL_END.gapOverR[0]), TUBE_WALL_END.ecOverR[0], 1e-12);
  close(null, tubeWallEndCorrection(1, TUBE_WALL_END.gapOverR[1]), TUBE_WALL_END.ecOverR[1], 1e-12);
  // each elbow takes the sharp bend's correction (its mouth's gap changes too, so compare at one length and gap)
  const elbowed = vent({ nt: 1, dia: 4, len: 30 });
  const e1 = subTubeEndCorrection(box, "round1", elbowed, 0.75, DRV18, 1);
  const e0 = subTubeEndCorrection(box, "round1", { ...elbowed, len: 10 }, 0.75, DRV18, 0);
  assert.ok(e1 - e0 < SHARP_BEND_CORRECTION * 4 + 0.2, `${e1} vs ${e0}`);
  // a second tube beside it adds the mutual mass of the two mouths
  const two = subTubeEndCorrection(box, "round2", { ...one, nt: 2 }, 0.75, DRV18, 0);
  assert.ok(two > straight);
  // the planner's vent carries it, and the fewest elbows that fit
  const g = ventGeometry("round1", box, elbowed, 0.75, DRV18);
  assert.equal(g.elbows, modelTubeElbows(box, "round1", elbowed, 0.75, DRV18));
  assert.equal(g.elbows, 1);
  close(null, g.ec, e1, 1e-12);
});

test("exact solver: the shortest tube that tunes, over the elbow counts", () => {
  const box = { w: 24, h: 34, d: 21 };
  const v = vent({ nt: 2, dia: 4, len: 0, slotH: 3, throat: 2 });
  const vs = ventShape("round2", box, v, 0.75, DRV18);
  for (const Leff of [0.2, 0.5, 0.8]) {
    const { len, reached } = tubeLengthFor("round2", box, v, 0.75, DRV18, Leff);
    if (!reached) continue;
    const at = ventShape("round2", box, { ...v, len }, 0.75, DRV18);
    close(null, ductLengthFor(at, Leff), len, 1e-9, `Leff ${Leff}`);
  }
  assert.ok(vs.area > 0);
});

test("flared tubes run faster than sharp-edged vents", () => {
  close(null, ventSpeedLimit("round2", 23.5), 30, 1e-12);
  assert.equal(ventSpeedLimit("slots", 23.5), 23.5);
  assert.equal(ventSpeedLimit("vslots", 20), 20);
  assert.ok(FLARED_PORT_SPEED_RATIO > 1);
});

test("port tube catalog: every tube set has its pipe and an elbow entry, by area, and the sliders hold them", () => {
  const area = (t: (typeof PORT_TUBES)[number]) => t.nt * t.dia ** 2;
  PORT_TUBES.forEach((t, i) => {
    assert.ok(
      PORT_PIPES.some((p) => p.dia === t.dia),
      `pipe for ${t.dia}″`,
    );
    assert.ok(
      PORT_ELBOWS.some((p) => p.dia === t.dia),
      `elbow entry for ${t.dia}″`,
    );
    if (i) assert.ok(area(t) >= area(PORT_TUBES[i - 1]), `${t.nt} × ${t.dia}″ by area`);
    assert.ok(t.nt >= PA_SLIDERS.tubes.min && t.nt <= PA_SLIDERS.tubes.max);
    assert.ok(t.dia >= PA_SLIDERS.tubeDia.min && t.dia <= PA_SLIDERS.tubeDia.max);
  });
  assert.ok(PORT_PIPES.every((p) => p.src.startsWith("https://") && p.idIn < p.odIn));
  assert.ok(PORT_TUBES.some((t) => t.dia === 8) && PORT_TUBES.some((t) => t.dia === 10));
});

test("tube kit: pipe sticks and elbows priced, and no price where an elbow has no US vendor", () => {
  const box = { w: 24, h: 34, d: 21 };
  const kit = subTubeKit(box, "round2", vent({ nt: 2, dia: 4, len: 30 }), 0.75, DRV18);
  const pipe = PORT_PIPES.find((p) => p.dia === 4)!,
    elbow = PORT_ELBOWS.find((p) => p.dia === 4)!;
  assert.equal(kit.elbows, 1);
  assert.equal(kit.sticks, 1); // 60″ of tube from one 5 ft section
  close(null, kit.price!, pipe.price + 2 * elbow.price!, 1e-9);
  // 3-1/2″: the pipe is sold, the elbow isn't, so a bent tube has no price; a straight one does
  assert.equal(
    subTubeKit(box, "round2", vent({ nt: 2, dia: 3.5, len: 30 }), 0.75, DRV18).price,
    null,
  );
  assert.ok(subTubeKit(box, "round2", vent({ nt: 2, dia: 3.5, len: 10 }), 0.75, DRV18).price! > 0);
});

test("hi-fi: the same fold rule, and each elbow tunes the port higher", () => {
  const w = HIFI_WOOFERS.find((o) => o.id === "sb17nrx")!;
  const dim = { w: 9, h: 15, d: 11 };
  const straightMax = portMaxLength(dim, 0.75, { dia: 2, elbows: 0 });
  close(null, straightMax, 11 - 0.75 - 2, 1e-12);
  const len = straightMax + 1;
  assert.equal(hifiPortElbows(dim, 0.75, { n: 1, dia: 2, len }), 1);
  // the box model takes the elbow's bend correction: 1.46 r and one sharp bend
  const b = hifiBox(
    w,
    { box: "vented", dim, wall: 0.75, port: { n: 1, dia: 2, len }, wAmpW: 100 },
    2000,
  );
  const A = Math.PI;
  close(null, b!.vM!.Fb, ventTuning(b!.net, A, len, 1, 1.46 + SHARP_BEND_CORRECTION * 2).Fb, 1e-9);
});

test("tube fold: no elbow up a wall too short for a leg and the mouth's gap", () => {
  // 4″: a riser needs a leg (4) plus the lid gap (4) above the axis; 7.5 isn't enough, 8 is
  assert.equal(tubeSpan({ run: 20, rise: 7.5, stop: 0 }, 4, 1), null);
  assert.ok(tubeSpan({ run: 20, rise: 8, stop: 0 }, 4, 1));
  // a riser behind a stop deeper than the back wall allows has nowhere to stand
  assert.equal(tubeSpan({ run: 12, rise: 25, stop: 11 }, 4, 1), null);
});

test("tube fold: each count's own lengths, where the model takes it, never overlapping", () => {
  // straight to 16, one elbow from 15 (overlapping), two from 44: the elbow's own lengths start past the straight ones
  const own = ownSpans(
    ELBOW_COUNTS.map((e) => tubeSpan(room, 4, e)),
    0.25,
  );
  assert.deepEqual(
    own.map((o) => [o.e, o.span]),
    [
      [0, [0, 16]],
      [1, [16.25, 39]],
      [2, [44, 46]],
    ],
  );
  for (const { e, span } of own) assert.equal(tubeElbows(room, 4, span[0]), e);
});

test("tube kit: sticks hold whole pieces, not the tubes' total length", () => {
  // three 35″ pieces from 60″ sticks: one per stick, though 105″ is under two sticks
  assert.equal(sticksFor([35, 35, 35], 60), 3);
  assert.equal(sticksFor([30, 30, 20, 20], 60), 2);
  // a piece longer than a stick takes a whole one and its rest goes in with the others
  assert.equal(sticksFor([70, 50], 60), 2);
});

test("hi-fi: a port's return leg keeps its diameter of air from the baffle's inside face", () => {
  const room = hifiTubeRoom({ w: 9, h: 30, d: 14 }, 0.75);
  assert.equal(room.stop, 0.75);
  const span = tubeSpan(room, 2, 2);
  assert.ok(span);
  const legs = tubeLegs(room, 2, span[1], 2);
  assert.ok(legs.gap >= 2 - 1e-9, `${legs.gap}`);
});

test("ductFitMax is ductFit's fit, and the tubes' room reads the layout's highest axis", () => {
  for (const style of ["slots", "vslots", "vslot1", "round1", "round2", "round4"] as const)
    for (const box of [
      { w: 20, h: 24, d: 16 },
      { w: 24, h: 34, d: 21 },
      { w: 38, h: 22, d: 28 },
    ])
      for (const v of [
        vent({ slotH: 3, throat: 2, nt: 2, dia: 4, len: 0 }),
        vent({ slotH: 6, throat: 5, nt: 4, dia: 6, len: 0 }),
        vent({ slotH: 2, throat: 1, nt: 1, dia: 10, len: 0 }),
      ]) {
        const at = `${style} ${JSON.stringify(box)} ${JSON.stringify(v)}`;
        close(
          null,
          ductFitMax(box, style, v, 0.75, DRV18),
          ductFit(box, style, v, 0.75, DRV18).fit,
          1e-12,
          at,
        );
        const { tubes } = tubeLayout(box, style, v, 0.75, 18);
        if (tubes.length)
          close(
            null,
            tubeRoom(box, style, v, 0.75, DRV18).rise,
            box.h - 1.5 - Math.max(...tubes.map((p) => p.y)),
            1e-12,
            at,
          );
      }
});
