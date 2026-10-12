import { useDeferredValue, useMemo, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { stackLimits, stackResponse } from "../../lib/speaker/stackResponse";
import { BASE_POSE } from "../../lib/speaker/specParts";
import { STACKS_COLLECTION } from "../../constants/speakerSpec";
import { emptyStack, stackFromSaved, stackSnapshot } from "./stackSaves";
import type { SavedConfig, SpeakerSpec, StackDesign, StackMember, StackSpec } from "../../types";

/** What the library's row says when a document holds no stack. */
const MISSING_STACK_TEXT = "That save holds no stack";

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
 * The Stack page's state: the stack and the speakers its members name, its response and limits, the edits the settings
 * make and the library (the signed-in user's `stacks`). Held in App, so the stack survives switching pages.
 */
export function useStack() {
  const [design, setDesign] = useState<StackDesign>(emptyStack);
  // the model reads only the members and the speakers (a name edit doesn't run it), a step behind the typing
  const members = useDeferredValue(design.stack.members);
  const speakers = useDeferredValue(design.speakers);
  const response = useMemo(() => stackResponse({ members }, speakers), [members, speakers]);
  const limits = useMemo(() => stackLimits({ members }, response), [members, response]);
  const store = useConfigStore(STACKS_COLLECTION);
  const editStack = (edit: (stack: StackSpec) => StackSpec) =>
    setDesign((d) => ({ ...d, stack: edit(d.stack) }));
  const editMembers = (edit: (members: readonly StackMember[]) => StackMember[]) =>
    editStack((s) => ({ ...s, members: edit(s.members) }));
  return {
    design,
    setDesign,
    response,
    limits,
    store,
    snapshot: () => stackSnapshot(design),
    /** opens a saved stack: the document's id and name, its members and its speakers */
    restore: (c: SavedConfig) => {
      const saved = stackFromSaved(c);
      // a document without a stack (written elsewhere): left closed, with a word on the library's row
      if (saved) setDesign(saved);
      else store.flash(MISSING_STACK_TEXT);
    },
    setName: (name: string) => editStack((s) => ({ ...s, name })),
    setNotes: (notes: string) => editStack((s) => ({ ...s, notes })),
    editMember: (k: number, edit: (member: StackMember) => StackMember) =>
      editMembers((list) => list.map((m, i) => (i === k ? edit(m) : m))),
    /**
     * adds a speaker on top of the highest member (or on the base), on its own input range as its crossover; its copy
     * replaces an older copy of the same speaker
     */
    addSpeaker: (speaker: SpeakerSpec) =>
      setDesign((d) => {
        const n = d.stack.members.length;
        const member: StackMember = {
          speakerId: speaker.id,
          pose: { ...BASE_POSE, on: n ? n - 1 : null },
          mirror: false,
          crossover: speaker.input,
          levelDb: 0,
          delayMs: 0,
        };
        return {
          stack: { ...d.stack, members: [...d.stack.members, member] },
          speakers: [...d.speakers.filter((s) => s.id !== speaker.id), speaker],
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
