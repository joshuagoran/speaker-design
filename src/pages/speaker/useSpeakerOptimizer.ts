import { useMemo, useState } from "react";
import { runSpeakerOptimizer } from "../../lib/speaker/optimize/runOptimizer";
import {
  budgetStart,
  storedLimit,
  useDesignOptimizer,
  weightStart,
} from "../../hooks/useDesignOptimizer";
import {
  NEXT_SIZE_LOCK,
  countKept,
  driverLayout,
  isKept,
  sizeHeldByDriver,
  keepItems,
  lockedNames,
  reconcileHeld,
  sizeAxisName,
  sizeLockMode,
  withSizeLock,
  toggleKeep,
  type HeldLocks,
  type KeepItem,
} from "./speakerKeeps";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import type { LockControl } from "../../components/ui/LockButton";
import type {
  Dims3,
  SpeakerOptimizerCard,
  SpeakerOptimizerLimits,
  SpeakerOptimizerLocks,
  SpeakerSpec,
} from "../../types";

interface Props {
  /** the speaker as the page has it now */
  spec: SpeakerSpec;
  /** puts a spec in as one edit, with no settings reset (a card's design has the same chambers and bands as yours) */
  loadSpec: (spec: SpeakerSpec) => void;
  /**
   * how many times the page replaced the chamber list (or lost a chamber): the locks name parts by place, so they start
   * over with it
   */
  round: number;
  /** your design's numbers: its level at 1 m (null when it can't be modeled), price and weight */
  current: { musicDb: number | null; price: number; lb: number };
}

/** What the optimizer remembers per viewer: the two limits (the target and the goals start over with the design). */
type StoredSpeakerLimits = Pick<SpeakerOptimizerLimits, "budget" | "maxLb">;

/** Whether two specs are the same design: everything a search reads and a card replaces (all but the id and name). */
export const sameDesign = (a: SpeakerSpec, b: SpeakerSpec): boolean =>
  a.cabinet === b.cabinet && a.bands === b.bands && a.input === b.input && a.look === b.look;

/** A card's design as Load puts it in: the card's spec under your spec's id and name. */
export const loadedSpec = (card: Pick<SpeakerOptimizerCard, "spec">, spec: SpeakerSpec) => ({
  ...card.spec,
  id: spec.id,
  name: spec.name,
});

/**
 * The Speaker optimizer: goals in tap order, the target level and limits, the locks, the search, and loading a card
 * (one edit, with Undo; `useDesignOptimizer`). The two limits are remembered per viewer; the goals, the target and the
 * locks are not. `clearResults` drops the result and Undo (the page calls it when it replaces the whole spec).
 */
export function useSpeakerOptimizer({ spec, loadSpec, round, current }: Props) {
  // the locks name parts by place: they belong to the chamber list and the driver layout they were set on
  const layout = driverLayout(spec);
  const [held, setHeld] = useState<HeldLocks>({ round, layout, locks: {} });
  const items = useMemo(() => keepItems(spec), [spec]);
  const nChambers = spec.cabinet.chambers.length;
  // a lock that no longer holds is dropped for good, not only hidden: a driver added back must not bring it back
  const now = reconcileHeld(held, { round, layout }, items);
  if (now !== held) setHeld(now);
  const { locks } = now;
  const setLocks = (next: SpeakerOptimizerLocks) => setHeld({ round, layout, locks: next });
  const { limits, setLimit, ...shared } = useDesignOptimizer({
    design: spec,
    loadDesign: loadSpec,
    sameDesign,
    loaded: loadedSpec,
    restored: (before, yours) => ({ ...before, id: yours.id, name: yours.name }),
    musicDb: current.musicDb,
    storage: {
      key: "speaker.optimizerLimits",
      read: (stored): StoredSpeakerLimits => ({
        budget: storedLimit(stored?.budget),
        maxLb: storedLimit(stored?.maxLb),
      }),
    },
    run: (goals, limits, options) => runSpeakerOptimizer({ spec, goals, limits, locks }, options),
  });
  return {
    ...shared,
    budget: limits.budget,
    setBudget: (budget: number | null) => setLimit("budget", budget),
    budgetStart: budgetStart(current.price),
    maxLb: limits.maxLb,
    setMaxLb: (maxLb: number | null) => setLimit("maxLb", maxLb),
    weightStart: weightStart(current.lb),
    locks,
    /** the lock beside a part's setting; null when the optimizer can't change that part (a sealed vent, no filter) */
    partLock: (kind: KeepItem["kind"], ref: KeepItem["ref"]): LockControl | null => {
      const item = items.find((i) => i.kind === kind && i.ref === ref);
      if (!item) return null;
      const held = sizeHeldByDriver(locks, item);
      const locked = held || isKept(locks, item);
      return {
        name: item.label,
        locked,
        unlocks: locked,
        disabled: held,
        onClick: () => setLocks(toggleKeep(locks, item)),
      };
    },
    /** the lock beside a chamber's size on an axis: free, up to this size (≤), exactly this size (=) */
    sizeLock: (chamber: number, axis: keyof Dims3): LockControl => {
      const mode = sizeLockMode(locks, chamber, axis);
      return {
        name: sizeAxisName(chamber, axis, nChambers),
        locked: mode !== "free",
        mark: mode === "free" ? undefined : SPEAKER_OPTIMIZER_TEXT.sizeMark[mode],
        unlocks: NEXT_SIZE_LOCK[mode] === "free",
        onClick: () => setLocks(withSizeLock(locks, chamber, axis, NEXT_SIZE_LOCK[mode])),
      };
    },
    /** how many locks are set, and their names */
    nLocks: countKept(locks),
    lockedNames: lockedNames(locks, items, nChambers),
    clearLocks: () => setLocks({}),
  };
}

/** The locks the Speaker page's settings draw beside their fields. */
export type SpeakerLocks = Pick<SpeakerOptimizer, "partLock" | "sizeLock">;

/** What `useSpeakerOptimizer` returns. */
export type SpeakerOptimizer = ReturnType<typeof useSpeakerOptimizer>;
