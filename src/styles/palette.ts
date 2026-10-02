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
