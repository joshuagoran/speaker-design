import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { DRAFT_WRITE_MS } from "../constants/pageDrafts";
import {
  readSessionJson,
  readStoredJson,
  removeSession,
  writeSessionJson,
  writeStoredJson,
} from "../lib/storage";

/** How a page's working design is kept in the browser. */
export interface PageDraft<T> {
  /** the local storage key, one per page (`PAGE_DRAFT_KEYS`) */
  key: string;
  /** the session storage key of the page's shared view, one per page (`PAGE_SHARED_KEYS`) */
  sharedKey: string;
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
 * A design that came from a link and is shown in place of the page's own: the design as it is now, as it was when it
 * opened (or last saved as a copy, to tell a change).
 */
export interface SharedDesign<T> {
  design: T;
  original: T;
}

/** What a page holds: its own design (the draft), and the shared view that shows instead of it, when there is one. */
export interface DraftState<T> {
  own: T;
  shared: SharedDesign<T> | null;
}

/** The state after the shown design is replaced by `next` (a value, or an edit of the design shown). */
export function withEdit<T>(state: DraftState<T>, next: SetStateAction<T>): DraftState<T> {
  const apply = (from: T) => (typeof next === "function" ? (next as (d: T) => T)(from) : next); // boundary cast: T is not a function type for any page's design
  return state.shared
    ? { ...state, shared: { ...state.shared, design: apply(state.shared.design) } }
    : { ...state, own: apply(state.own) };
}

/** The state with a link's design shown in place of the page's own, which stays as it is. */
export const withShared = <T>(state: DraftState<T>, design: T): DraftState<T> => ({
  ...state,
  shared: { design, original: design },
});

/** The state back on the page's own design. */
export const withoutShared = <T>(state: DraftState<T>): DraftState<T> => ({
  ...state,
  shared: null,
});

/** The state after a shared design was saved as a copy: the shared view closes, and `copy` is the page's own design. */
export const withCopyKept = <T>(copy: T): DraftState<T> => ({ own: copy, shared: null });

/** Whether a shared design differs from the one it opened as (or was last saved as): its stored documents are compared. */
export const sharedChanged = <T>(draft: PageDraft<T>, shared: SharedDesign<T>): boolean =>
  JSON.stringify(draft.toDraft(shared.design)) !== JSON.stringify(draft.toDraft(shared.original));

/** The shared view session storage kept, read as a shared design; null when there is none or it does not fit. */
export function readShared<T>(draft: PageDraft<T>): SharedDesign<T> | null {
  const raw = readSessionJson<unknown>(draft.sharedKey, null);
  if (typeof raw !== "object" || raw === null) return null;
  try {
    const design = draft.fromDraft(Reflect.get(raw, "design"));
    const original = draft.fromDraft(Reflect.get(raw, "original"));
    return design && original ? { design, original } : null;
  } catch {
    return null;
  }
}

/** The shared view as session storage keeps it. */
const sharedDocument = <T>(draft: PageDraft<T>, shared: SharedDesign<T>) => ({
  design: draft.toDraft(shared.design),
  original: draft.toDraft(shared.original),
});

/**
 * Calls `write` with `value` `DRAFT_WRITE_MS` after its last change, and at once when the page is left (a reload inside
 * the delay would lose the last change). Nothing is written while `value` is the same one.
 */
export function useDelayedWrite<V>(value: V, write: (value: V) => void) {
  /** the value waiting to be written; null when what is stored is current */
  const pending = useRef<{ value: V } | null>(null);
  const flush = () => {
    if (!pending.current) return;
    const { value: latest } = pending.current;
    pending.current = null;
    try {
      write(latest);
    } catch {
      // a value that cannot be written is skipped; the page goes on
    }
  };
  useEffect(() => {
    pending.current = { value };
    const timer = setTimeout(flush, DRAFT_WRITE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
}

/** What a page does with a shared view: show a link's design in place of its own, and go back. */
export interface SharedMode<T> {
  /** whether a shared design shows (true), or the page's own design does (false) */
  active: boolean;
  /** shows `design` in place of the page's own (which stays, and stays in the draft) */
  open: (design: T) => void;
  /** back to the page's own design */
  close: () => void;
  /** whether the shared design was changed since it opened (or was last saved as a copy) */
  changed: () => boolean;
  /** closes the shared view after a copy saved: `copy` (the saved copy, with its new ids) becomes the page's own design */
  keep: (copy: T) => void;
  /** one edit of the page's own design, even while a shared design shows in its place */
  editOwn: (edit: (own: T) => T) => void;
}

/**
 * `useState` for a page's working design: it starts from the draft the browser kept (`readDraft`), and every change is
 * written back `DRAFT_WRITE_MS` after the last one (at once when the page is left). Storage that is empty or throws
 * leaves the page on its empty design, working as usual.
 *
 * It also holds a shared view (`SharedMode`): a design a link opened, shown and edited in place of the page's own. The
 * draft is the page's own design only, so a shared view never writes it. The shared view goes to session storage under
 * its own key, so a reload keeps it.
 */
export function usePageDraft<T>(
  draft: PageDraft<T>,
): [T, Dispatch<SetStateAction<T>>, SharedMode<T>] {
  const [state, setState] = useState<DraftState<T>>(() => ({
    own: readDraft(draft),
    shared: readShared(draft),
  }));
  useDelayedWrite(state.own, (own) => writeStoredJson(draft.key, draft.toDraft(own)));
  useDelayedWrite(state.shared, (shared) => {
    if (shared) writeSessionJson(draft.sharedKey, sharedDocument(draft, shared));
    else removeSession(draft.sharedKey);
  });
  const shown = state.shared ? state.shared.design : state.own;
  const shared: SharedMode<T> = {
    active: state.shared !== null,
    open: (design) => setState((s) => withShared(s, design)),
    close: () => setState(withoutShared),
    changed: () => (state.shared ? sharedChanged(draft, state.shared) : false),
    keep: (copy) => setState(withCopyKept(copy)),
    editOwn: (edit) => setState((s) => ({ ...s, own: edit(s.own) })),
  };
  // stable, as `useState`'s setter is: pages hand it on to the optimizer
  const setDesign = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => setState((s) => withEdit(s, next)),
    [],
  );
  return [shown, setDesign, shared];
}
