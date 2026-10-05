// The one palette. Every colour in the app comes from here: the CSS variables and Tailwind's colour names are generated from
// it at build time (tailwind.config.js), and the app code uses PAL.<name>. Nothing else in the project writes a colour literal.
export interface StatusColour {
  tint: string;
  edge: string;
  base: string;
  text: string;
}

export interface Palette {
  ink: string;
  white: string;
  muted: string;
  edge: string;
  magenta: string;
  cyan: string;
  yellow: string;
  subTint: string;
  midTint: string;
  cyanHue: number;
  status: { green: StatusColour; red: StatusColour; orange: StatusColour };
  accent: string;
  alpha: (hex: string, a: number) => string;
  cssVars: { ink: string; white: string; muted: string; edge: string; accent: string };
}

const P = {
  ink: "#111111",
  white: "#ffffff",
  muted: "#595959",
  edge: "#e6e6e6",
  magenta: "#e5007e",
  cyan: "#0082c8",
  yellow: "#ffd400",
  subTint: "#fff3b0",
  midTint: "#cce6f4",
  cyanHue: 201,
  // status colours stay conventional and separate from the brand colours. tint: background, edge: border of a tinted note,
  // base: the colour, text: its dark shade for text
  status: {
    green: { tint: "#ecf8f0", edge: "#8fcf9f", base: "#1a7f37", text: "#1a7f37" },
    red: { tint: "#fdeeee", edge: "#ee9a9a", base: "#c81e1e", text: "#c81e1e" },
    orange: { tint: "#fff3e3", edge: "#f2b26b", base: "#d9730d", text: "#b35900" },
  },
} as Palette; // the literal omits accent, alpha and cssVars, which are assigned right below
P.accent = P.ink;
// a colour with transparency, for chart tints and shadows
P.alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
// the CSS variables the stylesheet reads
P.cssVars = { ink: P.ink, white: P.white, muted: P.muted, edge: P.edge, accent: P.accent };

export const PAL = P;

// Dispersion maps only (an owner-approved exception to the brand palette): one continuous VituixCAD-style scale of
// level relative to on-axis, white at +6 dB through red at 0 dB to black at −36 dB, with a contour line every 3 dB.
// Every dispersion map and its key use these, so all maps read alike.
export const DISPERSION_SCALE = {
  /** top and bottom of the scale, dB re on-axis; levels outside are clamped */
  topDb: 6,
  botDb: -36,
  /** a thin darker contour line every this many dB */
  contourDb: 3,
  /** how dark a contour line is drawn: the cell's colour times this */
  contourShade: 0.45,
  /** the key's ticks, dB apart */
  keyStepDb: 6,
  /** [dB, colour], from the top down */
  stops: [
    [6, "#ffffff"], // white
    [3, "#ff8fa3"], // pink
    [0, "#ff1a00"], // red
    [-4, "#ff9900"], // orange
    [-7, "#ffee00"], // yellow
    [-10, "#a8ff00"], // yellow-green
    [-14, "#00e040"], // green
    [-17, "#00ffd0"], // aqua
    [-20, "#00b0ff"], // cyan-blue
    [-24, "#2040ff"], // blue
    [-27, "#8000ff"], // violet
    [-30, "#d000d0"], // magenta
    [-33, "#500050"], // dark purple
    [-36, "#000000"], // black
  ],
} as const;

/** An RGB triple, 0-255. */
export type Rgb = readonly [r: number, g: number, b: number];

const hexRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const DISPERSION_RGB = DISPERSION_SCALE.stops.map(([db, hex]) => [db, hexRgb(hex)] as const);

/** A level's colour on the dispersion scale, interpolated between the stops; clamped to +6..−36 dB. */
export function dispersionRgb(db: number): Rgb {
  const d = Math.max(DISPERSION_SCALE.botDb, Math.min(DISPERSION_SCALE.topDb, db));
  for (let i = 0; i + 1 < DISPERSION_RGB.length; i++) {
    const [d0, c0] = DISPERSION_RGB[i],
      [d1, c1] = DISPERSION_RGB[i + 1];
    if (d <= d0 && d >= d1) {
      const t = (d0 - d) / (d0 - d1),
        mix = (k: 0 | 1 | 2) => Math.round(c0[k] + (c1[k] - c0[k]) * t);
      return [mix(0), mix(1), mix(2)];
    }
  }
  return DISPERSION_RGB[DISPERSION_RGB.length - 1][1];
}

/** The same colour as a CSS `rgb()` string, darkened by `shade` (1 for none, `contourShade` on a contour line). */
export const dispersionColour = (db: number, shade = 1): string =>
  `rgb(${dispersionRgb(db)
    .map((v) => Math.round(v * shade))
    .join(",")})`;
