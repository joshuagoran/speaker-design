import { useEffect, useRef, useState } from "react";
import { useMenuClose } from "../../hooks/useMenuClose";
import { THEME_CHOICES } from "../../constants/themes";
import { UNIT_SYSTEM_CHOICES, VOLUME_UNIT_CHOICES } from "../../constants/units";
import { SETTINGS_MENU_TEXT } from "../../constants/uiText";
import { useThemeChoice } from "../../hooks/useTheme";
import type { UnitSystem, VolumeUnit } from "../../types";
import { Icon, IconButton } from "./IconButton";
import { SelectField } from "./SelectField";

/** [id, label] pairs as a select's options. */
const optionsOf = <T extends string>(choices: readonly (readonly [T, string])[]) =>
  choices.map(([id, name]) => ({ id, name }));
const THEME_OPTIONS = optionsOf(THEME_CHOICES);
const UNIT_OPTIONS = optionsOf(UNIT_SYSTEM_CHOICES);
const VOLUME_OPTIONS = optionsOf(VOLUME_UNIT_CHOICES);

interface Props {
  /** the Units choice (the app's root holds it, for every page) */
  units: UnitSystem;
  onUnits: (system: UnitSystem) => void;
  /** the Volume choice (held with Units) */
  volume: VolumeUnit;
  onVolume: (volume: VolumeUnit) => void;
}

/** The header's gear button: a small menu with the Theme, Units, and Volume dropdowns (each kept per browser). */
export function SettingsMenu({ units, onUnits, volume, onVolume }: Props) {
  const [theme, setTheme] = useThemeChoice();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  /** where the menu opens: under the button, its right edge on the button's (fixed, so the header can't clip it) */
  const [at, setAt] = useState({ top: 0, right: 0 });
  useMenuClose(open, box, setOpen);
  // a fixed menu would part from its button as the page scrolls or the window gets wider or narrower, so either closes
  // it (a phone's address bar showing or hiding changes only the height)
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const width = window.innerWidth;
    const resize = () => {
      if (window.innerWidth !== width) close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  const toggle = () => {
    const button = box.current?.getBoundingClientRect();
    // `right` is measured from the viewport's edge without its scrollbar
    if (button)
      setAt({ top: button.bottom + 4, right: document.documentElement.clientWidth - button.right });
    setOpen((o) => !o);
  };
  return (
    <div ref={box} className="relative">
      <IconButton label={SETTINGS_MENU_TEXT.button} pressed={open} onClick={toggle}>
        <GearIcon />
      </IconButton>
      {open && (
        <div
          role="group"
          aria-label={SETTINGS_MENU_TEXT.button}
          style={at}
          className="fixed z-40 w-48 p-3 flex flex-col gap-3 rounded border border-stone-300 bg-panel shadow-dialog"
        >
          <SelectField
            label={SETTINGS_MENU_TEXT.theme}
            options={THEME_OPTIONS}
            value={THEME_OPTIONS.find((o) => o.id === theme)}
            onChange={(o) => setTheme(o.id)}
          />
          <SelectField
            label={SETTINGS_MENU_TEXT.units}
            options={UNIT_OPTIONS}
            value={UNIT_OPTIONS.find((o) => o.id === units)}
            onChange={(o) => onUnits(o.id)}
          />
          <SelectField
            label={SETTINGS_MENU_TEXT.volume}
            options={VOLUME_OPTIONS}
            value={VOLUME_OPTIONS.find((o) => o.id === volume)}
            onChange={(o) => onVolume(o.id)}
          />
        </div>
      )}
    </div>
  );
}

/** The gear icon: settings. */
function GearIcon() {
  return (
    <Icon>
      <path d="M6.44 3.46L6.74 1.52L9.26 1.52L9.56 3.46L11.15 4.38L12.98 3.67L14.24 5.85L12.71 7.08L12.71 8.92L14.24 10.15L12.98 12.33L11.15 11.62L9.56 12.54L9.26 14.48L6.74 14.48L6.44 12.54L4.85 11.62L3.02 12.33L1.76 10.15L3.29 8.92L3.29 7.08L1.76 5.85L3.02 3.67L4.85 4.38Z" />
      <circle cx="8" cy="8" r="2" />
    </Icon>
  );
}
