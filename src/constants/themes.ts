// The theme switch: ids, labels, and the names the boot script in index.html (vite.config.ts) and the app share.

/** The choice that follows the device's setting (`prefers-color-scheme`). */
export const THEME_SYSTEM = "system";

/** The two themes (the keys of PALETTES). */
export const THEME_LIGHT = "light";
export const THEME_DARK = "dark";

/** The header's theme switch, in display order: [choice, label]. */
export const THEME_CHOICES = [
  [THEME_SYSTEM, "System"],
  [THEME_LIGHT, "Light"],
  [THEME_DARK, "Dark"],
] as const;

/** Where the choice is kept, per browser (JSON, like the other stored settings). */
export const THEME_STORAGE_KEY = "theme";

/** The attribute on <html> that pins a theme; the stylesheet's dark variables key on it and on the media query. */
export const THEME_ATTR = "data-theme";

/** Where the boot script keeps a theme the host page set before ours (the claude.ai artifact frame), for System to return to. */
export const HOST_THEME_ATTR = "data-host-theme";

/** The device's dark setting. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";
