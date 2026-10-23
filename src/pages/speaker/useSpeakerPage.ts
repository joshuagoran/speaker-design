import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { speakerResponse } from "../../lib/speaker/speakerResponse";
import { speakerLimits } from "../../lib/speaker/speakerLimits";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { settledCabinet } from "../../lib/speaker/speakerLayout";
import { autoBalanceSpeaker, withSpeakerLevels } from "../../lib/speaker/autoBalance";
import { AUTO_BALANCE_STATUS } from "../../constants/autoBalance";
import { DEFAULT_SPEAKER_BAND, EMPTY_SPEAKER } from "../../lib/defaults";
import { SPEAKER_START_SPEAKER_NAMES } from "../../constants/speakerStarts";
import { CABINET_TOP, SPEAKERS_COLLECTION } from "../../constants/speakerSpec";
import { allBox } from "./settingsSummaries";
import { speakerSummary } from "./speakerText";
import { usePageDraft, type PageDraft, type SharedMode } from "../../hooks/usePageDraft";
import { PAGE_DRAFT_KEYS, PAGE_SHARED_KEYS, STACK_EDIT_KEY } from "../../constants/pageDrafts";
import { readSessionJson, removeSession, writeSessionJson } from "../../lib/storage";
import { DRAFT_ID } from "../../constants/saveRow";
import { asDraftDocument, draftDocument } from "../../lib/savedDraft";
import { speakerPrice } from "../../lib/speaker/speakerTotals";
import { readSavedSpeaker } from "../../lib/speaker/speakerSaves";
import { autoBandName, withAutoNames } from "../../lib/speaker/bandNames";
import { useSpeakerOptimizer } from "./useSpeakerOptimizer";
import type {
  BandId,
  SavedConfig,
  SavedSpeakerData,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerSpec,
  StackSpeakerEdit,
} from "../../types";

/** The id a design has until the library saves it (then it takes the document's). */
export const DRAFT_SPEAKER_ID = DRAFT_ID;

/** The empty speaker, named as a new one. */
export const emptySpeaker = (): SpeakerSpec => ({
  id: DRAFT_SPEAKER_ID,
  name: SPEAKER_START_SPEAKER_NAMES.empty,
  ...EMPTY_SPEAKER,
});

/** What the library saves: the spec without its id and name, undefined fields dropped (the stores reject them). */
export function speakerSnapshot(spec: SpeakerSpec): SavedSpeakerData {
  const { id: _id, name: _name, ...speaker } = spec;
  return JSON.parse(JSON.stringify({ summary: speakerSummary(spec), speaker }));
}

/** A saved speaker opened: the document's id and name, and its spec; null for a document that holds no speaker. */
export function speakerFromSaved(c: SavedConfig): SpeakerSpec | null {
  const saved: unknown = Reflect.get(c, "speaker");
  const read = readSavedSpeaker(saved);
  return read && { ...read, id: c.id, name: c.name };
}

/** The Speaker page's working design in the browser: the save document, with the speaker's id and name. */
export const speakerDraft: PageDraft<SpeakerSpec> = {
  key: PAGE_DRAFT_KEYS.speaker,
  sharedKey: PAGE_SHARED_KEYS.speaker,
  empty: emptySpeaker,
  toDraft: (spec) => draftDocument(speakerSnapshot(spec), spec),
  fromDraft: (raw) => {
    const doc = asDraftDocument(raw);
    return doc && speakerFromSaved(doc);
  },
};

/** A Stack's speaker open on the Speaker page for an edit: which Stack it is for, and the speaker as edited. */
interface StackEditSlot {
  edit: StackSpeakerEdit;
  design: SpeakerSpec;
}

/** The edit for a Stack session storage kept; null when there is none or it does not fit. */
function readStackEdit(): StackEditSlot | null {
  const raw = readSessionJson<unknown>(STACK_EDIT_KEY, null);
  if (typeof raw !== "object" || raw === null) return null;
  const stackName: unknown = Reflect.get(raw, "stackName");
  const speakerId: unknown = Reflect.get(raw, "speakerId");
  if (typeof stackName !== "string" || typeof speakerId !== "string") return null;
  try {
    const design = speakerDraft.fromDraft(Reflect.get(raw, "design"));
    return design && { edit: { stackName, speakerId }, design };
  } catch {
    return null;
  }
}

/** The prefix of the ids the Speaker page gives the bands it adds. */
const NEW_BAND_ID = "band";

/** A band id no band in `bands` has: "band1", "band2", ... (the adapters' ids are words, so they never clash). */
export function newBandId(bands: readonly Pick<SpeakerBand, "id">[]): BandId {
  const used = new Set(bands.map((b) => b.id));
  let n = 1;
  while (used.has(`${NEW_BAND_ID}${n}`)) n++;
  return `${NEW_BAND_ID}${n}`;
}

/** A list with item `i` replaced by `edit(item)`. */
const editAt = <T>(list: readonly T[], i: number, edit: (item: T) => T): T[] =>
  list.map((item, k) => (k === i ? edit(item) : item));

/**
 * The cabinet with a flat top once a chamber is a horn: an arched top is for speakers of Box chambers only, so the
 * setting goes away with nothing left behind it. The same cabinet back when nothing changes.
 */
export const withHornTop = (cabinet: SpeakerCabinet): SpeakerCabinet =>
  cabinet.top !== CABINET_TOP.flat && !allBox(cabinet.chambers)
    ? { ...cabinet, top: CABINET_TOP.flat }
    : cabinet;

/** The spec with its drivers settled where the layout stands them (`settledCabinet`); the same spec back when none moves. */
const settledSpec = (s: SpeakerSpec): SpeakerSpec => {
  const cabinet = settledCabinet(s.cabinet);
  return cabinet === s.cabinet ? s : { ...s, cabinet };
};

/**
 * The Speaker page's state: the speaker being designed, its response, the edits the settings make and the library (the
 * signed-in user's `speakers`). Held in App, so the design survives switching pages.
 */
export function useSpeakerPage() {
  const [pageSpec, setPageSpec, sharedDraft] = usePageDraft(speakerDraft);
  /**
   * the edit for a Stack: a Stack's speaker shows in place of the page's design (its own, or a link's), which stays as
   * it is. It has its own slot, kept in session storage, so a reload keeps it.
   */
  const [stackEdit, setStackEditState] = useState(readStackEdit);
  /** the edit open now (its Stack and design), read by the setters below (stable) and after a save resolves */
  const openEdit = useRef(stackEdit);
  /**
   * opens, changes or ends the edit for a Stack. Session storage takes it in the same step, so a reload never finds a
   * page that has moved on from the edit it kept.
   */
  const setStackEdit = useCallback((slot: StackEditSlot | null) => {
    openEdit.current = slot;
    try {
      if (slot)
        writeSessionJson(STACK_EDIT_KEY, {
          ...slot.edit,
          design: speakerDraft.toDraft(slot.design),
        });
      else removeSession(STACK_EDIT_KEY);
    } catch {
      // an edit that cannot be kept stays on the page; a reload then loses it
    }
    setStackEditState(slot);
  }, []);
  const spec = stackEdit ? stackEdit.design : pageSpec;
  /** edits the design shown: the edit for a Stack while one is open */
  const setSpec = useCallback((next: SetStateAction<SpeakerSpec>) => {
    const slot = openEdit.current;
    if (!slot) return setPageSpec(next);
    setStackEdit({ ...slot, design: typeof next === "function" ? next(slot.design) : next });
  }, []);
  /**
   * how many times the chamber list was replaced (a start, a saved speaker opened) or lost a chamber: each chamber's
   * settings take it with their index as their key, so no settings state carries over to another chamber
   */
  const [chamberRound, setChamberRound] = useState(0);
  /** the whole spec replaced: every chamber's settings start again, and the optimizer's cards and Undo are dropped */
  const restart = () => {
    setChamberRound((n) => n + 1);
    // called from an event, after `optimizer` below is set
    optimizer.clearResults();
  };
  const replaceSpec = (next: SpeakerSpec) => {
    setSpec(settledSpec(next));
    restart();
  };
  /** ends the edit for a Stack: the page shows its design again */
  const endStackEdit = () => {
    if (!openEdit.current) return;
    setStackEdit(null);
    restart();
  };
  /** the shared view: a link's speaker shows in place of the page's own, and the page starts over with each switch */
  const sharedView: SharedMode<SpeakerSpec> = {
    ...sharedDraft,
    open: (next) => {
      // a link opened: it shows, in place of an edit for a Stack
      endStackEdit();
      sharedDraft.open(settledSpec(next));
      restart();
    },
    close: () => {
      sharedDraft.close();
      restart();
    },
  };
  /** a Stack's speaker on the page for an edit, in place of the page's design (`stackEdit`) */
  const stackEditView = {
    /** the Stack it is for; null while the page shows its own design or a link's */
    edit: stackEdit?.edit ?? null,
    /** whether `edit` is still the edit open */
    isOpen: (edit: StackSpeakerEdit) => openEdit.current?.edit === edit,
    /** shows a Stack's `speaker` for an edit */
    open: (speaker: SpeakerSpec, edit: StackSpeakerEdit) => {
      setStackEdit({ edit, design: settledSpec(speaker) });
      restart();
    },
    /** back to the page's design (its own, or a link's) */
    close: endStackEdit,
    /**
     * gives the page's own design the draft id where it has `id`: a save the edit wrote over, so a later Save from the own
     * design makes a new save
     */
    detachOwn: (id: SpeakerSpec["id"]) =>
      sharedDraft.editOwn((own) => (own.id === id ? { ...own, id: DRAFT_SPEAKER_ID } : own)),
  };
  // the model reads only the cabinet, the bands and the input range (a name edit doesn't run it), a step behind the
  // typing: a horn chamber takes tens of ms, so the settings stay responsive
  const cabinet = useDeferredValue(spec.cabinet);
  const bands = useDeferredValue(spec.bands);
  /** the input range: the filters the system puts ahead of the box, the models' feed */
  const feed = useDeferredValue(spec.input);
  const response = useMemo(
    () => speakerResponse({ cabinet, bands }, { feed }),
    [cabinet, bands, feed],
  );
  // the limits read the response's chamber runs, so no box model runs again
  const limits = useMemo(
    () => speakerLimits({ cabinet, bands }, response, { feed }),
    [cabinet, bands, feed, response],
  );
  // the band Gains and Pads Calculate gains sets, flat, from the same response (lib/speaker/autoBalance)
  const balance = useMemo(
    () => autoBalanceSpeaker({ cabinet, bands, input: feed }, response),
    [cabinet, bands, feed, response],
  );
  // each chamber's braces, hardware and weight (the response's net air reads the same build)
  const build = useMemo(() => cabinetBuild(cabinet), [cabinet]);
  const store = useConfigStore(SPEAKERS_COLLECTION);
  // the optimizer reads and loads the whole spec (a card keeps the id and name); its locks start over when the chamber
  // list is replaced, its cards and Undo when the whole spec is (replaceSpec)
  const price = useMemo(() => speakerPrice(spec.cabinet), [spec.cabinet]);
  const optimizer = useSpeakerOptimizer({
    spec,
    loadSpec: (next) => setSpec(settledSpec(next)),
    round: chamberRound,
    current: { musicDb: limits.musicDb, price: price.dollars, lb: build.lb },
  });
  // every edit settles the drivers: a position that would leave the baffle, or overlap another driver or opening, is kept
  // where the layout stands it (the settings, the views and the cutlist then agree)
  const editCabinet = (edit: (cabinet: SpeakerCabinet) => SpeakerCabinet) =>
    setSpec((s) => ({ ...s, cabinet: settledCabinet(withHornTop(edit(s.cabinet))) }));
  const editChambers = (edit: (chambers: readonly SpeakerChamber[]) => SpeakerChamber[]) =>
    editCabinet((c) => ({ ...c, chambers: edit(c.chambers) }));
  const editChamber = (i: number, edit: (chamber: SpeakerChamber) => SpeakerChamber) =>
    editChambers((list) => editAt(list, i, edit));
  /** removes chamber `i`: the chambers after it move up, so every chamber's settings start again */
  const removeChamber = (i: number) => {
    editChambers((list) => list.filter((_, k) => k !== i));
    setChamberRound((n) => n + 1);
  };
  const editDriver = (chamber: number, i: number, edit: (driver: SpeakerDriver) => SpeakerDriver) =>
    editChamber(chamber, (c) => ({ ...c, drivers: editAt(c.drivers, i, edit) }));
  const editBands = (edit: (bands: readonly SpeakerBand[]) => SpeakerBand[]) =>
    setSpec((s) => ({ ...s, bands: edit(s.bands) }));
  const editBand = (i: number, edit: (band: SpeakerBand) => SpeakerBand) =>
    editBands((list) => editAt(list, i, edit));
  /** every driver's band `from` set to `to` */
  const moveDrivers = (s: SpeakerSpec, from: BandId, to: BandId): SpeakerCabinet => ({
    ...s.cabinet,
    chambers: s.cabinet.chambers.map((c) => ({
      ...c,
      drivers: c.drivers.map((d) => ({ ...d, bands: d.bands.map((b) => (b === from ? to : b)) })),
    })),
  });
  /** adds a band at the top, under a generated id; the bands the page named are renamed for the new count */
  const addBand = () =>
    editBands((list) =>
      withAutoNames([
        ...list,
        {
          id: newBandId(list),
          name: autoBandName(list.length, list.length + 1),
          ...DEFAULT_SPEAKER_BAND,
        },
      ]),
    );
  /** removes a band; its drivers move to the first band left */
  const removeBand = (id: BandId) =>
    setSpec((s) => {
      const bands = withAutoNames(s.bands.filter((b) => b.id !== id));
      return bands.length
        ? settledSpec({ ...s, cabinet: moveDrivers(s, id, bands[0].id), bands })
        : s;
    });
  /** what the library saves: the spec without its id and name, undefined fields dropped (the stores reject them) */
  const snapshot = (): SavedSpeakerData => speakerSnapshot(spec);
  /** opens a saved speaker: the document's id and name, and its spec */
  const restore = (c: SavedConfig) => {
    const saved = speakerFromSaved(c);
    // the library lists only saves that hold a speaker (`holds`)
    if (saved) replaceSpec(saved);
  };
  return {
    spec,
    sharedView,
    stackEditView,
    setSpec: replaceSpec,
    /** chamber `i`'s settings key: its index in this chamber list */
    chamberKey: (i: number) => `${chamberRound}:${i}`,
    response,
    limits,
    balance,
    /**
     * sets the band Gains and Pads Calculate gains gives: one band edit, as any other. Worked out from the spec as it is now, since
     * `balance` reads the deferred values, which can lag a step behind an edit.
     */
    applyBalance: () => {
      const current = { cabinet: spec.cabinet, bands: spec.bands, input: spec.input };
      const now =
        current.cabinet === cabinet && current.bands === bands && current.input === feed
          ? balance
          : autoBalanceSpeaker(current, speakerResponse(current, { feed: current.input }));
      if (now.status === AUTO_BALANCE_STATUS.balanced)
        setSpec((s) => withSpeakerLevels(s, now.levels));
    },
    build,
    price,
    optimizer,
    store,
    snapshot,
    /** whether a save holds a speaker: the library lists only those */
    holds: (c: SavedConfig) => speakerFromSaved(c) !== null,
    restore,
    setName: (name: string) => setSpec((s) => ({ ...s, name })),
    /** sets the save the speaker is open in, as its id; null: none (a new speaker's draft id) */
    setOpenId: (id: string | null) => setSpec((s) => ({ ...s, id: id ?? DRAFT_SPEAKER_ID })),
    editInput: (edit: (input: SpeakerSpec["input"]) => SpeakerSpec["input"]) =>
      setSpec((s) => ({ ...s, input: edit(s.input) })),
    /** sets part of the look (the cabinet finish, the baffle and horn colors) */
    editLook: (look: Partial<SpeakerSpec["look"]>) =>
      setSpec((s) => ({ ...s, look: { ...s.look, ...look } })),
    editCabinet,
    editChambers,
    editChamber,
    removeChamber,
    editDriver,
    editBands,
    editBand,
    addBand,
    removeBand,
  };
}

/** What `useSpeakerPage` returns. */
export type SpeakerPageState = ReturnType<typeof useSpeakerPage>;
