// Tailwind, compiled at build time (it used to run in the browser from the Play CDN). The colour names are mapped onto the
// palette: stone = the grays; green / orange (amber) / red = status; cmy-* = brand (cmy-a = actions and focus, ink today;
// cmy-y = yellow accents; chart colours are read from PAL in the app code); 4 px corners, 6 px for large ones.
import plugin from "tailwindcss/plugin";
import { PAL } from "./tools/palette.js";

const S = PAL.status;
// a: tint (backgrounds), e: soft edge (borders of tinted notes), b: the colour, c: its dark text shade
const scale = (s) => ({
  50: s.tint,
  200: s.edge,
  300: s.base,
  700: s.text,
  800: s.text,
  900: s.text,
});
const font = ["Inconsolata", "ui-monospace", "monospace"];

export default {
  content: ["./index.html", "./tools/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        stone: { 50: PAL.white, 300: PAL.edge, 500: PAL.muted, 900: PAL.ink },
        // status colours stay conventional and separate from the brand colours: green ok, orange warning, red problem
        green: scale(S.green),
        red: scale(S.red),
        orange: scale(S.orange),
        amber: scale(S.orange),
        cmy: { y: PAL.yellow, a: PAL.accent },
        soft: PAL.alpha(PAL.muted, 0.5),
      },
      borderRadius: { DEFAULT: "4px", lg: "6px" },
      boxShadow: { sheet: "0 -6px 20px " + PAL.alpha(PAL.ink, 0.1) },
      fontFamily: { sans: font, serif: font, mono: font },
    },
  },
  plugins: [
    // the palette's CSS variables (the page styles read var(--ink) etc.)
    plugin((api) =>
      api.addBase({
        ":root": Object.fromEntries(Object.entries(PAL.cssVars).map(([k, v]) => [`--${k}`, v])),
      }),
    ),
  ],
};
