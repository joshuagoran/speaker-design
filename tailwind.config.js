// Tailwind, compiled at build time (it used to run in the browser from the Play CDN). The colour names are mapped onto the
// palette: stone = the grays; panel = cards and inputs; green / orange (amber) / red = status; cmy-* = brand (cmy-a = actions
// and focus, ink today; cmy-y = yellow accents, cmy-m = magenta (goal rank badges); chart colours are read from the palette
// in the app code, usePalette()); 4 px corners, 6 px for large ones.
//
// Every palette colour is a CSS variable holding "r g b": the light theme on :root, the dark one when the device asks for
// it (unless a light theme is pinned) or when it is pinned with <html data-theme="dark">. The colour names read the
// variables, so every class follows the theme with no `dark:` variants, and opacity modifiers (bg-panel/90) still work.
import plugin from "tailwindcss/plugin";
import { PALETTES } from "./src/styles/palette.ts";
import { DARK_QUERY, THEME_ATTR, THEME_DARK, THEME_LIGHT } from "./src/constants/themes.ts";

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
};
// palette → { "--ink": "17 17 17", "--green-tint": …, … }
const vars = (p) =>
  Object.fromEntries(
    Object.entries(p).flatMap(([k, v]) =>
      typeof v === "string"
        ? [[`--${k}`, rgb(v)]]
        : Object.entries(v).flatMap(([s, c]) =>
            Object.entries(c).map(([role, hex]) => [`--${s}-${role}`, rgb(hex)]),
          ),
    ),
  );
const v = (name, a) =>
  a == null ? `rgb(var(--${name}) / <alpha-value>)` : `rgb(var(--${name}) / ${a})`;
// a: tint (backgrounds), e: soft edge (borders of tinted notes), b: the colour, c: its dark text shade
const scale = (s) => ({
  50: v(`${s}-tint`),
  200: v(`${s}-edge`),
  300: v(`${s}-base`),
  700: v(`${s}-text`),
  800: v(`${s}-text`),
  900: v(`${s}-text`),
});
const font = ["Inconsolata", "ui-monospace", "monospace"];
const dark = { ...vars(PALETTES[THEME_DARK]), colorScheme: THEME_DARK };

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stone: { 50: v("white"), 300: v("edge"), 500: v("muted"), 900: v("ink") },
        panel: v("panel"),
        // Tailwind's own white and black follow the theme too: the page and the ink
        white: v("white"),
        black: v("ink"),
        // status colours stay conventional and separate from the brand colours: green ok, orange warning, red problem
        green: scale("green"),
        red: scale("red"),
        orange: scale("orange"),
        amber: scale("orange"),
        cmy: { y: v("yellow"), m: v("magenta"), a: v("accent") },
        soft: v("muted", 0.5),
      },
      borderRadius: { DEFAULT: "4px", lg: "6px" },
      boxShadow: { sheet: `0 -6px 20px ${v("shadow", 0.1)}` },
      fontFamily: { sans: font, serif: font, mono: font },
    },
  },
  plugins: [
    // the palette's CSS variables (the page styles read rgb(var(--ink)) etc.), light then dark
    plugin((api) =>
      api.addBase({
        ":root": { ...vars(PALETTES[THEME_LIGHT]), colorScheme: THEME_LIGHT },
        [`@media ${DARK_QUERY}`]: { [`:root:not([${THEME_ATTR}="${THEME_LIGHT}"])`]: dark },
        [`:root[${THEME_ATTR}="${THEME_DARK}"]`]: dark,
      }),
    ),
  ],
};
