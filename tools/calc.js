// Calculation functions for the planner. Pure JS, no React, window or THREE.
export const PLY = 0.75; // 3/4" birch

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

export function boxModel(ts, VbL, SpIn2, LpIn, hpf, volts, hpType = "BW24") {
  if (!ts || !VbL || !SpIn2 || LpIn <= 0) return null;
  const rho = 1.18, c = 343;
  const Sd = ts.Sd / 10000;                 // cm^2 -> m^2
  const Mms = ts.Mms / 1000;                // g -> kg
  const Vas = ts.Vas / 1000, Vb = VbL / 1000;
  const Cms = 1 / (Math.pow(2 * Math.PI * ts.Fs, 2) * Mms);
  const Mas = Mms / (Sd * Sd);
  const Cas = Cms * Sd * Sd;
  const Ras = ((2 * Math.PI * ts.Fs * Mms) / ts.Qms) / (Sd * Sd);
  const Rae = ((ts.Bl * ts.Bl) / ts.Re) / (Sd * Sd);
  const Cab = Vb / (rho * c * c);
  const Sp = SpIn2 * 0.00064516;
  const reff = Math.sqrt(Sp / Math.PI);
  const Leff = LpIn * 0.0254 + 1.46 * reff;  // both-end correction
  const Map = (rho * Leff) / Sp;
  const Fb = (c / (2 * Math.PI)) * Math.sqrt(Sp / (Vb * Leff));
  const Ral = 7 / (2 * Math.PI * Fb * Cab);
  const Pg = (volts * ts.Bl) / (ts.Re * Sd);

  const N = 420, out = [];
  for (let i = 0; i < N; i++) {
    const f = 12 * Math.pow(300 / 12, i / (N - 1));
    const w = 2 * Math.PI * f, s = cx(0, w);
    const Zd = cadd(cx(Ras + Rae), cadd(cmul(s, cx(Mas)), cinv(cmul(s, cx(Cas)))));
    const Zc = cinv(cmul(s, cx(Cab)));
    const Zp = cadd(cmul(s, cx(Map)), cx(0.3));
    const Zbox = cinv(cadd(cadd(cinv(Zc), cinv(Zp)), cinv(cx(Ral))));
    const Ud = cdiv(cx(Pg), cadd(Zd, Zbox));
    const Up = cdiv(cmul(Ud, Zbox), Zp);
    const Ut = { re: Ud.re - Up.re, im: Ud.im - Up.im };
    const hp = hpGain(f, hpf, hpType);
    const p = (rho * w * cabs(Ut)) / (2 * Math.PI);
    // volts is RMS; x1.414 turns RMS travel and air speed into sine peaks, which Xmax and the 17 m/s limit mean
    out.push({ f, spl: 20 * Math.log10((p * hp) / 2e-5),
               xmm: Math.SQRT2 * (cabs(Ud) / (w * Sd)) * hp * 1000,
               vel: Math.SQRT2 * (cabs(Up) / Sp) * hp });
  }
  const band = out.filter((o) => o.f > 80 && o.f < 200);
  const ref = band.reduce((a, o) => a + o.spl, 0) / band.length;
  const f3 = (out.find((o) => o.spl >= ref - 3) || out[0]).f;
  const at = (t) => out.reduce((b, o) => (Math.abs(o.f - t) < Math.abs(b.f - t) ? o : b));
  const lo = out.filter((o) => o.f > 20 && o.f < 90);
  return {
    curve: out,
    Fb, f3, ref,
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
  const band = out.filter((o) => o.f > 200 && o.f < 500);
  const ref = band.reduce((a, o) => a + o.raw, 0) / band.length;
  const f3 = (out.find((o) => o.raw >= ref - 3) || out[0]).f;
  return { curve: out, Fc, Qtc, f3, ref, peakX: Math.max(...out.map((o) => o.xmm)) };
}

export const inToL = (w, h, d) => ((w - 2 * PLY) * (h - 2 * PLY) * (d - 2 * PLY) * 16.387) / 1000;
// Internal litres with walls of thickness t and a 3/4″ baffle recessed `inset` into the frame.
export const boxL = (w, h, d, t, inset = 0.75) => ((w - 2 * t) * (h - 2 * t) * (d - inset - 0.75 - t) * 16.387) / 1000;
// Plywood weight, lb/ft² (birch). The baffle stays 3/4″ either way.
export const PLY_LB = { 0.75: 2.3, 0.5: 1.6 };

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
  } else if (portStyle === "vslots" || portStyle === "vwide" || portStyle === "vslot1") {
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

