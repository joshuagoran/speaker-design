import { useDeferredValue, useMemo, useState, type SetStateAction } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { stackLimits, stackResponse } from "../../lib/speaker/stackResponse";
import { stackTotals } from "../../lib/speaker/speakerTotals";
import { BASE_POSE } from "../../lib/speaker/specParts";
import { autoBalanceStack, withStackLevels } from "../../lib/speaker/autoBalance";
import { AUTO_BALANCE_STATUS } from "../../constants/autoBalance";
import { STACKS_COLLECTION } from "../../constants/speakerSpec";
import { DRAFT_STACK_ID, stackDraft, stackFromSaved, stackSnapshot } from "./stackSaves";
import { usePageDraft, type SharedMode } from "../../hooks/usePageDraft";
import { useStackOptimizer } from "./useStackOptimizer";
import { STACK_TEXT } from "../../constants/stack";
import type { SavedConfig, SpeakerSpec, StackDesign, StackMember, StackSpec } from "../../types";

/**
 * The members left when member `k` goes: the ones that stood on it stand on the base where it stood (its pose added to
 * theirs, up to its bottom), and the later ones' references move down one.
 */
export function withoutMember(members: readonly StackMember[], k: number): StackMember[] {
  return members.flatMap((m, i) => {
    if (i === k) return [];
    const { on } = m.pose;
    if (on === k) {
      const gone = members[k].pose;
      return [
        {
          ...m,
          pose: {
            ...m.pose,
            xIn: gone.xIn + m.pose.xIn,
            yIn: gone.yIn + m.pose.yIn,
            zIn: gone.zIn + m.pose.zIn,
            on: gone.on !== null && gone.on > k ? gone.on - 1 : gone.on,
          },
        },
      ];
    }
    return [{ ...m, pose: { ...m.pose, on: on !== null && on > k ? on - 1 : on } }];
  });
}

/**
 * The copy of a library speaker a new member names: the stack's own copy where it is the same speaker; where the stack
 * holds an older copy under that id (its members keep it), the library's one under a new id and a numbered name.
 */
export function withSpeaker(speakers: readonly SpeakerSpec[], speaker: SpeakerSpec): SpeakerSpec {
  const held = speakers.find((s) => s.id === speaker.id);
  if (!held || JSON.stringify(held) === JSON.stringify(speaker)) return held ?? speaker;
  let n = 2;
  while (speakers.some((s) => s.id === `${speaker.id}/${n}`)) n++;
  return { ...speaker, id: `${speaker.id}/${n}`, name: STACK_TEXT.copyName(speaker.name, n) };
}

/**
 * The Stack page's state: the stack and the speakers its members name, its response, limits and totals, the edits the settings
 * make and the library (the signed-in user's `stacks`). Held in App, so the stack survives switching pages.
 */
export function useStack() {
  const [design, setDesign, sharedDraft] = usePageDraft(stackDraft);
  // how many times the whole stack was replaced (a start, a saved stack opened): the optimizer's locks start over with it
  const [round, setRound] = useState(0);
  /** the whole stack replaced: the optimizer's cards, locks and Undo are dropped */
  const restart = () => {
    setRound((n) => n + 1);
    // called from an event, after `optimizer` below is set
    optimizer.clearResults();
  };
  const replaceDesign = (next: SetStateAction<StackDesign>) => {
    setDesign(next);
    restart();
  };
  /** the shared view: a link's stack shows in place of the page's own, and the page starts over with each switch */
  const sharedView: SharedMode<StackDesign> = {
    ...sharedDraft,
    open: (next) => {
      sharedDraft.open(next);
      restart();
    },
    close: () => {
      sharedDraft.close();
      restart();
    },
    keep: (copy) => {
      sharedDraft.keep(copy);
      restart();
    },
  };
  // the model reads only the members and the speakers (a name edit doesn't run it), a step behind the typing
  const members = useDeferredValue(design.stack.members);
  const speakers = useDeferredValue(design.speakers);
  const response = useMemo(() => stackResponse({ members }, speakers), [members, speakers]);
  const limits = useMemo(() => stackLimits({ members }, response), [members, response]);
  // the members' price, weight and the stack's height
  const totals = useMemo(() => stackTotals({ members }, speakers), [members, speakers]);
  // the member Gains Calculate gains sets, box against box, flat, from the same response (lib/speaker/autoBalance)
  const balance = useMemo(
    () => autoBalanceStack({ stack: { members } }, response),
    [members, response],
  );
  const store = useConfigStore(STACKS_COLLECTION);
  // the optimizer reads and loads the whole design (a card keeps the stack's id, name and notes); its cards, locks and
  // Undo start over when the whole stack is replaced (replaceDesign)
  const optimizer = useStackOptimizer({
    design,
    loadDesign: setDesign,
    round,
    current: {
      musicDb: limits.musicDb,
      price: totals.dollars,
      maxBoxLb: totals.maxBoxLb,
      heightIn: totals.heightIn,
    },
  });
  const editStack = (edit: (stack: StackSpec) => StackSpec) =>
    setDesign((d) => ({ ...d, stack: edit(d.stack) }));
  const editMembers = (edit: (members: readonly StackMember[]) => StackMember[]) =>
    editStack((s) => ({ ...s, members: edit(s.members) }));
  return {
    design,
    sharedView,
    /** replaces the whole stack (a start, a saved stack opened): the optimizer starts over */
    setDesign: replaceDesign,
    /** how many times the whole stack was replaced (`setDesign`, a link's stack shown or closed) */
    round,
    optimizer,
    response,
    limits,
    totals,
    balance,
    /**
     * sets the member Gains Calculate gains gives (the speakers' bands stay): one edit. Worked out
     * from the design as it is now, since `balance` reads the deferred values, which can lag a step behind an edit.
     */
    applyBalance: () => {
      const now =
        design.stack.members === members && design.speakers === speakers
          ? balance
          : autoBalanceStack(design, stackResponse(design.stack, design.speakers));
      if (now.status === AUTO_BALANCE_STATUS.balanced)
        setDesign((d) => withStackLevels(d, now.levels));
    },
    store,
    snapshot: () => stackSnapshot(design),
    /** whether a save holds a stack: the library lists only those */
    holds: (c: SavedConfig) => stackFromSaved(c) !== null,
    /** opens a saved stack: the document's id and name, its members and its speakers */
    restore: (c: SavedConfig) => {
      const saved = stackFromSaved(c);
      // the library lists only saves that hold a stack (`holds`)
      if (saved) replaceDesign(saved);
    },
    setName: (name: string) => editStack((s) => ({ ...s, name })),
    /** sets the save the stack is open in, as its id; null: none (a new stack's draft id) */
    setOpenId: (id: string | null) => editStack((s) => ({ ...s, id: id ?? DRAFT_STACK_ID })),
    setNotes: (notes: string) => editStack((s) => ({ ...s, notes })),
    editMember: (k: number, edit: (member: StackMember) => StackMember) =>
      editMembers((list) => list.map((m, i) => (i === k ? edit(m) : m))),
    /** adds a speaker on top of the highest member (or on the base), on its own input range as its crossover */
    addSpeaker: (speaker: SpeakerSpec) =>
      setDesign((d) => {
        const n = d.stack.members.length;
        const copy = withSpeaker(d.speakers, speaker);
        const member: StackMember = {
          speakerId: copy.id,
          pose: { ...BASE_POSE, on: n ? n - 1 : null },
          mirror: false,
          crossover: copy.input,
          levelDb: 0,
          delayMs: 0,
          invertPolarity: false,
        };
        return {
          stack: { ...d.stack, members: [...d.stack.members, member] },
          speakers: d.speakers.some((s) => s.id === copy.id) ? d.speakers : [...d.speakers, copy],
        };
      }),
    /** removes a member; a speaker no member names any more goes with it */
    removeMember: (k: number) =>
      setDesign((d) => {
        const left = withoutMember(d.stack.members, k);
        const used = new Set(left.map((m) => m.speakerId));
        return {
          stack: { ...d.stack, members: left },
          speakers: d.speakers.filter((s) => used.has(s.id)),
        };
      }),
  };
}

/** What `useStack` returns. */
export type StackPlanner = ReturnType<typeof useStack>;
