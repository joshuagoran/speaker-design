// The Speaker settings column's data model: bracing and back panel per Box chamber, the hardware split into handles and
// the input dish, the read adapter that brings an earlier build's saves up to date (so a saved design doesn't change),
// the fill levels, the fold summaries and the chamber's position fields.
import { describe, expect, test } from "vite-plus/test";
import type { SpeakerChamber, SpeakerSpec } from "../src/types";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { readSavedSpeaker, readSpeakerCopy } from "../src/lib/speaker/speakerSaves";
import {
  speakerFromSaved,
  speakerSnapshot,
  withHornTop,
} from "../src/pages/speaker/useSpeakerPage";
import { cabinetBuild } from "../src/lib/speaker/speakerBuild";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { bracingTaken, shellBackJoint } from "../src/lib/speaker/chamberBracing";
import { withoutDish } from "../src/lib/pa/hardware";
import { NO_HANDLES } from "../src/constants/hardware";
import { GLUED_BACK, NO_BRACING } from "../src/constants/bracing";
import { CABINET_TOP, CHAMBER_LOAD, VENT_KIND } from "../src/constants/speakerSpec";
import { FILL_LEVEL_PCT } from "../src/constants/speakerSteps";
import {
  bandRange,
  bandSummary,
  constructionSummary,
  driverSummary,
  fillBracingSummary,
  fillLevelOf,
  hornSettingsSummary,
  ventSummary,
} from "../src/pages/speaker/settingsSummaries";
import { atXForOffset, atYForOffset, chamberOffset } from "../src/pages/speaker/chamberPlace";
import { hornRoom, startingHorn, withChamberLoad } from "../src/pages/speaker/chamberLoad";
import { DEFAULT_SPEAKER_CHAMBER, EMPTY_SPEAKER } from "../src/lib/defaults";

const paSub = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
const th18 = templateSpeaker(SPEAKER_TEMPLATE.th18);

/**
 * The spec as an earlier build saved it: bracing and back panel on the cabinet (`braceStyle`, `braceTargetHz`,
 * `backJoint`, from its first chamber), one `hardware` field, and no bracing on the chambers.
 */
function oldSave(spec: SpeakerSpec): unknown {
  const { cabinet } = speakerSnapshot(spec).speaker;
  const { handles, inputDish, chambers, ...rest } = cabinet;
  const [first] = chambers;
  return {
    ...speakerSnapshot(spec).speaker,
    cabinet: {
      ...rest,
      ...first?.bracing,
      hardware: inputDish ? (handles ?? { model: NO_HANDLES, upIn: 0, backIn: 0 }) : null,
      chambers: chambers.map(({ bracing: _b, ...c }) => c),
    },
  };
}

describe("the read adapter brings an earlier build's saves up to date", () => {
  test("the cabinet's bracing and back panel go to each chamber; the old keys go", () => {
    const read = readSavedSpeaker(oldSave(paSub));
    expect(read).not.toBeNull();
    const cabinet = read?.cabinet;
    for (const key of ["braceStyle", "braceTargetHz", "backJoint", "hardware"])
      expect(cabinet && Reflect.has(cabinet, key)).toBe(false);
    expect(cabinet?.chambers.map((c) => c.bracing)).toEqual(
      paSub.cabinet.chambers.map((c) => c.bracing),
    );
  });

  test("an old save builds and models the same design as the spec it was saved from", () => {
    for (const spec of [paSub, templateSpeaker(SPEAKER_TEMPLATE.paMidHighBox)]) {
      const read = readSavedSpeaker(oldSave(spec));
      expect(read).not.toBeNull();
      if (!read) continue;
      expect(cabinetBuild(read.cabinet).lb).toBeCloseTo(cabinetBuild(spec.cabinet).lb, 9);
      const net = (s: Pick<SpeakerSpec, "cabinet" | "bands">) =>
        speakerResponse(s).chambers.map((c) => c.netLiters);
      expect(net(read)).toEqual(net(spec));
    }
  });

  test("the old hardware reads as handles and the input dish; No handles keeps only the dish", () => {
    const read = (hardware: unknown) => {
      const save = oldSave(paSub);
      const cabinet: unknown = Reflect.get(Object(save), "cabinet");
      Reflect.set(Object(cabinet), "hardware", hardware);
      return readSavedSpeaker(save)?.cabinet;
    };
    const both = read({ model: "30769", upIn: 1, backIn: 0 });
    expect(both?.handles).toEqual({ model: "30769", upIn: 1, backIn: 0 });
    expect(both?.inputDish).toBe(true);
    const dish = read({ model: NO_HANDLES, upIn: 0, backIn: 0 });
    expect(dish?.handles).toBeNull();
    expect(dish?.inputDish).toBe(true);
    const none = read(null);
    expect(none?.handles).toBeNull();
    expect(none?.inputDish).toBe(false);
  });

  test("a Box chamber's typed net air reads as worked out; a horn's rear chamber stays", () => {
    const save = oldSave(paSub);
    const cabinet: unknown = Reflect.get(Object(save), "cabinet");
    const chambers: unknown = Reflect.get(Object(cabinet), "chambers");
    Reflect.set(Object(Reflect.get(Object(chambers), 0)), "netLiters", 42);
    expect(readSavedSpeaker(save)?.cabinet.chambers[0]?.netLiters).toBeNull();
    const bin = templateSpeaker(SPEAKER_TEMPLATE.paV2SubBinOne);
    const [horn] = bin.cabinet.chambers;
    expect(horn?.load.kind).toBe(CHAMBER_LOAD.horn);
    expect(readSavedSpeaker(oldSave(bin))?.cabinet.chambers[0]?.netLiters).toBe(horn?.netLiters);
  });

  test("a save from this build reads back as it was; a library document and a stack's copy go through it", () => {
    const snap = speakerSnapshot(paSub);
    expect(readSavedSpeaker(snap.speaker)).toEqual(snap.speaker);
    const opened = speakerFromSaved({ id: "x", name: "Old", ...snap, speaker: oldSave(paSub) });
    expect(opened?.name).toBe("Old");
    expect(opened?.cabinet.chambers[0]?.bracing).toEqual(paSub.cabinet.chambers[0]?.bracing);
    expect(readSpeakerCopy(paSub)).toEqual(paSub);
    expect(readSavedSpeaker({ cabinet: {} })).toBeNull();
  });
});

describe("bracing and the back panel are each Box chamber's", () => {
  test("a horn chamber takes no added braces and a glued back", () => {
    const [chamber] = th18.cabinet.chambers;
    expect(chamber && bracingTaken(chamber)).toEqual({
      braceStyle: NO_BRACING,
      backJoint: GLUED_BACK,
      braceTargetHz: 0,
    });
    const [c] = cabinetBuild(th18.cabinet).chambers;
    expect((c?.bracing.windowIn3 ?? 1) + (c?.bracing.ribIn3 ?? 1)).toBe(0);
  });

  test("one shell's back is screwed when any chamber's is", () => {
    const withBack = (backJoint: SpeakerChamber["bracing"]["backJoint"]): SpeakerChamber => ({
      ...DEFAULT_SPEAKER_CHAMBER,
      bracing: { ...DEFAULT_SPEAKER_CHAMBER.bracing, backJoint },
    });
    const glued = withBack(GLUED_BACK);
    const screwed = withBack("screwed");
    expect(shellBackJoint([glued, glued])).toBe(GLUED_BACK);
    expect(shellBackJoint([glued, screwed])).toBe("screwed");
  });

  test("a horn chamber turns an arched top flat", () => {
    const arched = { ...paSub.cabinet, top: CABINET_TOP.arched };
    expect(withHornTop(arched)).toBe(arched);
    const horned = { ...th18.cabinet, top: CABINET_TOP.arched };
    expect(withHornTop(horned).top).toBe(CABINET_TOP.flat);
  });
});

describe("handles and the input dish are two settings", () => {
  test("handles alone: no dish in the plan, the price or the weight", () => {
    const both = cabinetBuild(paSub.cabinet).chambers[0]?.hardware;
    const handlesOnly = cabinetBuild({ ...paSub.cabinet, inputDish: false }).chambers[0]?.hardware;
    expect(both?.parts.some((p) => p.kind === "plate")).toBe(true);
    expect(handlesOnly?.parts.some((p) => p.kind === "plate")).toBe(false);
    expect(handlesOnly?.parts.some((p) => p.kind === "handle")).toBe(true);
    expect(handlesOnly && both && handlesOnly.price < both.price).toBe(true);
    if (both) expect(withoutDish(both).bought.length).toBeLessThan(both.bought.length);
  });

  test("the dish alone: no handles; neither: no hardware", () => {
    const dish = cabinetBuild({ ...paSub.cabinet, handles: null }).chambers[0]?.hardware;
    expect(dish?.parts.some((p) => p.kind === "handle")).toBe(false);
    expect(dish?.parts.some((p) => p.kind === "plate")).toBe(true);
    const none = cabinetBuild({ ...paSub.cabinet, handles: null, inputDish: false }).chambers[0];
    expect(none?.hardware).toBeNull();
  });
});

describe("fiber fill: four levels", () => {
  test("None, Lined, Half and Full are 0, 10, 15 and 25 %", () => {
    expect(FILL_LEVEL_PCT).toEqual({ none: 0, lined: 10, half: 15, full: 25 });
  });

  test("a saved value shows as the nearest level", () => {
    expect([0, 4, 6, 10, 12, 14, 15, 19, 22, 25, 40].map(fillLevelOf)).toEqual([
      "none",
      "none",
      "lined",
      "lined",
      "lined",
      "half",
      "half",
      "half",
      "full",
      "full",
      "full",
    ]);
  });
});

describe("the fold summaries keep to the key facts", () => {
  const bands = [
    { id: "low", name: "Low" },
    { id: "high", name: "High" },
  ];

  test("a driver: count, model and band; a coaxial's HF band too", () => {
    const [sub] = paSub.cabinet.chambers[0]?.drivers ?? [];
    expect(sub && driverSummary(sub, bands)).toMatch(/^1 × .+ · Low band$/);
    const fill = templateSpeaker(SPEAKER_TEMPLATE.fill);
    const [coax] = fill.cabinet.chambers[0]?.drivers ?? [];
    expect(coax && driverSummary(coax, bands)).toMatch(/ · Low band, HF High band$/);
    expect(sub && driverSummary({ ...sub, bands: ["gone"] }, bands)).toMatch(/ · No band$/);
  });

  test("the vent, the fill and bracing, the horn settings", () => {
    expect(ventSummary({ kind: VENT_KIND.sealed })).toBe("Sealed");
    expect(
      ventSummary({
        kind: VENT_KIND.vented,
        port: { shape: "round", n: 2, dia: 3, len: 6 },
        maxSpeedMs: 17,
      }),
    ).toBe("Ported · 2 × 3 in round, 6 in long");
    expect(
      fillBracingSummary({
        stuffingPct: 10,
        bracing: { braceStyle: "both", braceTargetHz: 200, backJoint: "screwed" },
      }),
    ).toBe("Lined walls · ribs and window braces to 200 Hz · screwed back");
    expect(
      fillBracingSummary({
        stuffingPct: 0,
        bracing: { braceStyle: NO_BRACING, braceTargetHz: 200, backJoint: GLUED_BACK },
      }),
    ).toBe("No fill · no braces · glued back");
    const horn = th18.cabinet.chambers[0]?.load;
    if (horn?.kind === CHAMBER_LOAD.horn)
      expect(hornSettingsSummary(horn.horn)).toMatch(/^Tapped · taps [\d.]+ \/ [\d.]+ in$/);
  });

  test("a band, its range, and the construction", () => {
    const band = {
      id: "high",
      name: "High",
      highpass: { hz: 1200, type: "LR24" as const },
      lowpass: null,
      levelDb: -3,
      drive: "active" as const,
      ampW: 100,
    };
    expect(bandSummary(band)).toBe("High · High-pass LR24 1200 Hz · Low-pass off · −3 dB · 100 W");
    expect(bandRange(band)).toBe("above 1200 Hz");
    expect(bandRange({ highpass: null, lowpass: null })).toBe("full range");
    expect(constructionSummary(EMPTY_SPEAKER.cabinet)).toBe(
      "Flush · ¾″ walls · flat top · no hardware",
    );
    expect(constructionSummary(paSub.cabinet)).toMatch(/^Frame · .+ · handles, input dish$/);
    // a speaker with a horn chamber shows no top
    expect(constructionSummary(th18.cabinet)).not.toMatch(/top/);
  });
});

describe("a chamber's position: from the cabinet's center and its bottom", () => {
  const lower = { at: { xIn: 0, yIn: 0 }, dims: { w: 20, h: 20, d: 16 } };
  const upper = { at: { xIn: 4, yIn: 20 }, dims: { w: 12, h: 10, d: 16 } };

  test("the fields read the chamber's center against the cabinet's", () => {
    expect(chamberOffset([lower, upper], 1)).toEqual({ x: 0, y: 20 });
    expect(chamberOffset([lower, { ...upper, at: { xIn: 8, yIn: 20 } }], 1)).toEqual({
      x: 4,
      y: 20,
    });
    expect(chamberOffset([lower], 0)).toEqual({ x: 0, y: 0 });
  });

  test("a value typed in puts the chamber there, also where it sticks out", () => {
    for (const x of [-6, -4, 0, 3, 4, 10, -12]) {
      const xIn = atXForOffset([lower, upper], 1, x);
      const moved = [lower, { ...upper, at: { ...upper.at, xIn } }];
      expect(chamberOffset(moved, 1).x).toBeCloseTo(x, 9);
    }
    expect(atYForOffset([lower, upper], 1, 25)).toBe(25);
    expect(atYForOffset([lower, upper], 1, -5)).toBe(0);
    // one chamber is the cabinet: it keeps its place
    expect(atXForOffset([lower], 0, 5)).toBe(0);
  });
});

describe("a horn picked before a driver", () => {
  test("an empty chamber sizes its horn from the driver it would get first", () => {
    const spec = templateSpeaker(SPEAKER_TEMPLATE.paSubBox);
    const [chamber] = spec.cabinet.chambers;
    expect(chamber).toBeDefined();
    if (!chamber) return;
    const [first] = chamber.drivers;
    const empty: SpeakerChamber = { ...chamber, drivers: [] };
    const room = hornRoom(spec.cabinet, empty, undefined);
    expect(startingHorn(empty, room)).toBeNull();
    expect(startingHorn(empty, room, first)).not.toBeNull();
    const horn = withChamberLoad(empty, CHAMBER_LOAD.horn, room, undefined, first);
    expect(horn.load.kind).toBe(CHAMBER_LOAD.horn);
    // the chamber stays empty: the driver only sizes the horn
    expect(horn.drivers).toEqual([]);
  });
});
