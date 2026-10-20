import { useEffect, useRef, useState } from "react";
import {
  decodeLink,
  encodeLink,
  linkFragment,
  shareValue,
  speakerEnvelope,
  spaceEnvelope,
  stackEnvelope,
  withoutShare,
} from "../../lib/io/shareLink";
import { newDocId, type ConfigStore } from "../../components/saved-configs/useConfigStore";
import type { SharedMode } from "../../hooks/usePageDraft";
import type { SharedNoticeProps } from "../../components/ui/SharedNotice";
import { openEnvelope, type OpenedShare } from "./openShare";
import { saveSpaceCopy, saveSpeakerCopy, saveStackCopy, type CopyStores } from "./saveCopy";
import {
  SHARE_COPIED_SHOW_MS,
  SHARE_ERROR,
  SHARE_KIND,
  SHARE_LONG_LINK_CHARS,
  SHARE_TEXT,
} from "../../constants/share";
import { PAGE_HASHES, PROJECT_NAMES } from "../../constants/pages";
import type {
  ShareDesigns,
  ShareEnvelope,
  ShareError,
  ShareKind,
  SpaceDesign,
  SpeakerSpec,
  StackDesign,
} from "../../types";

/** The one line the header shows about sharing. */
export interface ShareNotice {
  text: string;
  /** a problem or a warning (a link that did not open or copy, or a long link), shown as a notice; absent: the link copied */
  problem?: true;
  /** when the link copied (ms since 1970): a new copy restarts the line's fade */
  shownAt?: number;
}

/** What the share hook needs of a page: the design it shows, the shared view, and its library. */
interface SharePage<T> {
  design: T;
  shared: SharedMode<T>;
  store: Pick<ConfigStore, "db" | "overwrite">;
}

/** The three pages, by the kind each shares. */
export type SharePages = { [K in ShareKind]: SharePage<ShareDesigns[K]> };

/** What a kind's page does for sharing: its design's name and envelope, and how a copy is saved. */
interface KindOps<T> {
  page: SharePage<T>;
  name: (design: T) => string;
  envelope: (design: T) => ShareEnvelope;
  /** saves a copy; every library it writes to must be signed in (`stores`) */
  saveCopy: (design: T, makeId: () => string) => Promise<T | null>;
  needs: readonly ShareKind[];
}

/** Whether a link is long enough that some apps cut it. */
const isLong = (link: string) => link.length > SHARE_LONG_LINK_CHARS;

/** Whether this device offers its share sheet and is a phone or a tablet (a touch screen): then Share opens it. */
const takesShareSheet = () =>
  typeof navigator.share === "function" &&
  typeof matchMedia === "function" &&
  matchMedia("(pointer: coarse)").matches;

/**
 * Sharing across the Speaker, Stack and Space pages. `copyLink` copies a link to the open design of the page showing
 * (`kind`). A link in the address (at load, or after it changes) opens as a shared
 * view on its page (the page's own design is not written over), and then leaves the address on the page's own hash; a
 * link that does not open changes nothing and says why. `sharedNotice` is what a page's results show while one is open.
 */
export function useShare(
  pages: SharePages,
  kind: ShareKind | null,
  onOpened: (kind: ShareKind) => void,
) {
  const [notice, setNotice] = useState<ShareNotice | null>(null);
  /** what saving a copy says, and for which kind */
  const [saved, setSaved] = useState<{ kind: ShareKind; text: string } | null>(null);
  // "Link copied!" clears after a few seconds; a problem or a warning stays until the next share or link
  useEffect(() => {
    if (!notice || notice.problem) return;
    const timer = window.setTimeout(() => setNotice(null), SHARE_COPIED_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  /** the pages and the call that follows a link, kept current: the address effect below runs once */
  const latestPages = useRef(pages);
  const latestOpened = useRef(onOpened);
  useEffect(() => {
    latestPages.current = pages;
    latestOpened.current = onOpened;
  });
  /** the address a link is being opened from, so one link opens once */
  const opening = useRef<string | null>(null);
  /** the count of opens started: an open that is not the latest when it finishes is stale and changes nothing */
  const latest = useRef(0);

  /** shows an opened design as its page's shared view */
  const show = (opened: OpenedShare) => {
    const p = latestPages.current;
    if (opened.kind === SHARE_KIND.speaker) p.speaker.shared.open(opened.design);
    else if (opened.kind === SHARE_KIND.stack) p.stack.shared.open(opened.design);
    else p.space.shared.open(opened.design);
  };

  useEffect(() => {
    const open = async () => {
      const { hash, pathname, search } = window.location;
      if (shareValue(hash) === null || opening.current === hash) return;
      opening.current = hash;
      latest.current += 1;
      const mine = latest.current;
      /** the page the design opened on, once it did */
      let page: ShareKind | null = null;
      try {
        const decoded = await decodeLink(hash);
        if (latest.current !== mine) return;
        let error: ShareError | null = decoded.ok ? null : decoded.error;
        if (decoded.ok) {
          // a link that passes the checks but does not read comes back null: nothing is shown or written
          const opened = openEnvelope(decoded.envelope);
          if (opened) {
            show(opened);
            page = opened.kind;
            setSaved(null);
            latestOpened.current(opened.kind);
          } else error = SHARE_ERROR.wrongFormat;
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
              history.replaceState(
                null,
                "",
                pathname + search + withoutShare(hash, page ? PAGE_HASHES[page] : undefined),
              );
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

  /** the stores a copy goes to, and whether each is signed in */
  const stores: CopyStores = {
    speakers: pages.speaker.store,
    stacks: pages.stack.store,
    spaces: pages.space.store,
  };
  const ops = {
    speaker: {
      page: pages.speaker,
      name: (d: SpeakerSpec) => d.name,
      envelope: speakerEnvelope,
      saveCopy: (d: SpeakerSpec, makeId: () => string) => saveSpeakerCopy(d, stores, makeId),
      needs: [SHARE_KIND.speaker],
    } satisfies KindOps<SpeakerSpec>,
    stack: {
      page: pages.stack,
      name: (d: StackDesign) => d.stack.name,
      envelope: stackEnvelope,
      saveCopy: (d: StackDesign, makeId: () => string) => saveStackCopy(d, stores, makeId),
      needs: [SHARE_KIND.speaker, SHARE_KIND.stack],
    } satisfies KindOps<StackDesign>,
    space: {
      page: pages.space,
      name: (d: SpaceDesign) => d.space.name,
      envelope: spaceEnvelope,
      saveCopy: (d: SpaceDesign, makeId: () => string) => saveSpaceCopy(d, stores, makeId),
      needs: [SHARE_KIND.speaker, SHARE_KIND.stack, SHARE_KIND.space],
    } satisfies KindOps<SpaceDesign>,
  };

  /** the link to a kind's open design, as a promise: the clipboard takes it so the copy still counts as the click's */
  const linkOf = <T>(forKind: ShareKind, o: KindOps<T>) => {
    const { origin, pathname, search } = window.location;
    const link = encodeLink(o.envelope(o.page.design)).then(
      (payload) => origin + pathname + search + linkFragment(forKind, payload),
    );
    // read by the caller; this keeps a failed copy from leaving the promise unhandled
    link.catch(() => undefined);
    return link;
  };

  /** copies a link to the page's open design, or opens the share sheet where the device has one */
  const copyOf = async <T>(forKind: ShareKind, o: KindOps<T>) => {
    try {
      const link = linkOf(forKind, o);
      if (takesShareSheet()) {
        try {
          await navigator.share({ url: await link });
        } catch (e) {
          // closing the sheet is not a failure
          if (!(e instanceof DOMException && e.name === "AbortError")) throw e;
        }
      } else if (typeof ClipboardItem === "undefined") {
        await navigator.clipboard.writeText(await link);
      } else {
        const blob = link.then((text) => new Blob([text], { type: "text/plain" }));
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      }
      setNotice(
        isLong(await link)
          ? { text: SHARE_TEXT.long, problem: true }
          : takesShareSheet()
            ? null
            : { text: SHARE_TEXT.copied, shownAt: Date.now() },
      );
    } catch {
      setNotice({ text: SHARE_TEXT.copyFailed, problem: true });
    }
  };

  /** the shared view's notice for a kind: its words and actions; null while the page shows its own design */
  const noticeOf = <T>(forKind: ShareKind, o: KindOps<T>): SharedNoticeProps | null => {
    const { shared, design } = o.page;
    if (!shared.active) return null;
    return {
      item: PROJECT_NAMES[forKind],
      name: o.name(design),
      canSave: o.needs.every((k) => Boolean(pages[k].store.db)),
      status: saved?.kind === forKind ? saved.text : "",
      onSave: () => {
        setSaved({ kind: forKind, text: SHARE_TEXT.saving });
        void o.saveCopy(design, newDocId).then((copy) => {
          if (!copy) {
            setSaved({ kind: forKind, text: SHARE_TEXT.copyNotSaved });
            return;
          }
          // the copy opens as the page's own design; the line beside Share says it saved
          shared.keep(copy);
          setSaved(null);
          setNotice({ text: SHARE_TEXT.copySaved, shownAt: Date.now() });
        });
      },
      onShare: () => {
        void copyOf(forKind, o);
        window.scrollTo(0, 0);
      },
      changed: shared.changed,
      onClose: () => {
        shared.close();
        setSaved(null);
      },
    };
  };

  return {
    notice,
    /** copies a link to the open design of the page showing */
    copyLink: () => {
      if (kind === SHARE_KIND.speaker) void copyOf(kind, ops.speaker);
      else if (kind === SHARE_KIND.stack) void copyOf(kind, ops.stack);
      else if (kind === SHARE_KIND.space) void copyOf(kind, ops.space);
    },
    /** the shared view's notice for a page; null while it shows its own design */
    sharedNotice: (forKind: ShareKind): SharedNoticeProps | null =>
      forKind === SHARE_KIND.speaker
        ? noticeOf(forKind, ops.speaker)
        : forKind === SHARE_KIND.stack
          ? noticeOf(forKind, ops.stack)
          : noticeOf(forKind, ops.space),
  };
}
