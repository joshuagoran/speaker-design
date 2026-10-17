// Sub drivers the Speaker page alone offers: no price from a US vendor. TH18's driver is here, for its Hornresp
// reference. src/lib/data.ts adds the comparable Xmax and lists them after the PA subs in SPEAKER_SUB_OPTIONS. Fields
// as in subs.ts; `price` is null where no US vendor sells the driver. Pure data: no logic, no derived fields.
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

export const SPEAKER_SUB_RAW: readonly RawDriver<SpeakerSubDriver>[] = [PD1850_RAW];
