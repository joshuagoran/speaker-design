// Vented-box lumped-element model.
// Pressure/volume-velocity (acoustic impedance) analogy, both-end port correction,
// Butterworth 24 dB/oct highpass applied to the acoustic output.
// Half space, 1 m, one cabinet, no room gain.

const RHO = 1.18;   // kg/m^3
const C   = 343;    // m/s

const cx   = (re, im = 0) => ({ re, im });
const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
const cinv = (a) => cdiv(cx(1), a);
const cabs = (a) => Math.hypot(a.re, a.im);

/**
 * @param {object} ts  Fs, Qms, Vas(L), Sd(cm^2), Xmax(mm), Re, Bl, Mms(g), aes(W)
 * @param {number} VbL net internal volume, litres
 * @param {number} SpIn2 total port area, in^2
 * @param {number} LpIn  duct length, inches
 * @param {number} hpf   highpass corner, Hz (BW24)
 * @param {number} volts drive voltage
 */
// The model now lives in tools/calc.js (the planner and the tests use it); this wraps it so
// older scripts keep working. opts: { nPorts, QL, Qp } as in boxModel.
import { boxModel } from "../tools/calc.js";
export function ventedBox(ts, VbL, SpIn2, LpIn, hpf, volts, opts = {}) {
  return boxModel(ts, VbL, SpIn2, LpIn, hpf, volts, "BW24", opts);
}

/**
 * Which limit bites first, and the SPL at that limit.
 * Limits are amp voltages for a sine into Z. Port (17 m/s) and Xmax use that sine's peaks;
 * thermal is program power, 2 x AES (AES noise has a 6 dB crest).
 */
export function firstLimit(model, ts, refVolts, Z = 8, maxVel = 17) {
  if (!model) return null;
  const vPort = (refVolts * maxVel) / model.peakVel;
  const vXmax = (refVolts * 100) / model.xmaxPct;
  const vTherm = Math.sqrt(2 * ts.aes * Z);
  const V = Math.min(vPort, vXmax, vTherm);
  const scale = 20 * Math.log10(V / refVolts);
  return {
    volts: V,
    watts: (V * V) / Z,
    who: V === vPort ? 'port' : V === vXmax ? 'xmax' : 'thermal',
    label: V === vPort ? 'port air speed'
         : V === vXmax ? 'cone travel (Xmax)'
         : 'driver program rating',
    velocity: model.peakVel * V / refVolts,
    xmaxPct:  model.xmaxPct * V / refVolts,
    spl30: model.spl30 + scale,
    spl35: model.spl35 + scale,
    spl45: model.spl45 + scale,
    scale
  };
}

export const PLY_IN = 0.75;
export const grossLitres = (w, h, d, ply = PLY_IN) =>
  ((w - 2 * ply) * (h - 2 * ply) * (d - 2 * ply) * 16.387) / 1000;
export const cabinetWeightLb = (w, h, d, braces = 2, lbPerFt2 = 2.3) =>
  ((2 * (w * h + w * d + h * d) + braces * w * d) / 144) * lbPerFt2;
