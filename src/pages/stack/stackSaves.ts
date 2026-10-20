// The Stack page's saves (the `stacks` collection under users/{uid}): what a save stores and how a document opens.
// Pure.
import type {
  SavedConfig,
  SavedStackData,
  SpeakerSpec,
  StackDesign,
  StackMember,
} from "../../types";
import { isSavedSpeakerShape } from "../../lib/speaker/speakerSaves";
import { readSpeakerCopy } from "../../lib/speaker/speakerSaves";
import { STACK_TEXT } from "../../constants/stack";
import { PAGE_DRAFT_KEYS } from "../../constants/pageDrafts";
import { DRAFT_ID } from "../../constants/saveRow";
import { asDraftDocument, draftDocument } from "../../lib/savedDraft";
import type { PageDraft } from "../../hooks/usePageDraft";

/** The id a stack has until the library saves it (then it takes the document's). */
export const DRAFT_STACK_ID = DRAFT_ID;

/** A stack with no members, named as a new one. */
export const emptyStack = (): StackDesign => ({
  stack: { id: DRAFT_STACK_ID, name: STACK_TEXT.newName, members: [], notes: "" },
  speakers: [],
});

/** The stack in one line, as the library lists it: its members' speakers, bottom to top. */
export const stackSummary = ({ stack, speakers }: StackDesign) =>
  stack.members
    .map((m) => speakers.find((s) => s.id === m.speakerId)?.name ?? m.speakerId)
    .join(" + ") || STACK_TEXT.noMembers;

/**
 * What a save stores: the stack without its id and name, and the speakers its members name; undefined fields dropped
 * (the stores reject them).
 */
export function stackSnapshot(design: StackDesign): SavedStackData {
  const { id: _id, name: _name, ...stack } = design.stack;
  const used = new Set(stack.members.map((m) => m.speakerId));
  return JSON.parse(
    JSON.stringify({
      summary: stackSummary(design),
      stack,
      speakers: design.speakers.filter((s) => used.has(s.id)),
    }),
  );
}

/** Whether a value reads as a saved speaker with its id (a stack's copy keeps the id its members name). */
const isStackSpeaker = (value: unknown): value is SpeakerSpec =>
  isSavedSpeakerShape(value) && typeof Reflect.get(value, "id") === "string";

/** Whether a value reads as a list of members: each names a speaker and has a pose and a crossover. */
const isMembers = (value: unknown): value is StackMember[] =>
  Array.isArray(value) &&
  value.every(
    (m: unknown) =>
      typeof m === "object" &&
      m !== null &&
      typeof Reflect.get(m, "speakerId") === "string" &&
      typeof Reflect.get(m, "pose") === "object" &&
      typeof Reflect.get(m, "crossover") === "object",
  );

/**
 * A saved stack opened: the document's id and name, its members and notes, and its speakers; null for a document that
 * holds no stack (written elsewhere). Its fields are trusted from there: `stackSnapshot` wrote them.
 */
export function stackFromSaved(c: SavedConfig): StackDesign | null {
  const stack: unknown = Reflect.get(c, "stack");
  const speakers: unknown = Reflect.get(c, "speakers");
  if (typeof stack !== "object" || stack === null) return null;
  const members: unknown = Reflect.get(stack, "members");
  const notes: unknown = Reflect.get(stack, "notes");
  if (
    !isMembers(members) ||
    typeof notes !== "string" ||
    !Array.isArray(speakers) ||
    !speakers.every(isStackSpeaker)
  )
    return null;
  return {
    stack: { id: c.id, name: c.name, members, notes },
    speakers: speakers.map(readSpeakerCopy),
  };
}

/** The Stack page's working design in the browser: the save document, with the stack's id and name. */
export const stackDraft: PageDraft<StackDesign> = {
  key: PAGE_DRAFT_KEYS.stack,
  empty: emptyStack,
  toDraft: (design) => draftDocument(stackSnapshot(design), design.stack),
  fromDraft: (raw) => {
    const doc = asDraftDocument(raw);
    return doc && stackFromSaved(doc);
  },
};
