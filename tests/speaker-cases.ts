// The designs and readers the speaker model's tests share (tests/speaker-response.test.ts,
// tests/speaker-limits.test.ts, and others): the Hi-fi and PA designs through the L1 adapters, the PA sub box model of
// them, and curve comparisons on a log-frequency axis.
import assert from "node:assert";
import { midBoxOf, type PaConfig } from "./pa-configs";
import type { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { speakerIdentity } from "../src/lib/speaker/specParts";
import type { PaFloor } from "../src/lib/speaker/paSpec";
import { DEFAULT_COVERAGE_LAYOUT } from "../src/lib/acoustics/coverageLayout";
import { needsWaveguide } from "../src/lib/speaker/twoWay";
import { subSystem } from "../src/lib/acoustics/boxModels";
import { towerMidDims } from "../src/lib/speaker/tower";
import { DEFAULT_HARDWARE } from "../src/lib/build/hardware";
import { panelNominalNear } from "../src/lib/build/panel";
import {
  HIFI_COAXES,
  HIFI_TWEETERS,
  HIFI_WAVEGUIDES,
  MID_OPTIONS,
  SUB_OPTIONS,
} from "../src/lib/data";
import { DEFAULT_HIFI, DEFAULT_PA } from "../src/lib/defaults";
import { HORN_MOUNT_DEFAULT } from "../src/constants/hornMount";
import {
  PORT_SHAPE,
  SPEAKER_PART,
  SPEAKER_RESPONSE_VOLTS,
  VENT_KIND,
} from "../src/constants/speakerSpec";
import type {
  BandId,
  DesignLayers,
  FrequencyPoint,
  HifiDesignState,
  PaPlannerDesign,
  SpeakerChamber,
  SpeakerSpec,
} from "../src/types";

/** A level relative to the model's drive: the engines run at the amp's voltage, the model at 2.83 V. */
export const atModelVolts = (volts: number) => 20 * Math.log10(volts / SPEAKER_RESPONSE_VOLTS);

/** A curve's level at `f`, read between its points on a log-frequency axis; null outside it. */
export function levelAt(curve: readonly FrequencyPoint[], f: number): number | null {
  if (f < curve[0].f || f > curve[curve.length - 1].f) return null;
  const i = Math.max(
    1,
    curve.findIndex((o) => o.f >= f),
  );
  const a = curve[i - 1],
    b = curve[i];
  const k = b.f === a.f ? 0 : Math.log(f / a.f) / Math.log(b.f / a.f);
  return a.spl + k * (b.spl - a.spl);
}

/** How far below a reference curve's highest point the comparison still reads, dB: deeper, only the skirts are left. */
export const WINDOW_DB = 30;

/**
 * The largest difference between the model's curve and a reference, dB: over the model's frequencies inside the
 * reference's span (and `fmax`), where the reference is within WINDOW_DB of its highest point.
 */
export function maxDiff(
  model: readonly FrequencyPoint[],
  ref: readonly FrequencyPoint[],
  fmax = Infinity,
) {
  const top = Math.max(...ref.map((o) => o.spl));
  let most = 0;
  for (const o of model) {
    if (o.f > fmax) continue;
    const r = levelAt(ref, o.f);
    if (r === null || r < top - WINDOW_DB) continue;
    most = Math.max(most, Math.abs(o.spl - r));
  }
  return most;
}

export function bandCurve(response: ReturnType<typeof speakerResponse>, id: BandId) {
  const band = response.bands.find((b) => b.id === id);
  assert.ok(band, `a ${id} band`);
  return band.curve;
}

const waveguideTweeter = HIFI_TWEETERS.find((t) => needsWaveguide(t) && !t.ownGuide);
const roundGuide = HIFI_WAVEGUIDES.find((h) => !h.rect);
const coax = HIFI_COAXES.find((c) => c.tweeter);
assert.ok(waveguideTweeter && roundGuide && coax?.tweeter, "the catalog has each case");

/** Hi-fi designs covering each box kind, port shape, a waveguide, a coaxial, LR48 and passive drive. */
export const hifiCases: { name: string; state: HifiDesignState }[] = [
  { name: "DEFAULT_HIFI", state: DEFAULT_HIFI },
  { name: "sealed", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.sealed } },
  { name: "radiator", state: { ...DEFAULT_HIFI, boxType: VENT_KIND.radiator } },
  {
    name: "slot",
    state: { ...DEFAULT_HIFI, portSpec: { shape: PORT_SHAPE.slot, n: 1, h: 1, len: 6 } },
  },
  {
    name: "two ports, LR48",
    state: { ...DEFAULT_HIFI, portSpec: { n: 2, dia: 1.5, len: 5 }, crossoverOrder: 8 },
  },
  {
    name: "compression driver on a round waveguide",
    state: {
      ...DEFAULT_HIFI,
      tweeter: waveguideTweeter,
      selectedWaveguide: roundGuide,
      crossoverHz: 1600,
    },
  },
  { name: "coaxial", state: { ...DEFAULT_HIFI, woofer: coax.woofer, tweeter: coax.tweeter } },
  { name: "passive", state: { ...DEFAULT_HIFI, drive: "passive" } },
];

/** The default coverage layout: the stacks' spots, left then right (they don't move the speakers' responses). */
export const PA_FLOOR: PaFloor = DEFAULT_COVERAGE_LAYOUT;

/** A saved or synthetic PA design with every field set (as tests/speaker-spec.test.ts reads it). */
export function paDesign(c: PaConfig): PaPlannerDesign {
  // older saved configs can lack some fields; they fall back to the default PA design
  const { xoLo, xoHi, tilt, hfTilt, ampW, mAmpW, hfAmpW, hpType, portMax, wall, inset, layout } =
    DEFAULT_PA;
  const cfg = {
    xoLo,
    xoHi,
    tilt,
    hfTilt,
    ampW,
    mAmpW,
    hfAmpW,
    hpType,
    portMax,
    wall,
    inset,
    layout,
    ...c,
    xoLoOrder: c.xoLoOrder === 8 ? (8 as const) : (4 as const),
    xoHiOrder: c.xoHiOrder === 8 ? (8 as const) : (4 as const),
  };
  return {
    ...cfg,
    mDim: midBoxOf(c),
    panel: c.panel ?? panelNominalNear(cfg.wall),
    hornMount: c.hornMount ?? HORN_MOUNT_DEFAULT,
    spacerH: c.spacerH ?? DEFAULT_PA.spacerH,
    // the seeds predate the handles and plates, so the defaults
    hardware: c.hardware ?? DEFAULT_HARDWARE,
    divider: c.divider ?? DEFAULT_PA.divider,
  };
}

/** A speaker of the design by part, with the crossover its stack feeds it. */
export function speakerAndFeed(
  read: DesignLayers,
  part: (typeof SPEAKER_PART)[keyof typeof SPEAKER_PART],
) {
  const id = speakerIdentity(read.stack, part).id;
  const spec = read.speakers.find((s) => s.id === id);
  const member = read.stack.members.find((m) => m.speakerId === id);
  assert.ok(spec && member, part);
  return { spec, feed: member.crossover };
}

/** The spec with one chamber's net air set. */
export const withNet = (
  spec: SpeakerSpec,
  chamber: SpeakerChamber,
  netLiters: number,
): SpeakerSpec => ({
  ...spec,
  cabinet: {
    ...spec.cabinet,
    chambers: spec.cabinet.chambers.map((c) => (c === chamber ? { ...c, netLiters } : c)),
  },
});

/** The PA sub box model of a design: its net air, tuning, curve, and limits. */
export function paSubModel(cfg: PaPlannerDesign) {
  const sub = SUB_OPTIONS.find((o) => o.id === cfg.sub);
  const mid = MID_OPTIONS.find((o) => o.id === cfg.mid);
  assert.ok(sub && mid);
  const s = subSystem(sub, mid, {
    subBox: cfg.cDim,
    midDims: cfg.layout === "tower" ? towerMidDims(cfg.cDim) : cfg.mDim,
    wall: cfg.wall,
    inset: cfg.inset,
    portStyle: cfg.portStyle,
    cVent: cfg.cVent,
    hpf: cfg.hpf,
    hpType: cfg.hpType,
    ampW: cfg.ampW,
    portMax: cfg.portMax,
    layout: cfg.layout,
    braceStyle: cfg.braceStyle,
    hardware: cfg.hardware,
    xoLo: cfg.xoLo,
  });
  assert.ok(s.mdl);
  return { s, sub: s.mdl };
}
