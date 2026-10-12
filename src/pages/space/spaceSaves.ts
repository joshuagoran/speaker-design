// The Space page's saves (the `spaces` collection under users/{uid}): what a save stores and how a document opens.
// Pure.
import type {
  SavedConfig,
  SavedSpaceData,
  SpaceAmp,
  SpaceDesign,
  SpaceFrontEnd,
  SpacePlacement,
  SpaceVenue,
  SpeakerSpec,
  StackSpec,
} from "../../types";
import { isSavedSpeaker } from "../speaker/useSpeakerPage";
import { paVenue } from "../../lib/speaker/paSpec";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import { SPACE_ITEM } from "../../constants/speakerSpec";
import { SPACE_TEXT } from "../../constants/space";

/** The id a space has until the library saves it (then it takes the document's). */
export const DRAFT_SPACE_ID = "draft";

/** A space with nothing placed, named as a new one, on the coverage page's default floor, with no hardware. */
export const emptySpace = (): SpaceDesign => ({
  space: {
    id: DRAFT_SPACE_ID,
    name: SPACE_TEXT.newName,
    placements: [],
    amps: [],
    frontEnd: null,
    venue: paVenue(DEFAULT_COVERAGE_LAYOUT),
  },
  stacks: [],
  speakers: [],
});

/** What a placement places, by name: its stack's or speaker's. */
export const itemName = (
  design: Pick<SpaceDesign, "stacks" | "speakers">,
  item: SpacePlacement["item"],
) =>
  (item.kind === SPACE_ITEM.stack ? design.stacks : design.speakers).find((s) => s.id === item.id)
    ?.name ?? item.id;

/** The space in one line, as the library lists it: what it places. */
export const spaceSummary = (design: SpaceDesign) =>
  design.space.placements.map((p) => itemName(design, p.item)).join(" + ") ||
  SPACE_TEXT.noPlacements;

/** The stacks and speakers a space places: the stacks its placements name, and the speakers those or they name. */
export function usedParts(design: SpaceDesign): Pick<SpaceDesign, "stacks" | "speakers"> {
  const items = design.space.placements.map((p) => p.item);
  const stacks = design.stacks.filter((s) =>
    items.some((i) => i.kind === SPACE_ITEM.stack && i.id === s.id),
  );
  const ids = new Set([
    ...stacks.flatMap((s) => s.members.map((m) => m.speakerId)),
    ...items.flatMap((i) => (i.kind === SPACE_ITEM.speaker ? [i.id] : [])),
  ]);
  return { stacks, speakers: design.speakers.filter((s) => ids.has(s.id)) };
}

/**
 * What a save stores: the space without its id and name, and the stacks and speakers it places; undefined fields
 * dropped (the stores reject them).
 */
export function spaceSnapshot(design: SpaceDesign): SavedSpaceData {
  const { id: _id, name: _name, ...space } = design.space;
  return JSON.parse(JSON.stringify({ summary: spaceSummary(design), space, ...usedParts(design) }));
}

/** Whether a value is an object with these fields of these kinds. */
const hasFields = (value: unknown, fields: Record<string, string>): value is object =>
  typeof value === "object" &&
  value !== null &&
  Object.entries(fields).every(([k, kind]) => typeof Reflect.get(value, k) === kind);

/** Whether a value reads as a saved speaker with its id (a space's copy keeps the id its placements name). */
const isSpaceSpeaker = (value: unknown): value is SpeakerSpec =>
  isSavedSpeaker(value) && typeof Reflect.get(value, "id") === "string";

/** Whether a value reads as a stack: its id, name, members and notes. */
const isStack = (value: unknown): value is StackSpec =>
  hasFields(value, { id: "string", name: "string", notes: "string" }) &&
  Array.isArray(Reflect.get(value, "members"));

/** Whether a value reads as a list of placements: each names an item and has a spot, an aim and channels. */
const isPlacements = (value: unknown): value is SpacePlacement[] =>
  Array.isArray(value) &&
  value.every(
    (p: unknown) =>
      hasFields(p, { x: "number", y: "number", liftIn: "number", item: "object", aim: "object" }) &&
      Array.isArray(Reflect.get(p, "channels")),
  );

/** Whether a value reads as a list of amps: each with its id and watts. */
const isAmps = (value: unknown): value is SpaceAmp[] =>
  Array.isArray(value) &&
  value.every((a: unknown) => hasFields(a, { id: "string", watts: "number" }));

/** Whether a value reads as a front end (its kind), or none. */
const isFrontEnd = (value: unknown): value is SpaceFrontEnd | null =>
  value === null || hasFields(value, { kind: "string" });

/** Whether a value reads as a venue: its room, listener, ear height, listening area and target. */
const isVenue = (value: unknown): value is SpaceVenue =>
  hasFields(value, {
    room: "object",
    listener: "object",
    area: "object",
    earFt: "number",
    targetDb: "number",
  });

/**
 * A saved space opened: the document's id and name, its placements, hardware and venue, and its stacks and speakers;
 * null for a document that holds no space (written elsewhere). Its fields are trusted from there: `spaceSnapshot`
 * wrote them.
 */
export function spaceFromSaved(c: SavedConfig): SpaceDesign | null {
  const space: unknown = Reflect.get(c, "space");
  const stacks: unknown = Reflect.get(c, "stacks");
  const speakers: unknown = Reflect.get(c, "speakers");
  if (typeof space !== "object" || space === null) return null;
  const placements: unknown = Reflect.get(space, "placements");
  const amps: unknown = Reflect.get(space, "amps");
  const frontEnd: unknown = Reflect.get(space, "frontEnd");
  const venue: unknown = Reflect.get(space, "venue");
  if (
    !isPlacements(placements) ||
    !isAmps(amps) ||
    !isFrontEnd(frontEnd) ||
    !isVenue(venue) ||
    !Array.isArray(stacks) ||
    !stacks.every(isStack) ||
    !Array.isArray(speakers) ||
    !speakers.every(isSpaceSpeaker)
  )
    return null;
  return {
    space: { id: c.id, name: c.name, placements, amps, frontEnd, venue },
    stacks,
    speakers,
  };
}
