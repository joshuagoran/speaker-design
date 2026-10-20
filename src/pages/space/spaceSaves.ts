// The Space page's saves (the `spaces` collection under users/{uid}): what a save stores and how a document opens.
// Pure.
import type {
  SavedConfig,
  SavedSpaceData,
  SpaceDesign,
  SpacePlacement,
  SpaceVenue,
  SpeakerSpec,
  StackSpec,
} from "../../types";
import { isSavedSpeakerShape } from "../../lib/speaker/speakerSaves";
import { readSpeakerCopy } from "../../lib/speaker/speakerSaves";
import { homeVenue } from "../../lib/speaker/specParts";
import { usedParts } from "../../lib/speaker/usedParts";
import { SPACE_ITEM } from "../../constants/speakerSpec";
import { COVERAGE_LEVEL_REF } from "../../constants/coverageLevel";
import { AUTO_BALANCE_MODE } from "../../constants/autoBalance";
import { SEATED_EAR_FT, SPACE_HOME_SEAT, SPACE_TEXT } from "../../constants/space";
import { PAGE_DRAFT_KEYS, PAGE_SHARED_KEYS } from "../../constants/pageDrafts";
import { DRAFT_ID } from "../../constants/saveRow";
import { readMember } from "../stack/stackSaves";
import { asDraftDocument, draftDocument } from "../../lib/savedDraft";
import type { PageDraft } from "../../hooks/usePageDraft";

/** The id a space has until the library saves it (then it takes the document's). */
export const DRAFT_SPACE_ID = DRAFT_ID;

/**
 * A space with nothing placed, named as a new one, in the default living room (20 × 30 × 12 ft) with a seated listener
 * two thirds down it: the page opens on a quiet, empty room.
 */
export const emptySpace = (): SpaceDesign => ({
  space: {
    id: DRAFT_SPACE_ID,
    name: SPACE_TEXT.newName,
    placements: [],
    venue: homeVenue(0, SPACE_HOME_SEAT, SEATED_EAR_FT),
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
  isSavedSpeakerShape(value) && typeof Reflect.get(value, "id") === "string";

/** Whether a value reads as a stack: its id, name, members and notes. */
const isStack = (value: unknown): value is StackSpec =>
  hasFields(value, { id: "string", name: "string", notes: "string" }) &&
  Array.isArray(Reflect.get(value, "members"));

/**
 * A placement as a save holds it: one from before a placement could stand upside down has no `upsideDown`, and one
 * from before its polarity could be inverted has no `invertPolarity`.
 */
type SavedPlacement = Omit<SpacePlacement, "upsideDown" | "invertPolarity"> &
  Partial<Pick<SpacePlacement, "upsideDown" | "invertPolarity">>;

/**
 * Whether a value reads as a list of placements: each names an item and has a spot, an aim, whether it is a mirrored
 * pair and whether it is a fill, and maybe whether it is upside down and its polarity inverted. (A draft or save from
 * the time a placement could follow another has `follows` and no `mirrored`: not read.)
 */
const isPlacements = (value: unknown): value is SavedPlacement[] =>
  Array.isArray(value) &&
  value.every(
    (p: unknown) =>
      hasFields(p, {
        x: "number",
        y: "number",
        liftIn: "number",
        item: "object",
        aim: "object",
        mirrored: "boolean",
        fill: "boolean",
      }) &&
      !("follows" in p) &&
      ["undefined", "boolean"].includes(typeof Reflect.get(p, "upsideDown")) &&
      ["undefined", "boolean"].includes(typeof Reflect.get(p, "invertPolarity")),
  );

/** Whether a value is one of a const record's values (a saved string that names an id the app has). */
const isOneOf = (ids: Record<string, string>, value: unknown) =>
  Object.values(ids).some((id) => id === value);

/**
 * Whether a value reads as a venue: its room, listener, alignment point, ear height, target, where it is measured and
 * balance.
 */
const isVenue = (value: unknown): value is SpaceVenue =>
  hasFields(value, {
    room: "object",
    listener: "object",
    alignAt: "object",
    earFt: "number",
    targetDb: "number",
    levelRef: "string",
    balance: "string",
  }) &&
  isOneOf(COVERAGE_LEVEL_REF, Reflect.get(value, "levelRef")) &&
  isOneOf(AUTO_BALANCE_MODE, Reflect.get(value, "balance"));

/**
 * A saved space opened: the document's id and name, its placements and venue, and its stacks and speakers;
 * null for a document that holds no space (written elsewhere). Its fields are trusted from there: `spaceSnapshot`
 * wrote them.
 */
export function spaceFromSaved(c: SavedConfig): SpaceDesign | null {
  const space: unknown = Reflect.get(c, "space");
  const stacks: unknown = Reflect.get(c, "stacks");
  const speakers: unknown = Reflect.get(c, "speakers");
  if (typeof space !== "object" || space === null) return null;
  const placements: unknown = Reflect.get(space, "placements");
  const venue: unknown = Reflect.get(space, "venue");
  if (
    !isPlacements(placements) ||
    !isVenue(venue) ||
    !Array.isArray(stacks) ||
    !stacks.every(isStack) ||
    !Array.isArray(speakers) ||
    !speakers.every(isSpaceSpeaker)
  )
    return null;
  return {
    space: {
      id: c.id,
      name: c.name,
      placements: placements.map((p) => ({
        ...p,
        upsideDown: p.upsideDown ?? false,
        invertPolarity: p.invertPolarity ?? false,
      })),
      venue,
    },
    stacks: stacks.map((s) => ({ ...s, members: s.members.map(readMember) })),
    speakers: speakers.map(readSpeakerCopy),
  };
}

/** The Space page's working design in the browser: the save document, with the space's id and name. */
export const spaceDraft: PageDraft<SpaceDesign> = {
  key: PAGE_DRAFT_KEYS.space,
  sharedKey: PAGE_SHARED_KEYS.space,
  empty: emptySpace,
  toDraft: (design) => draftDocument(spaceSnapshot(design), design.space),
  fromDraft: (raw) => {
    const doc = asDraftDocument(raw);
    return doc && spaceFromSaved(doc);
  },
};
