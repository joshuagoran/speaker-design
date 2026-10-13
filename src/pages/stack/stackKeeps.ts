// The Stack optimizer's Keep list: the parts of a stack a lock can hold, and the locks as the stack's search takes them.
// A speaker's locks are the Speaker optimizer's (../speaker/speakerKeeps), by speaker id; a member's crossover, level and
// delay locks name the member by its place in the stack. Pure functions on `StackOptimizerLocks`.
import type {
  SpeakerOptimizerLocks,
  SpeakerSpec,
  StackDesign,
  StackOptimizerLocks,
} from "../../types";
import {
  allKept,
  countKept,
  driverLayout,
  heldLocks,
  keepItems,
  type KeepItem,
} from "../speaker/speakerKeeps";

/** The locks a member has: its crossover, its level and its delay (keys of `StackOptimizerLocks`). */
export const MEMBER_LOCKS = ["crossovers", "levels", "delays"] as const;
export type MemberLockKind = (typeof MEMBER_LOCKS)[number];

/** The speakers the members name, each once, in the order the members first name them. */
export function stackSpeakers(design: Pick<StackDesign, "stack" | "speakers">): SpeakerSpec[] {
  const ids = [...new Set(design.stack.members.map((m) => m.speakerId))];
  return ids.flatMap((id) => design.speakers.find((s) => s.id === id) ?? []);
}

/** One speaker's part of the Keep list: the speaker and the parts of it a lock can hold. */
export interface SpeakerKeeps {
  speaker: SpeakerSpec;
  items: KeepItem[];
}

/** Every speaker with its lockable parts (`keepItems`). */
export const stackKeepItems = (design: Pick<StackDesign, "stack" | "speakers">): SpeakerKeeps[] =>
  stackSpeakers(design).map((speaker) => ({ speaker, items: keepItems(speaker) }));

/** A speaker's locks (none: empty). */
export const locksOfSpeaker = (
  locks: StackOptimizerLocks,
  id: SpeakerSpec["id"],
): SpeakerOptimizerLocks => locks.speakers?.[id] ?? {};

/** The stack's locks with one speaker's locks replaced; a speaker left with none has no entry. */
export function withSpeakerLocks(
  locks: StackOptimizerLocks,
  id: SpeakerSpec["id"],
  next: SpeakerOptimizerLocks,
): StackOptimizerLocks {
  const { [id]: _old, ...others } = locks.speakers ?? {};
  const speakers = countKept(next) > 0 ? { ...others, [id]: next } : others;
  const { speakers: _speakers, ...rest } = locks;
  return Object.keys(speakers).length ? { ...rest, speakers } : rest;
}

/** Whether the whole speaker is kept. */
export const isSpeakerKept = (locks: StackOptimizerLocks, id: SpeakerSpec["id"]): boolean =>
  (locks.keep ?? []).includes(id);

/** The locks with the whole speaker's lock flipped. */
export function toggleSpeakerKept(
  locks: StackOptimizerLocks,
  id: SpeakerSpec["id"],
): StackOptimizerLocks {
  const keep = isSpeakerKept(locks, id)
    ? (locks.keep ?? []).filter((k) => k !== id)
    : [...(locks.keep ?? []), id];
  const { keep: _keep, ...rest } = locks;
  return keep.length ? { ...rest, keep } : rest;
}

/** Whether this member's crossover, level or delay is locked. */
export const isMemberKept = (
  locks: StackOptimizerLocks,
  kind: MemberLockKind,
  member: number,
): boolean => (locks[kind] ?? []).includes(member);

/** The locks with this member's crossover, level or delay lock flipped. */
export function toggleMemberKept(
  locks: StackOptimizerLocks,
  kind: MemberLockKind,
  member: number,
): StackOptimizerLocks {
  const list = locks[kind] ?? [];
  const next = list.includes(member) ? list.filter((m) => m !== member) : [...list, member];
  const { [kind]: _kind, ...rest } = locks;
  return next.length ? { ...rest, [kind]: next } : rest;
}

/** How many locks the stack has: each speaker kept, each speaker's locks, and each member's crossover, level and delay. */
export const countStackKept = (locks: StackOptimizerLocks): number =>
  (locks.keep?.length ?? 0) +
  Object.values(locks.speakers ?? {}).reduce((n, l) => n + countKept(l), 0) +
  MEMBER_LOCKS.reduce((n, kind) => n + (locks[kind]?.length ?? 0), 0);

/** How many locks there can be: a lock per speaker, per part and per box axis, and three per member. */
export const stackLockMax = (design: Pick<StackDesign, "stack" | "speakers">): number =>
  stackKeepItems(design).reduce((n, { items }) => n + 1 + items.length + 3, 0) +
  MEMBER_LOCKS.length * design.stack.members.length;

/** Every speaker kept, with every part held and every box axis exact, and every member's crossover, level and delay: the "lock all" state. */
export function allStackKept(design: Pick<StackDesign, "stack" | "speakers">): StackOptimizerLocks {
  const members = design.stack.members.map((_, k) => k);
  const speakers = stackKeepItems(design);
  return {
    keep: speakers.map(({ speaker }) => speaker.id),
    speakers: Object.fromEntries(
      speakers.map(({ speaker, items }) => [speaker.id, allKept(items)]),
    ),
    crossovers: members,
    levels: members,
    delays: members,
  };
}

/**
 * Locks as they were set: on which stack (the page's round), which members (each member's speaker id, in order: the
 * member locks name a member by its place) and which driver layouts (each speaker's, `driverLayout`).
 */
export interface HeldStackLocks {
  round: number;
  members: readonly SpeakerSpec["id"][];
  layouts: Readonly<Record<SpeakerSpec["id"], string>>;
  locks: StackOptimizerLocks;
}

/** What a stack is, for the locks that were set on it: its round, its members and its speakers' driver layouts. */
export function heldKey(
  design: Pick<StackDesign, "stack" | "speakers">,
  round: number,
): Omit<HeldStackLocks, "locks"> {
  return {
    round,
    members: design.stack.members.map((m) => m.speakerId),
    layouts: Object.fromEntries(stackSpeakers(design).map((s) => [s.id, driverLayout(s)])),
  };
}

/** Whether the first list is the start of the second (the same members, with more added after them). */
const startsThe = (held: readonly string[], now: readonly string[]) =>
  held.every((id, i) => now[i] === id);

/**
 * The locks that hold on the stack as it is now:
 * - none once the stack was replaced (another opened, a start);
 * - a speaker's locks as the Speaker optimizer holds them (`heldLocks`: without the driver and horn locks once a driver
 *   entry was added or removed, and only the parts it still has), and only for a speaker a member still names;
 * - the member locks only while the members are the ones they were set on, or those with more added after them (a
 *   removed member moves the later ones, so a lock would move to another member), and only for members that exist.
 */
export function heldStackLocks(
  held: HeldStackLocks,
  now: Pick<HeldStackLocks, "round" | "members" | "layouts">,
  design: Pick<StackDesign, "stack" | "speakers">,
): StackOptimizerLocks {
  if (held.round !== now.round) return {};
  const speakers = stackKeepItems(design);
  const ids = new Set(speakers.map(({ speaker }) => speaker.id));
  let out: StackOptimizerLocks = {};
  for (const { speaker, items } of speakers) {
    const ours = locksOfSpeaker(held.locks, speaker.id);
    const layout = held.layouts[speaker.id];
    // a speaker the locks were not set on has no locks of its own to hold
    if (layout === undefined) continue;
    out = withSpeakerLocks(
      out,
      speaker.id,
      heldLocks(
        { round: now.round, layout, locks: ours },
        { round: now.round, layout: now.layouts[speaker.id] ?? layout },
        items,
      ),
    );
  }
  const keep = (held.locks.keep ?? []).filter((id) => ids.has(id));
  if (keep.length) out = { ...out, keep };
  if (startsThe(held.members, now.members))
    for (const kind of MEMBER_LOCKS) {
      const list = (held.locks[kind] ?? []).filter((k) => k < now.members.length);
      if (list.length) out = { ...out, [kind]: list };
    }
  return out;
}

/**
 * The held locks as they stand on the stack now: the same object while nothing changed, else new ones with the locks
 * that still hold (`heldStackLocks`) and the stack they stand on. The page keeps the result, so a lock that stopped
 * holding stays dropped: a member or driver added back later must not bring it back onto another one.
 */
export function reconcileHeldStack(
  held: HeldStackLocks,
  design: Pick<StackDesign, "stack" | "speakers">,
  round: number,
): HeldStackLocks {
  const now = heldKey(design, round);
  const locks = heldStackLocks(held, now, design);
  return JSON.stringify([held.round, held.members, held.layouts, held.locks]) ===
    JSON.stringify([now.round, now.members, now.layouts, locks])
    ? held
    : { ...now, locks };
}
