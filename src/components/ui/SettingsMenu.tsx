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
  // a fixed menu would part from its button as the page scrolls or the window changes size, so either closes it
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  const toggle = () => {
    const button = box.current?.getBoundingClientRect();
    if (button) setAt({ top: button.bottom + 4, right: window.innerWidth - button.right });
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
      <path d="M12.75 6.81L14.54 7.08L14.54 8.92L12.75 9.19L12.20 10.52L13.27 11.97L11.97 13.27L10.52 12.20L9.19 12.75L8.92 14.54L7.08 14.54L6.81 12.75L5.48 12.20L4.03 13.27L2.73 11.97L3.80 10.52L3.25 9.19L1.46 8.92L1.46 7.08L3.25 6.81L3.80 5.48L2.73 4.03L4.03 2.73L5.48 3.80L6.81 3.25L7.08 1.46L8.92 1.46L9.19 3.25L10.52 3.80L11.97 2.73L13.27 4.03L12.20 5.48Z" />
      <circle cx="8" cy="8" r="2" />
    </Icon>
  );
}
