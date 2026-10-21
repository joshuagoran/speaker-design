// The Speaker page's templates (src/pages/speaker/speakerTemplates) and the L3e cabinet settings: each template builds a
// spec the speaker model takes whole, with the chambers, drivers and bands it promises; the PA v2 boxes reach the horn
// engine; and the construction, top and positions survive a save (the library stores the spec as JSON).
import { test } from "vite-plus/test";
import assert from "node:assert";
import { SPEAKER_TEMPLATES, templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import {
  mouthPlace,
  ventPlace,
  withMouthPosition,
  withVentPosition,
} from "../src/pages/speaker/speakerPlaces";
import { DEFAULT_VENTS } from "../src/pages/speaker/speakerParts";
import { hfBandOf, speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerLimits } from "../src/lib/speaker/speakerLimits";
import { frontChamber, throatCones } from "../src/lib/speaker/hornThroat";
import { hornDesignOf } from "../src/lib/speaker/hornDesign";
import { frontLoadedOf, roomOf } from "./horn-room";
import { baffleInsetIn } from "../src/lib/speaker/chamberAir";
import {
  drawsArchedTop,
  hornFlare,
  roundPortsAt,
  slotOpeningsAt,
  speakerLayout,
} from "../src/lib/speaker/speakerLayout";
import { hornModel } from "../src/lib/acoustics/hornModel";
import { hornGrid } from "./helpers";
import { takesHornMountAt } from "../src/lib/build/hornMount";
import { HORN_OPTIONS } from "../src/lib/data";
import { byIdOrThrow } from "../src/lib/tables";
import {
  DEFAULT_FILL,
  DEFAULT_HIFI,
  DEFAULT_MONITOR,
  DEFAULT_PA,
  PA_V2_MID_BOX,
  PA_V2_SUB_BIN,
} from "../src/lib/defaults";
import {
  SPEAKER_START_SPEAKER_NAMES,
  SPEAKER_TEMPLATE,
  type SpeakerTemplate,
} from "../src/constants/speakerStarts";
import {
  CABINET_CONSTRUCTION,
  CABINET_TOP,
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SPEAKER_BAND,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { crossoverSlopeName } from "../src/constants/crossovers";
import { TOWER_MID_HEIGHT_IN } from "../src/constants/paLayouts";
import { CATALOG_TABLE_NAMES } from "../src/constants/catalogTables";
import { PANEL } from "../src/constants/cutParts";
import { CM_PER_IN, CM2_PER_IN2, LITERS_PER_CUBIC_IN, MM_PER_IN } from "../src/constants/units";
import type { DriverKind, SpeakerChamber, SpeakerSpec } from "../src/types";
import { DRAFT_SPEAKER_ID } from "../src/pages/speaker/useSpeakerPage";

/** What each template promises: its chambers' driver kinds (each entry once per driver), and its bands. */
const EXPECTED: Record<SpeakerTemplate, { chambers: DriverKind[][]; bands: string[] }> = {
  empty: { chambers: [[]], bands: [SPEAKER_BAND.low] },
  paSubBox: { chambers: [[DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
  paMidHighBox: {
    chambers: [[DRIVER_KIND.mid, DRIVER_KIND.compression]],
    bands: [SPEAKER_BAND.mid, SPEAKER_BAND.high],
  },
  paTowerBaffleHorn: {
    chambers: [[DRIVER_KIND.sub], [DRIVER_KIND.mid], [DRIVER_KIND.compression]],
    bands: [SPEAKER_BAND.low, SPEAKER_BAND.mid, SPEAKER_BAND.high],
  },
  paTowerTopHorn: {
    chambers: [[DRIVER_KIND.sub], [DRIVER_KIND.mid, DRIVER_KIND.compression]],
    bands: [SPEAKER_BAND.low, SPEAKER_BAND.mid, SPEAKER_BAND.high],
  },
  hifiTwoWay: {
    chambers: [[DRIVER_KIND.woofer, DRIVER_KIND.tweeter]],
    bands: [SPEAKER_BAND.low, SPEAKER_BAND.high],
  },
  monitorCoax: { chambers: [[DRIVER_KIND.coaxial]], bands: [SPEAKER_BAND.low, SPEAKER_BAND.high] },
  monitorHorn: {
    chambers: [[DRIVER_KIND.woofer, DRIVER_KIND.tweeter]],
    bands: [SPEAKER_BAND.low, SPEAKER_BAND.high],
  },
  fill: { chambers: [[DRIVER_KIND.coaxial]], bands: [SPEAKER_BAND.low, SPEAKER_BAND.high] },
  paV2SubBinOne: { chambers: [[DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
  paV2SubBinTwo: { chambers: [[DRIVER_KIND.sub, DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
  paV2MidBox: { chambers: [[DRIVER_KIND.mid, DRIVER_KIND.mid]], bands: [SPEAKER_BAND.mid] },
  th18: { chambers: [[DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
  genericSub18: { chambers: [[DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
  genericDualSub18: { chambers: [[DRIVER_KIND.sub, DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
  genericTop12: {
    chambers: [[DRIVER_KIND.mid, DRIVER_KIND.compression]],
    bands: [SPEAKER_BAND.low, SPEAKER_BAND.high],
  },
  genericTop15: {
    chambers: [[DRIVER_KIND.mid, DRIVER_KIND.compression]],
    bands: [SPEAKER_BAND.low, SPEAKER_BAND.high],
  },
  genericHornSub18: { chambers: [[DRIVER_KIND.sub]], bands: [SPEAKER_BAND.low] },
};

/** The spec as a save stores it and the library opens it again: JSON, undefined fields dropped. */
const saved = (spec: SpeakerSpec): SpeakerSpec => JSON.parse(JSON.stringify(spec));

/** The model of a spec with its own input range, as the Speaker page runs it. */
const modelOf = (spec: SpeakerSpec) => {
  const response = speakerResponse(spec, { feed: spec.input });
  return { response, limits: speakerLimits(spec, response, { feed: spec.input }) };
};

/** A chamber's round port; fails when it has none. */
function roundPortOf(chamber: SpeakerChamber) {
  assert.ok(chamber.vent.kind === VENT_KIND.vented);
  const { port } = chamber.vent;
  assert.ok(port.shape !== PORT_SHAPE.slot && port.shape !== PORT_SHAPE.duct);
  return port;
}

/** A template's one chamber. */
function onlyChamber(spec: SpeakerSpec): SpeakerChamber {
  assert.equal(spec.cabinet.chambers.length, 1);
  const [chamber] = spec.cabinet.chambers;
  return chamber;
}

test("speaker templates: each builds a draft spec the model takes whole, with its chambers, drivers and bands", () => {
  assert.deepEqual([...SPEAKER_TEMPLATES].sort(), Object.values(SPEAKER_TEMPLATE).sort());
  for (const template of SPEAKER_TEMPLATES) {
    const spec = templateSpeaker(template);
    assert.equal(spec.id, DRAFT_SPEAKER_ID, template);
    assert.equal(spec.name, SPEAKER_START_SPEAKER_NAMES[template], template);
    // a template sets only the first values: the spec carries no template or role
    assert.deepEqual(
      Object.keys(spec).sort(),
      ["bands", "cabinet", "id", "input", "look", "name"],
      template,
    );
    const expected = EXPECTED[template];
    assert.deepEqual(
      spec.cabinet.chambers.map((c) => c.drivers.flatMap((d) => Array(d.count).fill(d.kind))),
      expected.chambers,
      template,
    );
    assert.deepEqual(
      spec.bands.map((b) => b.id),
      expected.bands,
      template,
    );
    const { response, limits } = modelOf(spec);
    assert.deepEqual(response.gaps, [], `${template}: no model gaps`);
    for (const c of response.chambers) assert.deepEqual(c.gaps, [], template);
    // every band with a driver is modeled, on finite numbers
    const fed = new Set(spec.cabinet.chambers.flatMap((c) => c.drivers.flatMap((d) => d.bands)));
    assert.deepEqual(
      response.bands.map((b) => b.id),
      spec.bands.filter((b) => fed.has(b.id)).map((b) => b.id),
      template,
    );
    for (const b of response.bands) {
      assert.ok(Number.isFinite(b.passbandDb), `${template} ${b.id}`);
      assert.ok(
        b.curve.every((o) => Number.isFinite(o.spl)),
        `${template} ${b.id}`,
      );
    }
    assert.equal(limits.bands.length, response.bands.length, template);
  }
});

test("speaker templates: every band is crossed where it hands over, and no sub or HF band plays unfiltered", () => {
  for (const template of SPEAKER_TEMPLATES) {
    const spec = templateSpeaker(template);
    const drivers = spec.cabinet.chambers.flatMap((c) => c.drivers);
    const hfBands = new Set(drivers.map(hfBandOf));
    const subBands = new Set(
      drivers.filter((d) => d.kind === DRIVER_KIND.sub).flatMap((d) => d.bands),
    );
    spec.bands.forEach((band, i) => {
      const at = `${template} ${band.id}`;
      // a band hands over to the next one up with its own low-pass, and takes over from the one below with its own
      // high-pass (the input range filters every band, so it is no crossover between them)
      if (i < spec.bands.length - 1) assert.ok(band.lowpass, `${at}: no low-pass to the next band`);
      if (i > 0) assert.ok(band.highpass, `${at}: no high-pass from the band below`);
      // an HF section never plays the lows, a sub never plays the mids: its own filter or the input range's
      if (hfBands.has(band.id))
        assert.ok(band.highpass ?? spec.input.highpass, `${at}: HF section with no high-pass`);
      if (subBands.has(band.id))
        assert.ok(band.lowpass ?? spec.input.lowpass, `${at}: sub with no low-pass`);
    });
  }
});

test("speaker templates: the fill's coaxial crosses at its HF section's recommended crossover", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.fill);
  const xo = DEFAULT_FILL.driver.hf?.xo;
  assert.ok(xo, "the default fill's coaxial has a crossover");
  const filter = { hz: xo, type: crossoverSlopeName(DEFAULT_HIFI.crossoverOrder) };
  const [low, high] = spec.bands;
  assert.deepEqual([low.highpass, low.lowpass], [null, filter]);
  assert.deepEqual([high.highpass, high.lowpass], [filter, null]);
});

test("speaker templates: the PA v2 sub bin's drivers share one throat, and the horn engine models it", () => {
  for (const [template, count] of [
    [SPEAKER_TEMPLATE.paV2SubBinOne, 1],
    [SPEAKER_TEMPLATE.paV2SubBinTwo, 2],
  ] as const) {
    const spec = templateSpeaker(template);
    const chamber = onlyChamber(spec);
    assert.equal(chamber.load.kind, CHAMBER_LOAD.horn);
    assert.equal(chamber.netLiters, PA_V2_SUB_BIN.rearLiters * count, "~324 L for two");
    assert.ok(chamber.vent.kind === VENT_KIND.vented);
    const { port } = chamber.vent;
    assert.ok(port.shape === PORT_SHAPE.slot && port.folded);
    // each slot runs the clear face's height (an open slot always runs it): ~600 cm² of slot per driver (the sizes in
    // eighths of an inch)
    const [placed] = speakerLayout(spec.cabinet).chambers;
    const openings = slotOpeningsAt(placed, port, spec.cabinet.panel.thicknessIn);
    assert.equal(openings.length, port.n);
    assert.ok(openings.every((o) => Math.abs(o.h - placed.clear.h) < 1e-9));
    const slotCm2 = openings.reduce((sum, o) => sum + o.w * o.h, 0) * CM_PER_IN * CM_PER_IN;
    assert.ok(Math.abs(slotCm2 / count / 600 - 1) < 0.05, `${slotCm2.toFixed(0)} cm²`);
    // the mouth fits the clear face: wider than square, not clipped
    const flare = hornFlare(spec.cabinet, speakerLayout(spec.cabinet).chambers[0]);
    assert.ok(flare && !flare.mouthClipped, `${template}: the mouth fits`);
    // Auto net air counts both slots and their shelves
    const auto: SpeakerChamber = { ...chamber, netLiters: null };
    const oneSlot: SpeakerChamber = { ...auto, vent: { ...chamber.vent, port: { ...port, n: 1 } } };
    const airOf = (c: SpeakerChamber) =>
      speakerResponse(
        { ...spec, cabinet: { ...spec.cabinet, chambers: [c] } },
        { feed: spec.input },
      ).chambers[0].netLiters;
    const slotL = port.h * placed.clear.h * port.len * LITERS_PER_CUBIC_IN;
    assert.ok(airOf(oneSlot) - airOf(auto) > slotL, "the second slot takes its air");
    const result = hornDesignOf(chamber, { count: 1, angle: 2 }, roomOf(chamber, placed.clear));
    const design = frontLoadedOf(result);
    assert.equal(design.drivers, count);
    assert.equal(design.driver, PA_V2_SUB_BIN.sub.ts);
    assert.equal(design.rear.liters, PA_V2_SUB_BIN.rearLiters * count);
    // one straight-sided (parabolic) flare at the box's inside height: from the throat the compression ratio sets (the
    // cones' area over it), narrower than the cones, to the face between the slots
    assert.equal(design.segments.length, 1);
    const [flareSegment] = design.segments;
    assert.equal(flareSegment.profile, HORN_PROFILE.parabolic);
    assert.equal(flareSegment.length, PA_V2_SUB_BIN.flareCm);
    const insideH = chamber.dims.h - 2 * spec.cabinet.panel.thicknessIn;
    const conesCm2 = PA_V2_SUB_BIN.sub.ts.Sd * count;
    assert.ok(
      Math.abs(flareSegment.s1 - conesCm2 / PA_V2_SUB_BIN.compression) < 1e-9,
      `${template}: the throat`,
    );
    // the front chamber: the cones' air under the walls' back edges
    const cones = throatCones(chamber.drivers);
    assert.ok(cones && cones.count === count, template);
    assert.equal(design.throatChamber, frontChamber(cones.cone, count).liters, template);
    assert.ok(
      flare && Math.abs(flareSegment.s2 / CM2_PER_IN2 - flare.mouth.w * flare.mouth.h) < 1e-9,
    );
    assert.ok(flare && Math.abs(flare.mouth.h - insideH) < 1e-9, "the mouth is the inside height");
    const model = hornModel(design, hornGrid(), 2.83);
    assert.ok(model, "the engine takes it");
    // tuned to ~35 Hz, as the plan's model
    assert.ok(model.fb !== null && model.fb > 33 && model.fb < 37, `Fb ${model.fb}`);
    assert.ok(model.curve.every((p) => Number.isFinite(p.spl)));
    // the band keeps its 30 Hz subsonic; the input range stops at the PA's crossover to the mids
    assert.deepEqual(spec.bands[0].highpass, PA_V2_SUB_BIN.subsonic);
    assert.equal(spec.input.lowpass?.hz, DEFAULT_PA.xoLo);
    assert.equal(spec.cabinet.construction, CABINET_CONSTRUCTION.frameInset);
  }
});

test("speaker templates: the PA v2 mid box has two 10″ in one throat, tuned to ~95 Hz, crossed at the R-OSSE", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paV2MidBox);
  const chamber = onlyChamber(spec);
  const result = hornDesignOf(
    chamber,
    { count: 1, angle: 2 },
    roomOf(chamber, speakerLayout(spec.cabinet).chambers[0].clear),
  );
  const design = frontLoadedOf(result);
  assert.equal(design.drivers, PA_V2_MID_BOX.drivers);
  // the throat from the compression ratio, the front chamber from the cones under the walls
  const conesCm2 = PA_V2_MID_BOX.mid.ts.Sd * PA_V2_MID_BOX.drivers;
  assert.ok(Math.abs(design.segments[0].s1 - conesCm2 / PA_V2_MID_BOX.compression) < 1e-9);
  const cones = throatCones(chamber.drivers);
  assert.ok(cones);
  assert.equal(design.throatChamber, frontChamber(cones.cone, cones.count).liters);
  const model = hornModel(design, hornGrid(), 2.83);
  assert.ok(model && model.fb !== null && model.fb > 90 && model.fb < 100, `Fb ${model?.fb}`);
  const [cone1, cone2] = chamber.drivers;
  assert.ok(
    Math.abs(cone2.position.yIn - cone1.position.yIn - PA_V2_MID_BOX.coneSpacingMm / MM_PER_IN) <
      1e-9,
    "~280 mm apart",
  );
  assert.equal(spec.bands[0].lowpass?.hz, PA_V2_MID_BOX.hfHorn.hf?.minXo);
  assert.equal(spec.input.highpass?.hz, DEFAULT_PA.xoLo);
});

test("speaker templates: the booth monitors cross to the subs at 70 Hz LR24 and cover 90–100°", () => {
  for (const template of [SPEAKER_TEMPLATE.monitorCoax, SPEAKER_TEMPLATE.monitorHorn]) {
    const spec = templateSpeaker(template);
    assert.deepEqual(spec.input, { highpass: { hz: 70, type: "LR24" }, lowpass: null }, template);
    assert.equal(DEFAULT_MONITOR.highpass.hz, 70);
  }
  const coax = onlyChamber(templateSpeaker(SPEAKER_TEMPLATE.monitorCoax));
  assert.equal(coax.drivers[0].driverId, DEFAULT_MONITOR.coax.id);
  const cov = DEFAULT_MONITOR.coax.hf?.cov ?? 0;
  assert.ok(cov >= 90 && cov <= 100, `${cov}°`);
  // the 8″ + horn: the horn in the baffle, tight above the woofer, crossed at 2.5 kHz
  const spec = templateSpeaker(SPEAKER_TEMPLATE.monitorHorn);
  const horn = onlyChamber(spec);
  const woofer = horn.drivers.find((d) => d.kind === DRIVER_KIND.woofer);
  const tweeter = horn.drivers.find((d) => d.kind === DRIVER_KIND.tweeter);
  assert.ok(woofer && tweeter?.horn);
  assert.equal(tweeter.horn.hornId, DEFAULT_MONITOR.waveguide.id);
  assert.equal(tweeter.horn.placement, HORN_PLACEMENT.baffle);
  assert.ok(tweeter.position.yIn > woofer.position.yIn);
  assert.ok(tweeter.position.yIn < horn.dims.h);
  const covH = DEFAULT_MONITOR.waveguide.hf.covH;
  assert.ok(covH >= 90 && covH <= 100, `${covH}°`);
  assert.equal(spec.bands[0].lowpass?.hz, DEFAULT_MONITOR.crossoverHz);
});

test("speaker templates: the tower with the horn on top keeps an adjustable mid chamber and a flat top", () => {
  const spec = templateSpeaker(SPEAKER_TEMPLATE.paTowerTopHorn);
  const [sub, mid] = spec.cabinet.chambers;
  assert.equal(mid.dims.h, TOWER_MID_HEIGHT_IN);
  assert.equal(mid.at.yIn, sub.dims.h);
  assert.equal(spec.cabinet.top, CABINET_TOP.flat);
  const horn = mid.drivers.find((d) => d.kind === DRIVER_KIND.compression);
  assert.ok(horn?.horn);
  assert.equal(horn.horn.placement, HORN_PLACEMENT.top);
  // the mouth on the front plane
  assert.equal(horn.position.yIn, 0);
  const catalog = byIdOrThrow(HORN_OPTIONS, horn.horn.hornId, CATALOG_TABLE_NAMES.horns);
  assert.equal(
    horn.horn.mount,
    takesHornMountAt(catalog, HORN_PLACEMENT.top) ? DEFAULT_PA.hornMount : null,
  );
  // its height is a setting: a taller mid chamber has more air
  const air = (s: SpeakerSpec) => speakerResponse(s, { feed: s.input }).chambers[1].netLiters;
  const taller: SpeakerSpec = {
    ...spec,
    cabinet: {
      ...spec.cabinet,
      chambers: [sub, { ...mid, dims: { ...mid.dims, h: mid.dims.h + 4 } }],
    },
  };
  assert.ok(air(taller) > air(spec) + 10);
  // the PA's own tower keeps its horn in the baffle under the arched top, and draws the arch
  const arched = templateSpeaker(SPEAKER_TEMPLATE.paTowerBaffleHorn);
  assert.equal(arched.cabinet.top, CABINET_TOP.arched);
  assert.ok(drawsArchedTop(arched.cabinet, speakerLayout(arched.cabinet)));
});

test("speaker settings: construction, top, a vent's and a mouth's positions survive a save", () => {
  // construction and top
  const base = templateSpeaker(SPEAKER_TEMPLATE.monitorCoax);
  const framed: SpeakerSpec = {
    ...base,
    cabinet: {
      ...base.cabinet,
      construction: CABINET_CONSTRUCTION.frameInset,
      insetIn: 0.5,
      top: CABINET_TOP.arched,
    },
  };
  const reopened = saved(framed);
  assert.deepEqual(reopened, framed);
  assert.equal(baffleInsetIn(reopened.cabinet), 0.5);
  // a flush box has no inset, whatever the field holds
  assert.equal(
    baffleInsetIn({ ...reopened.cabinet, construction: CABINET_CONSTRUCTION.flushBox }),
    0,
  );

  // a round port: Auto is the Hi-fi rule's row; Manual moves it, to the back too
  const chamber = onlyChamber(base);
  const placed = speakerLayout(base.cabinet).chambers[0];
  const auto = ventPlace(base.cabinet, placed);
  assert.ok(auto && auto.position === undefined);
  assert.equal(auto.what, VENT_KIND.vented);
  assert.equal(auto.auto.panel, PANEL.baffle);
  const rule = roundPortsAt(placed, roundPortOf(chamber));
  assert.ok(Math.abs(auto.auto.yIn - rule.spots[0].y) < 1e-9);
  const position = { panel: PANEL.back, xIn: 1, yIn: 4 } as const;
  const moved: SpeakerSpec = {
    ...base,
    cabinet: {
      ...base.cabinet,
      chambers: [{ ...chamber, vent: withVentPosition(chamber.vent, position) }],
    },
  };
  const back = saved(moved);
  assert.deepEqual(back, moved);
  const backPlaced = speakerLayout(back.cabinet).chambers[0];
  assert.deepEqual(ventPlace(back.cabinet, backPlaced)?.position, position);
  const ports = roundPortsAt(backPlaced, roundPortOf(onlyChamber(back)));
  assert.equal(ports.panel, PANEL.back);
  assert.ok(!ports.moved);
  // Auto again: the field is gone, not stored empty
  const cleared = withVentPosition(onlyChamber(back).vent, undefined);
  assert.ok(cleared.kind === VENT_KIND.vented && !("position" in cleared.port));

  // radiators: Auto stacks them on the back
  const radiators: SpeakerChamber = { ...chamber, vent: DEFAULT_VENTS.radiator };
  const radiatorPlace = ventPlace(base.cabinet, { ...placed, chamber: radiators });
  assert.ok(radiatorPlace);
  assert.equal(radiatorPlace.what, VENT_KIND.radiator);
  assert.equal(radiatorPlace.auto.panel, PANEL.back);
  const setRadiators = withVentPosition(radiators.vent, { ...radiatorPlace.auto, xIn: 0.5 });
  assert.ok(setRadiators.kind === VENT_KIND.radiator && setRadiators.position?.xIn === 0.5);

  // the PA's ports keep their rule's place: flared tubes, the letterbox, side ducts
  const paSub = onlyChamber(templateSpeaker(SPEAKER_TEMPLATE.paSubBox));
  const paCabinet = templateSpeaker(SPEAKER_TEMPLATE.paSubBox).cabinet;
  assert.equal(ventPlace(paCabinet, speakerLayout(paCabinet).chambers[0]), null);
  assert.equal(withVentPosition(paSub.vent, position), paSub.vent);

  // a horn mouth: Auto on the clear face's center; Manual moves it, inside the face
  const bin = templateSpeaker(SPEAKER_TEMPLATE.paV2MidBox);
  const binPlaced = speakerLayout(bin.cabinet).chambers[0];
  const mouth = mouthPlace(bin.cabinet, binPlaced);
  assert.ok(mouth && mouth.position === undefined);
  const { clear } = binPlaced;
  assert.ok(Math.abs(mouth.auto.yIn - (clear.y + clear.h / 2 - binPlaced.y0)) < 1e-9);
  const binChamber = onlyChamber(bin);
  const mouthAt = { xIn: 0, yIn: mouth.auto.yIn + 0.5 };
  const setMouth: SpeakerSpec = {
    ...bin,
    cabinet: {
      ...bin.cabinet,
      chambers: [{ ...binChamber, load: withMouthPosition(binChamber.load, mouthAt) }],
    },
  };
  const reopenedBin = saved(setMouth);
  assert.deepEqual(reopenedBin, setMouth);
  assert.deepEqual(
    mouthPlace(reopenedBin.cabinet, speakerLayout(reopenedBin.cabinet).chambers[0])?.position,
    mouthAt,
  );
  // far past the face: drawn moved inside it
  const far = withMouthPosition(binChamber.load, { xIn: 100, yIn: 0 });
  const farFlare = hornFlare(bin.cabinet, { ...binPlaced, chamber: { ...binChamber, load: far } });
  assert.ok(farFlare?.mouthMoved);
  // and back to Auto
  const auto2 = withMouthPosition(far, undefined);
  assert.ok(auto2.kind === CHAMBER_LOAD.horn && !("mouthPosition" in auto2.horn));
});
