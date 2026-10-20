// A design as a link: the share envelope as JSON, deflated, then base64url, in the address fragment
// (`#space&s=1.<payload>`). A link is untrusted data: it is parsed as JSON only and checked before anything reads it.
import { PAGE_HASHES } from "../../constants/pages";
import {
  SHARE_ERROR,
  SHARE_FORMAT,
  SHARE_INFLATE_SLICE_BYTES,
  SHARE_KIND,
  SHARE_MAX_JSON_BYTES,
  SHARE_MAX_NOTES_CHARS,
  SHARE_MAX_PARTS,
  SHARE_MAX_PAYLOAD_CHARS,
  SHARE_MAX_PLACEMENTS,
  SHARE_MAX_SPEAKERS,
  SHARE_MAX_STACKS,
  SHARE_MAX_TEXT_CHARS,
  SHARE_PARAM,
  SHARE_VERSION,
} from "../../constants/share";
import { AUTO_DELAY, AUTO_LEVEL, SPACE_ITEM } from "../../constants/speakerSpec";
import { FLOOR_ALPHA, ROOM_MATERIALS } from "../../data/acoustics/materials";
import { ROOM_SURFACES } from "../acoustics/roomAcoustics";
import type { ShareError, SpaceDesign, SpaceShare } from "../../types";

/** What decoding a link gives: the envelope, or why it did not open. */
export type DecodedLink = { ok: true; envelope: SpaceShare } | { ok: false; error: ShareError };

const failure = (error: ShareError): DecodedLink => ({ ok: false, error });

/** The envelope of a space: its marks, and the space with the stacks and speakers it places. */
export const spaceEnvelope = (design: SpaceDesign): SpaceShare => ({
  format: SHARE_FORMAT,
  version: SHARE_VERSION,
  kind: SHARE_KIND.space,
  speakers: design.speakers,
  stacks: design.stacks,
  spaces: [design.space],
});

/** The space an envelope holds, with its stacks and speakers. */
export const designOfEnvelope = (envelope: SpaceShare): SpaceDesign => ({
  space: envelope.spaces[0],
  stacks: envelope.stacks,
  speakers: envelope.speakers,
});

// ---- Bytes and base64url ----

/** The bytes as base64url: `-` and `_` for `+` and `/`, no padding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The bytes of base64url text (already checked to use only its characters). */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

/** Raw deflate of the bytes, by the browser's own compression. */
async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** What unpacking gave: the bytes, or why not. */
type Inflated = { ok: true; bytes: Uint8Array } | { ok: false; error: ShareError };

/** Words in a decompression error that mean the data ended early (the engines word it differently). */
const ENDED_EARLY = /unexpected end|incomplete|truncat|ended early|premature|Z_BUF_ERROR/i;

/**
 * Raw inflate of the bytes, stopping at `SHARE_MAX_JSON_BYTES` of output: a small input can unpack to a huge text, so
 * the input goes in slices of `SHARE_INFLATE_SLICE_BYTES` and the output is counted as it comes, not after.
 */
async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Inflated> {
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const feed = async () => {
    for (let at = 0; at < bytes.length; at += SHARE_INFLATE_SLICE_BYTES) {
      await writer.write(bytes.subarray(at, at + SHARE_INFLATE_SLICE_BYTES));
    }
    await writer.close();
  };
  // a bad stream also fails the reader, which is where the error is read
  const fed = feed().catch(() => undefined);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > SHARE_MAX_JSON_BYTES) {
        await reader.cancel();
        await fed;
        return { ok: false, error: SHARE_ERROR.tooLarge };
      }
      chunks.push(value);
    }
  } catch (e) {
    // Node puts the reason in `cause` and `code`; browsers put it in the message
    const message = [e, e instanceof Error ? e.cause : null]
      .flatMap((x) => (x instanceof Error ? [x.message, Reflect.get(x, "code")] : []))
      .join(" ");
    return {
      ok: false,
      error: ENDED_EARLY.test(message) ? SHARE_ERROR.cutShort : SHARE_ERROR.notDeflate,
    };
  }
  await fed;
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return { ok: true, bytes: out };
}

// ---- The fragment ----

/** The prefix of the `s` parameter's value: the version, then a dot. */
const VERSION_PREFIX = `${SHARE_VERSION}.`;

/** The parts of a fragment after the page's hash: `#space&s=1.x&y` has `s=1.x` and `y`. */
const paramsOf = (hash: string) => hash.replace(/^#/, "").split("&").slice(1);

/** The value of the fragment's `s` parameter (`1.<payload>`); null when it has none. */
export function shareValue(hash: string): string | null {
  const own = `${SHARE_PARAM}=`;
  const part = paramsOf(hash).find((p) => p.startsWith(own));
  return part === undefined ? null : part.slice(own.length);
}

/** The fragment of a payload, on the Space page: `#space&s=1.<payload>`. */
export const linkFragment = (payload: string) =>
  `${PAGE_HASHES.space}&${SHARE_PARAM}=${VERSION_PREFIX}${payload}`;

/** The fragment without its `s` parameter, the page's hash kept: `#space&s=1.x` is `#space`. */
export function withoutShare(hash: string): string {
  const [page = "", ...rest] = hash.split("&");
  const own = `${SHARE_PARAM}=`;
  return [page, ...rest.filter((p) => !p.startsWith(own))].join("&");
}

// ---- Checks ----

/** Whether a value is a plain object (not a list). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a finite number (a link's text can put anything in a number's place). */
const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Whether a value is a string of at most `max` characters. */
const isText = (value: unknown, max = SHARE_MAX_TEXT_CHARS): value is string =>
  typeof value === "string" && value.length <= max;

/** Whether a value is a list of at most `max` items that each pass `check`. */
const isListOf = (value: unknown, max: number, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.length <= max && value.every(check);

/** Whether a value is a spot on the floor. */
const isPoint = (value: unknown) => isRecord(value) && isNum(value.x) && isNum(value.y);

/** Whether a value is a level or a delay that a feed takes: a number, or the solver's Auto. */
const isFeed = (value: unknown, auto: string) => isNum(value) || value === auto;

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
  typeof value.mirror === "boolean" &&
  typeof value.mirrored === "boolean" &&
  typeof value.fill === "boolean" &&
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
  typeof value.balance === "string";

/** Whether a value reads as a space (`SpaceSpec`). */
const isSpace = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isListOf(value.placements, SHARE_MAX_PLACEMENTS, isPlacement) &&
  isVenue(value.venue);

/** Whether a value reads as a stack member (`StackMember`). */
const isMember = (value: unknown) =>
  isRecord(value) &&
  isText(value.speakerId) &&
  isRecord(value.pose) &&
  [value.pose.xIn, value.pose.yIn, value.pose.zIn, value.pose.pitchDeg].every(isNum) &&
  (value.pose.on === null || isNum(value.pose.on)) &&
  typeof value.mirror === "boolean" &&
  isRecord(value.crossover) &&
  isNum(value.levelDb) &&
  isFeed(value.delayMs, AUTO_DELAY);

/** Whether a value reads as a stack (`StackSpec`). */
const isStackShare = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isText(value.notes, SHARE_MAX_NOTES_CHARS) &&
  isListOf(value.members, SHARE_MAX_PARTS, isMember);

/**
 * Whether a value reads as a speaker (`SpeakerSpec`) at the top: its id and name, and the parts it is built of, as
 * objects. The speaker's inner numbers are read as the space opens, which catches a speaker that does not read.
 */
const isSpeakerShare = (value: unknown) =>
  isRecord(value) &&
  isText(value.id) &&
  isText(value.name) &&
  isRecord(value.cabinet) &&
  isListOf(value.cabinet.chambers, SHARE_MAX_PARTS, isRecord) &&
  isListOf(value.bands, SHARE_MAX_PARTS, isRecord) &&
  isRecord(value.input) &&
  isRecord(value.look);

/**
 * Whether a parsed value is a space envelope of this version: the kind, and one space, and the stacks and speakers,
 * each checked inside (objects that are not null, finite numbers, short text, and capped counts).
 */
const isSpaceShare = (value: unknown): value is SpaceShare =>
  isRecord(value) &&
  value.kind === SHARE_KIND.space &&
  isListOf(value.speakers, SHARE_MAX_SPEAKERS, isSpeakerShare) &&
  isListOf(value.stacks, SHARE_MAX_STACKS, isStackShare) &&
  isListOf(value.spaces, 1, isSpace) &&
  Array.isArray(value.spaces) &&
  value.spaces.length === 1;

/** The envelope in parsed JSON, or why it is not one. */
function readEnvelope(json: unknown): DecodedLink {
  if (!isRecord(json) || json.format !== SHARE_FORMAT) return failure(SHARE_ERROR.wrongFormat);
  if (json.version !== SHARE_VERSION) return failure(SHARE_ERROR.otherVersion);
  return isSpaceShare(json) ? { ok: true, envelope: json } : failure(SHARE_ERROR.wrongFormat);
}

// ---- Encode and decode ----

/** The payload of an envelope: its JSON, deflated, as base64url. */
export async function encodeLink(envelope: SpaceShare): Promise<string> {
  return toBase64Url(await deflate(new TextEncoder().encode(JSON.stringify(envelope))));
}

/**
 * The envelope a fragment carries, or why it does not open. `fragment` is the address hash (`#space&s=1.<payload>`).
 * A link cut short (by a chat app) ends early, so it fails as cut short, or as damaged where the engine cannot tell.
 */
export async function decodeLink(fragment: string): Promise<DecodedLink> {
  const value = shareValue(fragment);
  if (value === null) return failure(SHARE_ERROR.wrongFormat);
  const dot = value.indexOf(".");
  if (dot < 0) return failure(SHARE_ERROR.cutShort);
  if (value.slice(0, dot + 1) !== VERSION_PREFIX) {
    return failure(
      /^\d+$/.test(value.slice(0, dot)) ? SHARE_ERROR.otherVersion : SHARE_ERROR.wrongFormat,
    );
  }
  const payload = value.slice(dot + 1);
  if (payload === "") return failure(SHARE_ERROR.cutShort);
  if (payload.length > SHARE_MAX_PAYLOAD_CHARS) return failure(SHARE_ERROR.tooLarge);
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) return failure(SHARE_ERROR.badBase64);
  // base64 text is never one character past a whole group: only a cut leaves that
  if (payload.length % 4 === 1) return failure(SHARE_ERROR.cutShort);
  const inflated = await inflate(fromBase64Url(payload));
  if (!inflated.ok) return failure(inflated.error);
  let json: unknown;
  try {
    // a cut deflate stream can still give text, which stops partway
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(inflated.bytes));
  } catch {
    return failure(SHARE_ERROR.cutShort);
  }
  return readEnvelope(json);
}
