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
  ampClass: "D",
  channels: 2,
  w8: 800,
  w4: 1200,
  gainDb: 36.5,
  limiterW: [5, 800],
  usedPrice: 600,
  note: "Mains rack: subs.",
} as const satisfies AmpModel;

/** The mid and horn amp. */
export const GXD4 = {
  id: "gxd4",
  model: "GXD4",
  ampClass: "D",
  channels: 2,
  w8: 400,
  w4: 600,
  gainDb: 33.5,
  limiterW: [5, 400],
  usedPrice: 400,
  note: "Owned. v1 rack: mids. Fine delay steps (0.01 ms).",
} as const satisfies AmpModel;

/** The GXD prices were checked Sep 2026. */
export const QSC_GXD = {
  brand: "QSC",
  models: [GXD4, GXD8],
  dsp: true,
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
  ampClass: "D",
  channels: 4,
  w8: 400,
  w4: 400,
  gainDb: 34,
  limiterW: [10, 1250],
  usedPrice: 550,
  note: "v1 rack: subs and horns. The 500 W/ch on the spec sheet is a 20 ms burst. Price: the owner's listing, Oct 2026.",
} as const satisfies AmpModel;

export const QSC_PLD = {
  brand: "QSC",
  models: [PLD42],
  dsp: true,
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

// Amps considered, none in a rack. Their used prices are US asking prices (Guitar Center, Reverb, eBay; Oct 2026, the
// listings undated) or, flagged `usedPriceEst`, estimates from related models where no US listing was found.

/** Lab.gruppen's 8-channel C Series install amp, the v1 plan's rejected alternative. */
export const LAB_GRUPPEN_C_X = {
  brand: "Lab.gruppen",
  models: [
    {
      id: "c208x",
      model: "C 20:8X",
      ampClass: "D",
      channels: 8,
      w8: 250,
      w4: 250,
      gainDb: 32,
      limiterW: null,
      usedPrice: 700,
      usedPriceEst: true,
      note: "The v1 plan’s rejected alternative. Phoenix inputs, screw-terminal outputs.",
    },
  ],
  dsp: false,
  filters: "No DSP. A 35 Hz, 6 dB/oct high-pass, switchable per channel.",
  limiterModes:
    "Voltage peak limiter by DIP switch: 100, 63, 45 or 32 V peak (bridged 200, 126, 90 or 64 V); plus current and average-power limiters",
  limits:
    "No crossovers, EQ or delay: it needs an external DSP. Gain 29, 32, 35 or 38 dB by DIP switch. Bridged pairs give 500 W into 8 Ω but only 250 W into 4 Ω. The ratings give no bandwidth or THD.",
  src: [
    {
      name: "Lab.gruppen C Series manual rev 1.1.5",
      url: "https://www.fullcompass.com/common/files/27161-LabGruppenC4XOperationManual.pdf",
    },
  ],
} as const satisfies AmpSeries;

/** Lab.gruppen's 4-channel C Series touring amps; their figures are from the same manual's spec table. */
export const LAB_GRUPPEN_C_4 = {
  brand: "Lab.gruppen",
  models: [
    {
      id: "c164",
      model: "C 16:4",
      ampClass: "D",
      channels: 4,
      w8: 400,
      w4: 300,
      gainDb: 35,
      limiterW: null,
      usedPrice: 500,
      usedPriceEst: true,
      note: "Bridged into 4 Ω is not recommended.",
    },
    {
      id: "c284",
      model: "C 28:4",
      ampClass: "D",
      channels: 4,
      w8: 700,
      w4: 700,
      gainDb: 35,
      limiterW: null,
      usedPrice: 700,
      usedPriceEst: true,
    },
    {
      id: "c484",
      model: "C 48:4",
      ampClass: "D",
      channels: 4,
      w8: 1000,
      w4: 1200,
      gainDb: 35,
      limiterW: null,
      usedPrice: 1000,
      note: "Price: an eBay asking price, Aug 2025.",
    },
    {
      id: "c684",
      model: "C 68:4",
      ampClass: "D",
      channels: 4,
      w8: 1200,
      w4: 1700,
      gainDb: 35,
      limiterW: null,
      usedPrice: 1300,
      usedPriceEst: true,
    },
    {
      id: "c884",
      model: "C 88:4",
      ampClass: "D",
      channels: 4,
      w8: 1250,
      w4: 2100,
      gainDb: 35,
      limiterW: null,
      usedPrice: 1700,
      usedPriceEst: true,
      note: "Rated at a 141 V limit; the other :4 models at 100 V.",
    },
  ],
  dsp: false,
  filters: "No DSP and no high-pass filter.",
  limiterModes:
    "Voltage peak limiter by switch: 141, 118, 100, 85, 71, 59, 50 or 42 V peak, Hard or Soft; plus current and average-power limiters",
  limits:
    "No crossovers, EQ or delay: it needs an external DSP. Gain 23–44 dB in 3 dB steps (35 dB as shipped). No power sharing between channels; the average-power limiter can cut the total to protect the supply or the breaker. The C 88:4 is rated at a 141 V limit, the others at 100 V. The C 16:4 should not be bridged into 4 Ω.",
  src: LAB_GRUPPEN_C_X.src,
} as const satisfies AmpSeries;

/** Powersoft's 8-channel install amp, the non-DSP version (not the DSP+D or DSP+ETH). */
export const POWERSOFT_OTTOCANALI = {
  brand: "Powersoft",
  models: [
    {
      id: "ottocanali4k4",
      model: "Ottocanali 4K4",
      ampClass: "D",
      channels: 8,
      w8: 250,
      w4: 500,
      gainDb: 32,
      limiterW: null,
      usedPrice: 1500,
      usedPriceEst: true,
      note: "The amp in the design notes.",
    },
  ],
  dsp: false,
  filters: "No DSP. A 35 or 70 Hz high-pass per channel by DIP switch (slope not published).",
  limiterModes: "Clip limiter per channel; long-term power limiters",
  limits:
    "No crossovers, EQ or delay: it needs an external DSP. Gain 26, 29, 32 or 35 dB by switch. The datasheet's 1.94 V sensitivity is a series figure that doesn't fit the 4K4. The ratings give no bandwidth or THD.",
  src: [
    {
      name: "Ottocanali datasheet",
      url: "https://powersoft.com/api/media/file/PS_Ottocanali_DS.pdf",
    },
    {
      name: "Ottocanali 4K4 A&E spec",
      url: "https://powersoft.com/api/media/file/powersoft_ottocanali_4K4_AE.pdf",
    },
    {
      name: "Ottocanali user guide",
      url: "https://powersoft.com/api/media/file/PS_OTTOCANALI_UG.pdf",
    },
  ],
} as const satisfies AmpSeries;

/** QSC's 2-channel RMX: class AB up to the 1450, class H above. Ratings are 20 Hz–20 kHz at 0.1% THD. */
export const QSC_RMX = {
  brand: "QSC",
  models: [
    {
      id: "rmx850",
      model: "RMX 850",
      ampClass: "AB",
      channels: 2,
      w8: 185,
      w4: 280,
      gainDb: 30,
      limiterW: null,
      usedPrice: 150,
    },
    {
      id: "rmx1450",
      model: "RMX 1450",
      ampClass: "AB",
      channels: 2,
      w8: 260,
      w4: 400,
      gainDb: 32,
      limiterW: null,
      usedPrice: 200,
    },
    {
      id: "rmx2450",
      model: "RMX 2450",
      ampClass: "H",
      channels: 2,
      w8: 450,
      w4: 650,
      gainDb: 34,
      limiterW: null,
      usedPrice: 350,
      note: "2-tier class H.",
    },
    {
      id: "rmx4050hd",
      model: "RMX 4050HD",
      ampClass: "H",
      channels: 2,
      w8: 800,
      w4: 1300,
      gainDb: 36,
      limiterW: null,
      usedPrice: 750,
      note: "3-tier class H. CE rating 650 W at 8 Ω.",
    },
    {
      id: "rmx5050",
      model: "RMX 5050",
      ampClass: "H",
      channels: 2,
      w8: 1050,
      w4: 1600,
      gainDb: 36,
      limiterW: null,
      usedPrice: 900,
      usedPriceEst: true,
      note: "3-tier class H.",
    },
  ],
  dsp: false,
  filters: "No DSP. A low-frequency filter by DIP switch: off, 30 or 50 Hz (slope not published).",
  limiterModes: "Clip limiter per channel, can be switched off",
  limits:
    "No crossovers, EQ or delay: it needs an external DSP. The RMX…a models have the same specs (the 4050a's sensitivity is 1.42 V). Heavy: 35–75 lb.",
  src: [
    {
      name: "RMX spec sheet",
      url: "https://in.qscaudio.com/resource-files/productresources/amp/discontinued/rmx/q_amp_rmx_series_specs.pdf",
    },
    {
      name: "RMXa spec sheet (Gear4music copy)",
      url: "https://r2.gear4music.com/media/11/116611/download_116611.pdf",
    },
  ],
} as const satisfies AmpSeries;

/**
 * Crest Audio's 2-channel CA: class AB for the CA2 and CA4, class H above. Ratings are 20 Hz–20 kHz at 0.1% THD+N;
 * gain is the default ratio (×45 to ×115) in dB.
 */
export const CREST_CA = {
  brand: "Crest Audio",
  models: [
    {
      id: "ca2",
      model: "CA2",
      ampClass: "AB",
      channels: 2,
      w8: 150,
      w4: 200,
      gainDb: 33.1,
      limiterW: null,
      usedPrice: 150,
      usedPriceEst: true,
    },
    {
      id: "ca4",
      model: "CA4",
      ampClass: "AB",
      channels: 2,
      w8: 245,
      w4: 400,
      gainDb: 35.7,
      limiterW: null,
      usedPrice: 200,
      usedPriceEst: true,
    },
    {
      id: "ca6",
      model: "CA6",
      ampClass: "H",
      channels: 2,
      w8: 350,
      w4: 500,
      gainDb: 36.7,
      limiterW: null,
      usedPrice: 250,
      usedPriceEst: true,
    },
    {
      id: "ca9",
      model: "CA9",
      ampClass: "H",
      channels: 2,
      w8: 550,
      w4: 800,
      gainDb: 38.7,
      limiterW: null,
      usedPrice: 305,
      note: "Price: an eBay sale, May 2025, before shipping.",
    },
    {
      id: "ca12",
      model: "CA12",
      ampClass: "H",
      channels: 2,
      w8: 650,
      w4: 1100,
      gainDb: 39.8,
      limiterW: null,
      usedPrice: 450,
      usedPriceEst: true,
    },
    {
      id: "ca18",
      model: "CA18",
      ampClass: "H",
      channels: 2,
      w8: 950,
      w4: 1700,
      gainDb: 41.2,
      limiterW: null,
      usedPrice: 600,
      usedPriceEst: true,
      note: "Rear gain switch; the others use an internal jumper.",
    },
  ],
  dsp: false,
  filters: "No DSP. A built-in subsonic high-pass (corner not published).",
  limiterModes: "ACL clip limiting per channel",
  limits:
    "No crossovers, EQ or delay: it needs an external DSP. Gain ×40 or ×20 by an internal jumper as well (the CA18 has a rear switch). Discontinued; the manual is a third-party copy, matched by Crest's CA9 and CA18 brochures.",
  src: [
    {
      name: "CA Series owner's manual (third-party copy)",
      url: "https://audiovias.com/descarga/265/crest-audio-manuales/7093/crest-audio-ca-series-manual-de-usuario.pdf",
    },
    {
      name: "CA9 brochure",
      url: "https://www.fullcompass.com/common/files/60-CrestCA9Brochure.pdf",
    },
    {
      name: "CA18 brochure",
      url: "https://www.fullcompass.com/common/files/62-CrestCA18Brochure.pdf",
    },
  ],
} as const satisfies AmpSeries;

/** Every amp series in the catalog; a rack's amp ids are the models listed here. */
export const AMP_SERIES = [
  QSC_GXD,
  QSC_PLD,
  LAB_GRUPPEN_C_X,
  LAB_GRUPPEN_C_4,
  POWERSOFT_OTTOCANALI,
  QSC_RMX,
  CREST_CA,
] as const;
