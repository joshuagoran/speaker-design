// Watts and volts at a driver's nominal impedance: the one rule every engine (PA, Hi-fi, Speaker, Stack, Space and the
// optimizers) uses to turn a power rating into a drive voltage and back. A driver takes `volts² / imp` watts; an amp is
// a voltage ceiling, its watts rated into 8 Ω (`AMP_RATING`), so a 4 Ω driver takes twice an amp's rated watts. That is
// an ideal amp, and an estimate: real amps list about 1.5× their 8 Ω watts into 4 Ω (src/data/catalog/amps.ts `w4`),
// some less, but no design names its amp model yet, so there is no listed rating to read.
// Pure.
import type { NominalImpedance } from "../types";

/** The impedance a driver is taken at where its nominal impedance isn't entered, Ω (a gap: `NominalImpedance`). */
export const FALLBACK_OHMS = 8;

/** The load an amp's watts are rated into: the amp is a voltage ceiling, √(8 Ω · W). */
export const AMP_RATING = { imp: 8 } as const satisfies Required<NominalImpedance>;

/** A part's nominal impedance, Ω: its own, or `FALLBACK_OHMS` where it isn't entered. */
export const ohmsOf = (part: NominalImpedance): number =>
  part.imp !== undefined && part.imp > 0 ? part.imp : FALLBACK_OHMS;

/** The voltage that puts `watts` into the part, V RMS. */
export const wattsToVolts = (watts: number, part: NominalImpedance): number =>
  Math.sqrt(watts * ohmsOf(part));

/** The watts `volts` puts into the part, W. */
export const voltsToWatts = (volts: number, part: NominalImpedance): number =>
  (volts * volts) / ohmsOf(part);
