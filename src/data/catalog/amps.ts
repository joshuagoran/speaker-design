// Power amplifiers: the mains rack's QSC GXD series, as the Notes page and the signal-path drawing describe it (both
// format their power figures from here). Watts are per channel, continuous, both channels driven; gain is voltage
// gain in dB; limiterW is the speaker-power range the limiter accepts. The compiler checks every field (AmpSeries in
// src/types.ts). To add a model, append it to `models`; to add a series, export another AmpSeries. Rack prices live
// in racks.ts.
import type { AmpModel, AmpSeries } from "../../types";

/** The sub amp. */
export const GXD8: AmpModel = {
  id: "gxd8",
  model: "GXD8",
  w8: 800,
  w4: 1200,
  gainDb: 36.5,
  limiterW: [5, 800],
};

/** The mid and horn amp. */
export const GXD4: AmpModel = {
  id: "gxd4",
  model: "GXD4",
  w8: 400,
  w4: 600,
  gainDb: 33.5,
  limiterW: [5, 400],
};

export const QSC_GXD: AmpSeries = {
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
};
