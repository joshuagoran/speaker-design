import { test } from "vite-plus/test";
import assert from "node:assert";
import { ohmsOf } from "../src/lib/power";
import { hornPower } from "../src/lib/acoustics/boxModels";
import { CD_OPTIONS } from "../src/lib/data";
import { close } from "./helpers";

const n314t = CD_OPTIONS.find((o) => o.id === "n314t")!.hf!;
test("horn power: amp into Z, capped at 2 x AES, derated below the rated crossover", (t) => {
  const a = hornPower(n314t, 900, 100);
  close(
    t,
    a.P,
    Math.min((100 * 8) / ohmsOf(n314t), 2 * n314t.aes * Math.min(1, (900 / n314t.aesXo) ** 2)),
    1e-9,
  );
  const b = hornPower({ aes: 40, aesXo: 1800, imp: 8 }, 900, 400);
  close(t, b.derate, 0.25, 1e-12);
  close(t, b.P, 20, 1e-9);
  assert.equal(b.who, "thermal");
});
