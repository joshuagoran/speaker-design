import { useEffect, useRef, useState } from "react";
import {
  decodeLink,
  designOfEnvelope,
  encodeLink,
  linkFragment,
  shareValue,
  spaceEnvelope,
  withoutShare,
} from "../../lib/io/shareLink";
import {
  SHARE_COPIED_SHOW_MS,
  SHARE_ERROR,
  SHARE_LONG_LINK_CHARS,
  SHARE_TEXT,
} from "../../constants/share";
import { spaceFromSaved, usedParts } from "./spaceSaves";
import type { ShareError, SpaceDesign, SpaceShare } from "../../types";

/** The one line the page shows about sharing. */
export interface ShareNotice {
  text: string;
  /** a problem or a warning (a link that did not open or copy, or a long link), shown as a notice; absent: the link copied */
  problem?: true;
  /** when the link copied (ms since 1970): a new copy restarts the line's fade */
  shownAt?: number;
}

/**
 * The space a shared envelope holds, read as a space opens from a save (each part checked); null when a part does not
 * read.
 */
function openedDesign(envelope: SpaceShare): SpaceDesign | null {
  const { space, stacks, speakers } = designOfEnvelope(envelope);
  return spaceFromSaved({ id: space.id, name: space.name, space, stacks, speakers });
}

/**
 * Sharing on the Space page. `share` copies a link to the open design. A link in the address (at load, or after it
 * changes) replaces the open design with its space, and then leaves the address on the page's own hash; a link that
 * does not open changes nothing and says why.
 */
export function useShareLink(design: SpaceDesign, replaceDesign: (d: SpaceDesign) => void) {
  const [notice, setNotice] = useState<ShareNotice | null>(null);
  // "Link copied!" clears after a few seconds; a problem or a warning stays until the next share or link
  useEffect(() => {
    if (!notice || notice.problem) return;
    const timer = window.setTimeout(() => setNotice(null), SHARE_COPIED_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  /** the address a link is being opened from, so one link opens once */
  const opening = useRef<string | null>(null);
  /** the count of opens started: an open that is not the latest when it finishes is stale and changes nothing */
  const latest = useRef(0);
  /** the page's replace, kept current: the address effect below runs once and must not keep the first one */
  const replace = useRef(replaceDesign);
  useEffect(() => {
    replace.current = replaceDesign;
  });
  useEffect(() => {
    const open = async () => {
      const { hash, pathname, search } = window.location;
      if (shareValue(hash) === null || opening.current === hash) return;
      opening.current = hash;
      latest.current += 1;
      const mine = latest.current;
      try {
        const decoded = await decodeLink(hash);
        if (latest.current !== mine) return;
        let error: ShareError | null = decoded.ok ? null : decoded.error;
        if (decoded.ok) {
          try {
            const opened = openedDesign(decoded.envelope);
            if (opened) replace.current(opened);
            else error = SHARE_ERROR.wrongFormat;
          } catch {
            // a link that passes the checks but does not read: nothing is written
            error = SHARE_ERROR.wrongFormat;
          }
        }
        setNotice(error ? { text: SHARE_TEXT.errors[error], problem: true } : null);
      } catch {
        if (latest.current === mine) setNotice({ text: SHARE_TEXT.openFailed, problem: true });
      } finally {
        if (latest.current === mine) {
          opening.current = null;
          // the link comes off the address only if the address is still the one opened
          if (window.location.hash === hash) {
            try {
              history.replaceState(null, "", pathname + search + withoutShare(hash));
            } catch {
              // an address that cannot change keeps its link; the page goes on
            }
          }
        }
      }
    };
    void open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  /**
   * copies a link to the open design. The copy starts before the link is made (the clipboard takes the link as a
   * promise), so the browser still counts it as the click's own.
   */
  const share = async () => {
    try {
      const { origin, pathname, search } = window.location;
      const link = encodeLink(spaceEnvelope({ ...design, ...usedParts(design) })).then(
        (payload) => origin + pathname + search + linkFragment(payload),
      );
      // read below; this keeps a failed copy from leaving the promise unhandled
      link.catch(() => undefined);
      if (typeof ClipboardItem === "undefined") {
        await navigator.clipboard.writeText(await link);
      } else {
        const blob = link.then((text) => new Blob([text], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      }
      setNotice(
        (await link).length > SHARE_LONG_LINK_CHARS
          ? { text: SHARE_TEXT.long, problem: true }
          : { text: SHARE_TEXT.copied, shownAt: Date.now() },
      );
    } catch {
      setNotice({ text: SHARE_TEXT.copyFailed, problem: true });
    }
  };
  return { notice, share };
}
