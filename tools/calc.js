// Calculation functions for the planner. Pure JS, no React, window or THREE.

// ---------------------------------------------------------------
// Vented-box model. Same lumped-element circuit used to check this
// design offline; see the provenance note under the table.
// Complex helpers kept local and minimal.
// ---------------------------------------------------------------
export const cx = (re, im = 0) => ({ re, im });
export const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
export const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
export const cinv = (a) => cdiv(cx(1), a);
export const cabs = (a) => Math.hypot(a.re, a.im);

// Filter magnitudes. Butterworth order n: x^n / sqrt(1 + x^2n). Linkwitz-Riley 2m: a
// Butterworth m squared, x^2m / (1 + x^2m). LR24 is -6 dB at the corner, BW24 -3 dB.
export const HP_TYPES = { BW24: ["bw", 4], LR24: ["lr", 4], BW48: ["bw", 8], LR48: ["lr", 8] };
export const hpGain = (f, fc, type = "BW24") => {
  const [kind, n] = HP_TYPES[type] || HP_TYPES.BW24, x = f / fc;
  return kind === "bw" ? Math.pow(x, n) / Math.sqrt(1 + Math.pow(x, 2 * n)) : Math.pow(x, n) / (1 + Math.pow(x, n));
};
export const lr24lp = (f, fc) => 1 / (1 + Math.pow(f / fc, 4));   // Linkwitz-Riley 24 dB/oct lowpass
export const lr24hp = (f, fc) => hpGain(f, fc, "LR24");

// opts: nPorts (separate openings sharing the area), QL (box leakage, default 7), Qp (port losses, default 50),
// ecIn (total end correction in inches, both ends; default 1.46 r per opening).
export function boxModel(ts, VbL, SpIn2, LpIn, hpf, volts, hpType = "BW24", opts = {}) {
  if (!ts || !VbL || !SpIn2 || LpIn <= 0) return null;
  const { nPorts = 1, QL = 7, Qp = 50, ecIn } = opts;
  const rho = 1.18, c = 343;
  const Sd = ts.Sd / 10000;                 // cm^2 -> m^2
  const Mms = ts.Mms / 1000;                // g -> kg
  const Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd);
  const Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Sp = SpIn2 * 0.00064516;
  const reff = Math.sqrt(Sp / nPorts / Math.PI);   // radius of each opening
  const Leff = LpIn * 0.0254 + (ecIn != null ? ecIn * 0.0254 : 1.46 * reff);  // one flanged + one free end per opening
  const Map = (rho * Leff) / Sp;
  const Fb = (c / (2 * Math.PI)) * Math.sqrt(Sp / (Vb * Leff));
  const Ral = QL / (2 * Math.PI * Fb * Cab);
  const Rap = Number.isFinite(Qp) ? (2 * Math.PI * Fb * Map) / Qp : 0;   // port friction and turbulence
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);

  const N = 420, out = [];
  for (let i = 0; i < N; i++) {
    const f = 12 * Math.pow(300 / 12, i / (N - 1));
    const w = 2 * Math.PI * f, s = cx(0, w);
    const Zd = cadd(cx(Ras + Rae), cadd(cmul(s, cx(Mas)), cinv(cmul(s, cx(Cas)))));
    const Zc = cinv(cmul(s, cx(Cab)));
    const Zp = cadd(cmul(s, cx(Map)), cx(Rap));
    const Zbox = cinv(cadd(cadd(cinv(Zc), cinv(Zp)), cinv(cx(Ral))));
    const Ud = cdiv(cx(Pg), cadd(Zd, Zbox));
    const Up = cdiv(cmul(Ud, Zbox), Zp);
    // radiated = cone - port - leak = the flow into the box air
    const Ut = cdiv(cmul(Ud, Zbox), Zc);
    const hp = hpGain(f, hpf, hpType);
    const p = (rho * w * cabs(Ut)) / (2 * Math.PI);
    const raw = 20 * Math.log10(p / 2e-5);
    // volts is RMS; x1.414 turns RMS travel and air speed into sine peaks, which Xmax and the 17 m/s limit mean
    out.push({ f, raw, spl: raw + 20 * Math.log10(hp),
               xmm: Math.SQRT2 * (cabs(Ud) / (w * Sd)) * hp * 1000,
               vel: Math.SQRT2 * (cabs(Up) / Sp) * hp });
  }
  // midband reference: the mass-controlled asymptote (see closedBox)
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.spl >= ref - 3) || out[out.length - 1]).f;      // system, with the highpass
  const f3Box = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;   // box alone
  const at = (t) => out.reduce((b, o) => (Math.abs(o.f - t) < Math.abs(b.f - t) ? o : b));
  const lo = out;   // limits are searched over the whole curve (12-300 Hz)
  return {
    curve: out,
    Fb, f3, f3Box, ref,
    spl30: at(30).spl, spl35: at(35).spl, spl45: at(45).spl,
    peakVel: Math.max(...lo.map((o) => o.vel)),
    peakVelF: lo.reduce((b, o) => (o.vel > b.vel ? o : b)).f,
    peakX: Math.max(...lo.map((o) => o.xmm)),
    peakXF: lo.reduce((b, o) => (o.xmm > b.xmm ? o : b)).f,
    xmaxPct: (Math.max(...lo.map((o) => o.xmm)) / ts.Xmax) * 100,
  };
}

// ---------------------------------------------------------------
// Sealed-box model for the mid-bass: the same driver circuit with the box
// compliance in series and no port. hp and lp are the crossover corners,
// Linkwitz-Riley 24 dB/oct. Voice-coil inductance is not modelled, so the top
// octave reads a little high. Excursion is the sine peak, as in boxModel.
// ---------------------------------------------------------------
export function closedBox(ts, VbL, hp, lp, volts) {
  if (!ts || !VbL || VbL <= 0) return null;
  const rho = 1.18, c = 343;
  const Sd = ts.Sd / 10000, Mms = ts.Mms / 1000, Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd), Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);
  const Ctot = (Cas * Cab) / (Cas + Cab);
  const Fc = 1 / (2 * Math.PI * Math.sqrt(Mas * Ctot));
  const Qes = (2 * Math.PI * ts.Fs * Mms * ts.Re) / (ts.Bl * ts.Bl);
  const Qts = (Qes * ts.Qms) / (Qes + ts.Qms);
  const Qtc = Qts * (Fc / ts.Fs);
  const N = 420, out = [];
  for (let i = 0; i < N; i++) {
    const f = 20 * Math.pow(2000 / 20, i / (N - 1));
    const w = 2 * Math.PI * f, s = cx(0, w);
    const Z = cadd(cx(Ras + Rae), cadd(cmul(s, cx(Mas)), cadd(cinv(cmul(s, cx(Cas))), cinv(cmul(s, cx(Cab))))));
    const U = cabs(cdiv(cx(Pg), Z));
    const g = (hp ? lr24hp(f, hp) : 1) * (lp ? lr24lp(f, lp) : 1);
    const raw = 20 * Math.log10((rho * w * U) / (2 * Math.PI) / 2e-5);
    out.push({ f, raw, spl: raw + 20 * Math.log10(g), xmm: Math.SQRT2 * (U / (w * Sd)) * g * 1000 });
  }
  // Midband reference: the mass-controlled asymptote p = rho*V*Bl*Sd/(2*pi*Re*Mms) (half space, 1 m).
  // Averaging a band (the old 200-500 Hz) reads low when a well-damped box is still rising there.
  const ref = 20 * Math.log10((rho * volts * ts.Bl * Sd) / (2 * Math.PI * ts.Re * Mms) / 2e-5);
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[out.length - 1]).f;
  return { curve: out, Fc, Qtc, f3, ref, peakX: Math.max(...out.map((o) => o.xmm)) };
}

// Internal litres with walls of thickness t and a 3/4″ baffle recessed `inset` into the frame.
export const boxL = (w, h, d, t, inset = 0.75) => ((w - 2 * t) * (h - 2 * t) * (d - inset - 0.75 - t) * 16.387) / 1000;
// Plywood weight, lb/ft² (birch). The baffle stays 3/4″ either way.
export const PLY_LB = { 0.75: 2.3, 0.5: 1.6 };
export const plyLb = (t) => PLY_LB[t] ?? 2.3;   // lb/ft²; unknown thicknesses fall back to 3/4″

// ---------------------------------------------------------------
// Cutlist: panels for the sub and mid boxes from the planner's current
// dimensions, and a simple shelf layout on 4x8 or 5x5 sheets.
// ---------------------------------------------------------------
export const CUTOUT = { 18: 16.6, 15: 13.9, 12: 11.1, 10: 9.2 };   // typical front-mount cutouts, in
export const SHEETS = { "4x8": { w: 48, h: 96, name: "4 × 8 ft" }, "5x5": { w: 60, h: 60, name: "5 × 5 ft" } };
export const f8 = (x) => {   // inches to the nearest 1/16, as 12 5/8
  const n = Math.round(x * 16), whole = Math.floor(n / 16), r = n % 16;
  if (!r) return `${whole}`;
  let a = r, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; }
  return whole ? `${whole} ${a}/${b}` : `${a}/${b}`;
};
export const tName = (t) => (t === 0.75 ? "3/4″" : t === 0.5 ? "1/2″" : `${t}″`);

export function boxParts(label, W, H, D, t, inset, joint, extra = {}) {
  const BT = 0.75, P = [];
  const topW = joint === "butt" ? W - 2 * t : joint === "rabbet" ? W - t : W;
  const rearNote = `rabbet ${f8(t)} × ${f8(t / 2)} on rear edge for the back`;
  const sideNote = joint === "rabbet" ? `rabbet ${f8(t)} × ${f8(t / 2)} top and bottom edges; ${rearNote}`
    : joint === "miter" ? `45° on top and bottom edges; ${rearNote}` : rearNote;
  const topNote = joint === "miter" ? `45° on both ends; ${rearNote}` : rearNote;
  P.push({ box: label, part: "Side", qty: 2, a: D, b: H, t, note: sideNote });
  P.push({ box: label, part: "Top / bottom", qty: 2, a: D, b: topW, t, note: topNote });
  P.push({ box: label, part: "Back", qty: 1, a: W - t, b: H - t, t, note: "sits in the rear rabbet" });
  const iw = W - 2 * t, ih = H - 2 * t, band = extra.band || 0;
  P.push({ box: label, part: "Baffle", qty: 1, a: iw, b: ih - band, t: BT,
    note: `set ${f8(inset)}″ back on cleats; ${extra.cutNote || ""}`.replace(/; $/, "") });
  P.push({ box: label, part: "Baffle cleat", qty: 2, a: 0.75, b: iw, t: BT, note: "glue and screw behind the baffle" });
  P.push({ box: label, part: "Baffle cleat", qty: 2, a: 0.75, b: ih - band - 1.5, t: BT, note: "" });
  const inD = D - inset - BT - t;
  if (extra.braces) P.push({ box: label, part: "Window brace", qty: extra.braces, a: iw, b: inD, t, note: "cut out the centre, leave ~2″ rails" });
  return { P, iw, ih, inD };
}

export function cutParts({ sub, mid, subBox, midDims, wall, inset, joint, portStyle, cVent, layout }) {
  const t = wall, all = [];
  const vent = [];
  const s = boxParts("Sub", subBox.w, subBox.h, subBox.d, t, inset, joint, {
    braces: wall === 0.5 ? 3 : 2,
    band: portStyle === "slots" || portStyle === "folded" ? cVent.slotH + t : 0,
    cutNote: `${f8(CUTOUT[sub.size] || 16.6)}″ driver cutout (check the datasheet)`,
  });
  all.push(...s.P);
  if (portStyle === "slots" || portStyle === "folded") {
    const len = portStyle === "slots" ? Math.min(cVent.len, subBox.d - t - cVent.slotH) : subBox.d - inset - t - cVent.slotH - 2 * t;
    all.push({ box: "Sub", part: "Duct shelf", qty: 1, a: s.iw, b: len, t, note: "roof of the bottom slot" });
    all.push({ box: "Sub", part: "Duct fin", qty: 2, a: cVent.slotH, b: len, t, note: "splits the slot in three" });
    if (portStyle === "folded") all.push({ box: "Sub", part: "Duct rear wall", qty: 1, a: s.iw, b: Math.max(2, cVent.len - len), t, note: "rear channel, rises up the back" });
  } else if (portStyle === "vslots" || portStyle === "vslot1") {
    const n = portStyle === "vslot1" ? 1 : 2;
    all.push({ box: "Sub", part: "Side duct wall", qty: n, a: s.ih, b: cVent.len, t, note: `${f8(cVent.throat)}″ throat; 20° chamfer both ends` });
    all.push({ box: "Sub", part: "Duct divider", qty: 2 * n, a: cVent.throat, b: cVent.len, t: 0.5, note: "" });
  } else {
    vent.push(`${cVent.nt} × ${f8(cVent.dia)}″ port tube, ${f8(cVent.len)}″ long (buy, flared)`);
  }
  if (layout !== "tower") {
    const m = boxParts("Mid", midDims.w, midDims.h, midDims.d, t, inset, joint, {
      braces: wall === 0.5 ? 2 : 1,
      cutNote: `${f8(CUTOUT[mid.size || 12] || 11.1)}″ driver cutout (check the datasheet)`,
    });
    all.push(...m.P);
  }
  return { parts: all, vent };
}

// Shelf packing with rotation and kerf: largest first, fill rows across the sheet.
export function packSheets(rects, sheet, kerf) {
  const sheets = [];
  const items = rects.slice().sort((p, q) => Math.max(q.a, q.b) - Math.max(p.a, p.b) || Math.min(q.a, q.b) - Math.min(p.a, p.b));
  const tooBig = [];
  for (const r of items) {
    const opts = [[r.a, r.b], [r.b, r.a]].filter(([w, h]) => w <= sheet.w && h <= sheet.h);
    if (!opts.length) { tooBig.push(r); continue; }
    let placed = false;
    for (const sh of sheets) {
      for (const row of sh.rows) {
        for (const [w, h] of opts) {
          if (h <= row.h && row.x + w <= sheet.w) { sh.items.push({ ...r, x: row.x, y: row.y, w, h }); row.x += w + kerf; placed = true; break; }
        }
        if (placed) break;
      }
      if (placed) break;
      // new row on this sheet: tallest-first orientation that fits
      for (const [w, h] of opts.slice().sort((p, q) => q[1] - p[1])) {
        if (sh.y + h <= sheet.h) { sh.rows.push({ y: sh.y, h, x: w + kerf }); sh.items.push({ ...r, x: 0, y: sh.y, w, h }); sh.y += h + kerf; placed = true; break; }
      }
      if (placed) break;
    }
    if (!placed) {
      const [w, h] = opts.slice().sort((p, q) => q[1] - p[1])[0];
      sheets.push({ rows: [{ y: 0, h, x: w + kerf }], items: [{ ...r, x: 0, y: 0, w, h }], y: h + kerf });
    }
  }
  return { sheets, tooBig };
}


// ---- end correction of a rectangular opening ----
// Low-frequency radiation mass of a uniform rectangular piston a x b in an infinite baffle is
// rho*I/(2*pi*S^2), I = the double area integral of 1/distance (closed form below). As a length:
// end correction = I/(2*pi*a*b). A circle gives the familiar 0.85 r.
export function rectI(a, b) {
  const d = Math.hypot(a, b);
  return (2 / 3) * (a ** 3 + b ** 3 - d ** 3) + 2 * a * b * (a * Math.log((b + d) / a) + b * Math.log((a + d) / b));
}
export const rectEndCorr = (a, b) => rectI(a, b) / (2 * Math.PI * a * b);
// Flanged + free end, as the 1.46 r (0.85 r + 0.61 r) used for round tubes.
export const BOTH_ENDS = 1 + 0.61 / 0.85;
// Rectangular duct of throat a x height b along a panel: a wall at an end mirrors the mouth, so that end
// acts as one twice as wide in a (image method). Outer end flanged (baffle), inner end free (0.61/0.85).
export const ductEndCorr = (a, b, { inner = true, outer = true } = {}) =>
  rectEndCorr(outer ? 2 * a : a, b) + (0.61 / 0.85) * rectEndCorr(inner ? 2 * a : a, b);
// Inner end, inside the box: the vent mouth (height h against one wall, spanning the box from wall to wall)
// opens into the box interior, a duct of height X that ends at the back wall a distance L away. Low-frequency
// modal sum for a piston in a rigid 2D duct (the evanescent cross-modes carry the added mass):
//   end correction = 2 X^2 / (pi^3 h) * sum sin^2(m pi h / X) coth(m pi L / X) / m^3
// It includes the wall the vent sits on and the opposite wall, and tends to the free-space strip as X grows.
// The gap to the back wall is taken as at least h: the planner's "Duct too long" check asks for that much,
// and closer than that the flow turns through the gap and the model no longer holds.
export function duct2DEndCorr(h, X, L = Infinity) {
  if (h >= X) return 0;
  L = Math.max(L, h);
  let sum = 0;
  for (let m = 1; m <= 2000; m++) {
    const k = (m * Math.PI) / X, sn = Math.sin(k * h);
    sum += (sn * sn) / (m * m * m) * (Number.isFinite(L) ? 1 / Math.tanh(k * L) : 1);
  }
  return ((2 * X * X) / (Math.PI ** 3 * h)) * sum;
}
const FREE_END = 0.61 / 0.85;   // an unflanged (free) end relative to a flanged one, as in 1.46 r
// Letterbox on the floor: outside, the ground mirrors the mouth (slot twice as tall, open width w);
// inside, the box interior (height X, back wall L behind the mouth) with the side walls at both ends.
export const slotEndCorr = (h, w, X, L) => (X ? rectEndCorr(2 * h, w) + FREE_END * duct2DEndCorr(h, X, L) : ductEndCorr(h, w));
// Side duct (throat th, open height H) against a side wall: outside, the ground mirrors the bottom of the
// mouth; inside, the box interior across its width X (for a pair of ducts, half the width: symmetry).
export const sideDuctEndCorr = (th, H, X, L) => (X ? rectEndCorr(th, 2 * H) + FREE_END * duct2DEndCorr(th, X, L) : ductEndCorr(th, H, { outer: false }));

// Vent geometry for the sub. t is the wall (and fin) ply. n is the number of separate openings,
// which sets the end correction in boxModel.
export function ventGeom(portStyle, box, cVent, t) {
  const iw = box.w - 2 * t, ih = box.h - 2 * t;
  if (portStyle === "vslots" || portStyle === "vslot1") {
    const n = portStyle === "vslot1" ? 1 : 2;
    const th = cVent.throat, area = n * th * (ih - 2 * 0.5), seg = (ih - 2 * 0.5) / 3;   // two 1/2\u2033 dividers per duct
    const L = box.d - 0.75 - t - cVent.len;   // mouth to back wall (duct measured from the baffle front, 3/4" inset)
    return { n, area, len: cVent.len, ec: sideDuctEndCorr(th, ih - 2 * 0.5, n === 2 ? iw / 2 : iw, L), dh: (4 * (th * seg)) / (2 * (th + seg)),
             desc: `${n === 1 ? "one side duct" : "two side ducts"}, ${th.toFixed(2)}\u2033 throat \u00d7 ${ih.toFixed(1)}\u2033, ${cVent.len.toFixed(1)}\u2033 long` };
  }
  if (portStyle === "slots" || portStyle === "folded") {
    // one letterbox split by two fins (wall ply); the fins run the full length but the mouths
    // sit together, so it is treated as a single opening on the floor (see slotEndCorr)
    const h = cVent.slotH, area = h * (iw - 2 * t), seg = (iw - 2 * t) / 3;
    // a folded duct turns up the back wall, so its mouth faces the lid, not the back: no back-wall term
    const L = portStyle === "folded" ? Infinity : box.d - 0.75 - t - cVent.len;
    return { n: 1, area, len: cVent.len, ec: slotEndCorr(h, iw - 2 * t, ih, L), dh: (4 * (h * seg)) / (2 * (h + seg)),
             desc: `letterbox, ${h.toFixed(2)}\u2033 \u00d7 ${iw.toFixed(1)}\u2033, ${cVent.len.toFixed(1)}\u2033 long` + (portStyle === "folded" ? ", folded up the back wall" : "") };
  }
  const r = cVent.dia / 2;
  return { n: cVent.nt, area: cVent.nt * Math.PI * r * r, len: cVent.len, dh: cVent.dia,
           desc: `${cVent.nt} \u00d7 ${cVent.dia.toFixed(2)}\u2033 round, ${cVent.len.toFixed(1)}\u2033 long` };
}

// Litres of wood inside a box: everything behind the baffle except the shell panels themselves.
// Window braces keep ~2 in rails, so only their rails count.
const SHELL = new Set(["Side", "Top / bottom", "Back", "Baffle"]);
export function internalWoodL(parts, box) {
  let in3 = 0;
  for (const p of parts) {
    if (p.box !== box || SHELL.has(p.part)) continue;
    const a = Math.min(p.a, p.b), b = Math.max(p.a, p.b);
    const area = p.part === "Window brace" ? Math.max(0, 2 * 2 * (a + b) - 4 * 2 * 2) : a * b;
    in3 += area * p.t * p.qty;
  }
  return (in3 * 16.387) / 1000;
}

// ---- limits ----
// Every limit is an amp output voltage for a sine at the amp's rated power into 8 ohm. Port and
// cone limits use the sine's peaks. Thermal is program power, 2 x AES: AES noise has a 6 dB crest,
// so a sine with the same peak voltage carries twice the AES power; music with at least that crest
// keeps the coil's average at or under AES.
export const thermalV = (aes) => Math.sqrt(2 * aes * 8);
export const ampV = (W) => Math.sqrt(W * 8);
// Broadband ("music") limit: one drive level for the whole band.
export function subLimits(mdl, ts, AMP_V, portMax) {
  const vp = (AMP_V * portMax) / mdl.peakVel, vx = (AMP_V * 100) / mdl.xmaxPct, vt = thermalV(ts.aes);
  const L = Math.min(vp, vx, vt, AMP_V);
  const sc = 20 * Math.log10(L / AMP_V);
  return { who: L === vp ? "port air speed" : L === vx ? "cone travel (Xmax)" : L === vt ? "driver program rating" : "amplifier power",
           V: L, W: (L * L) / 8, vel: mdl.peakVel * L / AMP_V, xPct: mdl.xmaxPct * L / AMP_V,
           spl30: mdl.spl30 + sc, spl35: mdl.spl35 + sc, spl45: mdl.spl45 + sc };
}
// Per-frequency sine limit: each frequency meets its own port and excursion limits.
export function maxCurve(curve, ts, AMP_V, portMax) {
  const vt = thermalV(ts.aes);
  return curve.map((o) => {
    const vp = o.vel != null ? (AMP_V * portMax) / o.vel : Infinity, vx = (AMP_V * ts.Xmax) / o.xmm;
    const V = Math.min(vp, vx, vt, AMP_V);
    return { f: o.f, spl: o.spl + 20 * Math.log10(V / AMP_V), who: V === vp ? "port" : V === vx ? "Xmax" : V === vt ? "thermal" : "amp" };
  });
}
export const nearest = (curve, f) => curve.reduce((b, o) => (Math.abs(o.f - f) < Math.abs(b.f - f) ? o : b));

// ---- horn ----
// Datasheet model, not T/S: on-horn sensitivity + 10 log P, shaped by the LR24 highpass at the
// crossover and 12 dB/oct below the horn's loading limit. Power: amp voltage into the driver's
// impedance, capped at program (2 x AES), derated 6 dB/oct below the frequency AES was rated at.
export function hornResponse(hf, hz, xoHi, hfAmpW) {
  if (!hf || hf.sens == null || !hf.aes) return null;
  const imp = hf.imp || 8;
  const pAmp = (hfAmpW * 8) / imp;
  const derate = hf.aesXo && xoHi < hf.aesXo ? Math.pow(xoHi / hf.aesXo, 2) : 1;
  const pProg = 2 * hf.aes * derate;
  const P = Math.min(pAmp, pProg);
  const low = (hz && hz.lowHz) || 0;
  const curve = [];
  for (let i = 0; i < 300; i++) {
    const f = 300 * Math.pow(20000 / 300, i / 299);
    const g = lr24hp(f, xoHi) * (low ? Math.min(1, Math.pow(f / low, 2)) : 1);
    curve.push({ f, spl: hf.sens + 10 * Math.log10(P) + 20 * Math.log10(g) });
  }
  return { curve, P, pAmp, pProg, derate, imp, who: P === pAmp ? "amp" : "program rating", flat: hf.sens + 10 * Math.log10(P) };
}

// ---- directivity ----
// Rigid piston: -6 dB where ka sin(theta) = 2.2 (2 J1(x)/x = 0.5 at x = 2.215).
export function pistonBeam(SdCm2, f) {
  const ka = (2 * Math.PI * f / 343) * Math.sqrt(SdCm2 / 10000 / Math.PI);
  return ka <= 2.2 ? 180 : 2 * Math.asin(2.2 / ka) * 180 / Math.PI;
}
// Keele: a horn holds its angle down to f = 25 400 / (mouth width m x angle deg) (1e6 in-deg-Hz).
export const keeleF = (covDeg, mouthIn) => 25400 / (mouthIn * 0.0254 * covDeg);
export const hornBeam = (covDeg, fK, f) => Math.min(180, f >= fK ? covDeg : covDeg * fK / f);

// ---- weights (lb): 3/4″ baffle, other panels and full-size braces at the wall ply ----
// Brace counts match the Cutlist: sub 2 (3 with 1/2″ walls), mid 1 (2 with 1/2″ walls).
export const subWeight = (b, wall, drvLb) =>
  ((b.w * b.h) * 2.3 + (b.w * b.h + 2 * b.w * b.d + 2 * b.h * b.d + (wall === 0.5 ? 3 : 2) * b.w * b.d) * plyLb(wall)) / 144 + (drvLb || 0) + 6;
export const midWeight = (b, wall) =>
  ((b.w * b.h) * 2.3 + (b.w * b.h + 2 * b.w * b.d + 2 * b.h * b.d + (wall === 0.5 ? 2 : 1) * b.w * b.d) * plyLb(wall)) / 144 + 2;

// ---- the sub as the planner computes it ----
// cfg: { subBox, midDims, wall, inset, portStyle, cVent, hpf, hpType, ampW, portMax, layout }
export function subSystem(sub, mid, cfg) {
  const port = ventGeom(cfg.portStyle, cfg.subBox, cfg.cVent, cfg.wall);
  const grossL = boxL(cfg.subBox.w, cfg.subBox.h, cfg.subBox.d, cfg.wall, cfg.inset);
  const ductL = (port.area * port.len * 16.387) / 1000;
  const woodL = internalWoodL(cutParts({ sub, mid, subBox: cfg.subBox, midDims: cfg.midDims, wall: cfg.wall, inset: cfg.inset,
    joint: "butt", portStyle: cfg.portStyle, cVent: cfg.cVent, layout: cfg.layout }).parts, "Sub");
  const netL = Math.max(20, grossL - (sub.ts ? sub.ts.disp : 10.5) - ductL - woodL);
  const AMP_V = ampV(cfg.ampW);
  const mdl = sub.ts ? boxModel(sub.ts, netL, port.area, port.len, cfg.hpf, AMP_V, cfg.hpType, { nPorts: port.n, ecIn: port.ec }) : null;
  const lim = mdl ? subLimits(mdl, sub.ts, AMP_V, cfg.portMax) : null;
  return { port, grossL, ductL, woodL, netL, AMP_V, mdl, lim };
}

// Sub through the LR24 lowpass at the crossover, each frequency at its own sine limit (the filter
// scales excursion and port speed with the output).
export function subThroughLp(mdl, ts, AMP_V, portMax, xoLo) {
  const vt = thermalV(ts.aes);
  return mdl.curve.map((o) => {
    const g = lr24lp(o.f, xoLo);
    const vp = (AMP_V * portMax) / (o.vel * g), vx = (AMP_V * ts.Xmax) / (o.xmm * g);
    const V = Math.min(vp, vx, vt, AMP_V);
    return { f: o.f, spl: o.spl + 20 * Math.log10(g) + 20 * Math.log10(V / AMP_V) };
  });
}

// ---- the mid-bass as the planner computes it: sealed, always lightly stuffed ----
// cfg: { midDims, wall, inset, xoLo, xoHi, mAmpW }
export const STUFF = 1.15;   // ~15% more effective volume from light stuffing
export function midSystem(mid, cfg) {
  const V = ampV(cfg.mAmpW);
  const grossL = boxL(cfg.midDims.w, cfg.midDims.h, cfg.midDims.d, cfg.wall, cfg.inset);
  const disp = mid.ts && mid.ts.disp != null ? mid.ts.disp : (mid.size === 15 ? 4 : 2.5);   // assumed where not published
  const netL = Math.max(5, grossL - disp);
  const effL = netL * STUFF;
  const mdl = mid.ts ? closedBox(mid.ts, effL, cfg.xoLo, cfg.xoHi, V) : null;
  const vTherm = mid.ts ? thermalV(mid.ts.aes) : 0;
  const max = mdl ? maxCurve(mdl.curve, mid.ts, V, Infinity) : null;   // no port: Xmax, thermal, amp
  return { V, grossL, disp, netL, effL, mdl, vTherm, max, useV: Math.min(vTherm, V) };
}

// ---- passive coaxial fills ----
// drv: FILL_OPTIONS entry. cfg: { boxType: "vented" | "sealed", dim {w,h,d} external in, port {n, dia, len},
// hp (LR24 highpass to the subs), ampW (per box, 8 ohm rating), portMax }. 1/2" walls throughout.
export function fillSystem(drv, cfg) {
  const { boxType, dim, port, hp, ampW, portMax } = cfg;
  const ts = drv.ts, V = ampV(ampW), vented = boxType === "vented";
  const gross = ((dim.w - 1) * (dim.h - 1) * (dim.d - 1) * 16.387) / 1000;
  const pArea = vented ? port.n * Math.PI * Math.pow(port.dia / 2, 2) : 0;
  const pVol = (pArea * port.len * 16.387) / 1000;
  const disp = ts.disp != null ? ts.disp : drv.size >= 10 ? 1.5 : 1;
  const net = Math.max(3, gross - disp - (vented ? pVol : 0));
  const eff = vented ? net : net * STUFF;   // sealed boxes are stuffed
  const vM = vented ? boxModel(ts, eff, pArea, port.len, hp, V, "LR24", { nPorts: port.n }) : null;
  const sM = vented ? null : closedBox(ts, eff, hp, null, V);
  const m = vM || sM;
  const max = maxCurve(m.curve, ts, V, portMax).filter((o) => o.f <= 300);
  const sens = m.ref - 20 * Math.log10(V / 2.83);
  // system -3 dB, highpass included, for both box types
  const f3 = vM ? vM.f3 : (sM.curve.find((o) => o.spl >= sM.ref - 3) || sM.curve[sM.curve.length - 1]).f;
  // HF through a passive network, padded down to the woofer: reaches its program rating (2 x AES)
  // only at an amp power well above what the woofer sees
  const hf = drv.hf;
  const pad = hf ? Math.max(0, hf.sens - (drv.lfSens || sens)) : 0;
  const hfLimW = hf ? (2 * hf.aes * hf.imp / 8) * Math.pow(10, pad / 10) : null;   // amp watts (8 ohm rating)
  const lb = ((2 * (dim.w * dim.h + dim.w * dim.d + dim.h * dim.d)) / 144) * 1.6 + drv.lb + 1;   // 1/2" birch ~1.6 lb/ft2
  const portLimited = vented && max.some((o) => o.who === "port");
  return { V, gross, pArea, disp, net, eff, vM, sM, max, sens, f3, pad, hfLimW, lb, portLimited };
}
