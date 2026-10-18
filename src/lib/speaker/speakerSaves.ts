// The read adapter for a saved speaker (a library save, the page's draft, a stack's or a space's copy): it brings what an
// earlier build saved up to the spec the page holds now.
//
// - Bracing and back panel were the cabinet's (`braceStyle`, `braceTargetHz`, `backJoint`): each chamber takes the
//   cabinet's old choice as its own (`SpeakerChamber.bracing`), so the design does not change.
// - Hardware was one choice (`hardware`: the handles with the input dish, or none): it reads as both on (`handles` and
//   `inputDish`). Its handles stay off where the old choice had No handles, as the dish alone was then built.
// - A Box chamber's net air could be typed in (Custom). It is now always worked out from the chamber's size, so a typed
//   value reads as worked out. A horn chamber keeps its net air: it is the horn's rear chamber.
import type {
  BoxHandles,
  ChamberBracing,
  SavedSpeakerData,
  SpeakerChamber,
  SpeakerSpec,
} from "../../types";
import {
  savedBackJoint,
  savedBraceStyle,
  DEFAULT_BACK_JOINT,
  NO_BRACING,
} from "../../constants/bracing";
import { NO_HANDLES } from "../../constants/hardware";
import { CHAMBER_LOAD } from "../../constants/speakerSpec";
import { PA_PANEL_TARGET_HZ } from "../pa/bracing";
import { savedBox } from "../pa/hardware";
import { defaultBraceStyleNear } from "../bracing";

/** A saved speaker's spec, as the library holds it (no id or name). */
type SavedSpeaker = SavedSpeakerData["speaker"];

/** The keys an earlier build saved on the cabinet, which the chambers and the split hardware now hold. */
const LEGACY_CABINET_KEYS = ["braceStyle", "braceTargetHz", "backJoint", "hardware"] as const;

/** Whether a value is an object (not null). */
const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/**
 * Whether a value reads as a saved speaker: an object with a cabinet of chambers and a list of bands. Its other fields
 * are trusted from there: the page's snapshot wrote them (`readSavedSpeaker` brings older ones up to date).
 */
export function isSavedSpeakerShape(value: unknown): value is SavedSpeaker {
  if (!isObject(value)) return false;
  const cabinet: unknown = Reflect.get(value, "cabinet");
  return (
    isObject(cabinet) &&
    Array.isArray(Reflect.get(cabinet, "chambers")) &&
    Array.isArray(Reflect.get(value, "bands"))
  );
}

/** A saved style for a chamber: a brace style or none; absent when it is neither. */
const savedChamberStyle = (s: unknown): ChamberBracing["braceStyle"] | undefined =>
  s === NO_BRACING ? NO_BRACING : savedBraceStyle(s);

/**
 * The bracing an earlier build saved on the cabinet, as each chamber now takes it: its style (the plywood's at walls
 * `t` where it saved none), its target (the PA boxes' where none) and its back joint (the default where none).
 */
function legacyBracing(cabinet: object, t: number): ChamberBracing {
  const target: unknown = Reflect.get(cabinet, "braceTargetHz");
  return {
    braceStyle: savedChamberStyle(Reflect.get(cabinet, "braceStyle")) ?? defaultBraceStyleNear(t),
    braceTargetHz:
      typeof target === "number" && Number.isFinite(target) ? target : PA_PANEL_TARGET_HZ,
    backJoint: savedBackJoint(Reflect.get(cabinet, "backJoint")) ?? DEFAULT_BACK_JOINT,
  };
}

/** The handles an earlier build's one hardware choice held: its handles where it had a model; null for none. */
function legacyHandles(hardware: unknown): BoxHandles | null {
  if (!isObject(hardware)) return null;
  const handles = savedBox(hardware, NO_HANDLE_SET);
  return handles.model === NO_HANDLES ? null : handles;
}

/** No handles: what an old hardware choice whose model doesn't read takes (its dish stays). */
const NO_HANDLE_SET: BoxHandles = { model: NO_HANDLES, upIn: 0, backIn: 0 };

/**
 * A chamber as the page holds it now: its own bracing (the cabinet's old choice, `fallback`, where it has none), and a
 * Box chamber's net air worked out (a typed value from before is dropped).
 */
function readChamber(chamber: SpeakerChamber, fallback: ChamberBracing): SpeakerChamber {
  const bracing: unknown = Reflect.get(chamber, "bracing");
  const box = chamber.load.kind === CHAMBER_LOAD.direct;
  return {
    ...chamber,
    bracing: isObject(bracing) ? chamber.bracing : fallback,
    netLiters: box ? null : chamber.netLiters,
  };
}

/**
 * A saved speaker brought up to the spec the page holds now (see the file's notes); null when the value does not read
 * as a speaker at all. A speaker saved by this build reads back unchanged, but for a Box chamber's net air.
 */
export function readSavedSpeaker(value: unknown): SavedSpeaker | null {
  if (!isSavedSpeakerShape(value)) return null;
  const { cabinet } = value;
  const t = cabinet.panel.thicknessIn;
  const fallback = legacyBracing(cabinet, t);
  /** an earlier build's one hardware choice; absent once the cabinet has the split fields */
  const split = Reflect.has(cabinet, "handles") || Reflect.has(cabinet, "inputDish");
  const hardware: unknown = Reflect.get(cabinet, "hardware");
  const current = { ...cabinet };
  for (const key of LEGACY_CABINET_KEYS) Reflect.deleteProperty(current, key);
  return {
    ...value,
    cabinet: {
      ...current,
      handles: split ? (cabinet.handles ?? null) : legacyHandles(hardware),
      inputDish: split ? cabinet.inputDish === true : isObject(hardware),
      chambers: cabinet.chambers.map((c) => readChamber(c, fallback)),
    },
  };
}

/** A stack's or a space's copy of a speaker (it keeps the id its members name) brought up to date (`readSavedSpeaker`). */
export function readSpeakerCopy(spec: SpeakerSpec): SpeakerSpec {
  const read = readSavedSpeaker(spec);
  return read ? { ...read, id: spec.id, name: spec.name } : spec;
}
