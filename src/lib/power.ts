// Watts and volts at a driver's nominal impedance: the one rule every engine (PA, Hi-fi, Speaker, Stack, Space and the
// optimizers) uses to turn a power figure into a drive voltage and back. A driver takes `volts² / imp` watts. An amp
// power setting is the watts into the driver's nominal impedance, as entered: the user gives the amp's rating at the
// load it drives (the settings' tooltip says so), and the model takes it as it is, with no conversion from 8 Ω.
// Pure.
import type { NominalImpedance } from "../types";

/** The impedance a driver is taken at where its nominal impedance isn't entered, Ω (a gap: `NominalImpedance`). */
export const FALLBACK_OHMS = 8;

/** The load a 2.83 V sensitivity is 1 W into, Ω: a datasheet's 1 W figure moves to 2.83 V by 10·log10(8 / imp). */
export const SENSITIVITY_REFERENCE_OHMS = 8;

/** A part's nominal impedance, Ω: its own, or `FALLBACK_OHMS` where it isn't entered. */
export const ohmsOf = (part: NominalImpedance): number =>
  part.imp !== undefined && part.imp > 0 ? part.imp : FALLBACK_OHMS;

/** The voltage that puts `watts` into the part, V RMS. */
export const wattsToVolts = (watts: number, part: NominalImpedance): number =>
  Math.sqrt(watts * ohmsOf(part));

/** The watts `volts` puts into the part, W. */
export const voltsToWatts = (volts: number, part: NominalImpedance): number =>
  (volts * volts) / ohmsOf(part);
