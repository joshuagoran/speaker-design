// Electronics racks for the Notes page: each line is [description, price $], the page sums them.
// To add a line or a rack, append to the table; the compiler checks the shape (Rack in src/types.ts).
// Prices are US dollars, checked Sep 2026, single unit, before tax/shipping.
import type { Rack } from "../../types";

export const RACKS: readonly Rack[] = [
  {
    id: "mains",
    name: "Mains rack",
    note: "PA2 does the system tuning; each amp channel runs full-range with its own driver limiter.",
    items: [
      ["dbx DriveRack PA2 (used) — input EQ, master level, 6 outputs: XO, delay, driver EQ", 300],
      ["dbx RTA-M mic — for the PA2's RTA/AutoEQ", 100],
      ["QSC GXD8 (used) — subs, 800 W/ch at 8 Ω, limiter set by power + impedance", 600],
      ["QSC GXD4 (used) — mids, 400 W/ch at 8 Ω", 400],
      ["QSC GXD4 (used) — horns, gain trimmed, safety HPF ~500 Hz in the amp", 400],
      ["Furman PL-8 / M-8x2 (used) — 1U 15 A power conditioner", 90],
      ["Optional: GL.iNet travel router in the rack — PA2 app over its own Wi-Fi", 25],
      ["8U rack case, 6× XLR looms, 1U blank panel on the rear rail with 4× NL4MP sockets", 250],
    ],
  },
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
