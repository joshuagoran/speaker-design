import type { SetStateAction } from "react";
import type { CutlistSettings, PanelExactIn, Setter } from "../../types";
import type { CutlistOptions } from "./useCutlistOptions";
import { useStoredStateFrom } from "../../hooks/useStoredState";
import { CUTLIST_DEFAULTS, savedCutlist } from "../../lib/pa/cutlist";
import { PLYWOOD_SHEETS } from "../../lib/pa/calc";
import { keysOf } from "../../lib/records";
import {
  CUTLIST_PROJECTS,
  type CutlistProject,
  type StoredCutlistProject,
} from "../../constants/cutlistProjects";
import { savedPanelExactIn } from "../../lib/panel";

/** Where this browser keeps each project's cutlist choices. */
const STORE_KEYS = {
  speaker: "speaker.cutlist",
  stack: "stack.cutlist",
} as const satisfies Record<StoredCutlistProject, string>;

/** What this browser keeps: the cutlist's settings and the measured thickness of each nominal panel size. */
type StoredCutlist = CutlistSettings & { exactIn: PanelExactIn };

/** A stored project's cutlist choices on first load: butt-jointed pairs, the PA cutlist's sheet and cut defaults. */
const STORED_CUTLIST_DEFAULTS: CutlistSettings = {
  ...CUTLIST_DEFAULTS,
  joint: "butt",
  sheet: "4x8",
  stacks: 2,
};

/** Stored choices checked against what the page offers; anything missing or unknown falls back to the default. */
const fromStored =
  (project: CutlistProject) =>
  (c: Partial<StoredCutlist>): StoredCutlist => {
    const joint =
      c.joint === "rabbet" || c.joint === "miter" ? c.joint : STORED_CUTLIST_DEFAULTS.joint;
    const sets: readonly number[] = project.sets;
    return {
      ...savedCutlist({ ...c, joint, waterfall: c.waterfall ?? STORED_CUTLIST_DEFAULTS.waterfall }),
      joint,
      sheet: keysOf(PLYWOOD_SHEETS).find((k) => k === c.sheet) ?? STORED_CUTLIST_DEFAULTS.sheet,
      stacks: sets.find((n) => n === c.stacks) ?? STORED_CUTLIST_DEFAULTS.stacks,
      exactIn: savedPanelExactIn(c.exactIn),
    };
  };

/**
 * A project's cutlist choices (the Speaker page's, the Stack page's), remembered in this browser (the design itself isn't
 * saved with them).
 */
export function useStoredCutlistOptions(project: StoredCutlistProject): CutlistOptions {
  const [s, setS] = useStoredStateFrom<StoredCutlist, Partial<StoredCutlist>>(
    STORE_KEYS[project],
    {},
    fromStored(CUTLIST_PROJECTS[project]),
  );
  const field =
    <K extends keyof StoredCutlist>(k: K): Setter<StoredCutlist[K]> =>
    (v: SetStateAction<StoredCutlist[K]>) =>
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
