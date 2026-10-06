import { test } from "vite-plus/test";
import assert from "node:assert";
import fs from "node:fs";
import {
  evaluateDesign,
  designProblems,
  paSearchDesign,
  rangeOf,
  roomRequiredSpl,
  bandOutputDb,
  ventSizesFor,
  SUB_BAND_HZ,
  SUB_BOX_RANGE,
  VENT_STYLES,
} from "../src/lib/pa/optimize";
import {
  optimizePaStackExact,
  paExactScore,
  paExactGridText,
  runPaExactJob,
} from "../src/lib/pa/optimizeExact";
import {
  gridIndexNear,
  sealedQtc,
  sealedMid,
  midGridIndexNear,
  highpassTable,
  outputAt,
  solveShape,
  subCircuit,
  subLimitOf,
  subNetLiters,
  ventShape,
  ventedCurves,
} from "../src/lib/pa/exactSub";
import {
  ampVoltage,
  boxInternalLiters,
  midSystem,
  nearestPoint,
  slotFolds,
  subGeometry,
  subSystem,
  subWeightLb,
  ventSpeedLimit,
} from "../src/lib/pa/calc";
import { ductFit, ductFits, subBaffleFits } from "../src/lib/pa/chips";
import { goalKeeps } from "../src/lib/optimizer/goalKeeps";
import { PA_SLIDERS, PA_THROAT_MAX_VSLOT1 } from "../src/constants/paSliders";
import { vent, DRV18 } from "./helpers";
import { modelTubeElbows } from "../src/lib/pa/tubes";
import { LIMIT_CHIP_IDS } from "../src/constants/chipIds";
import { CD_OPTIONS, HORN_OPTIONS, MID_BOXES, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import type {
  Dims3,
  PaDesignConfig,
  PaEvaluation,
  PaExactGrid,
  PaGoal,
  PaOptimizerCurrent,
  PaOptimizerInput,
  VentSpec,
} from "../src/types";

// boundary: the seed file is saved configurations (older ones lack mDim; all carry ampW)
const seeds = JSON.parse(
  fs.readFileSync(new URL("../data/configs-seed.json", import.meta.url), "utf8"),
) as (Omit<PaOptimizerCurrent, "mDim" | "ampW"> & { mDim?: Dims3; ampW: number; name: string })[];
const pick = (name: string): PaOptimizerCurrent => {
  const c = seeds.find((x) => x.name === name);
  assert.ok(c, name);
  return {
    layout: "stack",
    inset: 0.75,
    wall: 0.75,
    hpType: "BW24",
    portMax: 20,
    tilt: 6,
    hfTilt: 6,
    joint: "butt",
    mDim: { ...(MID_BOXES.find((b) => b.id === c.midBox) || MID_BOXES[0]).box },
    ...c,
  };
};

// a seeded generator, so a failure names the same designs every run
const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test("exact PA search: one shared curve per volume and tuning gives the planner's numbers for every vent", () => {
  const rnd = random(11);
  const mid = MID_OPTIONS[0];
  const volts = ampVoltage(3000);
  let n = 0;
  for (let k = 0; k < 300; k++) {
    const sub = SUB_OPTIONS[Math.floor(rnd() * SUB_OPTIONS.length)];
    const style = VENT_STYLES[Math.floor(rnd() * VENT_STYLES.length)];
    const sizes = ventSizesFor(style);
    const t = rnd() < 0.5 ? 0.75 : 0.5;
    const box = {
      w: 20 + Math.floor(rnd() * 15),
      h: 22 + Math.floor(rnd() * 15),
      d: 16 + rnd() * 12,
    };
    const cVent: VentSpec = {
      slotH: 3,
      nt: 2,
      dia: 4,
      throat: 2,
      ...sizes[Math.floor(rnd() * sizes.length)],
      len: 4 + rnd() * 8,
    };
    const hpf = 20 + Math.floor(rnd() * 20);
    const cfg = {
      subBox: box,
      midDims: { w: 15, h: 15, d: 15 },
      wall: t,
      inset: 0.75,
      portStyle: style,
      cVent,
      layout: "stack" as const,
    };
    // the geometry: net volume, vent area and end correction
    const g = subGeometry(sub, mid, cfg);
    const vs = ventShape(style, box, cVent, t, sub);
    assert.ok(Math.abs(vs.area - g.port.area) < 1e-12, "vent area");
    assert.ok(Math.abs(vs.ec - g.port.ec) < 1e-12, `${style} end correction`);
    const net = subNetLiters(style, box, t, 0.75, cVent, vs.area, sub.ts.disp, undefined);
    assert.ok(Math.abs(net - g.netL) < 1e-12 * g.netL, `${style} net volume`);
    // the model: F3, clean output, limit, and the level at a crossover, from a curve that never saw the vent
    const s = subSystem(sub, mid, { ...cfg, hpf, hpType: "BW24", ampW: 3000, portMax: 23.5 });
    if (!s.mdl) continue;
    n++;
    const c = subCircuit(sub.ts, volts, SUB_BAND_HZ);
    const [cs] = ventedCurves(
      c,
      s.netL,
      s.mdl.Fb,
      [highpassTable(hpf, "BW24")],
      [gridIndexNear(100)],
    );
    const lim = subLimitOf(cs, vs.area, sub.ts, volts, ventSpeedLimit(style, 23.5));
    assert.strictEqual(cs.f3, s.mdl.f3, "F3");
    assert.ok(
      Math.abs(outputAt(cs, lim, volts) - bandOutputDb(s.mdl, s.lim, s.AMP_V)) < 1e-9,
      "output",
    );
    assert.strictEqual(lim.who, s.lim.who, "what limits it");
    assert.ok(Math.abs(lim.V / s.lim.V - 1) < 1e-12, "music limit");
  }
  assert.ok(n > 250, "most designs modelled");
});

test("exact PA search: a box solved for a volume and tuning gives them back in the planner's geometry", () => {
  const rnd = random(5);
  const mid = MID_OPTIONS[0];
  let n = 0;
  for (let k = 0; k < 300; k++) {
    const sub = SUB_OPTIONS[Math.floor(rnd() * SUB_OPTIONS.length)];
    const style = VENT_STYLES[Math.floor(rnd() * VENT_STYLES.length)];
    const sizes = ventSizesFor(style);
    const t = rnd() < 0.5 ? 0.75 : 0.5;
    const vent: VentSpec = {
      slotH: 3,
      nt: 2,
      dia: 4,
      throat: 2,
      ...sizes[Math.floor(rnd() * sizes.length)],
      len: 0,
    };
    const VbL = 60 + rnd() * 140,
      Fb = 24 + rnd() * 20;
    const fixed = { w: 20 + Math.floor(rnd() * 15), h: 22 + Math.floor(rnd() * 15), d: 0 };
    const sol = solveShape(
      { style, drv: sub, vent, t, inset: 0.75, disp: sub.ts.disp, VbL, Fb },
      fixed,
      "d",
      20,
    );
    if (!sol || sol.len <= 0) continue;
    n++;
    const g = subGeometry(sub, mid, {
      subBox: sol.box,
      midDims: { w: 15, h: 15, d: 15 },
      wall: t,
      inset: 0.75,
      portStyle: style,
      cVent: { ...vent, len: sol.len },
      layout: "stack",
    });
    assert.ok(Math.abs(g.netL / VbL - 1) < 1e-9, `${style} net volume`);
    assert.ok(Math.abs(g.Fb / Fb - 1) < 1e-9, `${style} tuning`);
    assert.strictEqual(sol.box.w, fixed.w);
    assert.strictEqual(sol.box.h, fixed.h);
  }
  assert.ok(n > 150, `solved ${n}`);
});

test("exact PA search: the vent's most end correction bounds every duct length, and len + ec rises with the length", () => {
  // the search prunes box pairs with the duct length at this bound (deepShape): a correction past it would drop a design;
  // and solveShape takes a single root of len + ec(len) = Leff, straight or folded
  let n = 0;
  for (const t of [0.5, 0.75])
    for (const w of [PA_SLIDERS.subW.min, 26, PA_SLIDERS.subW.max])
      for (const h of [PA_SLIDERS.subH.min, 30, PA_SLIDERS.subH.max])
        for (const d of [PA_SLIDERS.subD.min, 20, PA_SLIDERS.subD.max])
          for (const style of ["slots", "vslots", "vslot1", "round2"] as const) {
            const { min, max } =
              style === "slots"
                ? PA_SLIDERS.slotH
                : style === "round2"
                  ? PA_SLIDERS.tubeDia
                  : PA_SLIDERS.throat;
            for (const size of [
              min,
              (min + max) / 2,
              style === "vslot1" ? PA_THROAT_MAX_VSLOT1 : max,
            ]) {
              const box = { w, h, d },
                base =
                  style === "slots"
                    ? { slotH: size }
                    : style === "round2"
                      ? { nt: 2, dia: size }
                      : { throat: size };
              const most = ventShape(style, box, vent(base), t, DRV18, {
                folded: false,
                most: true,
              }).ec;
              // len + ec at the last length, and whether that one folded or took another elbow (its correction starts
              // afresh)
              let prevLeff = -Infinity,
                prevFolded = 0;
              for (let len = PA_SLIDERS.ductLen.min; len <= PA_SLIDERS.ductLen.max; len += 0.25) {
                const v = vent({ ...base, len }),
                  folded =
                    style === "slots"
                      ? Number(slotFolds(box, v, t))
                      : style === "round2"
                        ? modelTubeElbows(box, style, v, t, DRV18)
                        : 0,
                  ec = ventShape(style, box, v, t, DRV18).ec,
                  at = `${style} ${size} ${t} ${w}x${h}x${d} ${len}`;
                assert.ok(Number.isFinite(ec) && ec <= most, at);
                if (prevFolded === folded) assert.ok(len + ec > prevLeff, at);
                prevLeff = len + ec;
                prevFolded = folded;
                n++;
              }
            }
          }
  assert.ok(n > 10_000);
});

test("exact PA search: the tower mid's Qtc is midSystem's, and falls as the box grows", () => {
  const rnd = random(3);
  for (let k = 0; k < 200; k++) {
    const mid = MID_OPTIONS[Math.floor(rnd() * MID_OPTIONS.length)];
    const t = rnd() < 0.5 ? 0.75 : 0.5;
    const box = { w: 14 + Math.floor(rnd() * 26), h: 15.5, d: 8 + rnd() * 24 };
    const cfg = {
      wall: t,
      inset: 0.75,
      xoLo: 120,
      xoHi: 900,
      xoLoOrder: 4,
      xoHiOrder: 4,
      mAmpW: 400,
    } as const;
    const ms = midSystem(mid, { ...cfg, midDims: box });
    assert.ok(ms.mdl, mid.id);
    assert.strictEqual(sealedQtc(mid, box, t, 0.75, {}), ms.mdl.Qtc, `${mid.id} Qtc`);
    const bigger = { ...box, w: box.w + 1, d: box.d + rnd() };
    assert.ok(sealedQtc(mid, bigger, t, 0.75, {}) <= ms.mdl.Qtc, `${mid.id} falls`);
  }
});

test("exact PA search: the mid read at single points gives midSystem's checks and levels", () => {
  const rnd = random(13);
  let n = 0;
  for (let k = 0; k < 300; k++) {
    const mid = MID_OPTIONS[Math.floor(rnd() * MID_OPTIONS.length)];
    const t = rnd() < 0.5 ? 0.75 : 0.5;
    const box = { w: 12 + Math.floor(rnd() * 28), h: 12 + rnd() * 14, d: 8 + rnd() * 24 };
    const xoLo = [80, 90, 100, 110, 120, 140][Math.floor(rnd() * 6)];
    const xoHi = [800, 900, 1000, 1200, 1500, 1900][Math.floor(rnd() * 6)];
    const xoLoOrder = rnd() < 0.5 ? 4 : 8,
      xoHiOrder = rnd() < 0.5 ? 4 : 8;
    const mAmpW = 50 + Math.floor(rnd() * 1000);
    const ms = midSystem(mid, {
      midDims: box,
      wall: t,
      inset: 0.75,
      xoLo,
      xoHi,
      xoLoOrder,
      xoHiOrder,
      mAmpW,
    });
    assert.ok(ms.mdl && ms.max, mid.id);
    const mm = sealedMid(mid, box, t, 0.75, mAmpW, xoLo, {});
    assert.strictEqual(mm.Qtc, ms.mdl.Qtc, "Qtc");
    // the F3 where it is at or under the crossover, else past it
    if (ms.mdl.f3 <= xoLo) {
      n++;
      assert.strictEqual(mm.f3, ms.mdl.f3, "F3");
    } else assert.ok(mm.f3 > xoLo, "F3 past the crossover");
    for (const f of [xoLo, xoHi]) {
      const got = mm.at(midGridIndexNear(f, xoHi), xoLo, xoHi, xoLoOrder, xoHiOrder);
      assert.strictEqual(got.sig, nearestPoint(ms.mdl.curve, f).spl, `${f} Hz signal`);
      assert.strictEqual(got.max, nearestPoint(ms.max, f).spl, `${f} Hz at the limit`);
    }
  }
  assert.ok(n > 30, `F3 under the crossover ${n} times`);
});

// ---- the brute force: every design on a small grid, one by one with the planner's own model ----

// side ducts in a box heavier than it needs, with the sub, plywood, vent style, highpass, crossovers, amps and mid
// and horn locked; the width fixed, the height up to 24″; the compression drivers free
const fixture = (): PaOptimizerInput => {
  const seed = pick("light block");
  const cur = { ...seed, cDim: { w: 30, h: 24, d: 26 }, cVent: { ...seed.cVent, len: 10 } };
  return {
    cur,
    room: 1000,
    maxLb: 125,
    budget: 1100,
    locks: {
      sub: true,
      wall: true,
      vent: true,
      hpf: true,
      xoLo: true,
      xoHi: true,
      ampW: true,
      mAmpW: true,
      hfAmpW: true,
      mid: true,
      horn: true,
      subDim: { w: "exact", h: "max" },
      midDim: { w: "exact", h: "exact", d: "exact" },
    },
  };
};
const smallGrid: PaExactGrid = {
  volumeStep: 0.08,
  minNetL: 20,
  fb: { from: 28, to: 36, step: 8 },
  minDuctIn: 2,
};
// every design on the fixture's grid, as the grid is stated: each rung and tuning in every box of whole-inch width and
// height whose depth holds it, each vent size, your box as it is, each horn
function gridDesigns(input: PaOptimizerInput, grid: PaExactGrid): PaDesignConfig[] {
  const cur = paSearchDesign(input);
  const sub = SUB_OPTIONS.find((o) => o.id === cur.sub);
  assert.ok(sub);
  const dims = input.locks?.subDim ?? {};
  const sr = {
    w: rangeOf(dims.w, cur.cDim.w, SUB_BOX_RANGE.w),
    h: rangeOf(dims.h, cur.cDim.h, SUB_BOX_RANGE.h),
    d: rangeOf(dims.d, cur.cDim.d, SUB_BOX_RANGE.d),
  };
  const steps = ([lo, hi]: [number, number]) => {
    const v: number[] = [];
    for (let x = lo; x <= hi; x++) v.push(x);
    if (v[v.length - 1] !== hi) v.push(hi);
    return v;
  };
  const t = cur.wall,
    style = cur.portStyle;
  const cap = Math.ceil(input.maxLb * 1.1);
  const top = boxInternalLiters(sr.w[1], sr.h[1], sr.d[1], t, cur.inset);
  const subs: { cDim: Dims3; cVent: VentSpec }[] = [{ cDim: cur.cDim, cVent: cur.cVent }];
  for (const size of ventSizesFor(style))
    for (let fb = grid.fb.from; fb <= grid.fb.to; fb += grid.fb.step)
      for (let V = grid.minNetL; V <= top; V *= 1 + grid.volumeStep)
        for (const w of steps(sr.w))
          for (const h of steps(sr.h)) {
            const vent = { ...cur.cVent, ...size, len: 0 };
            const sol = solveShape(
              { style, drv: sub, vent, t, inset: cur.inset, disp: sub.ts.disp, VbL: V, Fb: fb },
              { w, h, d: 0 },
              "d",
              (sr.d[0] + sr.d[1]) / 2,
            );
            if (!sol || sol.box.d < sr.d[0] - 1e-9 || sol.box.d > sr.d[1] + 1e-9) continue;
            const v = { ...vent, len: sol.len };
            if (
              sol.len < grid.minDuctIn ||
              !ductFits(ductFit(sol.box, style, v, t, sub).spans, sol.len)
            )
              continue;
            if (!subBaffleFits(sol.box, style, v, t, sub)) continue;
            if (subWeightLb(sol.box, t, sub.lb) > cap) continue;
            subs.push({ cDim: sol.box, cVent: v });
          }
  const base = { ...cur };
  // the priced drivers with a published spec, as the search takes them (a driver whose throat doesn't match the horn
  // fails the checks; those are left out here to save time)
  const exit = HORN_OPTIONS.find((h) => h.id === cur.horn)?.exit;
  const cds = CD_OPTIONS.filter((cd) => cd.hf && cd.price != null && cd.exit === exit);
  return subs.flatMap((s) => cds.map((cd): PaDesignConfig => ({ ...base, ...s, cd: cd.id })));
}
// the quick search's ranking and comparisons (lib/pa/optimize), and what each goal keeps
const warnings = (m: PaEvaluation) =>
  (["sub", "mid", "horn"] as const).reduce(
    (a, k) =>
      a +
      m.chips[k].filter(
        ([kind, , , id]) => kind === "warn" && !LIMIT_CHIP_IDS.has(id) && id !== "subWeight",
      ).length,
    0,
  );
const changes = (c: PaDesignConfig, cur: PaDesignConfig) =>
  (["sub", "mid", "cd", "horn", "portStyle", "wall"] as const).filter((k) => c[k] !== cur[k])
    .length;
const objective: Record<PaGoal, (m: PaEvaluation, ch: number) => number> = {
  cheaper: (m, ch) => 1e6 * warnings(m) + m.price + 1e-6 * m.heaviest + 1e-8 * ch,
  lighter: (m, ch) => m.heaviest + 0.5 * ch + 2 * warnings(m),
  lower: (m, ch) => m.f3 + 0.1 * ch + 0.7 * warnings(m),
  louder: (m, ch) => -m.out + 0.05 * ch + 0.5 * warnings(m),
};
const beats: Record<PaGoal, (m: PaEvaluation, c: PaEvaluation) => boolean> = {
  cheaper: (m, c) => m.price < c.price,
  lighter: (m, c) => m.heaviest <= c.heaviest - 3,
  lower: (m, c) => m.f3 <= c.f3 - 2,
  louder: (m, c) => m.out >= c.out + 1,
};

// The first card is at least as good as every design on the grid (it can be better: Improve's designs, off the grid,
// join the pool too).
test("exact PA search: no design on its grid beats the first card, checked one by one with the planner's model", () => {
  const input = fixture();
  const cur = paSearchDesign(input);
  const curM = evaluateDesign(cur);
  assert.ok(curM && designProblems(curM, input).length === 0, "your design passes");
  const designs = gridDesigns(input, smallGrid)
    .map((c) => ({ c, m: evaluateDesign(c) }))
    .filter(
      (d): d is { c: PaDesignConfig; m: PaEvaluation } =>
        d.m !== null && designProblems(d.m, input).length === 0,
    );
  assert.ok(designs.length > 500, `a grid to search (${designs.length} designs pass)`);
  const target = Math.max(curM.out, roomRequiredSpl(1000));
  const keep = goalKeeps(target, curM.f3);
  for (const goal of ["cheaper", "lighter", "lower", "louder"] as const) {
    const ok = designs.filter(
      ({ m }) => m.out >= keep[goal].db && m.f3 <= keep[goal].f3 && beats[goal](m, curM),
    );
    const out = optimizePaStackExact({ ...input, goals: [goal] }, undefined, { grid: smallGrid });
    if (!ok.length) {
      assert.ok(out.goalMissing, `${goal}: nothing beats your design, and the page says so`);
      continue;
    }
    const best = Math.min(...ok.map(({ c, m }) => objective[goal](m, changes(c, cur))));
    const k = out.cards[0];
    assert.ok(k && !out.goalMissing, `${goal}: a card`);
    const m = evaluateDesign(k.config);
    assert.ok(m, `${goal}: the card is modelled`);
    const got = objective[goal](m, changes(k.config, cur));
    if (process.env.EXACT_DEBUG)
      console.log(
        goal,
        designs.length,
        ok.length,
        best,
        got,
        JSON.stringify(k.config.cDim),
        k.config.cVent.throat,
        k.config.horn,
        out.cards.map((c) => c.label).join(" / "),
      );
    assert.ok(
      got <= best + 1e-6,
      `${goal}: the first card (${got}) is at least the best on the grid (${best})`,
    );
  }
});

test("exact PA search: the model step split across workers gives exactly what one run gives", () => {
  // every sub driver the budget allows, so each share has some
  const f = fixture();
  const input = {
    ...f,
    goals: ["louder" as const, "cheaper" as const],
    locks: { ...f.locks, sub: false },
  };
  const one = optimizePaStackExact(input, undefined, { grid: smallGrid });
  // as the workers hand their shares back: copied, not shared
  const shares = structuredClone(
    [0, 1, 2].map((part) => paExactScore(input, part, 3, undefined, smallGrid)),
  );
  assert.ok(
    shares.every((share) => share.some((x) => x.rows.length > 0)),
    "every share models some curves",
  );
  const split = optimizePaStackExact(input, undefined, { grid: smallGrid, scored: shares });
  assert.ok(one.cards.length > 1, "cards to compare");
  assert.deepStrictEqual({ ...split, stats: null }, { ...one, stats: null });
  // the job runner's score job gives the same shares
  const job = runPaExactJob({ kind: "score", input, part: 1, parts: 3, grid: smallGrid });
  assert.ok(job.kind === "scored", "a score job returns its share");
  assert.deepStrictEqual(structuredClone(job.scored), shares[1]);
  assert.ok(paExactGridText(input).length > 3, "the grid in words");
});
