import { createContext, useContext, useMemo } from "react";
import {
  DEFAULT_UNIT_SETTINGS,
  UNIT_SYSTEM,
  UNIT_SYSTEM_CHOICES,
  UNITS_STORAGE_KEY,
  VOLUME_STORAGE_KEY,
  VOLUME_UNIT,
  VOLUME_UNIT_CHOICES,
} from "../constants/units";
import { unitsFor, type Units } from "../lib/units";
import type { UnitSettings, UnitSystem, VolumeUnit } from "../types";
import { useStoredStateFrom } from "./useStoredState";

const isUnitSystem = (v: unknown): v is UnitSystem => UNIT_SYSTEM_CHOICES.some(([s]) => s === v);
const isVolumeUnit = (v: unknown): v is VolumeUnit => VOLUME_UNIT_CHOICES.some(([u]) => u === v);

/** The settings menu's Units choice, kept per browser like the theme; US when none is stored. */
export const useUnitChoice = () =>
  useStoredStateFrom<UnitSystem, unknown>(UNITS_STORAGE_KEY, UNIT_SYSTEM.us, (stored) =>
    isUnitSystem(stored) ? stored : UNIT_SYSTEM.us,
  );

/** The settings menu's Volume choice, kept per browser; liters when none is stored. */
export const useVolumeChoice = () =>
  useStoredStateFrom<VolumeUnit, unknown>(VOLUME_STORAGE_KEY, VOLUME_UNIT.liters, (stored) =>
    isVolumeUnit(stored) ? stored : VOLUME_UNIT.liters,
  );

const UnitsContext = createContext<UnitSettings>(DEFAULT_UNIT_SETTINGS);

/** Gives the pages under it the unit settings `settings` (the app's root holds the choices). */
export function UnitsProvider({
  settings,
  children,
}: {
  settings: UnitSettings;
  children: React.ReactNode;
}) {
  return <UnitsContext.Provider value={settings}>{children}</UnitsContext.Provider>;
}

/** The unit settings the page shows: US and liters outside a `UnitsProvider`. */
export const useUnitSettings = (): UnitSettings => useContext(UnitsContext);

/** The display helpers (lib/units) bound to the unit settings the page shows. */
export function useUnits(): Units {
  const settings = useUnitSettings();
  return useMemo(() => unitsFor(settings), [settings]);
}
