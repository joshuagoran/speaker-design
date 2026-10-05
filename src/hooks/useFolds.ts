import { useStoredStateFrom } from "./useStoredState";

/** A panel's fold sections: which are open, by id, and the ways to change that. */
export interface Folds<Id extends string> {
  open: Record<Id, boolean>;
  toggle: (id: Id) => void;
  /** opens (true) or folds (false) every section: Expand all / Collapse all */
  setAll: (open: boolean) => void;
}

/**
 * Fold sections that start open and are remembered per viewer under `key` (a per-browser convenience: without storage
 * they start open each visit). A section a stored value doesn't name starts open.
 */
export function useFolds<Id extends string>(key: string, ids: readonly Id[]): Folds<Id> {
  const all = (v: boolean) => Object.fromEntries(ids.map((id) => [id, v])) as Record<Id, boolean>; // boundary cast: the entries are exactly `ids`
  const [open, setOpen] = useStoredStateFrom<Record<Id, boolean>, Partial<Record<Id, boolean>>>(
    key,
    {},
    (stored) => ({ ...all(true), ...stored }),
  );
  return {
    open,
    toggle: (id) => setOpen((o) => ({ ...o, [id]: !o[id] })),
    setAll: (v) => setOpen(all(v)),
  };
}
