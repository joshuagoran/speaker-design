// Sub drivers the Speaker page alone offers: a size no PA cabinet takes (21 in), or no price from a US vendor. They
// drive the known folded horns' starts (TH18, SKRAM). src/lib/data.ts adds the comparable Xmax and lists them after
// the PA subs in SPEAKER_SUB_OPTIONS. Fields as in subs.ts; `price` is null where no US vendor sells the driver.
// Pure data: no logic, no derived fields.
import type { RawDriver, SpeakerSubDriver } from "../../types";

/** Precision Devices PD.1850/3, 8 Ω: TH18's driver. */
export const PD1850_RAW: RawDriver<SpeakerSubDriver> = {
  id: "pd18503",
  lb: 50.26,
  name: "Precision Devices PD.1850/3",
  maker: "precisionDevices",
  // no US vendor lists it (Oct 2026): sold in Europe only
  price: null,
  src: "no US vendor, Oct 2026",
  size: 18,
  ts: {
    Fs: 33.15,
    Qts: 0.24,
    Qes: 0.24,
    Qms: 15.42,
    Vas: 203.84,
    Sd: 1164.16,
    pub: {
      Xmax: 11.05,
      formula: "unstated",
      src: "https://www.precision-devices.com/products/18-inch-drivers/pd1850-3/ (datasheet PDF, 8 Ω model, rev. 030221)",
    },
    // winding depth 28 mm (Thomann's spec page, https://www.thomann.co.uk/precision_devices_pd.1850_3_8_ohms.htm); the
    // datasheet gives neither height
    Hvc: 28,
    Hg: 12,
    Re: 5.22,
    imp: 8,
    Le: 1.33,
    Bl: 30.99,
    Mms: 215.24,
    aes: 800,
    disp: 10.5,
  },
  sens: 98,
  // datasheet: 177.4 mm (6.98 in) deep without the 14.5 mm flange
  depthIn: 7.55,
  note: "[datasheet, precision-devices.com, Oct 2026] Ferrite, 800 W AES / 1600 W program, 98 dB, 5 in coil, 50.3 lb. No US vendor; price not known. Displacement not published; 10.5 L assumed.",
};

/** B&C 21DS115-8: SKRAM's driver. */
export const BC21DS115_RAW: RawDriver<SpeakerSubDriver> = {
  id: "bc21ds115",
  lb: 32.41,
  name: "B&C 21DS115-8",
  maker: "bc",
  price: 854.1,
  src: "usspeaker.com, Oct 2026",
  size: 21,
  ts: {
    Fs: 34,
    Qts: 0.27,
    Qes: 0.28,
    Qms: 10.2,
    Vas: 204,
    Sd: 1620,
    pub: {
      Xmax: 16.5,
      formula: "unstated",
      Xvar: 13.5,
      src: "https://www.bcspeakers.com/en/products/lf-driver/21-0/8/21ds115-8",
    },
    // winding depth 40 mm, gap 14 mm (the B&C page)
    Hvc: 40,
    Hg: 14,
    Re: 5.1,
    imp: 8,
    Le: 4.9,
    Bl: 39.3,
    Mms: 404,
    aes: 1700,
    disp: 18,
  },
  sens: 99,
  // the B&C page: 255 mm (10.04 in) deep
  depthIn: 10.04,
  note: "[bcspeakers.com, Oct 2026] Neo, 1700 W AES / 3400 W program, 99 dB, 4.5 in coil, Xvar 13.5 mm, 20 in cutout, 32.4 lb. Displacement not published; 18 L assumed (an 18 in driver's 10.5 L scaled by size and depth).",
};

export const SPEAKER_SUB_RAW: readonly RawDriver<SpeakerSubDriver>[] = [PD1850_RAW, BC21DS115_RAW];
