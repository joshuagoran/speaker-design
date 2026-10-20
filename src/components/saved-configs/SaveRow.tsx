import { useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { RowSelect } from "../ui/RowSelect";
import type { SelectOption } from "../ui/SelectField";
import { SAVE_ROW_TEXT, type SaveRowWords } from "../../constants/saveRow";
import { RESULT_MAX_WIDTH } from "../../styles/layout";
import type { ConfigStore } from "./useConfigStore";
import { deleteSave, openSave, saveDesign, saveDesignAs } from "./saveActions";
import type { SavedConfig, SavedConfigData } from "../../types";

interface Props<T extends SelectOption> {
  store: ConfigStore;
  /** what a save stores */
  snapshot: () => SavedConfigData;
  /** opens a saved design: the design takes the save's id, so it is open in that save */
  restore: (config: SavedConfig) => void;
  /** the design's name, which a save takes */
  name: string;
  onName: (name: string) => void;
  /** the id of the save the design is open in: the design's own id (a new design's is a draft id, which no save has) */
  openId: string;
  /** sets the save the design is open in; null: none */
  onOpenId: (id: string | null) => void;
  /** the nouns that name the page's designs */
  words: SaveRowWords;
  /** the starts "New from…" lists, each under its group, and the call that replaces the design with one (a new design) */
  starts: readonly T[];
  group: (start: T) => string;
  onStart: (start: T) => void;
}

/** The longest name a design takes. */
const NAME_MAX = 60;

/**
 * A results pane's top row (the Speaker, Stack, and Space pages'): the design's name; Save (into the save the design is
 * open in, or a new one); Save as (always a new one); the saved designs and Open; and "New from…" (a start, which
 * replaces this design). A picked saved design also takes Rename, Duplicate, and Delete on a second line.
 */
export function SaveRow<T extends SelectOption>({
  store,
  snapshot,
  restore,
  name,
  onName,
  openId,
  onOpenId,
  words,
  starts,
  group,
  onStart,
}: Props<T>) {
  const { db, saved, fb, fbUser, cfgMsg, signIn, signOut } = store;
  /** the save picked in the list; "" shows the open one */
  const [sel, setSel] = useState("");
  /** the new name typed while renaming the picked one; null when not renaming */
  const [newName, setNewName] = useState<string | null>(null);
  /** whether the row asks to confirm Delete (an inline step: a browser dialog can be blocked in the artifact host) */
  const [confirming, setConfirming] = useState(false);
  const list = saved ?? [];
  const open = openSave(saved, openId);
  const cur = list.find((c) => c.id === (sel || openId));
  const trimmed = name.trim();
  const reset = () => {
    setNewName(null);
    setConfirming(false);
  };
  // each action shows its own failure message (the store's)
  const doSave = async () => {
    const id = await saveDesign(store, openId, trimmed, snapshot());
    if (id) {
      onOpenId(id);
      setSel(id);
    }
    reset();
  };
  const doSaveAs = async () => {
    const made = await saveDesignAs(store, trimmed, snapshot());
    if (made) {
      onName(made.name);
      onOpenId(made.id);
      setSel(made.id);
    }
    reset();
  };
  const doRename = async () => {
    const to = newName?.trim();
    if (!cur || !to || !(await store.rename(cur, to))) return;
    // the open save renamed: the design takes the name, so the next Save keeps it
    if (cur.id === openId) onName(to);
    setNewName(null);
  };
  const doDelete = async (target: SavedConfig) => {
    setSel("");
    reset();
    if (await deleteSave(store, target.id, openId)) onOpenId(null);
  };
  /** each saved design as the list shows it: its name and the day it was saved */
  const savedOptions = list.map((c) => ({
    id: c.id,
    name: c.savedAt
      ? `${c.name} · ${new Date(c.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : c.name,
  }));
  return (
    <div
      role="group"
      aria-label={SAVE_ROW_TEXT.row}
      className={`${RESULT_MAX_WIDTH} flex flex-col gap-2`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TextField
          ariaLabel={words.namePlaceholder}
          placeholder={words.namePlaceholder}
          value={name}
          onChange={onName}
          onKeyDown={(e) => {
            if (e.key === "Enter" && db && trimmed) void doSave();
          }}
          maxLength={NAME_MAX}
          className="py-2 w-56 max-w-full"
        />
        {db ? (
          <>
            <Button
              variant="primary"
              onClick={doSave}
              disabled={!trimmed}
              title={SAVE_ROW_TEXT.saveTip(open && open.name)}
            >
              {SAVE_ROW_TEXT.save}
            </Button>
            <Button onClick={doSaveAs} disabled={!trimmed} title={SAVE_ROW_TEXT.saveAsTip}>
              {SAVE_ROW_TEXT.saveAs}
            </Button>
            <RowSelect
              ariaLabel={words.savedList}
              options={savedOptions}
              value={cur ? cur.id : ""}
              onChange={(o) => {
                setSel(o.id);
                reset();
              }}
              prompt={list.length ? words.pick(list.length) : words.noSaved}
              disabled={!list.length}
              className="min-w-0 max-w-full w-56"
            />
            <Button
              onClick={() => {
                if (cur) restore(cur);
                reset();
              }}
              disabled={!cur}
            >
              {SAVE_ROW_TEXT.open}
            </Button>
          </>
        ) : fb ? (
          <Button
            variant="primary"
            onClick={signIn}
            // start fetching Firebase as soon as the pointer or focus heads here: the sign-in popup must open soon
            // after the click or browsers block it
            onPointerEnter={fb.prefetch}
            onFocus={fb.prefetch}
            onTouchStart={fb.prefetch}
          >
            {SAVE_ROW_TEXT.signIn}
          </Button>
        ) : (
          saved !== null && (
            <span className="text-xs text-stone-500">{SAVE_ROW_TEXT.unavailable}</span>
          )
        )}
        <RowSelect
          ariaLabel={SAVE_ROW_TEXT.newFrom}
          title={words.newFromTip}
          options={starts}
          value=""
          onChange={onStart}
          group={group}
          prompt={SAVE_ROW_TEXT.newFromPrompt}
          className="min-w-0 max-w-full w-56"
        />
        {cfgMsg && <span className="text-xs text-stone-500">{cfgMsg}</span>}
        {fbUser && (
          <button onClick={signOut} className="ml-auto text-xs text-stone-500 hover:underline">
            {SAVE_ROW_TEXT.signOut}
          </button>
        )}
      </div>
      {cur && db && (
        <div className="flex flex-wrap items-center gap-2">
          {newName === null && confirming && (
            <>
              <span className="text-sm">{SAVE_ROW_TEXT.confirmDelete(cur.name)}</span>
              <Button size="xs" variant="primary" onClick={() => void doDelete(cur)}>
                {SAVE_ROW_TEXT.yes}
              </Button>
              <Button size="xs" onClick={() => setConfirming(false)}>
                {SAVE_ROW_TEXT.cancel}
              </Button>
            </>
          )}
          {newName === null && !confirming && (
            <>
              <Button size="xs" onClick={() => setNewName(cur.name)}>
                {SAVE_ROW_TEXT.rename}
              </Button>
              <Button
                size="xs"
                onClick={() => void store.duplicate(cur, SAVE_ROW_TEXT.copyName(cur.name))}
              >
                {SAVE_ROW_TEXT.duplicate}
              </Button>
              <button
                onClick={() => setConfirming(true)}
                aria-label={SAVE_ROW_TEXT.deleteLabel(cur.name)}
                className="text-xs text-stone-500 hover:text-red-700 px-1"
              >
                {SAVE_ROW_TEXT.delete}
              </button>
            </>
          )}
          {newName !== null && (
            <>
              <TextField
                ariaLabel={SAVE_ROW_TEXT.renameLabel(cur.name)}
                value={newName}
                onChange={setNewName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doRename();
                  if (e.key === "Escape") setNewName(null);
                }}
                maxLength={NAME_MAX}
                className="py-1 w-48 max-w-full"
              />
              <Button size="xs" variant="primary" onClick={doRename} disabled={!newName.trim()}>
                {SAVE_ROW_TEXT.rename}
              </Button>
              <Button size="xs" onClick={() => setNewName(null)}>
                {SAVE_ROW_TEXT.cancel}
              </Button>
            </>
          )}
          {cur.summary && (
            <div className="basis-full text-xs text-stone-500 truncate">{cur.summary}</div>
          )}
        </div>
      )}
    </div>
  );
}
