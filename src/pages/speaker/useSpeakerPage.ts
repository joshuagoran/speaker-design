import { useDeferredValue, useMemo, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { speakerResponse } from "../../lib/speaker/speakerResponse";
import { speakerLimits } from "../../lib/speaker/speakerLimits";
import { cabinetBuild } from "../../lib/speaker/speakerBuild";
import { settledCabinet } from "../../lib/speaker/speakerLayout";
import {
  AUTO_BALANCE_TILT,
  autoBalanceSpeaker,
  withSpeakerLevels,
} from "../../lib/speaker/autoBalance";
import {
  AUTO_BALANCE_MODE,
  AUTO_BALANCE_STATUS,
  type AutoBalanceMode,
} from "../../constants/autoBalance";
import { DEFAULT_SPEAKER_BAND, EMPTY_SPEAKER } from "../../lib/defaults";
import { SPEAKER_START_SPEAKER_NAMES } from "../../constants/speakerStarts";
import { CABINET_TOP, SPEAKERS_COLLECTION } from "../../constants/speakerSpec";
import { allBox } from "./settingsSummaries";
import { speakerSummary } from "./speakerText";
import { usePageDraft, type PageDraft } from "../../hooks/usePageDraft";
import { PAGE_DRAFT_KEYS } from "../../constants/pageDrafts";
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
} from "../../types";

/** The id a design has until the library saves it (then it takes the document's). */
export const DRAFT_SPEAKER_ID = "draft";

/** The empty speaker, named as a new one. */
export const emptySpeaker = (): SpeakerSpec => ({
  id: DRAFT_SPEAKER_ID,
  name: SPEAKER_START_SPEAKER_NAMES.empty,
  ...EMPTY_SPEAKER,
});

/** What the library's row says when a document holds no speaker. */
const MISSING_SPEAKER_TEXT = "That save holds no speaker";

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
  empty: emptySpeaker,
  toDraft: (spec) => draftDocument(speakerSnapshot(spec), spec),
  fromDraft: (raw) => {
    const doc = asDraftDocument(raw);
    return doc && speakerFromSaved(doc);
  },
};

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
  const [spec, setSpec] = usePageDraft(speakerDraft);
  /**
   * how many times the chamber list was replaced (a start, a saved speaker opened) or lost a chamber: each chamber's
   * settings take it with their index as their key, so no settings state carries over to another chamber
   */
  const [chamberRound, setChamberRound] = useState(0);
  /** the whole spec replaced: every chamber's settings start again, and the optimizer's cards and Undo are dropped */
  const replaceSpec = (next: SpeakerSpec) => {
    setSpec(settledSpec(next));
    setChamberRound((n) => n + 1);
    // called from an event, after `optimizer` below is set
    optimizer.clearResults();
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
  // the band Levels auto balance sets, flat or with the PA music tilt, from the same response (lib/speaker/autoBalance)
  const [balanceMode, setBalanceMode] = useState<AutoBalanceMode>(AUTO_BALANCE_MODE.flat);
  const balance = useMemo(
    () =>
      autoBalanceSpeaker({ cabinet, bands, input: feed }, response, AUTO_BALANCE_TILT[balanceMode]),
    [cabinet, bands, feed, response, balanceMode],
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
    // a document without a speaker (written elsewhere): left closed, with a word on the library's row
    if (!saved) {
      store.flash(MISSING_SPEAKER_TEXT);
      return;
    }
    replaceSpec(saved);
  };
  return {
    spec,
    setSpec: replaceSpec,
    /** chamber `i`'s settings key: its index in this chamber list */
    chamberKey: (i: number) => `${chamberRound}:${i}`,
    response,
    limits,
    balance,
    balanceMode,
    setBalanceMode,
    /**
     * sets the band Levels auto balance gives: one band edit, as any other. Worked out from the spec as it is now, since
     * `balance` reads the deferred values, which can lag a step behind an edit.
     */
    applyBalance: () => {
      const current = { cabinet: spec.cabinet, bands: spec.bands, input: spec.input };
      const now =
        current.cabinet === cabinet && current.bands === bands && current.input === feed
          ? balance
          : autoBalanceSpeaker(
              current,
              speakerResponse(current, { feed: current.input }),
              AUTO_BALANCE_TILT[balanceMode],
            );
      if (now.status === AUTO_BALANCE_STATUS.balanced)
        setSpec((s) => withSpeakerLevels(s, now.levels));
    },
    build,
    price,
    optimizer,
    store,
    snapshot,
    restore,
    setName: (name: string) => setSpec((s) => ({ ...s, name })),
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
