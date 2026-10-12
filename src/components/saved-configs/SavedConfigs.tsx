import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/TextField";
import { useState } from "react";
import type { ConfigStore } from "./useConfigStore";
import type { SavedConfig, SavedConfigData } from "../../types";
import { FONT } from "../../styles/fonts";
import { PAGE_WIDTH, RESULT_MAX_WIDTH } from "../../styles/layout";

interface Props {
  store: ConfigStore;
  /** what to save; may include a `summary` line */
  snapshot: () => SavedConfigData;
  restore: (config: SavedConfig) => void;
  /** shown beside Sign out */
  extra?: React.ReactNode;
  /** a plain div instead of the page-width section */
  bare?: boolean;
  /** the name a save takes, where the page names its design itself (the Speaker page): then no name box shows */
  saveName?: string;
  /** the library's actions on the picked one too: save over it, rename, duplicate (the Speaker page's speakers) */
  manage?: boolean;
}

/** The name a duplicate takes. */
const copyName = (name: string) => `${name} (copy)`;

/** Name-and-save row plus a menu of saved setups. snapshot() returns what to store (may include a `summary` line); restore(c) loads one. */
export function SavedConfigs({
  store,
  snapshot,
  restore,
  extra,
  bare = false,
  saveName,
  manage = false,
}: Props) {
  const { db, saved, fb, fbUser, cfgMsg, signIn, signOut, save, remove } = store;
  const [name, setName] = useState("");
  const [sel, setSel] = useState("");
  /** the new name typed while renaming the picked one; null when not renaming */
  const [newName, setNewName] = useState<string | null>(null);
  /** whether the row asks to confirm Save over (an inline step: a browser dialog can be blocked in the artifact host) */
  const [confirming, setConfirming] = useState(false);
  if (saved === null) return null;
  const cur = saved.find((c) => c.id === sel);
  const nameToSave = (saveName ?? name).trim();
  const doSave = async () => {
    if (manage) {
      // the library: the new one is picked, so its own actions (save over, rename) act on it
      const id = await store.create(nameToSave, snapshot());
      if (id) setSel(id);
      setNewName(null);
      setConfirming(false);
    } else if (await save(nameToSave, snapshot())) setName("");
  };
  /** the picked one's data replaced by the current design, its name kept (after the row's confirm step) */
  const doSaveOver = (target: SavedConfig) => {
    setConfirming(false);
    void store.overwrite(target.id, target.name, snapshot()); // `overwrite` shows its own failure message
  };
  const doRename = async () => {
    if (cur && newName?.trim() && (await store.rename(cur, newName.trim()))) setNewName(null);
  };
  const Wrap = bare ? "div" : "section";
  const namePrompt = "Name this setup";
  return (
    <Wrap
      className={bare ? `${RESULT_MAX_WIDTH} mb-3` : `${PAGE_WIDTH} pb-2`}
      style={{ fontFamily: FONT }}
    >
      <Card pad="lg" tone="tint">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500 mr-1">Saved configurations</span>
          {db ? (
            <>
              {saveName === undefined && (
                <TextField
                  ariaLabel={namePrompt}
                  value={name}
                  onChange={setName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void doSave(); // `save` shows its own failure message
                  }}
                  placeholder={namePrompt}
                  maxLength={60}
                  className="py-1.5 w-56"
                />
              )}
              <Button variant="dark" onClick={doSave} disabled={!nameToSave}>
                {saveName === undefined ? "Save current" : "Save as new"}
              </Button>
              {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
              {fbUser && (
                <span className="ml-auto flex items-center gap-3 text-xs text-stone-500">
                  {extra}
                  <button onClick={signOut} className="hover:underline">
                    Sign out
                  </button>
                </span>
              )}
            </>
          ) : fb ? (
            <>
              <Button
                variant="dark"
                onClick={signIn}
                // start fetching Firebase as soon as the pointer or focus heads here: the sign-in popup must open soon
                // after the click or browsers block it
                onPointerEnter={fb.prefetch}
                onFocus={fb.prefetch}
                onTouchStart={fb.prefetch}
              >
                Sign in with Google to save
              </Button>
              {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
            </>
          ) : (
            <span className="text-xs text-stone-500">
              Saving is unavailable in this view. Everything else works.
            </span>
          )}
        </div>
        {saved.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={cur ? cur.id : ""}
              aria-label="Load a saved configuration"
              onChange={(e) => {
                const c = saved.find((x) => x.id === e.target.value);
                setSel(e.target.value);
                setNewName(null);
                setConfirming(false);
                if (c) restore(c);
              }}
              className="px-2 py-1.5 rounded border border-stone-300 bg-panel text-sm min-w-0 max-w-full flex-1"
            >
              <option value="" disabled>
                Load a saved configuration ({saved.length})…
              </option>
              {saved.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.savedAt
                    ? ` · ${new Date(c.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                    : ""}
                </option>
              ))}
            </select>
            {cur && manage && newName === null && confirming && (
              <>
                <span className="text-sm">Replace “{cur.name}” with this design?</span>
                <Button size="xs" variant="dark" onClick={() => doSaveOver(cur)}>
                  Yes
                </Button>
                <Button size="xs" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            )}
            {cur && manage && newName === null && !confirming && (
              <>
                <Button
                  size="xs"
                  onClick={() => setConfirming(true)}
                  aria-label={`Save over ${cur.name}`}
                >
                  Save over
                </Button>
                <Button size="xs" onClick={() => setNewName(cur.name)}>
                  Rename
                </Button>
                <Button size="xs" onClick={() => void store.duplicate(cur, copyName(cur.name))}>
                  Duplicate
                </Button>
              </>
            )}
            {cur && manage && newName !== null && (
              <>
                <TextField
                  ariaLabel={`New name for ${cur.name}`}
                  value={newName}
                  onChange={setNewName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void doRename(); // `rename` shows its own failure message
                    if (e.key === "Escape") setNewName(null);
                  }}
                  maxLength={60}
                  className="py-1 w-48 max-w-full"
                />
                <Button size="xs" variant="dark" onClick={doRename} disabled={!newName.trim()}>
                  Rename
                </Button>
                <Button size="xs" onClick={() => setNewName(null)}>
                  Cancel
                </Button>
              </>
            )}
            {cur && (
              <button
                onClick={() => {
                  void remove(cur.id); // `remove` shows its own failure message
                  setSel("");
                  setNewName(null);
                  setConfirming(false);
                }}
                aria-label={`Delete ${cur.name}`}
                className="text-xs text-stone-500 hover:text-red-700 px-1"
              >
                Delete
              </button>
            )}
            {cur && cur.summary && (
              <div className="basis-full text-xs text-stone-500 truncate">{cur.summary}</div>
            )}
          </div>
        )}
      </Card>
    </Wrap>
  );
}
