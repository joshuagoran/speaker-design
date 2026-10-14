// Keep-up at the crossovers (lib/speaker/keepUp) against the PA page's mid and horn checks (lib/pa/chips): the golden PA
// designs read in as stacks with their music balance in the band Levels (the PA presets').
import { test } from "vite-plus/test";
import assert from "node:assert";
import { evaluateDesign } from "../src/lib/pa/optimize";
import { layersFromPa } from "../src/lib/speaker/paSpec";
import { paBalancedLayers } from "../src/lib/speaker/paBalance";
import { stackLimits, stackResponse } from "../src/lib/speaker/stackResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { keepUpChip, speakerKeepUps, stackKeepUps } from "../src/lib/speaker/keepUp";
import { configs } from "./golden-configs";
import { PA_FLOOR, paDesign } from "./speaker-cases";

/**
 * Inside one box, at one input (the horn against the mid in the mid box or the tower, the tower's mid against its sub),
 * the gap is the PA page's: on the golden designs (Oct 2026) within 0.15 dB.
 */
const IN_BOX_DB = 0.3;

/**
 * Between boxes (the sub box and the top box), the stack's crossover runs ahead of the amps, so near the crossover an
 * amp-limited band has the room its filter leaves it; the PA page takes each band's maximum output through its filter
 * at the amp's full voltage. The stack's gap is never below the PA page's (less this), and on the golden designs
 * (Oct 2026) 0.9 to 5.7 dB above it.
 */
const BETWEEN_BOXES_DB = 0.5;

test("keep-up: the golden PA designs' gaps at the crossovers against the PA page", () => {
  for (const c of configs) {
    const cfg = paDesign(c);
    const page = evaluateDesign(cfg);
    assert.ok(page, c.name);
    const read = paBalancedLayers(cfg, layersFromPa(cfg, { id: "pa", name: c.name }, PA_FLOOR));
    const response = stackResponse(read.stack, read.speakers);
    const limits = stackLimits(read.stack, response);
    const inBox = response.members.flatMap((m) => {
      if (!m) return [];
      const lim = speakerLimits(m.speaker, m.response, {
        feed: m.speaker.input,
        stackCrossover: true,
      });
      return speakerKeepUps(m.speaker.bands, m.response, lim);
    });
    const at = (hz: number) => inBox.find((k) => k.hz === hz);
    const horn = at(cfg.xoHi);
    assert.ok(horn && page.hornGap !== null, `${c.name}: horn`);
    assert.ok(
      Math.abs(horn.gapDb - page.hornGap) < IN_BOX_DB,
      `${c.name}: horn ${horn.gapDb} dB, page ${page.hornGap} dB`,
    );
    if (cfg.layout === "tower") {
      const mid = at(cfg.xoLo);
      assert.ok(mid, `${c.name}: tower mid`);
      assert.ok(
        Math.abs(mid.gapDb - page.midGap) < IN_BOX_DB,
        `${c.name}: mid ${mid.gapDb} dB, page ${page.midGap} dB`,
      );
    } else {
      const [mid] = stackKeepUps(read.stack, response, limits);
      assert.ok(mid && mid.lower === 0 && mid.upper === 1, `${c.name}: sub to top`);
      assert.ok(
        mid.gapDb > page.midGap - BETWEEN_BOXES_DB,
        `${c.name}: mid ${mid.gapDb} dB, page ${page.midGap} dB`,
      );
    }
  }
});

test("keep-up: the check warns past the PA page's slack, and is ok within it", () => {
  assert.equal(keepUpChip({ hz: 120, gapDb: -0.6 }, "Sub", "Top")[0], "warn");
  assert.equal(keepUpChip({ hz: 120, gapDb: -0.4 }, "Sub", "Top")[0], "ok");
});
