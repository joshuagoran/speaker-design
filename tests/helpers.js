// Shared test helpers and independent physics references.
import assert from "node:assert";
export const RHO = 1.18,
  C = 343,
  P0 = 2e-5;
export const db = (x) => 20 * Math.log10(x);
export const near = (curve, f) =>
  curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
export const close = (t, a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b} ± ${tol}, got ${a}`);
export const rel = (t, a, b, tol, msg) =>
  assert.ok(
    Math.abs(a - b) <= tol * Math.abs(b),
    `${msg || ""} expected ${b} ± ${tol * 100}%, got ${a}`,
  );
// Thiele-Small quantities the model actually uses (from Fs, Mms, Sd, Bl, Re, Qms), SI units.
export function tsModel(ts) {
  const Sd = ts.Sd / 1e4,
    Mms = ts.Mms / 1e3;
  const Cms = 1 / ((2 * Math.PI * ts.Fs) ** 2 * Mms);
  const VasL = RHO * C * C * Sd * Sd * Cms * 1000;
  const Qes = (2 * Math.PI * ts.Fs * Mms * ts.Re) / (ts.Bl * ts.Bl);
  const Qts = (Qes * ts.Qms) / (Qes + ts.Qms);
  const eta0 = (RHO * ts.Bl ** 2 * Sd ** 2) / (2 * Math.PI * C * ts.Re * Mms ** 2); // reference efficiency
  return { Sd, Mms, Cms, VasL, Qes, Qts, eta0 };
}
// Half-space SPL of the mass-controlled region for drive `volts` (RMS): p = rho*V*Bl*Sd/(2*pi*Re*Mms).
export const massLineSPL = (ts, volts) =>
  db((RHO * volts * ts.Bl * (ts.Sd / 1e4)) / (2 * Math.PI * ts.Re * (ts.Mms / 1e3)) / P0);
// -3 dB frequency of a 2nd-order highpass with corner fc and quality Q.
export const f3SecondOrder = (fc, Q) => {
  const a = 1 / (2 * Q * Q) - 1;
  return fc * Math.sqrt(a + Math.sqrt(a * a + 1));
};
// Helmholtz tuning, one flanged + one free end per opening (1.46 r), n equal openings.
export function helmholtz(VbL, areaIn2, lenIn, n = 1) {
  const Sp = areaIn2 * 0.00064516,
    r = Math.sqrt(Sp / n / Math.PI);
  const Leff = lenIn * 0.0254 + 1.46 * r;
  return (C / (2 * Math.PI)) * Math.sqrt(Sp / ((VbL / 1000) * Leff));
}
