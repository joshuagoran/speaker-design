// The one palette, in a light and a dark theme of the same shape. Every colour in the app comes from here: the CSS
// variables and Tailwind's colour names are generated from it at build time (tailwind.config.js), and the app code reads
// the active theme's palette with usePalette() (src/hooks/useTheme.ts). Nothing else in the project writes a colour literal,
// except three that show real things, the same in both themes: the favicon (index.html), the custom colour picker's
// rainbow ring (SwatchPicker) and the cabinet finish data (src/data/catalog/finishes.ts, the default baffle paint).
import type { ThemeName } from "../types";

export interface StatusColour {
  tint: string;
  edge: string;
  base: string;
  text: string;
}

export interface Palette {
  /** text and lines */
  ink: string;
  /** the page background (light: white) */
  white: string;
  /** cards, inputs and buttons on the page */
  panel: string;
  muted: string;
  edge: string;
  magenta: string;
  cyan: string;
  yellow: string;
  subTint: string;
  midTint: string;
  /** drop shadows */
  shadow: string;
  /** actions and focus */
  accent: string;
  status: { green: StatusColour; red: StatusColour; orange: StatusColour };
}

const LIGHT: Palette = {
  ink: "#111111",
  white: "#ffffff",
  panel: "#ffffff",
  muted: "#595959",
  edge: "#e6e6e6",
  magenta: "#e5007e",
  cyan: "#0077b8",
  yellow: "#ffd400",
  subTint: "#fff3b0",
  midTint: "#cce6f4",
  shadow: "#111111",
  accent: "#111111",
  // status colours stay conventional and separate from the brand colours. tint: background, edge: border of a tinted note,
  // base: the colour, text: its dark shade for text
  status: {
    green: { tint: "#ecf8f0", edge: "#8fcf9f", base: "#1a7f37", text: "#1a7f37" },
    red: { tint: "#fdeeee", edge: "#ee9a9a", base: "#c81e1e", text: "#c81e1e" },
    orange: { tint: "#fff3e3", edge: "#f2b26b", base: "#d9730d", text: "#a85400" },
  },
};

// the same roles on a near-black page: light text, brand and status colours re-tuned for contrast on dark, dark tints
const DARK: Palette = {
  ink: "#e8e8e6",
  white: "#141516",
  panel: "#1b1d1f",
  muted: "#a3a3a3",
  edge: "#33373b",
  magenta: "#ff4fae",
  cyan: "#45b6f2",
  yellow: "#ffd84d",
  subTint: "#3a3410",
  midTint: "#12313f",
  shadow: "#000000",
  accent: "#e8e8e6",
  status: {
    green: { tint: "#10291a", edge: "#2f6e43", base: "#6fd98c", text: "#6fd98c" },
    red: { tint: "#2e1414", edge: "#7a2f2f", base: "#ff8a8a", text: "#ff8a8a" },
    orange: { tint: "#2e2110", edge: "#8a5a1f", base: "#e8892b", text: "#ffb866" },
  },
};

export const PALETTES: Record<ThemeName, Palette> = { light: LIGHT, dark: DARK };

/** Colours drawn on data colours that stay the same in both themes (the dispersion and coverage maps' scales, the
 * cabinet finishes): the light palette's, so lines, marks and labels on them read the same in either theme. */
export const ON_DATA: Pick<Palette, "ink" | "white" | "muted" | "edge" | "magenta" | "cyan"> =
  LIGHT;

/** The 3D view's stage in each theme: floor, grid and lights (three.js hex numbers). The cabinet finishes and the driver
 * parts (PARTS_3D) keep their true colours in both. */
export const STAGE: Record<
  ThemeName,
  {
    floor: number;
    gridMajor: number;
    gridMinor: number;
    sky: number;
    ground: number;
    hemi: number;
    key: number;
  }
> = {
  light: {
    floor: 0xf4f4f4,
    gridMajor: 0xdddddd,
    gridMinor: 0xeaeaea,
    sky: 0xffffff,
    ground: 0x777766,
    hemi: 1.1,
    key: 0.6,
  },
  dark: {
    floor: 0x232528,
    gridMajor: 0x3d4145,
    gridMinor: 0x2e3134,
    sky: 0xd8dce0,
    ground: 0x2a2a26,
    hemi: 0.95,
    key: 0.55,
  },
};

/** The 3D view's driver and hardware parts (three.js hex numbers): their true colours, the same in both themes. */
export const PARTS_3D = {
  /** cones, surrounds, throats, stands and rods */
  black: 0x1c1c1c,
  /** horn bodies */
  cream: 0xece4c8,
  /** the cabinet shell in the cutaway, a ghost of clear birch */
  ghost: 0xd7b98a,
  /** port tubes */
  port: 0x8a7458,
  /** the scale figure beside the stack, drawn semi-transparent */
  figure: 0x8b847d,
} as const;

/** A colour with transparency, for chart tints and shadows. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

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
