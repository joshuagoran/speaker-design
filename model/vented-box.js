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
export function ventedBox(ts, VbL, SpIn2, LpIn, hpf, volts, opts = {}) {
  if (!VbL || VbL <= 0 || !SpIn2 || SpIn2 <= 0 || LpIn <= 0) return null;
  const N = opts.points || 400;
  const fLo = opts.fLo || 15, fHi = opts.fHi || 300;

  const Sd = ts.Sd / 1e4, Mms = ts.Mms / 1e3, Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd);
  const Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const Cab = Vb / (RHO * C * C);

  const Sp   = SpIn2 * 0.00064516;
  const reff = Math.sqrt(Sp / Math.PI);
  const Leff = LpIn * 0.0254 + 1.46 * reff;        // flanged both ends
  const Map  = (RHO * Leff) / Sp;
  const Fb   = (C / (2 * Math.PI)) * Math.sqrt(Sp / (Vb * Leff));
  const Ral  = 7 / (2 * Math.PI * Fb * Cab);       // box leakage, Ql = 7

  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const out = [];
  for (let i = 0; i < N; i++) {
    const f = fLo * Math.pow(fHi / fLo, i / (N - 1));
    const w = 2 * Math.PI * f, s = cx(0, w);
    const Zd   = cadd(cx(Ras + Rae), cadd(cmul(s, cx(Mas)), cinv(cmul(s, cx(Cas)))));
    const Zc   = cinv(cmul(s, cx(Cab)));
    const Zp   = cadd(cmul(s, cx(Map)), cx(0.3));
    const Zbox = cinv(cadd(cadd(cinv(Zc), cinv(Zp)), cinv(cx(Ral))));
    const Ud = cdiv(cx(Pg), cadd(Zd, Zbox));       // cone volume velocity
    const Up = cdiv(cmul(Ud, Zbox), Zp);           // port volume velocity
    const Ut = { re: Ud.re - Up.re, im: Ud.im - Up.im };
    const hp = Math.pow(f / hpf, 4) / Math.sqrt(1 + Math.pow(f / hpf, 8));
    const p  = (RHO * w * cabs(Ut)) / (2 * Math.PI);
    out.push({
      f,
      spl: 20 * Math.log10((p * hp) / 2e-5),
      xmm: (cabs(Ud) / (w * Sd)) * hp * 1000,      // one-way cone travel, mm
      vel: (cabs(Up) / Sp) * hp                    // port air speed, m/s
    });
  }

  const band = out.filter(o => o.f > 80 && o.f < 200);
  const ref  = band.reduce((a, o) => a + o.spl, 0) / (band.length || 1);
  const f3   = (out.find(o => o.spl >= ref - 3) || out[0]).f;
  const lo   = out.filter(o => o.f > 20 && o.f < 90);
  const at   = (t) => out.reduce((b, o) => Math.abs(o.f - t) < Math.abs(b.f - t) ? o : b);

  return {
    curve: out, Fb, f3, ref,
    spl30: at(30).spl, spl35: at(35).spl, spl45: at(45).spl,
    peakVel: Math.max(...lo.map(o => o.vel)),
    peakX:   Math.max(...lo.map(o => o.xmm)),
    xmaxPct: (Math.max(...lo.map(o => o.xmm)) / ts.Xmax) * 100
  };
}

/**
 * Which limit bites first, and the SPL at that limit.
 * Port limit taken at 17 m/s peak air speed.
 */
export function firstLimit(model, ts, refVolts, Z = 8, maxVel = 17) {
  if (!model) return null;
  const vPort = (refVolts * maxVel) / model.peakVel;
  const vXmax = (refVolts * 100) / model.xmaxPct;
  const vTherm = Math.sqrt(ts.aes * Z);
  const V = Math.min(vPort, vXmax, vTherm);
  const scale = 20 * Math.log10(V / refVolts);
  return {
    volts: V,
    watts: (V * V) / Z,
    who: V === vPort ? 'port' : V === vXmax ? 'xmax' : 'thermal',
    label: V === vPort ? 'port air speed'
         : V === vXmax ? 'cone travel (Xmax)'
         : 'driver power rating',
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
