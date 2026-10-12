// The Speaker page's HF pad check (src/pages/speaker/speakerChips bandChips) against the Fills page's (lib/pa/chips
// fillChips, lib/pa/calc fillSystem): every catalog coaxial in the Fills page's starting fill, as a speaker.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { fillSystem, hfLimitWatts } from "../src/lib/pa/calc";
import { fillChips } from "../src/lib/pa/chips";
import { speakerFromFill } from "../src/lib/speaker/fillSpec";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { bandChips } from "../src/pages/speaker/speakerChips";
import { DEFAULT_FILL } from "../src/lib/defaults";
import { FILL_OPTIONS } from "../src/lib/data";
import { SPEAKER_BAND } from "../src/constants/speakerSpec";
import type { Chip, SpeakerSpec } from "../src/types";

/** The spec with its HF band's Level at `levelDb`. */
const withHfLevel = (spec: SpeakerSpec, levelDb: number): SpeakerSpec => ({
  ...spec,
  bands: spec.bands.map((b) => (b.id === SPEAKER_BAND.high ? { ...b, levelDb } : b)),
});

test("speaker fill chips: with the Fills page's pad, the HF reaches its rating where the Fills page says", () => {
  let checked = 0;
  for (const driver of FILL_OPTIONS) {
    const state = { ...DEFAULT_FILL, driver };
    const page = fillSystem(driver, {
      boxType: state.boxType,
      dim: state.boxDims,
      port: state.portSpec,
      hp: state.highpassHz,
      hpOrder: state.highpassOrder,
      ampW: state.ampWatts,
      portMax: state.maxPortAirSpeedMs,
    });
    if (!page || page.hfLimW === null || !driver.hf) continue;
    const spec = withHfLevel(speakerFromFill(state, { id: "fill", name: driver.name }), -page.pad);
    const limits = speakerLimits(spec, speakerResponse(spec));
    const hf = limits.drivers.find((d) => d.band === SPEAKER_BAND.high);
    assert.ok(hf, driver.name);
    // the Fills page takes the full program rating; the speaker model derates it below its rating's frequency
    const watts = hfLimitWatts(hf.programW, hf.imp, page.pad);
    assert.ok(Math.abs(watts - page.hfLimW * hf.derate) < 1e-6 * page.hfLimW, driver.name);
    // the same verdict as the Fills page's chip, on its amp and on one past its limit
    for (const ampW of [state.ampWatts, Math.ceil(page.hfLimW * 1.5)]) {
      const amped: SpeakerSpec = { ...spec, bands: spec.bands.map((b) => ({ ...b, ampW })) };
      const ours = bandChips(amped, speakerLimits(amped, speakerResponse(amped)))
        .flatMap((b) => b.chips)
        .find((c) => c[3] === "speakerHfPad");
      const theirs: Chip | undefined = fillChips({
        drv: { size: driver.size },
        dim: state.boxDims,
        Fb: null,
        Qtc: null,
        hp: state.highpassHz,
        hpOrder: state.highpassOrder,
        portLimited: false,
        portMax: state.maxPortAirSpeedMs,
        f3: page.f3,
        hf: driver.hf,
        hfLimW: page.hfLimW * hf.derate,
        ampW,
        pad: page.pad,
      }).find((c) => c[3] === "fillHfHeadroom");
      assert.ok(ours && theirs, driver.name);
      assert.equal(ours[0], theirs[0], `${driver.name} at ${ampW} W`);
    }
    checked++;
  }
  assert.ok(checked > 10, `${checked} coaxials checked`);
});
