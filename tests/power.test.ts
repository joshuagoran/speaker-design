// The watts-to-volts rule every engine uses (src/lib/power.ts), and the catalog's impedances against their Re.
import { test } from "vite-plus/test";
import assert from "node:assert";
import { FALLBACK_OHMS, ohmsOf, voltsToWatts, wattsToVolts } from "../src/lib/power";
import { FILL_OPTIONS, HIFI_WOOFERS, MID_OPTIONS, SUB_OPTIONS } from "../src/lib/data";
import { close } from "./helpers";

test("watts and volts at 4, 8 and 16 Ω, and 8 Ω where no impedance is entered", (t) => {
  for (const [imp, volts] of [
    [4, 20],
    [8, Math.sqrt(800)],
    [16, 40],
  ] as const) {
    close(t, wattsToVolts(100, { imp }), volts, 1e-12, `${imp} Ω`);
    close(t, voltsToWatts(volts, { imp }), 100, 1e-9, `${imp} Ω`);
  }
  assert.equal(FALLBACK_OHMS, 8);
  for (const part of [{}, { imp: 0 }, { imp: -4 }]) {
    assert.equal(ohmsOf(part), FALLBACK_OHMS);
    close(t, wattsToVolts(100, part), Math.sqrt(800), 1e-12);
  }
  // the round trip holds at any impedance
  for (const imp of [2, 3.2, 6, 12])
    close(t, voltsToWatts(wattsToVolts(37, { imp }), { imp }), 37, 1e-9);
});

// A coaxial's `imp` in the fills table is its HF section's (`FillHf.imp`), not its woofer's: the woofer's Re can't
// check it, so the coaxials (FILL_OPTIONS, and their woofers in HIFI_WOOFERS) are left out.
const coaxIds = new Set(FILL_OPTIONS.map((f) => f.id));

test("an entry's impedance fits its Re: 4 Ω has Re ≤ 4.2 Ω, 8 Ω has Re ≥ 4.5 Ω", () => {
  const bad: string[] = [];
  for (const d of [...SUB_OPTIONS, ...MID_OPTIONS, ...HIFI_WOOFERS]) {
    if (coaxIds.has(d.id)) continue;
    const { imp, Re } = d.ts;
    if (imp === 4 && Re > 4.2) bad.push(`${d.id}: 4 Ω, Re ${Re}`);
    if (imp === 8 && Re < 4.5) bad.push(`${d.id}: 8 Ω, Re ${Re}`);
  }
  assert.deepEqual(bad, []);
});
