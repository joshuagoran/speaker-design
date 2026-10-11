import { useDeferredValue, useMemo, useState } from "react";
import { useConfigStore } from "../../components/saved-configs/useConfigStore";
import { speakerResponse } from "../../lib/speaker/speakerResponse";
import { EMPTY_SPEAKER } from "../../lib/defaults";
import { DESIGNER_START_SPEAKER_NAMES } from "../../constants/designer";
import { SPEAKERS_COLLECTION } from "../../constants/speakerSpec";
import { speakerSummary } from "./designerText";
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
  name: DESIGNER_START_SPEAKER_NAMES.empty,
  ...EMPTY_SPEAKER,
});

/** What the library's row says when a document holds no speaker. */
const MISSING_SPEAKER_TEXT = "That save holds no speaker";

/**
 * Whether a library document's `speaker` reads as a spec: an object with a cabinet of chambers and a list of bands.
 * Its fields are trusted from there: `snapshot` wrote them.
 */
function isSavedSpeaker(value: unknown): value is SavedSpeakerData["speaker"] {
  if (typeof value !== "object" || value === null) return false;
  const cabinet: unknown = Reflect.get(value, "cabinet");
  return (
    typeof cabinet === "object" &&
    cabinet !== null &&
    Array.isArray(Reflect.get(cabinet, "chambers")) &&
    Array.isArray(Reflect.get(value, "bands"))
  );
}

/** A list with item `i` replaced by `edit(item)`. */
const editAt = <T>(list: readonly T[], i: number, edit: (item: T) => T): T[] =>
  list.map((item, k) => (k === i ? edit(item) : item));

/**
 * The Designer's state: the speaker being designed, its response, the edits the settings make and the library (the
 * signed-in user's `speakers`). Held in App, so the design survives switching pages.
 */
export function useDesigner() {
  const [spec, setSpec] = useState<SpeakerSpec>(emptySpeaker);
  // the model reads only the cabinet and the bands (a name edit doesn't run it), a step behind the typing: a horn
  // chamber takes tens of ms, so the settings stay responsive
  const cabinet = useDeferredValue(spec.cabinet);
  const bands = useDeferredValue(spec.bands);
  const response = useMemo(() => speakerResponse({ cabinet, bands }), [cabinet, bands]);
  const store = useConfigStore(SPEAKERS_COLLECTION);
  const editCabinet = (edit: (cabinet: SpeakerCabinet) => SpeakerCabinet) =>
    setSpec((s) => ({ ...s, cabinet: edit(s.cabinet) }));
  const editChambers = (edit: (chambers: readonly SpeakerChamber[]) => SpeakerChamber[]) =>
    editCabinet((c) => ({ ...c, chambers: edit(c.chambers) }));
  const editChamber = (i: number, edit: (chamber: SpeakerChamber) => SpeakerChamber) =>
    editChambers((list) => editAt(list, i, edit));
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
  /** gives a band another id; its drivers follow */
  const renameBand = (from: BandId, to: BandId) =>
    setSpec((s) => ({
      ...s,
      cabinet: moveDrivers(s, from, to),
      bands: s.bands.map((b) => (b.id === from ? { ...b, id: to } : b)),
    }));
  /** removes a band; its drivers move to the first band left */
  const removeBand = (id: BandId) =>
    setSpec((s) => {
      const bands = s.bands.filter((b) => b.id !== id);
      return bands.length ? { ...s, cabinet: moveDrivers(s, id, bands[0].id), bands } : s;
    });
  /** what the library saves: the spec without its id and name, undefined fields dropped (the stores reject them) */
  const snapshot = (): SavedSpeakerData => {
    const { id: _id, name: _name, ...speaker } = spec;
    return JSON.parse(JSON.stringify({ summary: speakerSummary(spec), speaker }));
  };
  /** opens a saved speaker: the document's id and name, and its spec */
  const restore = (c: SavedConfig) => {
    const saved: unknown = Reflect.get(c, "speaker");
    // a document without a speaker (written elsewhere): left closed, with a word on the library's row
    if (!isSavedSpeaker(saved)) {
      store.flash(MISSING_SPEAKER_TEXT);
      return;
    }
    setSpec({ ...saved, id: c.id, name: c.name });
  };
  return {
    spec,
    setSpec,
    response,
    store,
    snapshot,
    restore,
    setName: (name: string) => setSpec((s) => ({ ...s, name })),
    editCabinet,
    editChambers,
    editChamber,
    editDriver,
    editBands,
    editBand,
    renameBand,
    removeBand,
  };
}

/** What `useDesigner` returns. */
export type Designer = ReturnType<typeof useDesigner>;
