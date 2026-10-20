/** Share links: the address fragment that carries a design, and what the page says about one. */
import type { ShareError } from "../types";

/** The `format` every shared design carries. */
export const SHARE_FORMAT = "speaknow";

/** The version of the shared envelope and of the fragment's payload. A link of another version does not open. */
export const SHARE_VERSION = 1;

/** What a shared envelope holds, by id. Only a space for now. */
export const SHARE_KIND = { space: "space" } as const;

/** The fragment parameter that carries the payload: `#space&s=1.<payload>`. */
export const SHARE_PARAM = "s";

/** The most JSON a link may unpack to, in bytes. A small link can unpack to a very large text. */
export const SHARE_MAX_JSON_BYTES = 1024 * 1024;

/** A link longer than this many characters gets a warning: some apps cut it. */
export const SHARE_LONG_LINK_CHARS = 8000;

/** Why a link did not open, by id. */
export const SHARE_ERROR = {
  cutShort: "cutShort",
  badBase64: "badBase64",
  notDeflate: "notDeflate",
  tooLarge: "tooLarge",
  otherVersion: "otherVersion",
  wrongFormat: "wrongFormat",
} as const;

/** What the Space page says about a link, as one short line. */
export const SHARE_TEXT = {
  button: "Share",
  copied: "Link copied.",
  long: "This link is long. Some apps cut it. Send a file instead.",
  copyFailed: "The link did not copy.",
  /** by reason: what is true about a link that did not open */
  errors: {
    cutShort: "This link is cut short. Ask for it again.",
    badBase64: "This link has wrong characters. Ask for it again.",
    notDeflate: "This link is damaged. Ask for it again.",
    tooLarge: "This link holds too much to open.",
    otherVersion: "This link is from another version of the app.",
    wrongFormat: "This link is not a shared space.",
  } as const satisfies Record<ShareError, string>,
};
