// Crossover / DSP units compared on the Notes page, one row per unit, every cell display text in column order:
// unit, I/O, slopes, limiter, PEQ per output, US price (new and used, with the seller where it matters), notes.
// To add a unit, append a row; the compiler checks it has all seven cells (DspUnitRow in src/types.ts).
// Prices are US dollars from US sellers; mark an unconfirmed spec in its cell, as the rows below do.
import type { DspUnitRow } from "../../types";

export const DSP_UNITS: readonly DspUnitRow[] = [
  [
    "dbx DriveRack 260",
    "2×6 XLR",
    "LR to 48 (BW to 24)",
    "dBu threshold; attack, hold, release",
    "4",
    "$995 new, ~$390 used",
    "Best value: limits set straight from the amp's gain. Only 4 PEQ bands per output.",
  ],
  [
    "dbx DriveRack VENU360",
    "3×6 XLR",
    "BW / LR to 48",
    "Attack, hold, release; threshold vs full scale",
    "8",
    "$1,149 new, ~$750 used",
    "Best overall: independent outputs, up to 1 s delay, app control.",
  ],
  [
    "Behringer DCX2496",
    "3×6 XLR (+AES)",
    "BW / LR to 48",
    "Per output, release only; units unclear",
    "Shared pool",
    "~$339",
    "Budget pick. Steep slopes use up EQ filters. PC control over RS-232/485.",
  ],
  [
    "Behringer DCX2496LE",
    "2×6 XLR",
    "BW / LR to 48",
    "Same as DCX2496",
    "Shared pool",
    "~$289",
    "Same DSP, but no third input, no digital I/O and no PC port: front panel only.",
  ],
  [
    "Ashly AQM408",
    "4×8 XLR",
    "BW / LR / Bessel to 48; FIR (512 taps)",
    "Brick-wall, peak detect, −20 to +20 dBu, attack & release; plus compressor (peak or average) for an RMS stage",
    "PEQ blocks (count unconfirmed)",
    "$999 new (Sweetwater, Full Compass, B&H), ~$800 used",
    "Current. Meets every requirement; 2 spare outputs. Control is browser-only over Ethernet (no front-panel editing), so bring a phone or tablet on the rack's network.",
  ],
  [
    "t.racks DSP 408",
    "4×8 XLR",
    "up to 48 (unconfirmed)",
    "Attack, release; units unclear",
    "9",
    "$439",
    "Thomann only in the US.",
  ],
  [
    "dbx DriveRack PA2 (current)",
    "2×6 XLR",
    "BW / LR to 48",
    "No attack or release; up to 3 dB overshoot",
    "8, linked L/R",
    "~$599, ~$366 used",
    "Left and right share EQ and delay per band; 10 ms output delay.",
  ],
];
