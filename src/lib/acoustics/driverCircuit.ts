// The driver and the vented box's losses as acoustic circuit elements: the one derivation the PA box models
// (lib/pa/calc boxModel, closedBox) and the horn engine (lib/acoustics/hornModel) share, so the two cannot drift apart.
// Symbols are Thiele and Small's; each is defined in the DriverCircuit and VentResistances types (src/types.ts).
import type { BoxModelTS, DriverCircuit, VentResistances } from "../../types";
import { GRAMS_PER_KG, SQ_CM_PER_SQ_M } from "../../constants/units";

/**
 * The driver's acoustic circuit at `volts` RMS. `frontAirMass` (kg) comes off the moving mass when the caller's own
 * radiation load carries the front's air load (the horn engine); the box models leave it at 0.
 */
export function driverCircuit(ts: BoxModelTS, volts: number, frontAirMass = 0): DriverCircuit {
  const Sd = ts.Sd / SQ_CM_PER_SQ_M;
  const Mms = ts.Mms / GRAMS_PER_KG;
  /** the suspension's mechanical compliance, m/N, from Fs = 1/(2π·√(Mms·Cms)) */
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  return {
    Sd,
    Mms,
    Mas: (Mms - frontAirMass) / (Sd * Sd),
    Cas: Cms * Sd * Sd,
    Ras: (2 * Math.PI * ts.Fs * Mms) / ts.Qms / (Sd * Sd),
    Rae: (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd),
    Pg: (volts * ts.Bl) / (ts.Re * Sd),
  };
}

/**
 * A vented box's leakage and vent losses as resistances, from their quality factors at the tuning `Fb` (Hz), the box's
 * acoustic compliance `Cab` (m³/Pa) and the vent's acoustic mass `Map` (kg/m⁴). A non-finite `Qp` means a lossless
 * vent.
 */
export const ventResistances = (
  Fb: number,
  Cab: number,
  Map: number,
  QL: number,
  Qp: number,
): VentResistances => ({
  Ral: QL / (2 * Math.PI * Fb * Cab),
  Rap: Number.isFinite(Qp) ? (2 * Math.PI * Fb * Map) / Qp : 0,
});
