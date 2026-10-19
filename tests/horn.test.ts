import { test } from "vite-plus/test";
import assert from "node:assert";
import { ohmsOf } from "../src/lib/power";
import { hornResponse } from "../src/lib/pa/calc";
import { CD_OPTIONS } from "../src/lib/data";
import { close, near, db } from "./helpers";

const n314t = CD_OPTIONS.find((o) => o.id === "n314t")!.hf!;
test("horn power: amp into Z, capped at 2 x AES, derated below the rated crossover", (t) => {
  const a = hornResponse(n314t, { lowHz: 580 }, 900, 100, 4);
  close(
    t,
    a!.P,
    Math.min((100 * 8) / ohmsOf(n314t), 2 * n314t.aes * Math.min(1, (900 / n314t.aesXo) ** 2)),
    1e-9,
  );
  const b = hornResponse(
    // sensRef and minXo complete the type; hornResponse ignores them
    { sens: 108, sensRef: "1 W / 1 m", aes: 40, aesXo: 1800, minXo: 1000, imp: 8 },
    {},
    900,
    400,
    4,
  );
  close(t, b!.derate, 0.25, 1e-12);
  close(t, b!.P, 20, 1e-9);
  assert.equal(b!.who, "thermal");
});
test("horn curve: flat = sens + 10 log P; LR24 -6 dB at the crossover; 12 dB/oct below the loading limit", (t) => {
  const h = hornResponse(n314t, { lowHz: 1000 }, 1000, 100, 4);
  close(t, h!.flat, n314t.sens + 10 * Math.log10(h!.P), 1e-9);
  close(t, near(h!.curve, 8000).spl, h!.flat, 0.05, "flat at 8 kHz");
  const g = hornResponse(n314t, {}, 1000, 100, 4);
  close(t, near(g!.curve, 1000).spl - g!.flat, db(0.5), 0.1, "LR24 at xo");
  const lo = hornResponse(n314t, { lowHz: 2000 }, 100, 100, 4); // far above the xo: only the loading rolloff
  close(t, near(lo!.curve, 1000).spl - near(lo!.curve, 2000).spl, -12, 0.3, "12 dB/oct");
});
