// The horn engine: a front-loaded horn box as Hornresp models one. The driver is the box models' acoustic circuit
// (lib/pa/calc boxModel, closedBox): a pressure source Pg = V·Bl/(Re·Sd) behind Ras + Rae + j(ωMas − 1/(ωCas)). Its
// front drives a throat chamber and the horn's segments into the mouth's radiation impedance; its rear drives a
// sealed or vented chamber. With no segments, no throat chamber and no radiation load it is exactly those box models.
import type { Complex, HornDesign, HornModel, HornPoint } from "../../types";
import { AIR_DENSITY, HORN_LEAK_Q, HORN_PORT_Q, SOUND_SPEED } from "../../constants/hornEngine";
import { abs, add, arg, cx, div, exp, inv, jx, mul, scale, sub } from "./complex";
import { mouthImpedance } from "./radiation";
import { chainMatrix, inputImpedance, outputFlowRatio } from "./hornSegments";

const CM2_TO_M2 = 1e-4,
  CM_TO_M = 1e-2,
  L_TO_M3 = 1e-3;
const RHO_C2 = AIR_DENSITY * SOUND_SPEED * SOUND_SPEED;

export interface HornModelOptions {
  /**
   * Load the mouth (or the cone, with no segments) with its radiation impedance. On by default; off reproduces the box
   * models, which leave it out. With it on, the driver's moving mass drops by one side's air load (8/3·ρa³), which the
   * datasheet Mms includes and the radiation impedance now carries.
   */
  radiationLoad?: boolean;
}

/** n log-spaced frequencies from fmin to fmax, Hz: the horn engine's grid (10 Hz–2 kHz reaches a mid horn's crossover). */
export const hornGrid = (fmin = 10, fmax = 2000, n = 500) =>
  Array.from({ length: n }, (_, i) => fmin * Math.pow(fmax / fmin, i / (n - 1)));

/** Unwraps a phase sequence in place, so no step between neighbors exceeds π. */
function unwrap(ph: number[]) {
  for (let i = 1; i < ph.length; i++) {
    let d = ph[i] - ph[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    ph[i] = ph[i - 1] + d;
  }
}

/** The front's load at f: the horn's chain, the mouth's load, the horn's input and the throat chamber's divider. */
function frontLoad(design: HornDesign, f: number, radiationLoad: boolean) {
  const { segments } = design;
  const mouthArea = segments.length
    ? segments[segments.length - 1].s2 * CM2_TO_M2
    : design.driver.Sd * CM2_TO_M2;
  const M = chainMatrix(segments, f);
  const Zload = radiationLoad ? mouthImpedance(mouthArea, f, design.angle, design.count) : cx(0);
  const Zh = segments.length ? inputImpedance(M, Zload) : Zload;
  const Ctc = (design.throatChamber * L_TO_M3) / RHO_C2;
  // the throat chamber sits in parallel with the horn's input: Zf = Zh/(1 + jωCtc·Zh), and Ut = U/(1 + jωCtc·Zh)
  const chamber = add(cx(1), mul(jx(2 * Math.PI * f * Ctc), Zh));
  return { M, Zload, Zh, chamber, Zf: div(Zh, chamber) };
}

/** The design's response at each frequency (Hz) with `volts` RMS on each driver. */
export function hornModel(
  design: HornDesign,
  freqs: readonly number[],
  volts: number,
  opts: HornModelOptions = {},
): HornModel {
  const { radiationLoad = true } = opts;
  const { driver: ts, segments, rear, count, angle } = design;
  const Sd = ts.Sd * CM2_TO_M2;
  const airMass = radiationLoad ? (8 / 3) * AIR_DENSITY * Math.pow(Sd / Math.PI, 1.5) : 0;
  const Mmd = ts.Mms / 1000 - airMass;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * (ts.Mms / 1000));
  const Mas = Mmd / (Sd * Sd),
    Cas = Cms * Sd * Sd;
  const Ras = (2 * Math.PI * ts.Fs * (ts.Mms / 1000)) / ts.Qms / (Sd * Sd);
  const Rae = (ts.Bl * ts.Bl) / ts.Re / (Sd * Sd);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);

  const throatArea = segments.length ? segments[0].s1 * CM2_TO_M2 : Sd;

  // the rear chamber: compliance, and the vent's mass with the box model's leak and port losses
  const Cab = (rear.liters * L_TO_M3) / RHO_C2;
  const vent = rear.port
    ? (() => {
        const Sp = rear.port.area * CM2_TO_M2;
        const Map = (AIR_DENSITY * rear.port.effLength * CM_TO_M) / Sp;
        const Fb = 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
        return {
          Sp,
          Map,
          Fb,
          Ral: HORN_LEAK_Q / (2 * Math.PI * Fb * Cab),
          Rap: (2 * Math.PI * Fb * Map) / HORN_PORT_Q,
        };
      })()
    : null;
  const offset = design.portOffset * CM_TO_M;

  const out: HornPoint[] = [];
  const phase: number[] = [];
  for (const f of freqs) {
    const w = 2 * Math.PI * f,
      k = w / SOUND_SPEED;
    const Zd = cx(Ras + Rae, w * Mas - 1 / (w * Cas));
    const { M, Zload, chamber, Zf } = frontLoad(design, f, radiationLoad);
    // rear: the chamber's compliance, with the vent and the leak beside it when vented
    const portZ = vent ? cx(vent.Rap, w * vent.Map) : null;
    const Yr = vent && portZ ? add(cx(1 / vent.Ral, w * Cab), inv(portZ)) : jx(w * Cab);
    const Zr = inv(Yr);
    // the cone's volume velocity, and where it goes
    const Zm = add(add(Zd, Zf), Zr);
    const U = div(cx(Pg), Zm);
    const Ut = div(U, chamber); // into the throat
    const Um = segments.length ? mul(Ut, outputFlowRatio(M, Zload)) : Ut; // out of the mouth
    const pBox = mul(U, Zr);
    const Up = vent && portZ ? div(pBox, portZ) : cx(0);
    const Ul = vent ? scale(pBox, 1 / vent.Ral) : cx(0);
    // the vent and leak radiate in antiphase to the cone's front, from `offset` behind the mouth
    const rearOut = mul(add(Up, Ul), exp(cx(0, -k * offset)));
    const Utot = scale(sub(Um, rearOut), count);
    // p = jωρ·U/(Ω·r) at r = 1 m in a solid angle Ω = angle·π
    const p = scale(mul(jx(w * AIR_DENSITY), Utot), 1 / (angle * Math.PI));
    const ze = abs(add(cx(ts.Re), div(cx((ts.Bl * ts.Bl) / (Sd * Sd)), sub(Zm, cx(Rae)))));
    phase.push(arg(p));
    out.push({
      f,
      spl: 20 * Math.log10(abs(p) / 2e-5),
      phase: 0,
      delay: 0,
      xmm: Math.SQRT2 * (abs(U) / (w * Sd)) * 1000,
      portVel: vent ? Math.SQRT2 * (abs(Up) / vent.Sp) : 0,
      throatVel: Math.SQRT2 * (abs(Ut) / throatArea),
      ze,
    });
  }
  unwrap(phase);
  for (let i = 0; i < out.length; i++) {
    out[i].phase = phase[i];
    // group delay −dφ/dω, central differences (one-sided at the ends), ms
    const a = Math.max(0, i - 1),
      b = Math.min(out.length - 1, i + 1);
    const dw = 2 * Math.PI * (out[b].f - out[a].f);
    out[i].delay = dw > 0 ? (-(phase[b] - phase[a]) / dw) * 1000 : 0;
  }
  return { curve: out, fb: vent ? vent.Fb : null };
}

/** The throat chamber's and the horn's load on the cone at f, acoustic ohms: for tests and the planner's readouts. */
export const hornFrontImpedance = (design: HornDesign, f: number, radiationLoad = true): Complex =>
  frontLoad(design, f, radiationLoad).Zf;
