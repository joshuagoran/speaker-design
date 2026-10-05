import { useSyncExternalStore } from "react";
import {
  DARK_QUERY,
  HOST_THEME_ATTR,
  THEME_ATTR,
  THEME_CHOICES,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  THEME_SYSTEM,
} from "../constants/themes";
import { PALETTES } from "../styles/palette";
import type { Palette } from "../styles/palette";
import type { ThemeChoice, ThemeName } from "../types";
import { useStoredStateFrom } from "./useStoredState";

// The theme in use: <html data-theme> when a theme is pinned (by the switch, or by the host page), else the device's
// setting. The stylesheet reads the same two things (tailwind.config.js), so CSS and the charts drawn from usePalette()
// always agree.

const isThemeName = (v: unknown): v is ThemeName =>
  typeof v === "string" && Object.hasOwn(PALETTES, v);
const isThemeChoice = (v: unknown): v is ThemeChoice => THEME_CHOICES.some(([c]) => c === v);
const deviceDark = () => typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;

function subscribe(onChange: () => void) {
  const media = typeof matchMedia === "function" ? matchMedia(DARK_QUERY) : null;
  media?.addEventListener("change", onChange);
  const attr = new MutationObserver(onChange);
  attr.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTR] });
  return () => {
    media?.removeEventListener("change", onChange);
    attr.disconnect();
  };
}

function themeNow(): ThemeName {
  const pinned = document.documentElement.getAttribute(THEME_ATTR);
  if (isThemeName(pinned)) return pinned;
  return deviceDark() ? THEME_DARK : THEME_LIGHT;
}

/** The theme in use, following the switch, the host page and the device's setting as they change. */
export const useThemeName = (): ThemeName =>
  useSyncExternalStore(subscribe, themeNow, (): ThemeName => THEME_LIGHT);

/** The palette of the theme in use, for colours drawn from code (SVG charts, drawings, the 3D view). */
export const usePalette = (): Palette => PALETTES[useThemeName()];

/** Pins the chosen theme on <html>, or, for System, hands back to the host page's theme or the device's setting. */
function applyThemeChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice !== THEME_SYSTEM) return root.setAttribute(THEME_ATTR, choice);
  const host = root.getAttribute(HOST_THEME_ATTR);
  if (host) root.setAttribute(THEME_ATTR, host);
  else root.removeAttribute(THEME_ATTR);
}

/** The header switch's choice, kept per browser; the boot script in index.html applied the stored one before first paint. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useStoredStateFrom<ThemeChoice, unknown>(
    THEME_STORAGE_KEY,
    THEME_SYSTEM,
    (stored) => (isThemeChoice(stored) ? stored : THEME_SYSTEM),
  );
  return [
    choice,
    (next) => {
      setChoice(next);
      applyThemeChoice(next);
    },
  ];
}
