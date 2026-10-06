import { useEffect, useSyncExternalStore } from "react";
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
  const set = document.documentElement.getAttribute(THEME_ATTR);
  if (isThemeName(set)) return set;
  return deviceDark() ? THEME_DARK : THEME_LIGHT;
}

/** The theme in use, following the switch, the host page and the device's setting as they change. */
export const useThemeName = (): ThemeName =>
  useSyncExternalStore(subscribe, themeNow, (): ThemeName => THEME_LIGHT);

/** The palette of the theme in use, for colors drawn from code (SVG charts, drawings, the 3D view). */
export const usePalette = (): Palette => PALETTES[useThemeName()];

// The host page (the claude.ai artifact frame) and the switch both write <html data-theme>. The switch's pin wins; the
// host's latest theme is kept in data-host-theme for System to return to, so a host change after load neither overrides
// a pinned theme nor leaves System on a stale one.
/** The theme pinned with the switch, or null for System. */
let pinned: ThemeName | null = null;
/** The data-theme value this app last wrote, to tell the host page's writes from ours. */
let written: string | null = null;

function writeTheme(theme: string | null) {
  const root = document.documentElement;
  written = theme;
  if (theme) root.setAttribute(THEME_ATTR, theme);
  else root.removeAttribute(THEME_ATTR);
}

/** Pins the chosen theme on <html>, or, for System, hands back to the host page's theme or the device's setting. */
function applyThemeChoice(choice: ThemeChoice) {
  pinned = choice === THEME_SYSTEM ? null : choice;
  writeTheme(pinned ?? document.documentElement.getAttribute(HOST_THEME_ATTR));
}

/** Follows the host page's later data-theme writes: records them for System, and puts the pin back over them. */
function watchHostTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  pinned = choice === THEME_SYSTEM ? null : choice;
  // what we would have written: the pin, or the host theme the boot script recorded
  written = pinned ?? root.getAttribute(HOST_THEME_ATTR);
  const sync = () => {
    const now = root.getAttribute(THEME_ATTR);
    if (now === written) return;
    if (now) root.setAttribute(HOST_THEME_ATTR, now);
    else root.removeAttribute(HOST_THEME_ATTR);
    if (pinned) writeTheme(pinned);
    else written = now;
  };
  sync(); // the host may have written between the boot script and now
  const attr = new MutationObserver(sync);
  attr.observe(root, { attributes: true, attributeFilter: [THEME_ATTR] });
  return () => attr.disconnect();
}

/** The header switch's choice, kept per browser; the boot script in index.html applied the stored one before first paint. */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useStoredStateFrom<ThemeChoice, unknown>(
    THEME_STORAGE_KEY,
    THEME_SYSTEM,
    (stored) => (isThemeChoice(stored) ? stored : THEME_SYSTEM),
  );
  useEffect(() => watchHostTheme(choice), [choice]);
  return [
    choice,
    (next) => {
      setChoice(next);
      applyThemeChoice(next);
    },
  ];
}
