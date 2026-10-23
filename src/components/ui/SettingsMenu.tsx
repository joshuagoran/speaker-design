import { useEffect, useRef, useState } from "react";
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
  // a click outside the menu or Escape closes it
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !box.current?.contains(e.target)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <IconButton
        label={SETTINGS_MENU_TEXT.button}
        pressed={open}
        onClick={() => setOpen((o) => !o)}
      >
        <GearIcon />
      </IconButton>
      {open && (
        <div
          role="group"
          aria-label={SETTINGS_MENU_TEXT.button}
          className="absolute right-0 top-full mt-1 z-20 w-48 p-3 flex flex-col gap-3 rounded border border-stone-300 bg-panel shadow-menu"
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
      <circle cx="8" cy="8" r="2.25" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </Icon>
  );
}
