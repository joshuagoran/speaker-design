// Hi-fi 2-way model: woofer (sealed or vented) + tweeter, active crossover, baffle step, placement, and the
// response at a listening position (off-axis, crossover lobing). Pure functions, no DOM.
import { boxModel, closedBox, ventTuning, ampV, thermalV, keeleF, plyLb, hpGain } from "./calc.js";

const C = 343, IN = 0.0254;

// ---- small complex helpers (local: the crossover sum needs phase) ----
const cm = (re, im = 0) => ({ re, im });
const cmul = (a, b) => cm(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cadd = (a, b) => cm(a.re + b.re, a.im + b.im);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cm((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = (a) => Math.hypot(a.re, a.im);
const cexp = (ph) => cm(Math.cos(ph), Math.sin(ph));

// Linkwitz-Riley low/high pass as complex transfer functions: LR(2n) = Butterworth(n) squared.
// order 4 (24 dB/oct) or 8 (48 dB/oct). The pair sums flat in magnitude and in phase.
function butter(s, n) {
  // normalised Butterworth denominator for n = 2 or 4
  if (n === 2) return cadd(cadd(cmul(s, s), cmul(cm(Math.SQRT2), s)), cm(1));
  const q1 = 2 * Math.cos((3 * Math.PI) / 8), q2 = 2 * Math.cos(Math.PI / 8);
  const a = cadd(cadd(cmul(s, s), cmul(cm(q1), s)), cm(1)), b = cadd(cadd(cmul(s, s), cmul(cm(q2), s)), cm(1));
  return cmul(a, b);
}
export function lr(f, fc, order = 4, kind = "lp") {
  const s = cm(0, f / fc), n = order / 2, d = butter(s, n), d2 = cmul(d, d);
  if (kind === "lp") return cdiv(cm(1), d2);
  let sn = cm(1); for (let i = 0; i < order; i++) sn = cmul(sn, s);
  return cdiv(sn, d2);
}

// ---- baffle step, placement, compensation (all magnitude shelves) ----
export const baffleStepF3 = (baffleWIn) => 115 / (baffleWIn * IN);            // −3 dB point, Hz
// 0 dB well above f3, −6 dB well below (radiation from half space to full space)
export function baffleStep(f, baffleWIn) {
  const x = (0.707 * f) / baffleStepF3(baffleWIn);
  return 0.5 * Math.sqrt((1 + 4 * x * x) / (1 + x * x));
}
// DSP compensation: a low shelf of `db` at the same corner (costs that much headroom at low frequencies)
export function bscEq(f, baffleWIn, db) {
  if (!db) return 1;
  const B = Math.pow(10, db / 20), x = (0.707 * f) / baffleStepF3(baffleWIn);
  return Math.sqrt((B * B + x * x) / (1 + x * x));
}
export const PLACES = { free: { name: "Free-standing", db: 0 }, wall: { name: "Wall", db: 3 }, corner: { name: "Corner", db: 6 } };
// boundary reinforcement below ~ c / (4 · distance to the wall)
export function boundary(f, place, wallM) {
  const db = (PLACES[place] || PLACES.free).db;
  if (!db) return 1;
  const G = Math.pow(10, db / 20), x = f / (C / (4 * Math.max(0.1, wallM)));
  return Math.sqrt((G * G + x * x) / (1 + x * x));
}

// ---- directivity ----
// Bessel J1 (Numerical Recipes rational approximation)
function j1(x) {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a = x * (72362614232 + y * (-7895059235 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const b = 144725228442 + y * (2300535178 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a / b;
  }
  const z = 8 / ax, y = z * z, xx = ax - 2.356194491;
  const p = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const q = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const v = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p - z * Math.sin(xx) * q);
  return x < 0 ? -v : v;
}
// rigid piston of radius a (m) in a baffle, off-axis by theta (rad): 2·J1(x)/x, x = ka·sin θ
export function piston(f, a, theta) {
  const x = ((2 * Math.PI * f) / C) * a * Math.sin(Math.min(Math.abs(theta), Math.PI / 2));
  return x < 1e-6 ? 1 : Math.abs((2 * j1(x)) / x);
}
// waveguide: constant coverage (−6 dB at the edges) above the mouth's control frequency, wider below it
export function waveguide(f, covH, covV, mouthWIn, mouthHIn, th, tv) {
  const fh = keeleF(covH, mouthWIn), fv = covV && mouthHIn ? keeleF(covV, mouthHIn) : fh;
  const bh = Math.min(180, f >= fh ? covH : (covH * fh) / f), bv = Math.min(180, f >= fv ? (covV || covH) : ((covV || covH) * fv) / f);
  const db = -6 * (Math.pow(th / ((bh / 2) * Math.PI / 180), 2) + Math.pow(tv / ((bv / 2) * Math.PI / 180), 2));
  return Math.pow(10, Math.max(-40, db) / 20);
}

// ---- box ----
// longest port (centreline, inches) that fits: straight front to back; one elbow turns it up (or down) the back wall,
// using at most half the inner height so it stays clear of the woofer; two elbows fold it back along the bottom or top
export function portMaxLen(dim, wall, port) {
  const D = dim.d - 2 * wall, H = dim.h - 2 * wall, dia = port.dia, e = port.elbows || 0;
  const straight = D - dia / 2 - 1;
  if (e === 0) return straight;
  const up = H / 2 - dia;
  return e === 1 ? D - dia - 1 + Math.max(0, up) : 2 * (D - dia - 1) + Math.max(0, up);
}
export const grossL = (d, t) => Math.max(0, (d.w - 2 * t) * (d.h - 2 * t) * (d.d - 2 * t)) * 16.387 / 1e3;
export const portArea = (p) => p.n * Math.PI * Math.pow(p.dia / 2, 2);
const MDF_LB = { 0.75: 3.4, 0.5: 2.3 };
export const panelLb = (t, mat) => (mat === "mdf" ? MDF_LB[t] ?? 3.4 : plyLb(t));
export function boxLb(d, t, mat) {
  const ft2 = (2 * (d.w * d.h + d.w * d.d + d.h * d.d)) / 144;
  return ft2 * panelLb(t, mat);
}
// where the drivers sit (inches from the box bottom): tweeter near the top, woofer just below it;
// a freestanding waveguide sits on the box top, so the woofer moves up to the top of the baffle
export function layout(w, t, d, onTop) {
  const face = t.faceplate || { w: 4, h: 4 };
  if (onTop) { const th = d.h + face.h / 2, wh = d.h - 1 - w.size / 2; return { tweeterIn: th, wooferIn: wh, spacingIn: th - wh, onTop: true }; }
  const th = d.h - 1 - face.h / 2;
  const wh = th - face.h / 2 - 0.5 - w.size / 2;
  return { tweeterIn: th, wooferIn: wh, spacingIn: th - wh };
}

// ---- passive radiator box ----
// The vented circuit with the port's air mass replaced by the radiator: its moving mass (plus added mass), its
// suspension compliance and its losses, n radiators in parallel. Box tuning Fb (where the cone barely moves):
// the radiator mass against the box and suspension stiffness together; the radiator's own resonance Fp, below
// Fb, puts a notch in the output. pr: { drv, n, addG }.
export function prTuning(drv, n, addG, VbL) {
  const rho = 1.18, c = 343, Sp = drv.Sd / 1e4;
  const Map = (drv.Mms + (addG || 0)) / 1000 / (Sp * Sp) / n, Cap = (drv.Cms / 1000) * Sp * Sp * n, Cab = VbL / 1000 / (rho * c * c);
  return { Map, Cap, Cab, Fb: Math.sqrt((1 / Cap + 1 / Cab) / Map) / (2 * Math.PI), Fp: 1 / (2 * Math.PI * Math.sqrt(Map * Cap)) };
}
// radiators go on the back panel, stacked; each needs its size plus a little frame margin
export const prShape = (drv) => drv.shape || { w: drv.size, h: drv.size };
export const prFits = (dim, wall, pr) => { const s = prShape(pr.drv); return dim.w - 2 * wall >= s.w + 0.3 && dim.h - 2 * wall >= pr.n * (s.h + 0.5); };
// added mass (g, 5 g steps, ≥ 0) that tunes the box to Fb; null if Fb is above the radiator's as-shipped tuning
export function prAddFor(drv, n, VbL, Fb) {
  const { Cap, Cab } = prTuning(drv, n, 0, VbL), Sp = drv.Sd / 1e4;
  const Map = (1 / Cap + 1 / Cab) / Math.pow(2 * Math.PI * Fb, 2);
  const g = Map * n * Sp * Sp * 1000 - drv.Mms;
  return g < -2.5 ? null : Math.max(0, Math.round(g / 5) * 5);
}
export function prBox(ts, VbL, pr, hpf, volts, hpType = "BW24", opts = {}) {
  const { QL = 7, N = 420, fmin = 12, fmax = 300 } = opts;
  const { drv, n } = pr;
  if (!ts || !VbL || !drv || !n) return null;
  const rho = 1.18, Sd = ts.Sd / 1e4, Mms = ts.Mms / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd), Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const { Map, Cap, Cab, Fb, Fp } = prTuning(drv, n, pr.addG, VbL);
  const Sp = drv.Sd / 1e4;
  const Rap = ((2 * Math.PI * drv.Fs * (drv.Mms / 1000)) / (drv.Qms || 5)) / (Sp * Sp) / n;
  const Ral = QL / (2 * Math.PI * Fb * Cab);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const out = [];
  for (let i = 0; i < N; i++) {
    const f = fmin * Math.pow(fmax / fmin, i / (N - 1));
    const w = 2 * Math.PI * f, s = cm(0, w);
    const Zd = cadd(cm(Ras + Rae), cadd(cmul(s, cm(Mas)), cdiv(cm(1), cmul(s, cm(Cas)))));
    const Zc = cdiv(cm(1), cmul(s, cm(Cab)));
    const Zp = cadd(cadd(cmul(s, cm(Map)), cdiv(cm(1), cmul(s, cm(Cap)))), cm(Rap));
    const Zbox = cdiv(cm(1), cadd(cadd(cdiv(cm(1), Zc), cdiv(cm(1), Zp)), cm(1 / Ral)));
    const Ud = cdiv(cm(Pg), cadd(Zd, Zbox));
    const Up = cdiv(cmul(Ud, Zbox), Zp);
    const Ut = cdiv(cmul(Ud, Zbox), Zc);                 // radiated = cone - radiators - leak
    const hp = hpGain(f, hpf, hpType);
    const raw = 20 * Math.log10((rho * w * cabs(Ut)) / (2 * Math.PI) / 2e-5);
    out.push({ f, raw, spl: raw + 20 * Math.log10(hp), xmm: Math.SQRT2 * (cabs(Ud) / (w * Sd)) * hp * 1000, prx: Math.SQRT2 * (cabs(Up) / (w * Sp * n)) * hp * 1000 });
  }
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;
  return { curve: out, Fb, Fp, f3, ref };
}

// ---- the whole speaker ----
// cfg: { box: "sealed"|"vented"|"radiator", pr: { drv, n, addG } (radiator), dim: {w,h,d} (in), wall (in), mat, port: {n, dia, len} (in), xo (Hz), order (4|8),
//        wAmpW, tAmpW, bsc (dB), place, wallFt, portMax (m/s), hpf (Hz, optional subsonic for vented), guide (waveguide or null) }
export function hifiSystem(w, t, cfg) {
  const ts = w.ts, dim = cfg.dim, wall = cfg.wall || 0.75;
  const gross = grossL(dim, wall);
  const vented = cfg.box === "vented", radiator = cfg.box === "radiator" && !!(cfg.pr && cfg.pr.drv);
  const pA = vented ? portArea(cfg.port) : 0;
  const pVol = vented ? (pA * cfg.port.len * 16.387) / 1e3 : 0;
  const disp = ts.disp != null ? ts.disp : Math.max(0.2, Math.pow(w.size / 6.5, 3) * 0.6);
  const net = Math.max(1, gross * 0.97 - disp - pVol);          // 3% for bracing and damping
  const V = ampV(cfg.wAmpW), order = cfg.order || 4, xo = cfg.xo;
  const opts = { fmin: 15, fmax: Math.max(2000, xo * 3), N: cfg.N || 240 };
  // a vented box unloads below its tuning; with DSP you'd highpass it there (default 0.75 × Fb, BW24)
  const hpf = cfg.hpf != null ? cfg.hpf : vented ? Math.round(0.75 * ventTuning(net, pA, cfg.port.len, cfg.port.n).Fb)
    : radiator ? Math.round(0.75 * prTuning(cfg.pr.drv, cfg.pr.n, cfg.pr.addG, net).Fb) : null;
  const vM = vented ? boxModel(ts, net, pA, cfg.port.len, hpf || 1, V, "BW24", { ...opts, nPorts: cfg.port.n }) : null;
  const rM = radiator ? prBox(ts, net, cfg.pr, hpf || 1, V, "BW24", opts) : null;
  const sM = vented || radiator ? null : closedBox(ts, net * 1.1, hpf || null, null, V, opts);   // lightly stuffed
  const m = vM || rM || sM;
  if (!m) return null;
  const bw = dim.w, place = cfg.place || "free", wallM = (cfg.wallFt || 2) * 0.3048;
  const shelf = (f) => baffleStep(f, bw) * boundary(f, place, wallM);
  const eq = (f) => bscEq(f, bw, cfg.bsc || 0);

  // on-axis woofer response (small signal at the amp voltage) with baffle step, placement, EQ and the low-pass
  const woofer = m.curve.map((o) => {
    const g = shelf(o.f) * eq(o.f), lp = cabs(lr(o.f, xo, order, "lp"));
    return { f: o.f, spl: o.spl + 20 * Math.log10(g * lp), raw: o.spl + 20 * Math.log10(g), xmm: o.xmm * eq(o.f) * lp, vel: o.vel != null ? o.vel * eq(o.f) * lp : null, prx: o.prx != null ? o.prx * eq(o.f) * lp : null };
  });
  // per-frequency limits of the woofer with the EQ in the signal (the boosted drive can't pass the amp or the coil rating)
  const vT = thermalV(ts.aes || 100), portMax = cfg.portMax || 17;
  const wMax = woofer.map((o, i) => {
    const e = eq(o.f), lp = cabs(lr(o.f, xo, order, "lp"));
    const drive = V * e * lp;                                       // volts at the terminals for full-scale input
    const sAmp = V / Math.max(1e-9, V * e), sTh = vT / Math.max(1e-9, drive), sX = ts.Xmax / Math.max(1e-9, o.xmm);
    const sP = o.vel ? portMax / o.vel : Infinity, sR = o.prx ? cfg.pr.drv.Xmax / o.prx : Infinity;
    const s = Math.min(sAmp, sTh, sX, sP, sR);
    return { f: o.f, spl: o.spl + 20 * Math.log10(s), who: s === sX ? "Xmax" : s === sP ? "port" : s === sR ? "radiator" : s === sTh ? "thermal" : "amp", s };
  });
  // one scale for music (the worst case across the woofer's band), like the PA planner's music limit
  const band = wMax.filter((o) => o.f >= 30 && o.f <= xo * 1.5);
  const sMusic = Math.min(...band.map((o) => o.s)), whoW = band.reduce((a, o) => (o.s < a.s ? o : a)).who;

  // tweeter: sensitivity and power, derated below the frequency its rating assumes, then the high-pass
  const hf = t.hf || {};
  const imp = hf.imp || 8, tV = ampV(cfg.tAmpW || 50);
  const pAmp = ((cfg.tAmpW || 50) * 8) / imp;
  const derate = hf.aesXo && xo < hf.aesXo ? Math.pow(xo / hf.aesXo, 2) : 1;
  const pProg = hf.aes ? 2 * hf.aes * derate : Infinity;
  const pMax = Math.min(pAmp, pProg);
  const tSens = hf.sens != null ? hf.sens + (cfg.guideGain || 0) : 90;
  // level match: the woofer's passband level at 2.83 V (on-axis, above the baffle step)
  const refW = m.ref - 20 * Math.log10(V / 2.83);
  const tSens283 = tSens + 10 * Math.log10(8 / imp);
  const trim = refW - tSens283;                                     // dB applied to the tweeter in the DSP (usually negative)
  const tweeterAt = (f, volts) => tSens283 + 20 * Math.log10(volts / 2.83) + 20 * Math.log10(cabs(lr(f, xo, order, "hp")));
  // clean max level, flat target: the woofer's music level in its passband vs the tweeter's max (both at 1 m)
  const pb = woofer.filter((o) => o.f >= Math.max(150, bw * 0 + 150) && o.f <= xo / 1.4);
  const wLevel = (pb.length ? Math.min(...pb.map((o) => o.raw)) : m.ref) + 20 * Math.log10(sMusic);
  const tLevel = tSens + 10 * Math.log10(pMax);
  const maxLevel = Math.min(wLevel, tLevel);

  // in-room F3: small-signal response (baffle step, placement, EQ) against its own level at 200-500 Hz
  const refBand = woofer.filter((o) => o.f >= 200 && o.f <= 500);
  const ref = refBand.length ? refBand.reduce((a, o) => a + o.raw, 0) / refBand.length : m.ref;
  let f3 = woofer[woofer.length - 1].f;
  for (let i = woofer.length - 1; i >= 0; i--) { if (woofer[i].f > 500) continue; if (woofer[i].raw < ref - 3) { f3 = woofer[Math.min(woofer.length - 1, i + 1)].f; break; } f3 = woofer[i].f; }

  const lb = boxLb(dim, wall, cfg.mat) + (w.lb || 5) + (t.lb || 1.5) + 1 + (radiator ? cfg.pr.n * ((cfg.pr.drv.lb || 0.75) + (cfg.pr.addG || 0) / 454) : 0);
  const portFits = !vented || cfg.port.len <= portMaxLen(dim, wall, cfg.port) + 1e-9;
  const lay = layout(w, t, dim, !!(cfg.guide && cfg.guide.freestanding));
  return {
    gross, net, disp, pVol, pArea: pA, vented, radiator, Fb: vM ? vM.Fb : rM ? rM.Fb : null, Fp: rM ? rM.Fp : null, prFits: !radiator || prFits(dim, wall, cfg.pr), Qtc: sM ? sM.Qtc : null, f3Box: m.f3, ref, refW,
    woofer, wMax, sMusic, whoW, trim, tSens, tSens283, tLevel, wLevel, maxLevel, who: tLevel < wLevel ? "tweeter" : "woofer",
    pMax, derate, lb, portFits, lay, f3, hpf, xo, order, bsF3: baffleStepF3(bw), tweeterAt, peakVel: vM ? Math.max(...woofer.map((o) => o.vel || 0)) : null, V,
  };
}

// Response of one speaker at a point, relative to its on-axis response at 1 m; the DSP is time-aligned on the
// tweeter axis at the listening distance. Returns [{ f, spl }] at 2.83 V-equivalent level (1 m on-axis scale).
// geo: { th (rad, horizontal off-axis), eyeIn (ear height above the box bottom, in), distM }
export function responseAt(sys, w, t, cfg, geo, freqs = logFreqs(60, 20000, 160)) {
  const xo = cfg.xo, order = cfg.order || 4, a = Math.sqrt(w.ts.Sd / 1e4 / Math.PI);
  const dome = ((t.domeIn || 1) * IN) / 2;
  const dist = geo.distM, dz = (h) => (geo.eyeIn - h) * IN;
  const rW = Math.hypot(dist, dz(sys.lay.wooferIn)), rT = Math.hypot(dist, dz(sys.lay.tweeterIn));
  const r0W = Math.hypot(dist, (sys.lay.tweeterIn - sys.lay.wooferIn) * IN), r0T = dist;   // alignment point: tweeter axis
  const tvW = Math.atan2(dz(sys.lay.wooferIn), dist), tvT = Math.atan2(dz(sys.lay.tweeterIn), dist);
  const offW = Math.acos(Math.cos(geo.th) * Math.cos(tvW)), offT = Math.acos(Math.cos(geo.th) * Math.cos(tvT));
  const wAt = (f) => {
    const o = nearestF(sys.woofer, f);
    return Math.pow(10, (o.raw - 20 * Math.log10(sys.V / 2.83)) / 20);
  };
  const trimG = Math.pow(10, sys.trim / 20);
  return freqs.map((f) => {
    const k = (2 * Math.PI * f) / C;
    const dW = piston(f, a, offW), dT = cfg.guide ? waveguide(f, cfg.guide.covH, cfg.guide.covV, cfg.guide.w, cfg.guide.h, geo.th, tvT) : piston(f, dome, offT);
    const pw = cmul(cmul(lr(f, xo, order, "lp"), cm(wAt(f) * dW * (1 / rW))), cexp(-k * (rW - r0W)));
    const tOn = Math.pow(10, (sys.tSens283 + 20 * Math.log10(cabs(cm(1)))) / 20);
    const pt = cmul(cmul(lr(f, xo, order, "hp"), cm(tOn * trimG * dT * (1 / rT))), cexp(-k * (rT - r0T)));
    return { f, spl: 20 * Math.log10(Math.max(1e-9, cabs(cadd(pw, pt)))) };
  });
}
export const logFreqs = (a, b, n) => Array.from({ length: n }, (_, i) => a * Math.pow(b / a, i / (n - 1)));
const nearestF = (curve, f) => {
  let lo = 0, hi = curve.length - 1;
  if (f <= curve[0].f) return curve[0];
  if (f >= curve[hi].f) return curve[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (curve[mid].f < f) lo = mid; else hi = mid; }
  return f - curve[lo].f < curve[hi].f - f ? curve[lo] : curve[hi];
};

// Dispersion map: level vs angle and frequency, normalised to on-axis. plane "h" (horizontal, at the tweeter
// height) or "v" (vertical, from below to above the tweeter axis). Returns { angles, freqs, rows: [[dB]] }.
export function dispersionMap(sys, w, t, cfg, plane = "h", distM = 2) {
  const freqs = logFreqs(100, 20000, 72);
  const angles = plane === "h" ? Array.from({ length: 19 }, (_, i) => i * 5) : Array.from({ length: 25 }, (_, i) => -60 + i * 5);
  const on = responseAt(sys, w, t, cfg, { th: 0, eyeIn: sys.lay.tweeterIn, distM }, freqs);
  const rows = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const geo = plane === "h" ? { th: rad, eyeIn: sys.lay.tweeterIn, distM } : { th: 0, eyeIn: sys.lay.tweeterIn + (Math.tan(rad) * distM) / IN, distM: distM };
    const r = responseAt(sys, w, t, cfg, geo, freqs);
    return r.map((o, i) => o.spl - on[i].spl);
  });
  return { angles, freqs, rows };
}

// ---- checks ----
export function hifiChips(sys, w, t, cfg) {
  const F = [], xo = cfg.xo, hf = t.hf || {};
  const a = Math.sqrt(w.ts.Sd / 1e4 / Math.PI), ka = ((2 * Math.PI * xo) / C) * a;
  const beam = ka <= 2.2 ? 180 : (2 * Math.asin(2.2 / ka) * 180) / Math.PI;
  const tCov = cfg.guide ? cfg.guide.covH : 160;
  if (beam < Math.min(tCov, 180) * 0.75)
    F.push(["warn", "Woofer narrower than the tweeter at the crossover", `About ${Math.round(beam)}° against the tweeter's ${cfg.guide ? tCov + "°" : "wide dome"}: off-axis sound dips just below ${xo} Hz. A lower crossover or a smaller woofer meets it.`]);
  else F.push(["ok", "Dispersion matches at the crossover", `The woofer is about ${Math.round(beam)}° wide at ${xo} Hz.`]);
  if (hf.minXo && xo < hf.minXo) F.push(["warn", "Below the tweeter's minimum crossover", `${xo} Hz against ${hf.minXo} Hz recommended.`]);
  if (hf.fs && xo < 2 * hf.fs) F.push(["warn", "Close to the tweeter's resonance", `${xo} Hz is within an octave of its ${hf.fs} Hz resonance; distortion rises there.`]);
  if (w.fmax && xo > w.fmax) F.push(["warn", "Woofer past its usable range", `${w.name} is rated to about ${w.fmax} Hz; cross lower.`]);
  if (sys.Qtc != null) F.push(sys.Qtc > 0.8 ? ["warn", `Qtc ${sys.Qtc.toFixed(2)}`, "Peaky; the box is small for this woofer."] : sys.Qtc < 0.5 ? ["warn", `Qtc ${sys.Qtc.toFixed(2)}`, "Overdamped; the box could be smaller."] : ["ok", `Qtc ${sys.Qtc.toFixed(2)}`, "Well damped."]);
  if (sys.vented && !sys.portFits) {
    const e = cfg.port.elbows || 0, fits = portMaxLen(cfg.dim, cfg.wall || 0.75, cfg.port);
    F.push(["bad", "Port too long", `${cfg.port.len.toFixed(1)}″ doesn't fit; ${e ? `with ${e} elbow${e > 1 ? "s" : ""} ` : "straight, "}this box holds about ${fits.toFixed(1)}″.${e < 2 ? " Another elbow would make room." : ""}`]);
  }
  if (sys.radiator) {
    const p = cfg.pr, vdW = w.ts.Sd * w.ts.Xmax, vdP = p.n * p.drv.Sd * p.drv.Xmax, k = vdP / vdW;
    if (!sys.prFits) F.push(["bad", "Radiators won't fit", `${p.n} on the back need about ${(prShape(p.drv).w + 0.3 + 2 * (cfg.wall || 0.75)).toFixed(1)}″ of width and ${(p.n * (prShape(p.drv).h + 0.5) + 2 * (cfg.wall || 0.75)).toFixed(1)}″ of height.`]);
    F.push(k < 1.5 ? ["warn", "Radiators small for this woofer", `They can move ${k.toFixed(1)}× the woofer's air; 1.5–2× keeps them from running out first. Use a bigger or second radiator.`]
      : ["ok", "Radiators big enough", `They can move ${k.toFixed(1)}× the woofer's air.`]);
    if ((p.addG || 0) > 2 * p.drv.Mms) F.push(["warn", "Lots of added mass", `${p.addG} g on a ${p.drv.Mms} g cone; it may sag or rock. A bigger radiator or a bigger box tunes as low with less.`]);
  }
  const need = w.size + 0.8;
  if (cfg.dim.w < need) F.push(["bad", "Woofer won't fit", `A ${w.size}″ woofer needs about ${need.toFixed(1)}″ of baffle width.`]);
  if (sys.lay.wooferIn - w.size / 2 < 0.5) F.push(["bad", "Drivers won't fit the baffle", `The woofer and tweeter need about ${(cfg.dim.h - sys.lay.wooferIn + w.size / 2 + 0.5).toFixed(1)}″ of height.`]);
  F.push(sys.who === "tweeter"
    ? ["warn", "Tweeter runs out first", `The tweeter tops out at ${sys.tLevel.toFixed(0)} dB, ${(sys.wLevel - sys.tLevel).toFixed(1)} dB below the woofer${sys.derate < 1 ? ` (derated for the ${xo} Hz crossover)` : ""}. A higher crossover or a more sensitive tweeter helps.`]
    : ["ok", "Woofer sets the level", `Tweeter has ${(sys.tLevel - sys.wLevel).toFixed(1)} dB to spare.`]);
  const whoText = { Xmax: "cone travel", port: "port air speed", radiator: "radiator travel", thermal: "the woofer's power rating", amp: "the amp" }[sys.whoW];
  F.push([sys.whoW === "amp" ? "ok" : "warn", `Woofer limited by ${whoText}`, `Clean up to ${sys.wLevel.toFixed(0)} dB at 1 m${cfg.bsc ? `, with ${cfg.bsc} dB of baffle-step boost` : ""}.`]);
  return F;
}
