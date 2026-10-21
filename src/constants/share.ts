/** Share links: the address fragment that carries a design, and what the page says about one. */
import type { ShareError } from "../types";

/** The `format` every shared design carries. */
export const SHARE_FORMAT = "speaknow";

/** The version of the shared envelope and of the fragment's payload. A link of another version does not open. */
export const SHARE_VERSION = 1;

/**
 * What a shared envelope holds, by id: the same words as the projects (`PROJECT_NAMES`) and the page hashes
 * (`PAGE_HASHES`), so a kind names its page.
 */
export const SHARE_KIND = { speaker: "speaker", stack: "stack", space: "space" } as const;

/** The fragment parameter that carries the payload: `#space&s=1.<payload>`. */
export const SHARE_PARAM = "s";

/** The most JSON a link may unpack to, in bytes. A small link can unpack to a very large text. */
export const SHARE_MAX_JSON_BYTES = 1024 * 1024;

/** The longest payload a link may carry, in characters. A real link is about 5,000; a longer one is not opened. */
export const SHARE_MAX_PAYLOAD_CHARS = 65536;

/** The bytes the unpacker takes at a time, so the unpacked size is checked between slices. */
export const SHARE_INFLATE_SLICE_BYTES = 4096;

/** The longest id or name a link may carry, in characters. */
export const SHARE_MAX_TEXT_CHARS = 200;

/** The longest stack notes a link may carry, in characters. */
export const SHARE_MAX_STACK_NOTES_CHARS = 5000;

/**
 * The bounds on every value inside a shared speaker (its parts are read by the model, so a link must not hold a huge or
 * deep one): the longest list, the most keys in an object, and how deep values nest.
 */
export const SHARE_MAX_LIST_ITEMS = 256;
export const SHARE_MAX_KEYS = 64;
export const SHARE_MAX_DEPTH = 12;

/** The most placements, stacks and speakers a link may carry. */
export const SHARE_MAX_PLACEMENTS = 200;
export const SHARE_MAX_STACKS = 100;
export const SHARE_MAX_SPEAKERS = 200;
/** The most stages and risers a link may carry. */
export const SHARE_MAX_STAGES = 100;

/** The most members in a stack, bands in a speaker, or chambers in a cabinet a link may carry. */
export const SHARE_MAX_PARTS = 64;

/** A link longer than this many characters gets a warning: some apps cut it. */
export const SHARE_LONG_LINK_CHARS = 8000;

/** How long "Link copied!" shows before it clears, ms. Problems and warnings stay. */
export const SHARE_COPIED_SHOW_MS = 3000;

/** Why a link did not open, by id. */
export const SHARE_ERROR = {
  cutShort: "cutShort",
  badBase64: "badBase64",
  notDeflate: "notDeflate",
  tooLarge: "tooLarge",
  otherVersion: "otherVersion",
  wrongFormat: "wrongFormat",
} as const;

/** What the page says about sharing, as short lines. */
export const SHARE_TEXT = {
  button: "Share",
  /** the Share button's tooltip, by the item's name (a Speaker, a Stack or a Space) */
  tooltip: (item: string) => `Copy a link to this ${item}`,
  copied: "Link copied!",
  long: "This link is long. Some apps cut it.",
  copyFailed: "The link did not copy.",
  openFailed: "This link did not open.",
  /** the shared view's notice: the item's name, then the shared design's name */
  shared: (item: string, name: string) => `Shared ${item}: ${name}`,
  saveCopy: "Save a copy",
  signInToSave: "Sign in to save a copy.",
  saving: "Saving a copy…",
  copySaved: "Copy saved!",
  copyNotSaved: "The copy did not save.",
  close: "Close",
  closeAsk: "Close without saving a copy?",
  closeKeep: "Keep open",
  /** by reason: what is true about a link that did not open */
  errors: {
    cutShort: "This link is cut short. Ask for it again.",
    badBase64: "This link has wrong characters. Ask for it again.",
    notDeflate: "This link is damaged. Ask for it again.",
    tooLarge: "This link holds too much to open.",
    otherVersion: "This link is from another version of the app.",
    wrongFormat: "This link is not a shared design.",
  } as const satisfies Record<ShareError, string>,
};
