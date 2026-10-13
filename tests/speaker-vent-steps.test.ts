// The Speaker page's vent fields (pages/speaker/ChamberSettings PortFields): each number field steps by its
// SPEAKER_STEPS entry and shows its value rounded to that same step, so its arrows step from what it shows and land
// where the Speaker optimizer builds (it steps the vents by the same entries). Values off the step show on it.
import { expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PortFields } from "../src/pages/speaker/ChamberSettings";
import { SPEAKER_STEPS } from "../src/constants/speakerSteps";
import { PORT_SHAPE } from "../src/constants/speakerSpec";
import type { SpeakerPort } from "../src/types";

/** Each vent field's step, by the port kind that shows it, in the order the fields render. */
const CASES: [string, SpeakerPort, number[]][] = [
  [
    "letterbox: fins, height, length",
    { shape: PORT_SHAPE.slot, n: 1, h: 2.13, len: 13.8, fins: 2 },
    [SPEAKER_STEPS.count, SPEAKER_STEPS.slotHIn, SPEAKER_STEPS.portLenIn],
  ],
  [
    "plain slot: count, narrow side, length, long side",
    { shape: PORT_SHAPE.slot, n: 2, h: 1.13, w: 7.1, len: 9.3 },
    [SPEAKER_STEPS.count, SPEAKER_STEPS.slotHIn, SPEAKER_STEPS.portLenIn, SPEAKER_STEPS.portSizeIn],
  ],
  [
    "plain slot, long side Auto: the clear width on the step",
    { shape: PORT_SHAPE.slot, n: 1, h: 2, len: 9 },
    [SPEAKER_STEPS.count, SPEAKER_STEPS.slotHIn, SPEAKER_STEPS.portLenIn, SPEAKER_STEPS.portSizeIn],
  ],
  [
    "side ducts: throat, length",
    { shape: PORT_SHAPE.duct, n: 2, throat: 1.38, len: 21.3, div: 0.75, divider: "3/4" },
    [SPEAKER_STEPS.portSizeIn, SPEAKER_STEPS.portLenIn],
  ],
  [
    "round tubes: count, diameter, length",
    { shape: PORT_SHAPE.round, n: 2, dia: 2.9, len: 6.2 },
    [SPEAKER_STEPS.count, SPEAKER_STEPS.portSizeIn, SPEAKER_STEPS.portLenIn],
  ],
  [
    "flared tubes: count, diameter, length",
    { shape: PORT_SHAPE.round, n: 2, dia: 3.9, len: 9.8, flared: true },
    [SPEAKER_STEPS.count, SPEAKER_STEPS.portSizeIn, SPEAKER_STEPS.portLenIn],
  ],
];

/** Each number input's step and shown value, in order. */
function numberFields(port: SpeakerPort) {
  const html = renderToStaticMarkup(
    createElement(PortFields, {
      port,
      walls: { nominal: "3/4", thicknessIn: 0.75 },
      chamber: { dims: { w: 24, h: 32, d: 18 }, drivers: [] },
      clearW: 22.37,
      onChange: () => {},
    }),
  );
  return [...html.matchAll(/<input[^>]*type="number"[^>]*>/g)].map(([tag]) => ({
    step: Number(/ step="([^"]+)"/.exec(tag)?.[1]),
    value: Number(/ value="([^"]+)"/.exec(tag)?.[1]),
  }));
}

test("the vent fields' steps are SPEAKER_STEPS' entries", () => {
  // the slot sizes step as the PA page's sliders do, a count by one
  expect(SPEAKER_STEPS.slotHIn).toBe(0.25);
  expect(SPEAKER_STEPS.count).toBe(1);
});

for (const [name, port, steps] of CASES)
  test(`each vent field shows its value on its own step: ${name}`, () => {
    const fields = numberFields(port);
    expect(
      fields.map((f) => f.step),
      name,
    ).toEqual(steps);
    for (const { step, value } of fields) {
      const k = value / step;
      expect(Math.abs(k - Math.round(k)), `${name}: ${value} on ${step}`).toBeLessThan(1e-9);
    }
  });
