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
  note: "Delay in 0.01 ms steps.",
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
  note: "The 500 W/ch on the spec sheet is a 20 ms burst. Price: a listing, Oct 2026.",
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
      note: "Phoenix inputs, screw-terminal outputs.",
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

/** Lab.gruppen's 4-channel C Series (class TD) touring amps; their figures are from the same manual's spec table. */
export const LAB_GRUPPEN_C_4 = {
  brand: "Lab.gruppen",
  models: [
    {
      id: "c164",
      model: "C 16:4",
      ampClass: "TD",
      channels: 4,
      w8: 400,
      w4: 300,
      gainDb: 35,
      limiterW: null,
      usedPrice: 500,
      usedPriceEst: true,
      note: "Bridged pairs give 800 W into 16 Ω and 600 W into 8 Ω. Into 4 Ω bridged works, but Lab.gruppen don't recommend it: it gives no more power than one channel. 115 V model: 15 A plug (NEMA 5-15P).",
    },
    {
      id: "c284",
      model: "C 28:4",
      ampClass: "TD",
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
      ampClass: "TD",
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
      ampClass: "TD",
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
      ampClass: "TD",
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
    "No crossovers, EQ or delay: it needs an external DSP. Gain 23–44 dB in 3 dB steps (35 dB as shipped). No power sharing between channels; the average-power limiter can cut the total to protect the supply or the breaker. The C 88:4 is rated at a 141 V limit, the others at 100 V. Every channel pair (A+B, C+D) bridges. The 115 V models need a 20 A outlet (NEMA 5-20P), the C 88:4 a 30 A twist-lock.",
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
      note: "Price: Guitar Center asking $249.99; an eBay sale at $159.99 (date unknown).",
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

/**
 * Crown's 2-channel Macro-Tech: a linear "grounded bridge" output stage (AB+B per Crown's spec sheets, read only in
 * search excerpts). Ratings are maximum average power, 20 Hz–20 kHz, 0.1% THD, both channels driven, 120 V units;
 * gain is at the 1.4 V setting.
 */
export const CROWN_MACRO_TECH = {
  brand: "Crown",
  models: [
    {
      id: "ma600",
      model: "MA-600",
      ampClass: "ABB",
      channels: 2,
      w8: 210,
      w4: 300,
      gainDb: 30,
      limiterW: null,
      usedPrice: 250,
      usedPriceEst: true,
    },
    {
      id: "ma1200",
      model: "MA-1200",
      ampClass: "ABB",
      channels: 2,
      w8: 295,
      w4: 450,
      gainDb: 31,
      limiterW: null,
      usedPrice: 300,
      usedPriceEst: true,
    },
    {
      id: "ma2400",
      model: "MA-2400",
      ampClass: "ABB",
      channels: 2,
      w8: 505,
      w4: 750,
      gainDb: 33,
      limiterW: null,
      usedPrice: 400,
      usedPriceEst: true,
    },
    {
      id: "ma602",
      model: "MA-602",
      ampClass: "ABB",
      channels: 2,
      w8: 210,
      w4: 300,
      gainDb: 30,
      limiterW: null,
      usedPrice: 275,
      usedPriceEst: true,
    },
    {
      id: "ma1202",
      model: "MA-1202",
      ampClass: "ABB",
      channels: 2,
      w8: 295,
      w4: 450,
      gainDb: 31,
      limiterW: null,
      usedPrice: 325,
      usedPriceEst: true,
    },
    {
      id: "ma2402",
      model: "MA-2402",
      ampClass: "ABB",
      channels: 2,
      w8: 505,
      w4: 750,
      gainDb: 33,
      limiterW: null,
      usedPrice: 445,
      note: "Price: an eBay asking price ($445 or best offer).",
    },
    {
      id: "ma3600vz",
      model: "MA-3600VZ",
      ampClass: "ABB",
      channels: 2,
      w8: 1035,
      w4: 1565,
      gainDb: 36.8,
      limiterW: null,
      usedPrice: 600,
      note: "Variable-impedance supply. The 4 Ω figure is at 1 kHz only. Price: an eBay buy-it-now.",
    },
    {
      id: "ma5000vz",
      model: "MA-5000VZ",
      ampClass: "ABB",
      channels: 2,
      w8: 1090,
      w4: 1775,
      gainDb: 37,
      limiterW: null,
      usedPrice: 800,
      usedPriceEst: true,
      note: "Variable-impedance supply. 78 lb.",
    },
    {
      id: "ma5002vz",
      model: "MA-5002VZ",
      ampClass: "ABB",
      channels: 2,
      w8: 1090,
      w4: 1775,
      gainDb: 37,
      limiterW: null,
      usedPrice: 1000,
      note: "Variable-impedance supply. 78 lb. Price: under an eBay asking price of $1,124.99.",
    },
  ],
  dsp: false,
  filters: "No DSP and no built-in filters: optional PIP input modules add them.",
  limiterModes:
    "ODEP: cuts the drive as the output stage nears its thermal limit (not a speaker limiter)",
  limits:
    "No crossovers, EQ or delay: it needs an external DSP, and nothing in the amp protects a horn. Gain 26 dB fixed, or 0.775 V or 1.4 V sensitivity. Heavy: 40–78 lb. The 60x models have the same power as the 600/1200/2400.",
  src: [
    {
      name: "Macro-Tech 600/1200/2400 reference manual",
      url: "https://tcfurlong.com/wp-content/uploads/Crown-MA-1200-MA-2400-Rental-Manual.pdf",
    },
    {
      name: "MA-602/1202/2402 operation manual",
      url: "https://www.manualsdir.com/manuals/60112/crown-audio-1202-2402-macro-tech-602.html",
    },
    {
      name: "MA-3600VZ spec sheet",
      url: "https://www.fullcompass.com/common/files/2611-MA3600VZSpecSheet.pdf",
    },
    {
      name: "MA-5000VZ reference manual",
      url: "https://www.manualsdir.com/manuals/290447/crown-audio-macro-tech-ma-5000vz.html",
    },
    {
      name: "MA-5002VZ operation manual",
      url: "https://www.manualsdir.com/manuals/290427/crown-audio-macro-tech-ma5002vz.html",
    },
  ],
} as const satisfies AmpSeries;

/** Crown's 2-channel Macro-Tech i: class I (BCA). Ratings are guaranteed minimums, 20 Hz–20 kHz, 0.1% THD. Gain at 1.4 V. */
export const CROWN_MACRO_TECH_I = {
  brand: "Crown",
  models: [
    {
      id: "ma5000i",
      model: "MA-5000i",
      ampClass: "I",
      channels: 2,
      w8: 1250,
      w4: 2500,
      gainDb: 37.1,
      limiterW: null,
      usedPrice: 1600,
      usedPriceEst: true,
      note: "Under an eBay asking price of $1,850.",
    },
    {
      id: "ma9000i",
      model: "MA-9000i",
      ampClass: "I",
      channels: 2,
      w8: 1500,
      w4: 3500,
      gainDb: 37.9,
      limiterW: null,
      usedPrice: 1500,
      note: "Price: listings at $1,400–1,696.",
    },
    {
      id: "ma12000i",
      model: "MA-12000i",
      ampClass: "I",
      channels: 2,
      w8: 2100,
      w4: 4500,
      gainDb: 39.3,
      limiterW: null,
      usedPrice: 2150,
      note: "Price: a buy-it-now listing.",
    },
  ],
  dsp: false,
  filters: "No filters listed.",
  limiterModes:
    "Input compressor/limiter, peak voltage limiter, average power limiter, clip eliminator and thermal limiter, all set over HiQnet System Architect",
  limits:
    "No crossovers, EQ or delay in the amp: it needs an external DSP. The limiters need a computer and HiQnet. 28 lb (one figure for the series). Gain 32 or 26 dB settings as well.",
  src: [
    {
      name: "MA-i datasheet (2015)",
      url: "https://adn.harmanpro.com/product_documents/documents/2138_1447271308/MAi_DataSheet_111115_Web_original.pdf",
    },
    {
      name: "MA-i operation manual",
      url: "https://adn.harmanpro.com/product_documents/documents/1994_1407852944/140579-3_08-13_MAi_dual-port_operation_original.pdf",
    },
  ],
} as const satisfies AmpSeries;

/**
 * Crown's 2-channel XLS DriveCore 2 (class D). Ratings are maximum average power at 1 kHz, 0.5% THD (bandwidth and
 * channels driven not stated); gain is computed at the 1.4 V setting.
 */
export const CROWN_XLS = {
  brand: "Crown",
  models: [
    {
      id: "xls1002",
      model: "XLS 1002",
      ampClass: "D",
      channels: 2,
      w8: 215,
      w4: 350,
      gainDb: 29.4,
      limiterW: null,
      usedPrice: 200,
      usedPriceEst: true,
    },
    {
      id: "xls1502",
      model: "XLS 1502",
      ampClass: "D",
      channels: 2,
      w8: 300,
      w4: 525,
      gainDb: 30.9,
      limiterW: null,
      usedPrice: 365,
      note: "Price: a Reverb listing.",
    },
    {
      id: "xls2002",
      model: "XLS 2002",
      ampClass: "D",
      channels: 2,
      w8: 375,
      w4: 650,
      gainDb: 31.9,
      limiterW: null,
      usedPrice: 450,
      usedPriceEst: true,
    },
    {
      id: "xls2502",
      model: "XLS 2502",
      ampClass: "D",
      channels: 2,
      w8: 440,
      w4: 775,
      gainDb: 32.6,
      limiterW: null,
      usedPrice: 550,
      note: "Price: Reverb and Amazon used listings.",
    },
  ],
  dsp: true,
  filters:
    "PureBand crossover per channel: Linkwitz-Riley 24 dB/oct low-pass, high-pass or band-pass, 30 Hz–3 kHz in 1/12-octave steps. No EQ and no delay.",
  limiterModes: "PeakX: fixed, with no threshold, attack or release settings",
  limits:
    "No EQ or delay, and no voltage threshold to protect a horn. Light: 8.6–10.8 lb. The factory sensitivity (0.775 V or 1.4 V) isn't stated.",
  src: [
    {
      name: "XLS DriveCore 2 manual",
      url: "https://adn.harmanpro.com/product_documents/documents/2557_1431030087/5055568_XLSDC2_MNL_PRINT_050615_original.pdf",
    },
    {
      name: "XLS DriveCore 2 datasheet",
      url: "https://www.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw1d21606b/pdfs/Crown_XLSDC2_DataSheet.pdf",
    },
  ],
} as const satisfies AmpSeries;

/**
 * Yamaha's 2-channel P…S: EEEngine (a class AB output stage with a class D-driven supply, per Yamaha's catalog and a
 * search excerpt of its EEEngine page). Ratings are 20 Hz–20 kHz, 0.1% THD+N; gain 32 dB.
 */
export const YAMAHA_P_S = {
  brand: "Yamaha",
  models: [
    {
      id: "p2500s",
      model: "P2500S",
      ampClass: "EEEngine",
      channels: 2,
      w8: 250,
      w4: 310,
      gainDb: 32,
      limiterW: null,
      usedPrice: 200,
      usedPriceEst: true,
    },
    {
      id: "p3500s",
      model: "P3500S",
      ampClass: "EEEngine",
      channels: 2,
      w8: 350,
      w4: 450,
      gainDb: 32,
      limiterW: null,
      usedPrice: 250,
      usedPriceEst: true,
    },
    {
      id: "p5000s",
      model: "P5000S",
      ampClass: "EEEngine",
      channels: 2,
      w8: 500,
      w4: 700,
      gainDb: 32,
      limiterW: null,
      usedPrice: 350,
      usedPriceEst: true,
    },
    {
      id: "p7000s",
      model: "P7000S",
      ampClass: "EEEngine",
      channels: 2,
      w8: 700,
      w4: 950,
      gainDb: 32,
      limiterW: null,
      usedPrice: 450,
      usedPriceEst: true,
      note: "650 W at 8 Ω on the European model.",
    },
  ],
  dsp: false,
  filters:
    "No DSP. Per channel: off, a low-cut high-pass or a subwoofer low-pass, 25–150 Hz, 12 dB/oct.",
  limiterModes: "Comp limiter at 0.5% THD or more; a VI limiter for loads of 1 Ω or less",
  limits: "No EQ or delay, and only 12 dB/oct. The 4 Ω bridged figures are 20 ms bursts.",
  src: [
    {
      name: "P7000S/P5000S/P3500S/P2500S owner's manual",
      url: "https://usa.yamaha.com/files/download/other_assets/7/318527/p7000s_en_om_g0.pdf",
    },
    {
      name: "P Series catalog",
      url: "https://usa.yamaha.com/files/download/brochure/2/317232/p_series_catalog.pdf",
    },
  ],
} as const satisfies AmpSeries;

/** Yamaha's older 2-channel P4500. Ratings are 20 Hz–20 kHz, 0.05% THD. */
export const YAMAHA_P = {
  brand: "Yamaha",
  models: [
    {
      id: "p4500",
      model: "P4500",
      ampClass: null,
      channels: 2,
      w8: 460,
      w4: 620,
      gainDb: 32.1,
      limiterW: null,
      usedPrice: 250,
      usedPriceEst: true,
      note: "Class not stated in the manual.",
    },
  ],
  dsp: false,
  filters: "No filters.",
  limiterModes: "A protection limiter for loads of 1 Ω or less; no clip limiter",
  limits: "No crossovers, EQ or delay: it needs an external DSP. Not rated bridged into 4 Ω.",
  src: [
    {
      name: "P4500/P3200/P1600 owner's manual",
      url: "https://usa.yamaha.com/files/download/other_assets/5/318565/P4500E.pdf",
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
  CROWN_MACRO_TECH,
  CROWN_MACRO_TECH_I,
  CROWN_XLS,
  YAMAHA_P_S,
  YAMAHA_P,
] as const;
