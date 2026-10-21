// The checks on a shared envelope (a link's JSON, parsed): it is untrusted data, so every part the app reads is checked
// before anything reads it. Numbers are finite, text is short, lists and objects are capped, and the parts the models
// read have the shape the models need. Pure.
import {
  SHARE_ERROR,
  SHARE_FORMAT,
  SHARE_KIND,
  SHARE_MAX_DEPTH,
  SHARE_MAX_KEYS,
  SHARE_MAX_LIST_ITEMS,
  SHARE_MAX_PARTS,
  SHARE_MAX_PLACEMENTS,
  SHARE_MAX_SPEAKERS,
  SHARE_MAX_STACK_NOTES_CHARS,
  SHARE_MAX_STACKS,
  SHARE_MAX_TEXT_CHARS,
  SHARE_VERSION,
} from "../../constants/share";
import {
  AUTO_DELAY,
  AUTO_LEVEL,
  CHAMBER_LOAD,
  DRIVER_KIND,
  SPACE_ITEM,
  VENT_KIND,
} from "../../constants/speakerSpec";
import { FLOOR_ALPHA, ROOM_MATERIALS } from "../../data/acoustics/materials";
import { COVERAGE_BAND_IDS } from "../../constants/space";
import { ROOM_SURFACES } from "../acoustics/roomAcoustics";
import { SINGLE_FREQ_RANGE } from "../acoustics/coverage";
import type { ShareEnvelope, ShareError } from "../../types";

/** What reading an envelope gave: the envelope, or why it is not one. */
export type ReadEnvelope = { ok: true; envelope: ShareEnvelope } | { ok: false; error: ShareError };

const failure = (error: ShareError): ReadEnvelope => ({ ok: false, error });

/** Whether a value is a plain object (not a list). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a finite number (a link's text can put anything in a number's place, even 1e999). */
const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Whether a value is a string of at most `max` characters. */
const isText = (value: unknown, max = SHARE_MAX_TEXT_CHARS): value is string =>
  typeof value === "string" && value.length <= max;

/** Whether a value is a list of at most `max` items that each pass `check`. */
const isListOf = (
  value: unknown,
  max: number,
  check: (item: unknown) => boolean,
): value is unknown[] => Array.isArray(value) && value.length <= max && value.every(check);

/** Whether a value is a spot on the floor. */
const isPoint = (value: unknown) => isRecord(value) && isNum(value.x) && isNum(value.y);

/** Whether a value is a spot on a face: its `xIn` and `yIn`. */
const isFace = (value: unknown) => isRecord(value) && isNum(value.xIn) && isNum(value.yIn);

/** Whether a value is a level or a delay that a feed takes: a number, or the solver's Auto. */
const isFeed = (value: unknown, auto: string) => isNum(value) || value === auto;

/** Whether a value is a yes or no a link from before it was added may lack (`invertPolarity`). */
export const isOptionalFlag = (value: unknown) => value === undefined || typeof value === "boolean";

/** Whether a value is one of a const record's values (a text that names an id the app has). */
const isOneOf = (ids: Record<string, string>, value: unknown) =>
  typeof value === "string" && Object.hasOwn(ids, value);

/**
 * Whether every value inside is within bounds: numbers finite, text short, lists and objects not long, and nesting not
 * deep. A speaker's inner parts (a horn's drawing, a port) are read by the models from here, so no value may be huge.
 */
function withinBounds(value: unknown, depth = 0): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= SHARE_MAX_TEXT_CHARS;
  if (value === null || typeof value === "boolean") return true;
  if (depth >= SHARE_MAX_DEPTH) return false;
  if (Array.isArray(value))
    return value.length <= SHARE_MAX_LIST_ITEMS && value.every((v) => withinBounds(v, depth + 1));
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length <= SHARE_MAX_KEYS &&
    !keys.includes("__proto__") &&
    Object.values(value).every((v) => withinBounds(v, depth + 1))
  );
}

// ---- A space ----

/** Whether a value reads as a placement (`SpacePlacement`). */
const isPlacement = (value: unknown) =>
  isRecord(value) &&
  isPoint(value) &&
  isNum(value.liftIn) &&
  isRecord(value.item) &&
  (value.item.kind === SPACE_ITEM.stack || value.item.kind === SPACE_ITEM.speaker) &&
  isText(value.item.id) &&
  isRecord(value.aim) &&
  isNum(value.aim.yawDeg) &&
  isNum(value.aim.pitchDeg) &&
  typeof value.mirrored === "boolean" &&
  typeof value.fill === "boolean" &&
  // optional: a link from before a placement could stand upside down has none
  (value.upsideDown === undefined || typeof value.upsideDown === "boolean") &&
  isOptionalFlag(value.invertPolarity) &&
  isFeed(value.levelDb, AUTO_LEVEL) &&
  isFeed(value.delayMs, AUTO_DELAY);

/** Whether a value reads as a room (`CoverageRoom`): sizes above zero, a known material on each surface. */
const isRoom = (value: unknown) =>
  isRecord(value) &&
  [value.widthFt, value.lengthFt, value.ceilingFt].every((n) => isNum(n) && n > 0) &&
  typeof value.outdoors === "boolean" &&
  isText(value.crowd) &&
  Object.hasOwn(FLOOR_ALPHA, value.crowd) &&
  isRecord(value.materials) &&
  ROOM_SURFACES.every((surface) => {
    const material = isRecord(value.materials) ? value.materials[surface] : undefined;
    return isText(material) && Object.hasOwn(ROOM_MATERIALS, material);
  });

/**
 * Whether a value reads as a venue (`SpaceVenue`): its numbers and spots. Which level reference and balance it names is
 * checked as the space opens.
 */
const isVenue = (value: unknown) =>
  isRecord(value) &&
  isRoom(value.room) &&
  isPoint(value.listener) &&
  isPoint(value.alignAt) &&
  isNum(value.earFt) &&
  isNum(value.targetDb) &&
  typeof value.levelRef === "string" &&
  typeof value.balance === "string" &&
  // optional: a link from before Auto delay and level could be turned off has none
  isOptionalFlag(value.autoDelayLevel);

/** Whether a value reads as a coverage view (`SpaceView`): a known band, and a frequency in the band picker's range. */
const isView = (value: unknown) =>
  isRecord(value) &&
  COVERAGE_BAND_IDS.some((id) => id === value.band) &&
  isNum(value.freqHz) &&
  value.freqHz >= SINGLE_FREQ_RANGE[0] &&
  value.freqHz <= SINGLE_FREQ_RANGE[1];

/** Whether a value reads as a space (`SpaceSpec`). */
const isSpace = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isListOf(value.placements, SHARE_MAX_PLACEMENTS, isPlacement) &&
  isVenue(value.venue);

// ---- A stack ----

/** Whether a value reads as a stack member (`StackMember`). */
const isMember = (value: unknown) =>
  isRecord(value) &&
  isText(value.speakerId) &&
  isRecord(value.pose) &&
  [value.pose.xIn, value.pose.yIn, value.pose.zIn, value.pose.pitchDeg].every(isNum) &&
  (value.pose.on === null || isNum(value.pose.on)) &&
  typeof value.mirror === "boolean" &&
  isRecord(value.crossover) &&
  withinBounds(value.crossover) &&
  isNum(value.levelDb) &&
  isFeed(value.delayMs, AUTO_DELAY) &&
  isOptionalFlag(value.invertPolarity);

/** Whether a value reads as a stack (`StackSpec`). */
const isStack = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isText(value.notes, SHARE_MAX_STACK_NOTES_CHARS) &&
  isListOf(value.members, SHARE_MAX_PARTS, isMember);

// ---- A speaker ----

/** Whether a value is a filter (`BandFilter`) or none. */
const isFilter = (value: unknown) =>
  value === null || (isRecord(value) && isNum(value.hz) && isText(value.type));

/** Whether a value reads as a band (`SpeakerBand`). */
const isBand = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isFilter(value.highpass) &&
  isFilter(value.lowpass) &&
  isNum(value.levelDb) &&
  isText(value.drive) &&
  isNum(value.ampW);

/** Whether a value reads as a driver entry (`SpeakerDriver`): its kind and catalog id, count, spot, bands and horn. */
const isDriver = (value: unknown) =>
  isRecord(value) &&
  isOneOf(DRIVER_KIND, value.kind) &&
  isText(value.driverId) &&
  isNum(value.count) &&
  isFace(value.position) &&
  isListOf(value.bands, SHARE_MAX_PARTS, (b) => isText(b)) &&
  (value.horn === null ||
    (isRecord(value.horn) &&
      isText(value.horn.hornId) &&
      isText(value.horn.placement) &&
      (value.horn.mount === null || isText(value.horn.mount))));

/** Whether a value reads as a chamber's vent (`ChamberVent`): its kind, and a vented chamber's port and speed. */
const isVent = (value: unknown) =>
  isRecord(value) &&
  isOneOf(VENT_KIND, value.kind) &&
  (value.kind !== VENT_KIND.vented || (isRecord(value.port) && isNum(value.maxSpeedMs))) &&
  (value.kind !== VENT_KIND.radiator || isRecord(value.radiators));

/** Whether a value reads as a horn segment (`HornSegment`). */
const isSegment = (value: unknown) =>
  isRecord(value) && isText(value.profile) && [value.s1, value.s2, value.length].every(isNum);

/** Whether a value reads as a chamber's load (`ChamberLoad`): direct, or a horn with its segments, drive and path. */
const isLoad = (value: unknown) =>
  isRecord(value) &&
  (value.kind === CHAMBER_LOAD.direct ||
    (value.kind === CHAMBER_LOAD.horn &&
      isRecord(value.horn) &&
      isListOf(value.horn.segments, SHARE_MAX_PARTS, isSegment) &&
      isRecord(value.horn.drive) &&
      isText(value.horn.drive.kind) &&
      isText(value.horn.path) &&
      isNum(value.horn.portOffset) &&
      (value.horn.fold === undefined ||
        (isRecord(value.horn.fold) &&
          Array.isArray(value.horn.fold.boards) &&
          isRecord(value.horn.fold.mouth)))));

/** Whether a value reads as a chamber (`SpeakerChamber`). */
const isChamber = (value: unknown) =>
  isRecord(value) &&
  isFace(value.at) &&
  isRecord(value.dims) &&
  [value.dims.w, value.dims.h, value.dims.d].every(isNum) &&
  (value.netLiters === null || isNum(value.netLiters)) &&
  isNum(value.stuffingPct) &&
  isVent(value.vent) &&
  isLoad(value.load) &&
  isListOf(value.drivers, SHARE_MAX_PARTS, isDriver) &&
  isRecord(value.bracing) &&
  isNum(value.bracing.braceTargetHz);

/** Whether a value reads as a cabinet (`SpeakerCabinet`): its chambers and panel, and the numbers of its shape. */
const isCabinet = (value: unknown) =>
  isRecord(value) &&
  isListOf(value.chambers, SHARE_MAX_PARTS, isChamber) &&
  isRecord(value.panel) &&
  isNum(value.panel.thicknessIn) &&
  [value.insetIn, value.roundoverIn, value.tiltDeg].every(isNum);

/**
 * Whether a value reads as a speaker (`SpeakerSpec`): its id and name; a cabinet whose chambers, drivers, vents and
 * horns have the numbers, kinds and lists the models read; its bands; its input range; and its look. Every value inside
 * is also within bounds (`withinBounds`).
 */
const isSpeaker = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isCabinet(value.cabinet) &&
  isListOf(value.bands, SHARE_MAX_PARTS, isBand) &&
  isRecord(value.input) &&
  isFilter(value.input.highpass) &&
  isFilter(value.input.lowpass) &&
  isRecord(value.look) &&
  withinBounds(value);

// ---- The envelope ----

/** Whether every item in the list has an id no other item in it has (the ids are what the items name each other by). */
const hasUniqueIds = (list: unknown) =>
  Array.isArray(list) &&
  new Set(list.map((item: unknown) => (isRecord(item) ? item.id : null))).size === list.length;

/**
 * Whether a parsed value is an envelope of this version: three lists that hold what its kind says
 * (one item of the kind, and the items it names), each item checked inside.
 */
function isEnvelope(json: unknown): json is ShareEnvelope {
  if (!isRecord(json)) return false;
  const { speakers, stacks, spaces } = json;
  if (!hasUniqueIds(speakers) || !hasUniqueIds(stacks) || !hasUniqueIds(spaces)) return false;
  if (!isListOf(speakers, SHARE_MAX_SPEAKERS, isSpeaker)) return false;
  if (!isListOf(stacks, SHARE_MAX_STACKS, isStack)) return false;
  if (!isListOf(spaces, 1, isSpace)) return false;
  // only a space carries a view
  if (json.kind !== SHARE_KIND.space && json.view !== undefined) return false;
  switch (json.kind) {
    case SHARE_KIND.speaker:
      return speakers.length === 1 && stacks.length === 0 && spaces.length === 0;
    case SHARE_KIND.stack:
      return stacks.length === 1 && spaces.length === 0;
    case SHARE_KIND.space:
      return spaces.length === 1 && (json.view === undefined || isView(json.view));
    default:
      return false;
  }
}

/** The envelope in parsed JSON, or why it is not one. */
export function readEnvelope(json: unknown): ReadEnvelope {
  if (!isRecord(json) || json.format !== SHARE_FORMAT) return failure(SHARE_ERROR.wrongFormat);
  if (json.version !== SHARE_VERSION) return failure(SHARE_ERROR.otherVersion);
  return isEnvelope(json) ? { ok: true, envelope: json } : failure(SHARE_ERROR.wrongFormat);
}
