// A design as a link: the share envelope as JSON, deflated, then base64url, in the address fragment
// (`#space&s=1.<payload>`). A link is untrusted data: it is parsed as JSON only and checked before anything reads it.
import {
  SHARE_ERROR,
  SHARE_FORMAT,
  SHARE_INFLATE_SLICE_BYTES,
  SHARE_KIND,
  SHARE_MAX_JSON_BYTES,
  SHARE_MAX_PAYLOAD_CHARS,
  SHARE_PARAM,
  SHARE_VERSION,
} from "../../constants/share";
import { PAGE_HASHES } from "../../constants/pages";
import { readEnvelope, type ReadEnvelope } from "./shareChecks";
import { stackSpeakers, usedParts } from "../speaker/usedParts";
import type {
  ShareEnvelope,
  ShareError,
  ShareKind,
  SpaceDesign,
  SpaceShare,
  SpeakerShare,
  SpeakerSpec,
  StackDesign,
  StackShare,
} from "../../types";

/** What decoding a link gives: the envelope, or why it did not open. */
export type DecodedLink = ReadEnvelope;

const failure = (error: ShareError): DecodedLink => ({ ok: false, error });

/** The marks every envelope has, and the sender's note when there is one (plain text; an empty one is left out). */
const marks = (note: string): Pick<SpaceShare, "format" | "version" | "note"> => ({
  format: SHARE_FORMAT,
  version: SHARE_VERSION,
  ...(note.trim() ? { note: note.trim() } : {}),
});

/** The envelope of a speaker. */
export const speakerEnvelope = (speaker: SpeakerSpec, note = ""): SpeakerShare => ({
  ...marks(note),
  kind: SHARE_KIND.speaker,
  speakers: [speaker],
  stacks: [],
  spaces: [],
});

/** The envelope of a stack: the stack, with the speakers its members name. */
export const stackEnvelope = (design: StackDesign, note = ""): StackShare => ({
  ...marks(note),
  kind: SHARE_KIND.stack,
  speakers: stackSpeakers(design),
  stacks: [design.stack],
  spaces: [],
});

/** The envelope of a space: the space, with the stacks and speakers it places. */
export const spaceEnvelope = (design: SpaceDesign, note = ""): SpaceShare => ({
  ...marks(note),
  kind: SHARE_KIND.space,
  ...usedParts(design),
  spaces: [design.space],
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

/** The fragment of a payload, on the page of its kind: `#space&s=1.<payload>`. */
export const linkFragment = (kind: ShareKind, payload: string) =>
  `${PAGE_HASHES[kind]}&${SHARE_PARAM}=${VERSION_PREFIX}${payload}`;

/**
 * The fragment without its `s` parameter: `#space&s=1.x` is `#space`. The page's hash is kept, or `page` (a hash) takes
 * its place.
 */
export function withoutShare(hash: string, page?: string): string {
  const [own, ...rest] = hash.split("&");
  const param = `${SHARE_PARAM}=`;
  return [page ?? own ?? "", ...rest.filter((p) => !p.startsWith(param))].join("&");
}

// ---- Encode and decode ----

/** The payload of an envelope: its JSON, deflated, as base64url. */
export async function encodeLink(envelope: ShareEnvelope): Promise<string> {
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
