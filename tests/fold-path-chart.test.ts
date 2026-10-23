// The folded-horn path chart: it draws in both themes, the straight horn's dashed line is there, the cones' markers and
// the linked hover show, nothing past the fixed axes is drawn outside the plot, and the pointer maps to a distance.
import { describe, expect, test } from "vite-plus/test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  FoldPathChart,
  FoldPathDrawing,
  distanceAtPointer,
  foldPathAxes,
  nearestSection,
} from "../src/components/charts/FoldPathChart";
import { targetPathPoints } from "../src/lib/speaker/foldMatch";
import { HORN_PROFILE } from "../src/constants/hornEngine";
import { FOLD_CHART_TEXT } from "../src/constants/speakerPage";
import { CM2_PER_IN2, CM_PER_IN, DEFAULT_UNIT_SETTINGS } from "../src/constants/units";
import { PALETTES } from "../src/styles/palette";
import type { FoldPathSection, HornSegment } from "../src/types";

/** a passage that widens from 20 in² to 220 in², every 0.5 in, 100 in long, 10 in wide */
const sections: FoldPathSection[] = Array.from({ length: 201 }, (_, k) => ({
  sIn: k * 0.5,
  widthIn: 10,
  areaIn2: 20 + k,
}));

/** two straight-to-flared segments, in the horn engine's units: cm² and cm */
const target: HornSegment[] = [
  { profile: HORN_PROFILE.exponential, s1: 100, s2: 400, length: 60 },
  { profile: HORN_PROFILE.conical, s1: 400, s2: 900, length: 80 },
];

const taps = { front: 12, back: 40 };
const frame = { W: 760, H: 240, L: 52, R: 14, T: 16, B: 36 };
const axes = foldPathAxes(sections, target, DEFAULT_UNIT_SETTINGS);

/** the chart's drawing in one theme, as markup */
const draw = (theme: keyof typeof PALETTES, hoverIn: number | null = null) =>
  renderToString(
    createElement(
      "svg",
      null,
      createElement(FoldPathDrawing, {
        pal: PALETTES[theme],
        frame,
        clipId: "clip",
        sections,
        target,
        taps,
        hoverIn,
        axes,
      }),
    ),
  );

describe("FoldPathChart", () => {
  test("renders with an accessible name and the legend", () => {
    const html = renderToString(
      createElement(FoldPathChart, { sections, target, taps, hoverIn: null, onHover: () => {} }),
    );
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${FOLD_CHART_TEXT.label}"`);
    expect(html).toContain(FOLD_CHART_TEXT.traced);
    expect(html).toContain(FOLD_CHART_TEXT.target);
  });

  test.each(["light", "dark"] as const)(
    "draws both lines and the markers in the %s theme",
    (theme) => {
      const html = draw(theme);
      const pal = PALETTES[theme];
      expect(html).toContain('data-line="traced"');
      expect(html).toMatch(new RegExp(`data-line="target"[^>]*stroke-dasharray="5 4"`));
      expect(html).toContain(`stroke="${pal.cyan}"`);
      expect(html).toContain(`stroke="${pal.magenta}"`);
      expect(html).toContain(`data-tap="${FOLD_CHART_TEXT.front}"`);
      expect(html).toContain(`data-tap="${FOLD_CHART_TEXT.back}"`);
      expect(html).not.toContain("NaN");
    },
  );

  test("a cone that is absent draws no marker", () => {
    const html = renderToString(
      createElement(
        "svg",
        null,
        createElement(FoldPathDrawing, {
          pal: PALETTES.light,
          frame,
          clipId: "clip",
          sections,
          target,
          taps: { front: null, back: 40 },
          hoverIn: null,
          axes,
        }),
      ),
    );
    expect(html).not.toContain(`data-tap="${FOLD_CHART_TEXT.front}"`);
    expect(html).toContain(`data-tap="${FOLD_CHART_TEXT.back}"`);
  });

  test("the hover marker shows the width and area at the distance", () => {
    expect(draw("light")).not.toContain("data-hover");
    const html = draw("light", 30);
    expect(html).toContain("data-hover");
    expect(html).toContain(FOLD_CHART_TEXT.at("30.0 in", "10.0 in", "80 in²"));
  });

  test("a path past the axes is clipped to the plot", () => {
    const long: FoldPathSection[] = Array.from({ length: 801 }, (_, k) => ({
      sIn: k * 0.5,
      widthIn: 10,
      areaIn2: 20 + k * 5,
    }));
    const html = renderToString(
      createElement(
        "svg",
        null,
        createElement(FoldPathDrawing, {
          pal: PALETTES.light,
          frame,
          clipId: "clip",
          sections: long,
          target,
          taps,
          hoverIn: null,
          axes,
        }),
      ),
    );
    expect(html).toContain('clip-path="url(#clip)"');
    expect(html).toContain('<clipPath id="clip">');
  });
});

describe("targetPathPoints", () => {
  const points = targetPathPoints(target);

  test("starts at the throat and ends at the mouth, in inches and square inches", () => {
    expect(points[0].sIn).toBe(0);
    expect(points[0].areaIn2).toBeCloseTo(100 / CM2_PER_IN2, 9);
    const last = points[points.length - 1];
    expect(last.sIn).toBeCloseTo(140 / CM_PER_IN, 9);
    expect(last.areaIn2).toBeCloseTo(900 / CM2_PER_IN2, 9);
  });

  test("follows each segment's flare law (an exponential's area grows as S1 times the ratio to the power along)", () => {
    const inFirst = points.filter((p) => p.sIn * CM_PER_IN < 60 - 1e-9);
    expect(inFirst.length).toBeGreaterThan(10);
    for (const p of inFirst)
      expect(p.areaIn2).toBeCloseTo((100 * 4 ** ((p.sIn * CM_PER_IN) / 60)) / CM2_PER_IN2, 9);
  });

  test("leaves a segment without sizes out", () => {
    const gap: HornSegment = { profile: HORN_PROFILE.conical, s1: 0, s2: 500, length: 30 };
    const withGap = targetPathPoints([gap, ...target]);
    expect(withGap).toEqual(points);
    expect(withGap.every((p) => Number.isFinite(p.areaIn2) && Number.isFinite(p.sIn))).toBe(true);
  });

  test("an empty horn has no points", () => {
    expect(targetPathPoints([])).toEqual([]);
  });
});

describe("pointer mapping", () => {
  const x0 = 52,
    x1 = 746;

  test("maps the plot's ends to the axis", () => {
    expect(distanceAtPointer(x0, x0, x1, 150, 200)).toBe(0);
    expect(distanceAtPointer((x0 + x1) / 2, x0, x1, 150, 200)).toBeCloseTo(100, 9);
  });

  test("is null off the plot and past the path's end", () => {
    expect(distanceAtPointer(x0 - 1, x0, x1, 150, 200)).toBeNull();
    expect(distanceAtPointer(x1 + 1, x0, x1, 250, 200)).toBeNull();
    // 160 in is past a 150 in path
    expect(distanceAtPointer(x0 + (160 / 200) * (x1 - x0), x0, x1, 150, 200)).toBeNull();
    expect(distanceAtPointer(x0 + (100 / 200) * (x1 - x0), x0, x1, 150, 200)).toBeCloseTo(100, 9);
  });

  test("the nearest section is the one at the distance", () => {
    expect(nearestSection(sections, 30.2)?.sIn).toBe(30);
    expect(nearestSection([], 5)).toBeNull();
  });

  test("the axes fit the passage and the straight horn, to the next gridline", () => {
    const points = [...sections, ...targetPathPoints(target)];
    const longest = Math.max(...points.map((q) => q.sIn));
    const widest = Math.max(...points.map((q) => q.areaIn2));
    expect(axes.pathMaxIn).toBeGreaterThanOrEqual(longest);
    expect(axes.pathMaxIn - longest).toBeLessThan(axes.pathGridIn);
    expect(axes.areaMaxIn2).toBeGreaterThanOrEqual(widest);
    expect(axes.areaMaxIn2 - widest).toBeLessThan(axes.areaGridIn2);
    expect(axes.pathMaxIn / axes.pathGridIn).toBeLessThanOrEqual(8);
  });
});
