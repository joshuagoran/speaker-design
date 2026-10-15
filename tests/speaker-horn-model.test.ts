// A resized horn box still models, or says why not (#150: "No band has a modeled driver" after resizing the PA v2 sub
// bin). The cause was an Auto net air: the horn engine read the chamber's own `netLiters`, null for Auto, as a gap and
// dropped the band, while the settings showed the Auto air as if it worked. Auto now takes the box's clear volume less the
// horn's own air; a chamber the model still cannot run is named, with its reason and what to change.
import { describe, expect, test } from "vite-plus/test";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { cabinetBuild } from "../src/lib/speaker/speakerBuild";
import { hornFlare, speakerLayout } from "../src/lib/speaker/speakerLayout";
import { segmentsAirLiters } from "../src/lib/acoustics/hornSegments";
import { frontChamber, throatCones } from "../src/lib/speaker/hornThroat";
import { withCompressionRatio } from "../src/pages/speaker/hornSections";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { MODEL_GAP_TEXT, SPEAKER_TEXT } from "../src/constants/speakerPage";
import { CHAMBER_LOAD, HORN_PATH, SPEAKER_MODEL_GAP } from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { conesAreaCm2 } from "../src/lib/speaker/hornThroat";
import type { HornSegment, SpeakerChamber, SpeakerSpec } from "../src/types";

/** The sub bin with its box resized, its net air Auto, and its horn's sections and compression ratio changed. */
function resized(
  size: { w: number; h: number; d: number },
  horn: { sections: number; compression: number; lengthCm: number },
  netLiters: number | null = null,
): SpeakerSpec {
  const base = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinTwo);
  const [chamber] = base.cabinet.chambers;
  if (chamber.load.kind !== CHAMBER_LOAD.horn) throw new Error("the sub bin has a horn");
  const [first] = chamber.load.horn.segments;
  /** the mouth's area, cm²: the template's, as the box's face allows (the page clips a larger one) */
  const mouth = first.s2;
  const parts = Array.from({ length: horn.sections }, (_, i): HornSegment => {
    const from = first.s1 + ((mouth - first.s1) * i) / horn.sections;
    const to = first.s1 + ((mouth - first.s1) * (i + 1)) / horn.sections;
    return {
      profile: i % 2 ? HORN_PROFILE.exponential : HORN_PROFILE.parabolic,
      s1: from,
      s2: to,
      length: horn.lengthCm / horn.sections,
    };
  });
  const segments = withCompressionRatio(parts, conesAreaCm2(chamber.drivers), horn.compression);
  const next: SpeakerChamber = {
    ...chamber,
    dims: size,
    netLiters,
    load: { ...chamber.load, horn: { ...chamber.load.horn, segments } },
  };
  return { ...base, cabinet: { ...base.cabinet, chambers: [next] } };
}

const TEMPLATE_SIZE = { w: 46.5, h: 37.75, d: 30.5 };

describe("a resized horn box", () => {
  test("the repro: the sub bin's box and horn changed, net air Auto, still models its band", () => {
    const spec = resized({ w: 60, h: 48, d: 40 }, { sections: 3, compression: 3, lengthCm: 80 });
    const response = speakerResponse(spec);
    expect(response.bands).toHaveLength(1);
    expect(response.chambers[0].gaps).toEqual([]);
    expect(response.chambers[0].fb).not.toBeNull();
    expect(response.sum.every((p) => Number.isFinite(p.spl))).toBe(true);
  });

  test("Auto net air is the clear volume less the horn's own air, never less than a direct box's", () => {
    const spec = resized(TEMPLATE_SIZE, { sections: 1, compression: 2, lengthCm: 50 });
    const [chamber] = spec.cabinet.chambers;
    if (chamber.load.kind !== CHAMBER_LOAD.horn) throw new Error("a horn");
    const build = cabinetBuild(spec.cabinet).chambers[0];
    const cones = throatCones(chamber.drivers);
    const hornL =
      segmentsAirLiters(chamber.load.horn.segments) +
      (cones ? frontChamber(cones.cone, cones.count).liters : 0);
    expect(build.hornL).toBeCloseTo(hornL, 9);
    const response = speakerResponse(spec);
    const direct = speakerResponse({
      ...spec,
      cabinet: {
        ...spec.cabinet,
        chambers: [{ ...chamber, load: { kind: CHAMBER_LOAD.direct }, vent: chamber.vent }],
      },
    });
    // the horn's air is not the rear chamber's
    expect(direct.chambers[0].netLiters - response.chambers[0].netLiters).toBeGreaterThan(
      hornL * 0.9,
    );
    // an Auto horn box is a number the horn engine runs on, the same as setting it
    const set = speakerResponse(
      resized(
        TEMPLATE_SIZE,
        { sections: 1, compression: 2, lengthCm: 50 },
        response.chambers[0].netLiters,
      ),
    );
    expect(set.sum).toEqual(response.sum);
  });

  test("every size and shape: the band models, or each chamber's gap is named (never silent)", () => {
    for (const w of [30, TEMPLATE_SIZE.w, 70])
      for (const h of [14, TEMPLATE_SIZE.h, 60])
        for (const d of [12, TEMPLATE_SIZE.d, 48])
          for (const compression of [1, 2, 5])
            for (const sections of [1, 2, 4]) {
              const spec = resized({ w, h, d }, { sections, compression, lengthCm: 60 });
              const where = `${w}×${h}×${d}, ${sections} sections, ratio ${compression}`;
              const response = speakerResponse(spec);
              const named = response.chambers.some((c) => c.gaps.length > 0);
              expect(response.bands.length > 0 || named, `${where}: no silent drop`).toBe(true);
              // a horn that is buildable (its path fits) models
              const [placed] = speakerLayout(spec.cabinet).chambers;
              const flare = hornFlare(spec.cabinet, placed);
              if (flare?.path.fits && !flare.mouthClipped)
                expect(response.bands.length, `${where}: a buildable horn models`).toBe(1);
              expect(
                response.sum.every((p) => Number.isFinite(p.spl)),
                where,
              ).toBe(true);
            }
  });

  test("a path that does not fit still models (the page says it does not fit)", () => {
    const spec = resized({ w: 30, h: 14, d: 12 }, { sections: 2, compression: 2, lengthCm: 120 });
    const [placed] = speakerLayout(spec.cabinet).chambers;
    expect(hornFlare(spec.cabinet, placed)?.path.fits).toBe(false);
    expect(speakerResponse(spec).bands).toHaveLength(1);
  });

  test("a folded path models too", () => {
    const spec = resized({ w: 46.5, h: 60, d: 56 }, { sections: 1, compression: 2, lengthCm: 140 });
    const [chamber] = spec.cabinet.chambers;
    if (chamber.load.kind !== CHAMBER_LOAD.horn) throw new Error("a horn");
    const folded: SpeakerSpec = {
      ...spec,
      cabinet: {
        ...spec.cabinet,
        chambers: [
          {
            ...chamber,
            load: { ...chamber.load, horn: { ...chamber.load.horn, path: HORN_PATH.folded } },
          },
        ],
      },
    };
    expect(speakerResponse(folded).bands).toHaveLength(1);
  });
});

describe("a chamber the model leaves out is named", () => {
  test("a section with no length: the chamber, the reason and what to change", () => {
    const spec = resized(TEMPLATE_SIZE, { sections: 1, compression: 2, lengthCm: 0 });
    const response = speakerResponse(spec);
    expect(response.bands).toHaveLength(0);
    const [gaps] = response.chambers.map((c) => c.gaps);
    expect(gaps).toEqual(["segment"]);
    const note = SPEAKER_TEXT.chamberGap(1, MODEL_GAP_TEXT.segment);
    expect(note).toBe(
      "Chamber 1: a horn section has an area or a length that is not above zero. Set each section's start area, end area and length above zero.",
    );
  });

  test("every reason has a why and a what to change, each a sentence", () => {
    const ids = Object.keys(MODEL_GAP_TEXT);
    // every gap the model can name
    for (const id of [...Object.values(SPEAKER_MODEL_GAP), "segment", "vent", "driver", "tapped"])
      expect(ids).toContain(id);
    for (const { why, fix } of Object.values(MODEL_GAP_TEXT)) {
      expect(why.length).toBeGreaterThan(10);
      expect(why).not.toMatch(/[.]$/);
      expect(fix).toMatch(/^[A-Z].*[.]$/);
    }
  });
});
