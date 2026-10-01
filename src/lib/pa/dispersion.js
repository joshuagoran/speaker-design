// PA stack dispersion: sub, mid and horn stacked vertically, each through its LR24 crossover filters, with
// its own directivity (sub and mid as pistons, the horn as constant coverage above its control frequency)
// and its path length to the listener. The DSP is time-aligned on the horn axis at the listening distance,
// so the map shows lobing at the crossovers (vertical) and beaming (horizontal). Bands are level-matched.
import { lr, piston, waveguide, logFreqs } from "../hifi/hifi.js";

const C = 343, IN = 0.0254;
const cm = (re, im = 0) => ({ re, im });
const cmul = (a, b) => cm(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cadd = (a, b) => cm(a.re + b.re, a.im + b.im);
const cabs = (a) => Math.hypot(a.re, a.im);
const cexp = (ph) => cm(Math.cos(ph), Math.sin(ph));

// s: { sub: { zIn, Sd }, mid: { zIn, Sd }, horn: { zIn, covH, covV, wIn, hIn }, xoLo, xoHi, order }
// geo: { th (rad, horizontal), eyeIn (ear height, in), distM }. Returns [{ f, spl }] (dB, relative).
export function paResponseAt(s, geo, freqs) {
  const order = s.order || 4, dist = geo.distM, ref = s.horn.zIn;
  const src = [
    s.sub && s.sub.Sd ? { z: s.sub.zIn, a: Math.sqrt(s.sub.Sd / 1e4 / Math.PI), filt: (f) => lr(f, s.xoLo, order, "lp") } : null,
    { z: s.mid.zIn, a: Math.sqrt(s.mid.Sd / 1e4 / Math.PI), filt: (f) => cmul(lr(f, s.xoLo, order, "hp"), lr(f, s.xoHi, order, "lp")) },
    { z: s.horn.zIn, horn: true, filt: (f) => lr(f, s.xoHi, order, "hp") },
  ].filter(Boolean).map((o) => {
    const dz = (geo.eyeIn - o.z) * IN, r = Math.hypot(dist, dz), r0 = Math.hypot(dist, (ref - o.z) * IN);
    const tv = Math.atan2(dz, dist), off = Math.acos(Math.cos(geo.th) * Math.cos(tv));
    return { ...o, r, r0, tv, off };
  });
  return freqs.map((f) => {
    const k = (2 * Math.PI * f) / C;
    let p = cm(0);
    for (const o of src) {
      const d = o.horn ? waveguide(f, s.horn.covH, s.horn.covV, s.horn.wIn, s.horn.hIn, geo.th, o.tv) : piston(f, o.a, o.off);
      p = cadd(p, cmul(cmul(o.filt(f), cm((d * dist) / o.r)), cexp(-k * (o.r - o.r0))));
    }
    return { f, spl: 20 * Math.log10(Math.max(1e-9, cabs(p))) };
  });
}

// level vs angle and frequency, normalised to the horn axis. plane "h" (at horn height) or "v" (−60° below to +60° above)
export function paDispersionMap(s, plane = "v", distM = 5) {
  const freqs = logFreqs(100, 20000, 72);
  const angles = plane === "h" ? Array.from({ length: 19 }, (_, i) => i * 5) : Array.from({ length: 25 }, (_, i) => -60 + i * 5);
  const on = paResponseAt(s, { th: 0, eyeIn: s.horn.zIn, distM }, freqs);
  const rows = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const geo = plane === "h" ? { th: rad, eyeIn: s.horn.zIn, distM } : { th: 0, eyeIn: s.horn.zIn + (Math.tan(rad) * distM) / IN, distM };
    return paResponseAt(s, geo, freqs).map((o, i) => o.spl - on[i].spl);
  });
  return { angles, freqs, rows };
}

// first vertical null near the mid/horn crossover: the angle where the path difference is half a wavelength
export function firstNullDeg(spacingIn, f) {
  const x = C / f / (2 * spacingIn * IN);
  return x >= 1 ? null : (Math.asin(x) * 180) / Math.PI;
}
