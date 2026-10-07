// The horn body's color in the 3-D view: the color picked in the settings, else the horn's catalog finish.
import { HORN_COLOR_CATALOG } from "../../constants/hornColor";
import { HORN_FINISH_COLORS, PARTS_3D } from "../../styles/palette";
import type { Horn, PaDesignConfig } from "../../types";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** A picked color as the design keeps it: a hex color, or undefined for the catalog finish (empty or the reset). */
export function pickedHornColor(value: string | undefined): PaDesignConfig["hornColor"] {
  return value && value !== HORN_COLOR_CATALOG && HEX_COLOR.test(value) ? value : undefined;
}

/** A saved design's horn color; a save from before the picker, or a bad value: the catalog finish. */
export function savedHornColor(c: Partial<PaDesignConfig>): PaDesignConfig["hornColor"] {
  return pickedHornColor(c.hornColor);
}

/** The horn body's color as 0xRRGGBB: the picked color, else the factory finish, else the printed cream. */
export function hornBodyColor(horn: Pick<Horn, "finish">, picked?: string): number {
  const color = pickedHornColor(picked);
  if (color) return parseInt(color.slice(1), 16);
  return horn.finish ? HORN_FINISH_COLORS[horn.finish] : PARTS_3D.cream;
}

/** A 0xRRGGBB color as a CSS hex string. */
export const cssHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
