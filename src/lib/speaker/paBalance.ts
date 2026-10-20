// The PA design's music balance as band Levels. The PA
// page balances its bands at their limits: the mid `tilt` dB under the sub, the horn `hfTilt` dB under the mid, the
// weakest band setting the level. A stack plays every band from one input, each
// at its Level on its 2.83 V response. So each band's Level is what puts it where the page puts it: the page's balanced
// level less the band's own response, read inside the band's passband, the highest Level 0 dB. It is worked out once
// and saved in the bands: for the PA presets ahead of time, in their data (src/data/presets/pa-band-levels.ts, `vp run
// preset-levels`); for the current PA design or an old save when it is read in. Nothing works it out again after an
// edit. Pure.
import type { AdapterBandId, DesignLayers, SpeakerSpec } from "../../types";
import { SPEAKER_BAND } from "../../constants/speakerSpec";

/** The PA bands the balance sets, and the page's band that plays each. */
const PA_BANDS = {
  [SPEAKER_BAND.low]: "sub",
  [SPEAKER_BAND.mid]: "mid",
  [SPEAKER_BAND.high]: "horn",
} as const satisfies Partial<Record<AdapterBandId, "sub" | "mid" | "horn">>;
type PaBand = keyof typeof PA_BANDS;

const isPaBand = (id: string): id is PaBand => Object.hasOwn(PA_BANDS, id);

/** Each PA band's Level, dB, by band id: the music balance as the bands save it. */
export type PaBandLevels = Partial<Record<PaBand, number>>;

/**
 * The layers with these Levels in their PA bands, and every member's and placement's own level 0 (the balance is in the
 * bands now). A band without a Level keeps its own.
 */
export function withBandLevels(layers: DesignLayers, levels: PaBandLevels): DesignLayers {
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
