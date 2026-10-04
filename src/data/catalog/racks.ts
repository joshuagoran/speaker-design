// Electronics racks for the Notes page; the page sums each rack's lines. A line is a catalogue part named by id (an amp
// from amps.ts, whose name, rating and used price the line takes; a DSP unit from dsp-units.ts, whose name it takes)
// or, for anything not in the catalogue, [description, price $]. To add a line or a rack, append to the table; the
// compiler checks the shape and the ids (Rack in src/types.ts).
// Prices are US dollars, checked Sep 2026, single unit, before tax/shipping.
import type { Rack } from "../../types";

/** The safety high-pass in the horn amp, Hz: it catches a mis-recalled preset, which a level limiter cannot. */
export const HORN_AMP_SAFETY_HPF_HZ = 500;

/** The mains rack: the signal-path drawing names its processor. */
export const MAINS_RACK: Rack = {
  id: "mains",
  name: "Mains rack",
  note: "PA2 does the system tuning; each amp channel runs full-range with its own driver limiter.",
  items: [
    {
      dsp: "pa2",
      price: 300,
      note: "input EQ, master level, 6 outputs: XO, delay, driver EQ",
    },
    ["dbx RTA-M mic — for the PA2's RTA/AutoEQ", 100],
    { amp: "gxd8", use: "subs", rating: true, note: "limiter set by power + impedance" },
    { amp: "gxd4", use: "mids", rating: true },
    {
      amp: "gxd4",
      use: "horns",
      note: `gain trimmed, safety HPF ~${HORN_AMP_SAFETY_HPF_HZ} Hz in the amp`,
    },
    ["Furman PL-8 / M-8x2 (used) — 1U 15 A power conditioner", 90],
    ["Optional: GL.iNet travel router in the rack — PA2 app over its own Wi-Fi", 25],
    ["8U rack case, 6× XLR looms, 1U blank panel on the rear rail with 4× NL4MP sockets", 250],
  ],
};

export const RACKS: readonly Rack[] = [
  MAINS_RACK,
  {
    id: "battery",
    name: "Battery rack",
    note: "~70% sub output, ~90% mids/highs; 5–7 h on a 1 kWh pack.",
    items: [
      ["48 V 20 Ah LiFePO4 pack + fused disconnect", 350],
      ["miniDSP 2x4 HD (12 V) — copy of the dbx settings, run mono", 220],
      ["2× TPA3255 boards bridged mono (Fosi/3e Audio) — subs", 180],
      ["1× TPA3255 stereo board — mids", 90],
      ["1× small Class D board — horns", 60],
      ["48→12 V buck, wiring, panel-mount Speakon/XLR", 60],
      ["Small flight case", 120],
    ],
  },
  {
    id: "shared",
    name: "Shared",
    note: "Travels with whichever rack is in use.",
    items: [
      ["UMIK-1 measurement mic + REW", 100],
      ["6× XLR + 6× Speakon cables, Speakon panel jacks on all boxes", 120],
    ],
  },
];
