import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { DRAFT_WRITE_MS } from "../constants/pageDrafts";
import { readStoredJson, writeStoredJson } from "../lib/storage";

/** How a page's working design is kept in the browser. */
export interface PageDraft<T> {
  /** the local storage key, one per page (`PAGE_DRAFT_KEYS`) */
  key: string;
  /** the design a page starts from when it holds no valid draft */
  empty: () => T;
  /** the design as stored: the same document the page's save writes */
  toDraft: (design: T) => unknown;
  /** a stored value read as a design; null when it does not match the current shape */
  fromDraft: (raw: unknown) => T | null;
}

/** The design kept under the draft's key; the empty design when there is none, it fails to parse or does not fit. */
export function readDraft<T>(draft: PageDraft<T>): T {
  const raw = readStoredJson<unknown>(draft.key, null);
  if (raw === null) return draft.empty();
  try {
    return draft.fromDraft(raw) ?? draft.empty();
  } catch {
    return draft.empty();
  }
}

/**
 * `useState` for a page's working design: it starts from the draft the browser kept (`readDraft`), and every change is
 * written back `DRAFT_WRITE_MS` after the last one (at once when the page is left). Storage that is empty or throws
 * leaves the page on its empty design, working as usual.
 */
export function usePageDraft<T>(draft: PageDraft<T>): [T, Dispatch<SetStateAction<T>>] {
  const [design, setDesign] = useState(() => readDraft(draft));
  /** the design waiting to be written; null when the stored draft is current */
  const pending = useRef<{ design: T } | null>(null);
  const write = () => {
    if (!pending.current) return;
    const { design: latest } = pending.current;
    pending.current = null;
    try {
      writeStoredJson(draft.key, draft.toDraft(latest));
    } catch {
      // a design that cannot be written as a draft is skipped; the page goes on
    }
  };
  useEffect(() => {
    pending.current = { design };
    const timer = setTimeout(write, DRAFT_WRITE_MS);
    return () => clearTimeout(timer);
  }, [design]);
  // a reload inside the delay would lose the last change
  useEffect(() => {
    window.addEventListener("pagehide", write);
    return () => window.removeEventListener("pagehide", write);
  }, []);
  return [design, setDesign];
}
