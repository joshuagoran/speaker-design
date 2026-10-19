// A plain vented box through the horn engine (no horn): its tuning, level, excursion, and phase against Thiele and
// Small's closed forms. The vent is a duct with its exit's radiation load; `radiationLoad: false` makes it the lumped
// circuit those closed forms describe, for the exact checks.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { butterworth } from "../src/lib/acoustics/boxModels";
import { ventTuningHz } from "../src/lib/acoustics/hornModel";
import { chamberHornPort, chamberVentModel, stuffedLiters } from "../src/lib/speaker/chamberAir";
import { hifiRoundEndCorrection } from "../src/lib/acoustics/wooferBox";
import { speakerResponse } from "../src/lib/speaker/speakerResponse";
import { templateSpeaker } from "../src/pages/speaker/speakerTemplates";
import { SPEAKER_TEMPLATE } from "../src/constants/speakerStarts";
import { PORT_SHAPE, VENT_KIND } from "../src/constants/speakerSpec";
import { SUB_OPTIONS } from "../src/lib/data";
import type { BoxModelTS, SpeakerSpec } from "../src/types";
import {
  close,
  directBox,
  engineModel,
  helmholtz,
  hornGrid,
  massLineSPL,
  near,
  rel,
  roundVent,
  tsModel,
} from "./helpers";

const fh500 = SUB_OPTIONS.find((o) => o.id === "f18fh500")!.ts;
// without its coil inductance, for the mass-line check (a Le-free closed form; voice-coil.test.ts covers Le)
const { Le: _listed, ...fh500Bare } = fh500;
/** The box models' range, 12–300 Hz. */
const BASS = hornGrid(12, 300, 300);

/** A round vent's port for the lumped mode, which adds no exit load: its whole effective length (1.46 r added). */
const lumpedVent = (areaIn2: number, lenIn: number) => ({
  area: areaIn2 * 6.4516,
  length: (lenIn + 1.46 * Math.sqrt(areaIn2 / Math.PI)) * 2.54,
});

test("vented: Fb is the Helmholtz frequency (single port); the duct's waves lower it a little", (t) => {
  const helm = helmholtz(150, 60, 12, 1);
  const lumped = engineModel(directBox(fh500, 150, lumpedVent(60, 12)), BASS, 2.83, {
    radiationLoad: false,
  });
  rel(t, lumped.fb ?? NaN, helm, 1e-6, "lumped");
  // the duct: its air's springiness and the exit's load lower the tuning, here by 2 %
  const duct = ventTuningHz(150, roundVent(60, 12)) ?? NaN;
  assert.ok(duct < helm, "below Helmholtz");
  rel(t, duct, helm, 0.03, "duct");
});

test("vented: n round tubes get the end correction of each tube, not of one big opening", (t) => {
  // the monitor's round port, made two tubes
  const start = templateSpeaker(SPEAKER_TEMPLATE.monitorCoax);
  const [chamber] = start.cabinet.chambers;
  assert.ok(chamber.vent.kind === VENT_KIND.vented && chamber.vent.port.shape === PORT_SHAPE.round);
  const two = { ...chamber, vent: { ...chamber.vent, port: { ...chamber.vent.port, n: 2 } } };
  const spec: SpeakerSpec = { ...start, cabinet: { ...start.cabinet, chambers: [two] } };
  const vent = chamberVentModel(spec.cabinet, two);
  assert.ok(vent && two.vent.kind === VENT_KIND.vented && two.vent.port.shape === PORT_SHAPE.round);
  const { port } = two.vent;
  close(
    t,
    vent.endCorrectionIn,
    hifiRoundEndCorrection(port, port.elbows ?? 0),
    1e-12,
    "each tube",
  );
  const response = speakerResponse(spec);
  const air = stuffedLiters(two, response.chambers[0].netLiters);
  const fb = response.chambers[0].fb ?? NaN;
  rel(t, fb, ventTuningHz(air, chamberHornPort(spec.cabinet, two)) ?? NaN, 1e-12, "the model's");
  rel(t, fb, helmholtz(air, vent.areaIn2, port.len, 2), 0.01, "two tubes' Helmholtz");
});

test("vented: midband level is the mass-controlled line (reference efficiency)", (t) => {
  const line = massLineSPL(fh500, 2.83);
  const lumped = engineModel(directBox(fh500Bare, 150, lumpedVent(60, 12)), [250], 2.83, {
    radiationLoad: false,
  });
  close(t, lumped.curve[0].spl, line, 0.3, "250 Hz, lumped");
  // with the radiation load, the air's mass on the cone falls as ka nears 1 (an 18″ at 250 Hz): a little louder
  const loaded = engineModel(directBox(fh500Bare, 150, roundVent(60, 12)), [200, 250], 2.83);
  for (const o of loaded.curve) close(t, o.spl, line, 0.5, `${o.f} Hz, loaded`);
  const m = tsModel(fh500); // same thing through eta0: 112.07 + 10 log(eta0 * V^2 / Re) with V^2/Re = 1 W
  close(
    t,
    massLineSPL(fh500, Math.sqrt(fh500.Re)),
    112.07 + 10 * Math.log10(m.eta0),
    0.02,
    "eta0 identity",
  );
});

test("vented: a tiny port converges to the sealed box", (t) => {
  const freqs = [40, 60, 100, 200];
  const v = engineModel(directBox(fh500, 150, roundVent(0.05, 12)), freqs, 2.83),
    s = engineModel(directBox(fh500, 150), freqs, 2.83);
  freqs.forEach((f, i) => {
    close(t, v.curve[i].spl, s.curve[i].spl, 0.1, `SPL ${f} Hz`);
    rel(t, v.curve[i].xmm, s.curve[i].xmm, 0.01, `x ${f} Hz`);
  });
});

test("vented: excursion minimum sits at Fb", (t) => {
  // (port air speed does not always peak at Fb: with Fb above Fs it peaks near the lower impedance peak)
  for (const [Vb, len] of [
    [150, 12],
    [250, 16],
    [90, 10],
  ] as const) {
    const r = engineModel(directBox(fh500, Vb, roundVent(60, len)), BASS, 2.83);
    const band = r.curve.filter((o) => o.f > 15 && o.f < 90);
    const xMin = band.reduce((b, o) => (o.xmm < b.xmm ? o : b));
    rel(t, xMin.f, r.fb ?? NaN, 0.03, `${Vb} L`);
  }
});

test("vented: lossless B4 alignment has F3 = Fs", (t) => {
  // Qts 0.383, Vas/Vb 1.414, Fb = Fs (Thiele's B4)
  // only what the model reads; Xmax is not read here
  const base = { Fs: 30, Qms: 1e6, Sd: 1100, Mms: 150, Re: 5.5 };
  const ts: BoxModelTS = {
    ...base,
    Bl: Math.sqrt((2 * Math.PI * base.Fs * (base.Mms / 1e3) * base.Re) / 0.383),
    Xmax: 10,
  };
  const m = tsModel(ts),
    Vb = m.VasL / 1.4142;
  const area = 40,
    Sp = area * 0.00064516,
    r0 = Math.sqrt(Sp / Math.PI);
  const Leff = ((343 / (2 * Math.PI * ts.Fs)) ** 2 * Sp) / (Vb / 1000),
    len = (Leff - 1.46 * r0) / 0.0254;
  const lossless = { QL: 1e9, Qp: Infinity };
  for (const radiationLoad of [false, true]) {
    const port = radiationLoad ? roundVent(area, len) : lumpedVent(area, len);
    const r = engineModel(directBox(ts, Vb, port), BASS, 2.83, {
      ...lossless,
      radiationLoad,
    });
    const what = radiationLoad ? "duct" : "lumped";
    rel(t, r.fb ?? NaN, ts.Fs, radiationLoad ? 0.02 : 1e-3, `Fb, ${what}`);
    const line = massLineSPL(ts, 2.83),
      f3 = r.curve.find((o) => o.spl >= line - 3)?.f ?? NaN;
    rel(t, f3, ts.Fs, 0.02, `F3, ${what}`);
  }
});

test("vented: excursion and air speed are sine peaks that scale with the drive", (t) => {
  const design = directBox(fh500, 150, roundVent(60, 12));
  const a = engineModel(design, [30, 50], 2.83),
    b = engineModel(design, [30, 50], 2.83 * 2);
  rel(t, b.curve[1].xmm, 2 * a.curve[1].xmm, 1e-9, "excursion");
  rel(t, b.curve[0].portSpeed, 2 * a.curve[0].portSpeed, 1e-9, "air speed");
});

test("vented phase: a lossless lumped B4 box is s⁴ / B4(s), 180° at Fb", (t) => {
  // Thiele's B4: Qts = 1 / 2.613 (the Butterworth a1), Vas / Vb = √2, Fb = Fs; no losses anywhere
  const a1 = 2 * (Math.sin(Math.PI / 8) + Math.sin((3 * Math.PI) / 8)),
    Fs = 30,
    Mms = 150,
    Re = 6;
  // Qes = 2π Fs Mms Re / Bl²
  const Bl = Math.sqrt(2 * Math.PI * Fs * (Mms / 1e3) * Re * a1);
  const ts: BoxModelTS = { Fs, Qms: 1e12, Sd: 1200, Mms, Re, Bl, Xmax: 10 };
  const Vb = tsModel(ts).VasL / Math.SQRT2;
  // the port tuned to Fs exactly: lumped (no exit load), its length all of Leff
  const SpIn2 = 40,
    Leff = (SpIn2 * 0.00064516 * (343 / (2 * Math.PI * ts.Fs)) ** 2) / (Vb / 1000);
  const port = { area: SpIn2 * 6.4516, length: Leff * 100 };
  const r = engineModel(directBox(ts, Vb, port), BASS, 2.83, {
    QL: Infinity,
    Qp: Infinity,
    radiationLoad: false,
  });
  rel(t, r.fb ?? NaN, ts.Fs, 1e-9);
  const line = massLineSPL(ts, 2.83);
  for (const o of r.curve) {
    const s = { re: 0, im: o.f / ts.Fs },
      b = butterworth(s, 4);
    // s⁴ = (f/Fs)⁴, real
    const ref = Math.atan2(-b.im, b.re),
      d = o.phase - ref;
    assert.ok(Math.abs(d - 2 * Math.PI * Math.round(d / (2 * Math.PI))) < 1e-6, `${o.f} Hz`);
    close(t, o.spl - line, 20 * Math.log10((o.f / ts.Fs) ** 4 / Math.hypot(b.re, b.im)), 1e-6);
  }
  const atFb = near(r.curve, ts.Fs);
  close(t, (atFb.phase * 180) / Math.PI, 180, 2, "at Fb, as unwrapped from the top");
});
