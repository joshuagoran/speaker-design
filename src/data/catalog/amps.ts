// Power amplifiers: the racks' amps and the others considered, as the Notes page, the racks and the signal-path drawing
// describe them (all of them format their names, power figures and prices from here). Watts are per channel,
// continuous, all channels driven; gain is voltage gain in dB; limiterW is the speaker-power range the limiter accepts;
// usedPrice is what the racks pay for a used one (US dollars; the date is on each series). The compiler checks every field (AmpModel and
// AmpSeries in src/types.ts). To add a model, append it to its series' `models`; to add a series, export another
// AmpSeries and list it in AMP_SERIES. A rack names an amp by its id, so it can only name one listed here.
import type { AmpModel, AmpSeries } from "../../types";

/** The sub amp. */
export const GXD8 = {
  id: "gxd8",
  model: "GXD8",
  channels: 2,
  w8: 800,
  w4: 1200,
  gainDb: 36.5,
  limiterW: [5, 800],
  usedPrice: 600,
} as const satisfies AmpModel;

/** The mid and horn amp. */
export const GXD4 = {
  id: "gxd4",
  model: "GXD4",
  channels: 2,
  w8: 400,
  w4: 600,
  gainDb: 33.5,
  limiterW: [5, 400],
  usedPrice: 400,
} as const satisfies AmpModel;

/** The GXD prices were checked Sep 2026. */
export const QSC_GXD = {
  brand: "QSC",
  models: [GXD4, GXD8],
  filters:
    "Linkwitz-Riley 24 dB/oct only. Highpass 20 Hz–4 kHz, lowpass 60 Hz–4 kHz. No Butterworth and nothing steeper. Plus a 4-band PEQ (±12 dB, 0.1–3 oct) and 50 ms of delay.",
  limiterModes: "“Smart Speaker Protection”: Mild, Medium or Aggressive",
  limits:
    "No threshold in volts, no attack or release settings, no limiting confined to one band. QSC don't say how the power setting maps to a threshold (the spec sheet calls it a peak limiter, the manual an RMS limiter).",
  src: [
    {
      name: "GXD user manual",
      url: "https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_usermanual.pdf",
    },
    {
      name: "GXD spec sheet",
      url: "https://www.qscaudio.com/resource-files/productresources/amp/gxd/q_amp_gxd_specsheet.pdf",
    },
  ],
} as const satisfies AmpSeries;

/**
 * The v1 rack's subs-and-horns amp (docs/amp-dsp-v1.md). Power is the manual's 4-channel continuous rating (its
 * footnote says one channel driven; the spec sheet's 500 W at 8 Ω is a 20 ms burst). Gain is at the 1.2 V (+4 dBu)
 * input setting. The limiter's AUTO mode takes a speaker power of 10–1250 W per separate channel.
 */
export const PLD42 = {
  id: "pld42",
  model: "PLD4.2",
  channels: 4,
  w8: 400,
  w4: 400,
  gainDb: 34,
  limiterW: [10, 1250],
  // the owner's listing, Oct 2026
  usedPrice: 550,
} as const satisfies AmpModel;

export const QSC_PLD = {
  brand: "QSC",
  models: [PLD42],
  filters:
    "Butterworth, Linkwitz-Riley or Bessel-Thomson, 6–48 dB/oct (by type), 20 Hz–20 kHz. A 5-band PEQ (parametric, low or high shelf; −40 to +20 dB, 0.01–3 oct), 0–50 ms of delay and an input router per output (1, 1+2, 2, 2+3, 3, 3+4 or 4).",
  limiterModes:
    "AUTO (Mild, Medium or Aggressive, from a speaker power and impedance) or ADV (RMS threshold 3–100 V, peak threshold 5–155 V, with attack and release)",
  limits:
    "Delay steps are 1.0 ms. Inputs sum only in adjacent pairs, at equal level. No FIR for other makers' speakers: Intrinsic Correction works only with QSC profiles. A change of output configuration mutes all four channels.",
  src: [
    {
      name: "PLD user manual",
      url: "https://www.qscaudio.com/resource-files/productresources/amp/pld/q_amp_pld_usermanual.pdf",
    },
    {
      name: "PLD spec sheet",
      url: "https://www.qscaudio.com/resource-files/productresources/amp/pld/q_amp_pld_specs.pdf",
    },
  ],
} as const satisfies AmpSeries;

/** Every amp series in the catalog; a rack's amp ids are the models listed here. */
export const AMP_SERIES = [QSC_GXD, QSC_PLD] as const;
