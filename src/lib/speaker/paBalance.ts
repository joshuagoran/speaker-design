// The PA design's music balance as band Levels (docs/speaker-designer-plan.md, L3f "Band levels in the preset"). The PA
// page balances its bands at their limits: the mid `tilt` dB under the sub, the horn `hfTilt` dB under the mid, the
// weakest band setting the level (lib/pa/musicBalance `balancedLevelsOf`). A stack plays every band from one input, each
// at its Level on its 2.83 V response. So each band's Level is what puts it where the page puts it: the page's balanced
// level less the band's own response, read inside the band's passband, the highest Level 0 dB. It is worked out once,
// when a PA design becomes speakers and a stack, and saved in the bands; nothing works it out again after an edit. Pure.
import type { AdapterBandId, DesignLayers, PaPlannerDesign, SpeakerSpec } from "../../types";
import { derivePaDesign, paDesignInputsOf } from "../pa/paDesign";
import { balancedLevelsOf, coverageGeometry, musicBalanceOf } from "../pa/musicBalance";
import { bandSkirts, curveLevelAt } from "../pa/coverage";
import { speakerResponse } from "./speakerResponse";
import { SPEAKER_BAND } from "../../constants/speakerSpec";

/** The PA bands the balance sets, and the page's band that plays each. */
const PA_BANDS = {
  [SPEAKER_BAND.low]: "sub",
  [SPEAKER_BAND.mid]: "mid",
  [SPEAKER_BAND.high]: "horn",
} as const satisfies Partial<Record<AdapterBandId, "sub" | "mid" | "horn">>;
type PaBand = keyof typeof PA_BANDS;

/** How far inside its passband each band is read: the sub this far under the low crossover, the horn this far over the high one. */
const PASSBAND_STEP = 2;
/** The horn's reading at most this high, Hz: clear of the response's top end. */
const HORN_POINT_MAX_HZ = 8000;

/** Where each band's level is read, Hz: inside its passband, clear of its crossovers (where both sides agree). */
const bandPoints = (cfg: Pick<PaPlannerDesign, "xoLo" | "xoHi">): Record<PaBand, number> => ({
  [SPEAKER_BAND.low]: cfg.xoLo / PASSBAND_STEP,
  [SPEAKER_BAND.mid]: Math.sqrt(cfg.xoLo * cfg.xoHi),
  [SPEAKER_BAND.high]: Math.min(cfg.xoHi * PASSBAND_STEP * PASSBAND_STEP, HORN_POINT_MAX_HZ),
});

const isPaBand = (id: string): id is PaBand => Object.hasOwn(PA_BANDS, id);

/** Each PA band's level at its reading point in the stack, every Level at 0 dB, each member through its crossover. */
function stackBandLevels(
  layers: Pick<DesignLayers, "stack" | "speakers">,
  points: Record<PaBand, number>,
): Partial<Record<PaBand, number>> {
  const out: Partial<Record<PaBand, number>> = {};
  for (const member of layers.stack.members) {
    const speaker = layers.speakers.find((s) => s.id === member.speakerId);
    if (!speaker) continue;
    const flat = { ...speaker, bands: speaker.bands.map((b) => ({ ...b, levelDb: 0 })) };
    for (const band of speakerResponse(flat, { feed: member.crossover }).bands) {
      if (!isPaBand(band.id)) continue;
      const db = curveLevelAt(band.curve, points[band.id]);
      if (db !== null) out[band.id] = db;
    }
  }
  return out;
}

/**
 * Each PA band's Level for the design's music balance, dB, the highest 0; null when the page can't balance the design
 * (no mid model, or no stack geometry). A band the page leaves out (a sub or horn it can't model) gets none.
 */
export function paBandLevels(
  cfg: PaPlannerDesign,
  layers: Pick<DesignLayers, "stack" | "speakers">,
): Partial<Record<PaBand, number>> | null {
  const design = derivePaDesign(paDesignInputsOf(cfg));
  const geometry = coverageGeometry({ ...design, subBox: cfg.cDim });
  const balanced = balancedLevelsOf(
    {
      ...design,
      subMidCrossoverHz: cfg.xoLo,
      subHighpassHz: cfg.hpf,
      subHighpassType: cfg.hpType,
    },
    geometry,
    musicBalanceOf({
      subMidCrossoverHz: cfg.xoLo,
      midHornCrossoverHz: cfg.xoHi,
      midBelowSubDb: cfg.tilt,
      hornBelowMidDb: cfg.hfTilt,
    }),
  );
  if (!balanced || !geometry) return null;
  const skirts = bandSkirts(geometry);
  const points = bandPoints(cfg);
  const stack = stackBandLevels(layers, points);
  const raw: Partial<Record<PaBand, number>> = {};
  for (const band of [SPEAKER_BAND.low, SPEAKER_BAND.mid, SPEAKER_BAND.high] as const) {
    const pageBand = PA_BANDS[band];
    const curve = balanced.levels[pageBand];
    const page = curve && curveLevelAt(curve, points[band], skirts[pageBand]);
    const own = stack[band];
    if (page !== null && page !== undefined && own !== undefined) raw[band] = page - own;
  }
  const top = Math.max(...Object.values(raw));
  if (!Number.isFinite(top)) return null;
  const out: Partial<Record<PaBand, number>> = {};
  for (const [band, db] of Object.entries(raw)) if (isPaBand(band)) out[band] = db - top;
  return out;
}

/**
 * The PA design's layers with its music balance in the band Levels: each PA band at its Level (`paBandLevels`), and
 * every member's and placement's own level 0 (the balance is in the bands now). Unchanged where the page can't balance
 * the design.
 */
export function paBalancedLayers(cfg: PaPlannerDesign, layers: DesignLayers): DesignLayers {
  const levels = paBandLevels(cfg, layers);
  if (!levels) return layers;
  const speaker = (s: SpeakerSpec): SpeakerSpec => ({
    ...s,
    bands: s.bands.map((b) => {
      const db = isPaBand(b.id) ? levels[b.id] : undefined;
      return db === undefined ? b : { ...b, levelDb: db };
    }),
  });
  return {
    speakers: layers.speakers.map(speaker),
    stack: { ...layers.stack, members: layers.stack.members.map((m) => ({ ...m, levelDb: 0 })) },
    space: {
      ...layers.space,
      placements: layers.space.placements.map((p) => ({ ...p, levelDb: 0 })),
    },
  };
}
