// WCAG contrast of the palette in both themes: text 4.5:1 on its background, chart lines and large text 3:1.
import { assert, test } from "vite-plus/test";
import { PALETTES } from "../src/styles/palette";
import type { Palette } from "../src/styles/palette";

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** [what, foreground, background, minimum] for one theme's palette */
const pairs = (p: Palette): [string, string, string, number][] => {
  const s = p.status;
  return [
    ...(["white", "panel"] as const).flatMap((bg): [string, string, string, number][] => [
      [`ink on ${bg}`, p.ink, p[bg], 4.5],
      [`muted on ${bg}`, p.muted, p[bg], 4.5],
      [`cyan on ${bg}`, p.cyan, p[bg], 4.5],
      [`magenta on ${bg}`, p.magenta, p[bg], 4.5],
      [`green text on ${bg}`, s.green.text, p[bg], 4.5],
      [`red text on ${bg}`, s.red.text, p[bg], 4.5],
      [`orange text on ${bg}`, s.orange.text, p[bg], 4.5],
      [`orange line on ${bg}`, s.orange.base, p[bg], 3],
      [`green line on ${bg}`, s.green.base, p[bg], 3],
      [`red line on ${bg}`, s.red.base, p[bg], 3],
    ]),
    ["page text on ink (pressed buttons)", p.white, p.ink, 4.5],
    ["page text on accent (primary buttons)", p.white, p.accent, 4.5],
    ["page text on magenta (special buttons)", p.white, p.magenta, 4.5],
    ["muted on edge (section headers)", p.muted, p.edge, 4.5],
    ["ink on sub tint (cutlist)", p.ink, p.subTint, 4.5],
    ["ink on mid tint (cutlist)", p.ink, p.midTint, 4.5],
    ["green text on its tint", s.green.text, s.green.tint, 4.5],
    ["red text on its tint", s.red.text, s.red.tint, 4.5],
    ["orange text on its tint", s.orange.text, s.orange.tint, 4.5],
  ];
};

for (const [theme, p] of Object.entries(PALETTES))
  for (const [what, fg, bg, min] of pairs(p))
    test(`${theme}: ${what} ≥ ${min}:1`, () => {
      const c = contrast(fg, bg);
      assert.isAtLeast(c, min, `${fg} on ${bg} is ${c.toFixed(2)}:1`);
    });
