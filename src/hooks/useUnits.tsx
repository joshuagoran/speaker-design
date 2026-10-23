import { createContext, useContext, useMemo } from "react";
import { UNIT_SYSTEM, UNIT_SYSTEM_CHOICES, UNITS_STORAGE_KEY } from "../constants/units";
import { unitsFor, type Units } from "../lib/units";
import type { UnitSystem } from "../types";
import { useStoredStateFrom } from "./useStoredState";

const isUnitSystem = (v: unknown): v is UnitSystem => UNIT_SYSTEM_CHOICES.some(([s]) => s === v);

/** The settings menu's Units choice, kept per browser like the theme; US when none is stored. */
export const useUnitChoice = () =>
  useStoredStateFrom<UnitSystem, unknown>(UNITS_STORAGE_KEY, UNIT_SYSTEM.us, (stored) =>
    isUnitSystem(stored) ? stored : UNIT_SYSTEM.us,
  );

const UnitsContext = createContext<UnitSystem>(UNIT_SYSTEM.us);

/** Gives the pages under it the unit system `system` (the app's root holds the choice). */
export function UnitsProvider({
  system,
  children,
}: {
  system: UnitSystem;
  children: React.ReactNode;
}) {
  return <UnitsContext.Provider value={system}>{children}</UnitsContext.Provider>;
}

/** The unit system the page shows: US outside a `UnitsProvider`. */
export const useUnitSystem = (): UnitSystem => useContext(UnitsContext);

/** The display helpers (lib/units) bound to the unit system the page shows. */
export function useUnits(): Units {
  const system = useUnitSystem();
  return useMemo(() => unitsFor(system), [system]);
}
