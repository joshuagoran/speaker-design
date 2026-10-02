// PA stack dispersion: sub, mid and horn stacked vertically, each through its LR24/LR48 crossover filters, with
// its own directivity (sub and mid as pistons, the horn as constant coverage above its control frequency)
// and its path length to the listener. The DSP is time-aligned on the horn axis at the listening distance,
// so the map shows lobing at the crossovers (vertical) and beaming (horizontal). Bands are level-matched.
import {
  linkwitzRileyFilter,
  pistonDirectivity,
  waveguideDirectivity,
  logSpacedFrequencies,
  type Complex,
} from "../hifi/hifi";
import type {
  DispersionPlane,
  FrequencyPoint,
  HifiDispersionMap,
  ListenerGeometry,
  PaStackGeometry,
} from "../../types";

const C = 343,
  IN = 0.0254;
const cm = (re: number, im = 0): Complex => ({ re, im });
const cmul = (a: Complex, b: Complex) => cm(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cadd = (a: Complex, b: Complex) => cm(a.re + b.re, a.im + b.im);
const cabs = (a: Complex) => Math.hypot(a.re, a.im);
const cexp = (ph: number) => cm(Math.cos(ph), Math.sin(ph));

/** A driver in the sum: its height, its crossover filters and, for a piston, its radius in metres (the horn has none). */
type Source =
  | { z: number; a: number; filt: (f: number) => Complex; horn?: undefined }
  | { z: number; horn: true; filt: (f: number) => Complex; a?: undefined };

// s: { sub: { zIn, Sd }, mid: { zIn, Sd }, horn: { zIn, covH, covV, wIn, hIn }, xoLo, xoHi, orderLo, orderHi }
// geo: { th (rad, horizontal), eyeIn (ear height, in), distM }. Returns [{ f, spl }] (dB, relative).
export function paResponseAt(
  s: PaStackGeometry,
  geo: ListenerGeometry,
  freqs: number[],
): FrequencyPoint[] {
  const orderLo = s.orderLo ?? s.order ?? 4,
    orderHi = s.orderHi ?? s.order ?? 4,
    dist = geo.distM,
    ref = s.horn.zIn;
  const src = (
    [
      s.sub && s.sub.Sd
        ? {
            z: s.sub.zIn,
            a: Math.sqrt(s.sub.Sd / 1e4 / Math.PI),
            filt: (f: number) => linkwitzRileyFilter(f, s.xoLo, orderLo, "lp"),
          }
        : null,
      {
        z: s.mid.zIn,
        a: Math.sqrt(s.mid.Sd / 1e4 / Math.PI),
        filt: (f: number) =>
          cmul(
            linkwitzRileyFilter(f, s.xoLo, orderLo, "hp"),
            linkwitzRileyFilter(f, s.xoHi, orderHi, "lp"),
          ),
      },
      {
        z: s.horn.zIn,
        horn: true,
        filt: (f: number) => linkwitzRileyFilter(f, s.xoHi, orderHi, "hp"),
      },
    ].filter(Boolean) as Source[]
  ) // boundary cast: filter(Boolean) drops the null a stack without a sub leaves, which the checker can't see
    .map((o) => {
      const dz = (geo.eyeIn - o.z) * IN,
        r = Math.hypot(dist, dz),
        r0 = Math.hypot(dist, (ref - o.z) * IN);
      const tv = Math.atan2(dz, dist),
        off = Math.acos(Math.cos(geo.th) * Math.cos(tv));
      return { ...o, r, r0, tv, off };
    });
  return freqs.map((f) => {
    const k = (2 * Math.PI * f) / C;
    let p = cm(0);
    for (const o of src) {
      const d = o.horn
        ? waveguideDirectivity(f, s.horn.covH, s.horn.covV, s.horn.wIn, s.horn.hIn, geo.th, o.tv)
        : pistonDirectivity(f, o.a, o.off);
      p = cadd(p, cmul(cmul(o.filt(f), cm((d * dist) / o.r)), cexp(-k * (o.r - o.r0))));
    }
    return { f, spl: 20 * Math.log10(Math.max(1e-9, cabs(p))) };
  });
}

// level vs angle and frequency, normalised to the horn axis. plane "h" (at horn height) or "v" (−60° below to +60° above)
export function paDispersionMap(
  s: PaStackGeometry,
  plane: DispersionPlane = "v",
  distM = 5,
): HifiDispersionMap {
  const freqs = logSpacedFrequencies(100, 20000, 72);
  const angles =
    plane === "h"
      ? Array.from({ length: 19 }, (_, i) => i * 5)
      : Array.from({ length: 25 }, (_, i) => -60 + i * 5);
  const on = paResponseAt(s, { th: 0, eyeIn: s.horn.zIn, distM }, freqs);
  const rows = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const geo =
      plane === "h"
        ? { th: rad, eyeIn: s.horn.zIn, distM }
        : { th: 0, eyeIn: s.horn.zIn + (Math.tan(rad) * distM) / IN, distM };
    return paResponseAt(s, geo, freqs).map((o, i) => o.spl - on[i].spl);
  });
  return { angles, freqs, rows };
}

// first vertical null near the mid/horn crossover: the angle where the path difference is half a wavelength
export function firstNullAngleDeg(spacingIn: number, f: number): number | null {
  const x = C / f / (2 * spacingIn * IN);
  return x >= 1 ? null : (Math.asin(x) * 180) / Math.PI;
}
