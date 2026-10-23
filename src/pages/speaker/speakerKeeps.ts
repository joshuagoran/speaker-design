// The Speaker optimizer's locks: the parts of a spec a lock can hold, and the locks as a spec's search takes them. Pure
// functions on `SpeakerOptimizerLocks`; the settings draw a lock button beside each part's setting.
import type {
  BandId,
  DimensionLockMode,
  Dims3,
  DriverRef,
  SpeakerOptimizerLocks,
  SpeakerSpec,
} from "../../types";
import { driverRef } from "../../lib/speaker/optimize/space";
import { hornById } from "../../lib/data";
import { toggled } from "../../lib/lists";
import { VENT_KIND } from "../../constants/speakerSpec";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import { SETTINGS_TEXT } from "../../constants/speakerSettings";
import { driverName } from "../../lib/speaker/driverLists";

/** The three chamber axes, in the order the size locks list them. */
export const SIZE_AXES = ["w", "h", "d"] as const;

/** Order in which a size lock cycles: free, up to this size, exactly this size. */
export const NEXT_SIZE_LOCK: Record<DimensionLockMode, DimensionLockMode> = {
  free: "max",
  max: "exact",
  exact: "free",
};

/** One part a lock can hold: what it locks, which part, and its name beside its setting and in the Locked line. */
export type KeepItem =
  | { kind: "drivers" | "horns"; ref: DriverRef; label: string }
  | { kind: "vents"; ref: number; label: string }
  | { kind: "highpass" | "lowpass" | "amps"; ref: BandId; label: string };

/**
 * Every part of the spec a lock can hold, in the order of the page: each chamber's vent (a vented one), then each driver
 * entry and its horn; then each band's filters and amp.
 */
export function keepItems(spec: Pick<SpeakerSpec, "cabinet" | "bands">): KeepItem[] {
  const T = SPEAKER_OPTIMIZER_TEXT;
  const S = SETTINGS_TEXT;
  const { chambers } = spec.cabinet;
  const items: KeepItem[] = [];
  chambers.forEach((chamber, k) => {
    const where = chambers.length > 1 ? `${T.chamber(k + 1)} · ` : "";
    if (chamber.vent.kind !== VENT_KIND.sealed)
      items.push({
        kind: "vents",
        ref: k,
        label: `${where}${S.vent.toLowerCase()}`,
      });
    chamber.drivers.forEach((d, j) => {
      const ref = driverRef(k, j);
      items.push({ kind: "drivers", ref, label: `${where}${driverName(d)}` });
      if (d.horn)
        items.push({
          kind: "horns",
          ref,
          label: `${where}${hornById(d.horn.hornId)?.name ?? d.horn.hornId}`,
        });
    });
  });
  for (const b of spec.bands) {
    const name = (setting: string) => `${b.name} ${setting.toLowerCase()}`;
    if (b.highpass) items.push({ kind: "highpass", ref: b.id, label: name(S.highPass) });
    if (b.lowpass) items.push({ kind: "lowpass", ref: b.id, label: name(S.lowPass) });
    items.push({ kind: "amps", ref: b.id, label: name(S.ampPower) });
  }
  return items;
}

/** A chamber axis's name: "Chamber 2 width", or only "width" in a box with one chamber. */
export function sizeAxisName(chamber: number, axis: keyof Dims3, nChambers: number): string {
  const T = SPEAKER_OPTIMIZER_TEXT;
  const name = T.axis[axis].toLowerCase();
  return nChambers > 1 ? `${T.chamber(chamber + 1)} ${name}` : name;
}

/** A chamber's size lock on an axis (free when none is set). */
export const sizeLockMode = (
  locks: SpeakerOptimizerLocks,
  chamber: number,
  axis: keyof Dims3,
): DimensionLockMode => locks.size?.[chamber]?.[axis] ?? "free";

/** The locks with a chamber's size lock on an axis set to `mode`. */
export const withSizeLock = (
  locks: SpeakerOptimizerLocks,
  chamber: number,
  axis: keyof Dims3,
  mode: DimensionLockMode,
): SpeakerOptimizerLocks => ({
  ...locks,
  size: { ...locks.size, [chamber]: { ...locks.size?.[chamber], [axis]: mode } },
});

/** Each chamber's size locks that are set, in chamber and axis order. */
const sizeLocksSet = (locks: SpeakerOptimizerLocks, nChambers: number) =>
  Array.from({ length: nChambers }, (_, k) => k).flatMap((k) =>
    SIZE_AXES.flatMap((axis) => {
      const mode = sizeLockMode(locks, k, axis);
      return mode === "free" ? [] : [{ chamber: k, axis, mode }];
    }),
  );

/** Whether the locks hold this part. */
export const isKept = (locks: SpeakerOptimizerLocks, item: KeepItem): boolean =>
  (locks[item.kind] ?? []).some((r) => r === item.ref);

/**
 * The names of what is locked: each chamber's size locks with their marks ("Chamber 2 width ≤"), then the parts in the
 * order of the page.
 */
export const lockedNames = (
  locks: SpeakerOptimizerLocks,
  items: readonly KeepItem[],
  nChambers: number,
): string[] => [
  ...sizeLocksSet(locks, nChambers).map(
    ({ chamber, axis, mode }) =>
      `${sizeAxisName(chamber, axis, nChambers)} ${SPEAKER_OPTIMIZER_TEXT.sizeMark[mode]}`,
  ),
  ...items.filter((item) => isKept(locks, item)).map((item) => item.label),
];

/** The locks with this part's lock flipped. */
export function toggleKeep(locks: SpeakerOptimizerLocks, item: KeepItem): SpeakerOptimizerLocks {
  switch (item.kind) {
    case "drivers":
      return { ...locks, drivers: toggled(locks.drivers ?? [], item.ref) };
    case "horns":
      return { ...locks, horns: toggled(locks.horns ?? [], item.ref) };
    case "vents":
      return { ...locks, vents: toggled(locks.vents ?? [], item.ref) };
    case "highpass":
      return { ...locks, highpass: toggled(locks.highpass ?? [], item.ref) };
    case "lowpass":
      return { ...locks, lowpass: toggled(locks.lowpass ?? [], item.ref) };
    case "amps":
      return { ...locks, amps: toggled(locks.amps ?? [], item.ref) };
  }
}

/** How many locks are set: each part held, and each chamber axis that is not free. */
export const countKept = (locks: SpeakerOptimizerLocks): number =>
  (locks.drivers?.length ?? 0) +
  (locks.horns?.length ?? 0) +
  (locks.vents?.length ?? 0) +
  (locks.highpass?.length ?? 0) +
  (locks.lowpass?.length ?? 0) +
  (locks.amps?.length ?? 0) +
  Object.values(locks.size ?? {}).reduce(
    (n, axes) => n + SIZE_AXES.filter((a) => (axes[a] ?? "free") !== "free").length,
    0,
  );

/** The locks that name a part this spec has (an edit may have removed a chamber, driver or band since they were set). */
export function pruneKept(
  locks: SpeakerOptimizerLocks,
  items: readonly KeepItem[],
): SpeakerOptimizerLocks {
  return items.reduce<SpeakerOptimizerLocks>(
    (out, item) => (isKept(locks, item) && !isKept(out, item) ? toggleKeep(out, item) : out),
    { size: locks.size },
  );
}

/** Where the driver entries are: how many each chamber has. Driver and horn locks name an entry by its place. */
export const driverLayout = (spec: Pick<SpeakerSpec, "cabinet">): string =>
  spec.cabinet.chambers.map((c) => c.drivers.length).join(",");

/** Locks as they were set: on which chamber list (the page's round) and driver layout. */
export interface HeldLocks {
  round: number;
  layout: string;
  locks: SpeakerOptimizerLocks;
}

/**
 * The locks that hold on the spec as it is now: none once the chamber list was replaced; without the driver and horn
 * locks once a driver entry was added or removed (the entries after it moved place, so a lock would move to another
 * driver); and only the parts the spec still has.
 */
export function heldLocks(
  held: HeldLocks,
  now: Pick<HeldLocks, "round" | "layout">,
  items: readonly KeepItem[],
): SpeakerOptimizerLocks {
  if (held.round !== now.round) return {};
  const { drivers: _drivers, horns: _horns, ...rest } = held.locks;
  return pruneKept(held.layout === now.layout ? held.locks : rest, items);
}

/**
 * The held locks as they stand on the spec now: the same object while nothing changed, else new ones with the locks that
 * still hold (`heldLocks`). The page keeps the result, so a lock that stopped holding stays dropped: a driver added back
 * later must not bring it back onto another driver.
 */
export function reconcileHeld(
  held: HeldLocks,
  now: Pick<HeldLocks, "round" | "layout">,
  items: readonly KeepItem[],
): HeldLocks {
  const locks = heldLocks(held, now, items);
  return held.round === now.round &&
    held.layout === now.layout &&
    JSON.stringify(held.locks) === JSON.stringify(locks)
    ? held
    : { ...now, locks };
}
