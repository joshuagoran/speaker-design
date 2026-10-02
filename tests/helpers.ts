// Shared test helpers and independent physics references.
import assert from "node:assert";
import type { ThieleSmall, VentSpec } from "../src/types";

// The tests give a vent only the fields its layout reads; the cast marks the partial on purpose.
export const vent = (v: Partial<VentSpec>) => v as VentSpec;

/** The Thiele-Small fields these references use. */
type TsFields = Pick<ThieleSmall, "Fs" | "Sd" | "Mms" | "Re" | "Bl" | "Qms">;

export const RHO = 1.18,
  C = 343,
  P0 = 2e-5;
export const db = (x: number) => 20 * Math.log10(x);
export const near = <T extends { f: number }>(curve: T[], f: number): T =>
  curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));
// `t` is the test context the callers pass; unused
export const close = (t: unknown, a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ""} expected ${b} ± ${tol}, got ${a}`);
export const rel = (t: unknown, a: number, b: number, tol: number, msg?: string) =>
  assert.ok(
    Math.abs(a - b) <= tol * Math.abs(b),
    `${msg || ""} expected ${b} ± ${tol * 100}%, got ${a}`,
  );
// Thiele-Small quantities the model actually uses (from Fs, Mms, Sd, Bl, Re, Qms), SI units.
export function tsModel(ts: TsFields) {
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
export const massLineSPL = (ts: TsFields, volts: number) =>
  db((RHO * volts * ts.Bl * (ts.Sd / 1e4)) / (2 * Math.PI * ts.Re * (ts.Mms / 1e3)) / P0);
// -3 dB frequency of a 2nd-order highpass with corner fc and quality Q.
export const f3SecondOrder = (fc: number, Q: number) => {
  const a = 1 / (2 * Q * Q) - 1;
  return fc * Math.sqrt(a + Math.sqrt(a * a + 1));
};
// Helmholtz tuning, one flanged + one free end per opening (1.46 r), n equal openings.
export function helmholtz(VbL: number, areaIn2: number, lenIn: number, n = 1) {
  const Sp = areaIn2 * 0.00064516,
    r = Math.sqrt(Sp / n / Math.PI);
  const Leff = lenIn * 0.0254 + 1.46 * r;
  return (C / (2 * Math.PI)) * Math.sqrt(Sp / ((VbL / 1000) * Leff));
}
