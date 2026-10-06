import type { SetStateAction } from "react";
import type { CutlistSettings, PanelExactIn, Setter } from "../../types";
import type { CutlistOptions } from "../pa-stack/hooks/useCutlistOptions";
import { useStoredStateFrom } from "../../hooks/useStoredState";
import { CUTLIST_DEFAULTS, savedCutlist } from "../../lib/pa/cutlist";
import { PLYWOOD_SHEETS } from "../../lib/pa/calc";
import { keysOf } from "../../lib/records";
import { CUTLIST_PROJECTS } from "../../constants/cutlistProjects";
import { savedPanelExactIn } from "../../lib/panel";

/** Where this browser keeps the Hi-fi cutlist's choices. */
const STORE_KEY = "hifi.cutlist";

/** What this browser keeps: the cutlist's settings and the measured thickness of each nominal panel size. */
type HifiCutlistStored = CutlistSettings & { exactIn: PanelExactIn };

/** The Hi-fi cutlist's choices on first load: a pair of butt-jointed boxes, the PA cutlist's sheet and cut defaults. */
const HIFI_CUTLIST_DEFAULTS: CutlistSettings = {
  ...CUTLIST_DEFAULTS,
  joint: "butt",
  sheet: "4x8",
  stacks: 2,
};

/** Stored choices checked against what the page offers; anything missing or unknown falls back to the default. */
const fromStored = (c: Partial<HifiCutlistStored>): HifiCutlistStored => {
  const joint = c.joint === "rabbet" || c.joint === "miter" ? c.joint : HIFI_CUTLIST_DEFAULTS.joint;
  const sets: readonly number[] = CUTLIST_PROJECTS.hifi.sets;
  return {
    ...savedCutlist({ ...c, joint, waterfall: c.waterfall ?? HIFI_CUTLIST_DEFAULTS.waterfall }),
    joint,
    sheet: keysOf(PLYWOOD_SHEETS).find((k) => k === c.sheet) ?? HIFI_CUTLIST_DEFAULTS.sheet,
    stacks: sets.find((n) => n === c.stacks) ?? HIFI_CUTLIST_DEFAULTS.stacks,
    exactIn: savedPanelExactIn(c.exactIn),
  };
};

/**
 * The Hi-fi cutlist's choices, kept apart from the PA stack's and remembered in this browser (the Hi-fi design itself
 * isn't saved with them).
 */
export function useHifiCutlistOptions(): CutlistOptions {
  const [s, setS] = useStoredStateFrom<HifiCutlistStored, Partial<HifiCutlistStored>>(
    STORE_KEY,
    {},
    fromStored,
  );
  const field =
    <K extends keyof HifiCutlistStored>(k: K): Setter<HifiCutlistStored[K]> =>
    (v: SetStateAction<HifiCutlistStored[K]>) =>
      setS((prev) => ({ ...prev, [k]: typeof v === "function" ? v(prev[k]) : v }));
  return {
    cornerJoint: s.joint,
    setCornerJoint: field("joint"),
    plywoodSheetKind: s.sheet,
    setPlywoodSheetKind: field("sheet"),
    boxSetCount: s.stacks,
    setBoxSetCount: field("stacks"),
    kerfIn: s.kerf,
    setKerfIn: field("kerf"),
    edgeTrimIn: s.trim,
    setEdgeTrimIn: field("trim"),
    grain: s.grain,
    setGrain: field("grain"),
    waterfall: s.waterfall,
    setWaterfall: field("waterfall"),
    offcutShape: s.offcut,
    setOffcutShape: field("offcut"),
    cutStyle: s.cuts,
    setCutStyle: field("cuts"),
    panelExactIn: s.exactIn,
    setPanelExactIn: field("exactIn"),
  };
}
