import { useMemo, useState } from "react";
import { runStackOptimizer } from "../../lib/speaker/optimize/runStackOptimizer";
import {
  budgetStart,
  storedLimit,
  useDesignOptimizer,
  weightStart,
} from "../../hooks/useDesignOptimizer";
import { isKept, toggleKeep, type KeepItem } from "../speaker/speakerKeeps";
import {
  allStackKept,
  countStackKept,
  heldKey,
  reconcileHeldStack,
  isMemberKept,
  isSpeakerKept,
  locksOfSpeaker,
  stackKeepItems,
  stackLockMax,
  toggleMemberKept,
  toggleSpeakerKept,
  withSpeakerLocks,
  type HeldStackLocks,
  type MemberLockKind,
} from "./stackKeeps";
import type {
  DimensionLockMode,
  Dims3,
  SpeakerSpec,
  StackDesign,
  StackOptimizerCard,
  StackOptimizerLimits,
  StackOptimizerLocks,
} from "../../types";

interface Props {
  /** the stack and its speakers as the page has them now */
  design: StackDesign;
  /** puts a design in as one edit (a card's design has the same members and speaker layouts as yours) */
  loadDesign: (design: StackDesign) => void;
  /**
   * how many times the page replaced the whole stack (a start, a saved stack opened): the locks name members and
   * speakers' parts by place, so they start over with it
   */
  round: number;
  /**
   * your stack's numbers: its level at 1 m (null when it can't be modeled), its price, the heaviest box's weight and its
   * height
   */
  current: { musicDb: number | null; price: number; maxBoxLb: number; heightIn: number };
}

/** What the optimizer remembers per viewer: the three limits (the target and the goals start over with the stack). */
type StoredStackLimits = Pick<StackOptimizerLimits, "budget" | "maxLb" | "maxHeightIn">;

/** The height a limit starts at when it is turned on: your stack's height, to the next inch. */
const heightStart = (inches: number) => Math.max(1, Math.ceil(inches));

/**
 * Whether two designs are the same stack: everything a search reads and a card replaces, the members (their crossovers,
 * levels and delays) and the speakers. The id, name and notes are not part of it.
 */
export const sameStackDesign = (a: StackDesign, b: StackDesign): boolean =>
  a.stack.members === b.stack.members && a.speakers === b.speakers;

/** The design under your stack's id, name and notes (a card's design, or the one Undo goes back to). */
export const withStackIdentity = (design: StackDesign, yours: StackDesign): StackDesign => ({
  ...design,
  stack: {
    ...design.stack,
    id: yours.stack.id,
    name: yours.stack.name,
    notes: yours.stack.notes,
  },
});

/** A card's design as Load puts it in: the card's stack and speakers under your stack's id, name and notes. */
export const loadedStack = (card: Pick<StackOptimizerCard, "design">, yours: StackDesign) =>
  withStackIdentity(card.design, yours);

/**
 * The Stack optimizer: goals in tap order, the target level and limits, the locks, the search, and loading a card (one
 * edit, with Undo; `useDesignOptimizer`). The three limits are remembered per viewer; the goals, the target and the
 * locks are not. `clearResults` drops the result and Undo (the page calls it when it replaces the whole stack).
 */
export function useStackOptimizer({ design, loadDesign, round, current }: Props) {
  // the locks name members by their place and a speaker's drivers by theirs: they belong to the stack they were set on
  const key = heldKey(design, round);
  const [held, setHeld] = useState<HeldStackLocks>({ ...key, locks: {} });
  const keeps = useMemo(() => stackKeepItems(design), [design]);
  // a lock that no longer holds is dropped for good, not only hidden: a member or driver added back must not bring it
  // back onto another one
  const now = reconcileHeldStack(held, design, round);
  if (now !== held) setHeld(now);
  const { locks } = now;
  const setLocks = (next: StackOptimizerLocks) => setHeld({ ...key, locks: next });
  const { limits, setLimit, ...shared } = useDesignOptimizer({
    design,
    loadDesign,
    sameDesign: sameStackDesign,
    loaded: loadedStack,
    restored: withStackIdentity,
    musicDb: current.musicDb,
    storage: {
      key: "stack.optimizerLimits",
      read: (stored): StoredStackLimits => ({
        budget: storedLimit(stored?.budget),
        maxLb: storedLimit(stored?.maxLb),
        maxHeightIn: storedLimit(stored?.maxHeightIn),
      }),
    },
    run: (goals, limits, options) => runStackOptimizer({ design, goals, limits, locks }, options),
  });
  /** the speaker's own locks, changed by `edit` */
  const editSpeaker = (
    id: SpeakerSpec["id"],
    edit: (locks: ReturnType<typeof locksOfSpeaker>) => ReturnType<typeof locksOfSpeaker>,
  ) => setLocks(withSpeakerLocks(locks, id, edit(locksOfSpeaker(locks, id))));
  return {
    ...shared,
    budget: limits.budget,
    setBudget: (budget: number | null) => setLimit("budget", budget),
    budgetStart: budgetStart(current.price),
    maxLb: limits.maxLb,
    setMaxLb: (maxLb: number | null) => setLimit("maxLb", maxLb),
    weightStart: weightStart(current.maxBoxLb),
    maxHeightIn: limits.maxHeightIn,
    setMaxHeightIn: (maxHeightIn: number | null) => setLimit("maxHeightIn", maxHeightIn),
    heightStart: heightStart(current.heightIn),
    locks,
    /** each speaker the members name, with the parts of it a lock can hold */
    keeps,
    isSpeakerKept: (id: SpeakerSpec["id"]) => isSpeakerKept(locks, id),
    toggleSpeakerKept: (id: SpeakerSpec["id"]) => setLocks(toggleSpeakerKept(locks, id)),
    isKept: (id: SpeakerSpec["id"], item: KeepItem) => isKept(locksOfSpeaker(locks, id), item),
    toggleKeep: (id: SpeakerSpec["id"], item: KeepItem) =>
      editSpeaker(id, (l) => toggleKeep(l, item)),
    sizeLock: (id: SpeakerSpec["id"], axis: keyof Dims3): DimensionLockMode =>
      locksOfSpeaker(locks, id).size?.[axis] ?? "free",
    setSizeLock: (id: SpeakerSpec["id"], axis: keyof Dims3, mode: DimensionLockMode) =>
      editSpeaker(id, (l) => ({ ...l, size: { ...l.size, [axis]: mode } })),
    isMemberKept: (kind: MemberLockKind, member: number) => isMemberKept(locks, kind, member),
    toggleMemberKept: (kind: MemberLockKind, member: number) =>
      setLocks(toggleMemberKept(locks, kind, member)),
    lockBar: {
      nLocks: countStackKept(locks),
      lockMax: stackLockMax(design),
      onLockAll: () => setLocks(allStackKept(design)),
      onClear: () => setLocks({}),
    },
  };
}

/** What `useStackOptimizer` returns. */
export type StackOptimizer = ReturnType<typeof useStackOptimizer>;
