// Triaxials: 15–18 in passive woofers with a coaxial two-way compression driver (midrange and HF on one horn).
// src/lib/data.ts adds the comparable Xmax and sorts TRIAX_OPTIONS.
// To add an entry, append an object literal to the table. The type annotation makes the compiler check it exactly:
// a misspelled, extra or missing field, a string where a number belongs or a value outside its union (maker id) is an
// error.
// Prices are US dollars from US vendors only; `src` names the vendor and the month the price was read.
// Never drop a part because a spec is missing: use null where the type allows it and say what is missing in `note`.
// Pure data: no logic, no derived fields (src/lib/data.ts derives and sorts).
// Fields: id, name, maker (a MAKER_NAMES id), size in, lb, price $ (null if no US price), src, lfSens (woofer, dB
// 1 W/1 m), note.
// ts (the maker's Thiele-Small figures): Fs Hz, Vas L, Sd cm², Re Ω, Bl T·m, Mms g, aes W (AES rating), disp L
// (null where unpublished), Hvc / Hg (coil and gap heights) mm, and `pub` = every excursion figure the maker
// publishes, one-way mm, with its formula and source URL. Do not add Xmax / xmax: src/lib/xmax derives them.
// mf: midrange section, sens 1 W/1 m, aes W, imp Ω, xoLo recommended minimum Hz, xoHi top of its range Hz.
// hf: HF section, sens 1 W/1 m, aes W, xo recommended minimum Hz, imp Ω, cov degrees (horizontal, the shared horn).
import type { RawDriver, TriaxDriver } from "../../types";

export const TRIAX_RAW: readonly RawDriver<TriaxDriver>[] = [
  {
    id: "bc15htx100",
    size: 15,
    lb: 23.8,
    name: "B&C 15HTX100",
    maker: "bc",
    price: null,
    src: "no US vendor, Oct 2026",
    ts: {
      Fs: 52,
      Qts: 0.29,
      Qes: 0.305,
      Qms: 5.9,
      Vas: 78,
      Sd: 855,
      pub: {
        Xmax: 10,
        formula: "unstated",
        Xvar: 8.5,
        src: "https://www.bcspeakers.com/en/products/triaxial/15/8/15HTX100",
      },
      Hvc: 25.1,
      Hg: 10.2,
      Re: 5.5,
      imp: 8,
      Le: 0.9,
      Bl: 27,
      Mms: 125,
      aes: 800,
      disp: null,
    },
    mf: { sens: 108.5, aes: 90, imp: 8, xoLo: 700, xoHi: 5500 },
    hf: { sens: 108.5, aes: 50, xo: 4500, imp: 8, cov: 60 },
    lfSens: 99,
    note: "[bcspeakers.com product page, Oct 2026] Neo, DCX354 coaxial compression driver on a 600 Hz horn, 60° × 40°. LF 52 Hz–1 kHz, MF 0.5–5.5 kHz, HF 5–20 kHz (HF crossover 4.5 kHz or higher). No US vendor. Thomann (Germany) lists it at $749 plus shipping and import fees (Oct 2026). B&C names no matching passive network. The drawing gives 10.7 kg; the page gives 10.8 kg. Displacement not published.",
  },
  {
    id: "bc18htx100",
    size: 18,
    lb: 27.9,
    name: "B&C 18HTX100",
    maker: "bc",
    price: 1359.9,
    src: "usspeaker.com, Oct 2026",
    ts: {
      Fs: 44,
      Qts: 0.32,
      Qes: 0.34,
      Qms: 6.3,
      Vas: 173,
      Sd: 1210,
      pub: {
        Xmax: null,
        formula: "unstated",
        Xvar: 13,
        src: "https://www.bcspeakers.com/en/products/triaxial/18/8/18HTX100",
      },
      Hvc: 25.1,
      Hg: 10.2,
      Re: 5.4,
      imp: 8,
      Le: 1.16,
      Bl: 26.3,
      Mms: 158.5,
      aes: 800,
      disp: null,
    },
    mf: { sens: 110, aes: 110, imp: 8, xoLo: 600, xoHi: 5500 },
    hf: { sens: 110, aes: 80, xo: 4000, imp: 8, cov: 60 },
    lfSens: 100,
    note: "[bcspeakers.com product page, Oct 2026] Neo, DCX464 coaxial compression driver on a 600 Hz horn, 60° × 40°. LF 44–800 Hz, MF 0.5–5.5 kHz, HF 3.5–18 kHz (HF crossover 4 kHz or higher). B&C publishes only Xvar (13 mm) for the LF section; the comparable Xmax comes from its coil and gap heights. B&C names its FB464V2 passive network for the MF and HF; no US price for it was read. Displacement not published.",
  },
];
