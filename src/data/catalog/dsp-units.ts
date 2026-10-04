// Crossover / DSP units compared on the Notes page, one row per unit, every cell display text, by column:
// unit, I/O, slopes, limiter, PEQ per output, US price (new and used, with the seller where it matters), notes.
// To add a unit, append an entry with its id and row; the compiler checks the row has every named cell (DspUnit in
// src/types.ts). Racks name a unit by its id, and the Notes table marks the one the mains rack uses "(current)".
// A settled used price is `usedPrice` (a range); the table adds it to the price cell and a rack line uses it.
// Prices are US dollars from US sellers; mark an unconfirmed spec in its cell, as the rows below do.
import type { DspUnit } from "../../types";

export const DSP_UNITS = [
  {
    id: "driverack260",
    row: {
      unit: "dbx DriveRack 260",
      io: "2×6 XLR",
      slopes: "LR to 48 (BW to 24)",
      limiter: "dBu threshold; attack, hold, release",
      peqPerOutput: "4",
      priceUs: "$995 new, ~$390 used",
      notes: "Best value: limits set straight from the amp's gain. Only 4 PEQ bands per output.",
    },
  },
  {
    id: "venu360",
    row: {
      unit: "dbx DriveRack VENU360",
      io: "3×6 XLR",
      slopes: "BW / LR to 48",
      limiter: "Attack, hold, release; threshold vs full scale",
      peqPerOutput: "8",
      priceUs: "$1,149 new, ~$750 used",
      notes: "Best overall: independent outputs, up to 1 s delay, app control.",
    },
  },
  {
    id: "dcx2496",
    row: {
      unit: "Behringer DCX2496",
      io: "3×6 XLR (+AES)",
      slopes: "BW / LR to 48",
      limiter: "Per output, release only; units unclear",
      peqPerOutput: "Shared pool",
      priceUs: "~$339",
      notes: "Budget pick. Steep slopes use up EQ filters. PC control over RS-232/485.",
    },
  },
  {
    id: "dcx2496le",
    row: {
      unit: "Behringer DCX2496LE",
      io: "2×6 XLR",
      slopes: "BW / LR to 48",
      limiter: "Same as DCX2496",
      peqPerOutput: "Shared pool",
      priceUs: "~$289",
      notes: "Same DSP, but no third input, no digital I/O and no PC port: front panel only.",
    },
  },
  {
    id: "aqm408",
    row: {
      unit: "Ashly AQM408",
      io: "4×8 XLR",
      slopes: "BW / LR / Bessel to 48; FIR (512 taps)",
      limiter:
        "Brick-wall, peak detect, −20 to +20 dBu, attack & release; plus compressor (peak or average) for an RMS stage",
      peqPerOutput: "PEQ blocks (count unconfirmed)",
      priceUs: "$999 new (Sweetwater, Full Compass, B&H), ~$800 used",
      notes:
        "Current. Meets every requirement; 2 spare outputs. Control is browser-only over Ethernet (no front-panel editing), so bring a phone or tablet on the rack's network.",
    },
  },
  {
    id: "tracks408",
    row: {
      unit: "t.racks DSP 408",
      io: "4×8 XLR",
      slopes: "up to 48 (unconfirmed)",
      limiter: "Attack, release; units unclear",
      peqPerOutput: "9",
      priceUs: "$439",
      notes: "Thomann only in the US.",
    },
  },
  {
    id: "pa2",
    usedPrice: { lo: 300, hi: 400 },
    row: {
      unit: "dbx DriveRack PA2",
      io: "2×6 XLR",
      slopes: "BW / LR to 48",
      limiter: "No attack or release; up to 3 dB overshoot",
      peqPerOutput: "8, linked L/R",
      priceUs: "~$599",
      notes: "Left and right share EQ and delay per band; 10 ms output delay.",
    },
  },
] as const satisfies readonly DspUnit[];
