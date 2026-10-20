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
import { SHARE_ERROR, SHARE_LONG_LINK_CHARS, SHARE_TEXT } from "../../constants/share";
import { spaceFromSaved, usedParts } from "./spaceSaves";
import type { SpaceDesign, SpaceShare } from "../../types";

/** The one line the page shows about sharing: what it says, and whether it is a problem. */
export interface ShareNotice {
  text: string;
  problem: boolean;
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
  /** the address a link is being opened from, so one link opens once */
  const opening = useRef<string | null>(null);
  useEffect(() => {
    const open = async () => {
      const { hash, pathname, search } = window.location;
      if (shareValue(hash) === null || opening.current === hash) return;
      opening.current = hash;
      const decoded = await decodeLink(hash);
      const opened = decoded.ok ? openedDesign(decoded.envelope) : null;
      if (opened) {
        replaceDesign(opened);
        setNotice(null);
      } else {
        const error = decoded.ok ? SHARE_ERROR.wrongFormat : decoded.error;
        setNotice({ text: SHARE_TEXT.errors[error], problem: true });
      }
      try {
        history.replaceState(null, "", pathname + search + withoutShare(window.location.hash));
      } catch {
        // an address that cannot change keeps its link; the page goes on
      }
      opening.current = null;
    };
    void open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  /** copies a link to the open design */
  const share = async () => {
    const { origin, pathname, search } = window.location;
    const payload = await encodeLink(spaceEnvelope({ ...design, ...usedParts(design) }));
    const link = origin + pathname + search + linkFragment(payload);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setNotice({ text: SHARE_TEXT.copyFailed, problem: true });
      return;
    }
    setNotice({
      text: link.length > SHARE_LONG_LINK_CHARS ? SHARE_TEXT.long : SHARE_TEXT.copied,
      problem: false,
    });
  };
  return { notice, share };
}
