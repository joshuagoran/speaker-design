// The Speaker optimizer's Keep list: the parts of a spec a lock can hold, and the locks as a spec's search takes them.
// Pure functions on `SpeakerOptimizerLocks`; the fold draws one lock button per item.
import type { BandId, DriverRef, SpeakerOptimizerLocks, SpeakerSpec } from "../../types";
import { driverRef } from "../../lib/speaker/optimize/space";
import { hornById } from "../../lib/data";
import { toggled } from "../../lib/lists";
import { VENT_KIND } from "../../constants/speakerSpec";
import { SPEAKER_OPTIMIZER_TEXT } from "../../constants/speakerOptimizerText";
import { VENT_KIND_NAMES } from "../../constants/speakerPage";
import { driverName } from "./speakerParts";
import { filterText } from "./speakerText";

/** The three box axes, in the order the size locks list them. */
export const SIZE_AXES = ["w", "h", "d"] as const;

/** One part a lock can hold: what it locks, which part, and how the Keep list names it. */
export type KeepItem =
  | { kind: "drivers" | "horns"; ref: DriverRef; label: string; group: KeepGroupId }
  | { kind: "vents"; ref: number; label: string; group: KeepGroupId }
  | { kind: "highpass" | "lowpass" | "amps"; ref: BandId; label: string; group: KeepGroupId };

/** The Keep list's groups, by id (`SPEAKER_OPTIMIZER_TEXT.groups` names them). */
export type KeepGroupId = keyof typeof SPEAKER_OPTIMIZER_TEXT.groups;

/** Every part of the spec a lock can hold: each driver entry and its horn, each vented chamber's vent, each band's filters and amp. */
export function keepItems(spec: Pick<SpeakerSpec, "cabinet" | "bands">): KeepItem[] {
  const T = SPEAKER_OPTIMIZER_TEXT;
  const { chambers } = spec.cabinet;
  const items: KeepItem[] = [];
  chambers.forEach((chamber, k) => {
    const where = chambers.length > 1 ? `${T.chamber(k + 1)} · ` : "";
    chamber.drivers.forEach((d, j) => {
      const ref = driverRef(k, j);
      items.push({
        kind: "drivers",
        ref,
        group: "drivers",
        label: `${where}${d.count} × ${driverName(d)}`,
      });
      if (d.horn)
        items.push({
          kind: "horns",
          ref,
          group: "horns",
          label: `${where}${hornById(d.horn.hornId)?.name ?? d.horn.hornId}`,
        });
    });
    if (chamber.vent.kind !== VENT_KIND.sealed)
      items.push({
        kind: "vents",
        ref: k,
        group: "vents",
        label: `${where}${VENT_KIND_NAMES[chamber.vent.kind]} ${T.vent}`,
      });
  });
  for (const b of spec.bands) {
    if (b.highpass)
      items.push({
        kind: "highpass",
        ref: b.id,
        group: "bands",
        label: `${b.name} ${T.highpass} ${filterText(b.highpass)}`,
      });
    if (b.lowpass)
      items.push({
        kind: "lowpass",
        ref: b.id,
        group: "bands",
        label: `${b.name} ${T.lowpass} ${filterText(b.lowpass)}`,
      });
    items.push({ kind: "amps", ref: b.id, group: "bands", label: `${b.name} ${T.amp}` });
  }
  return items;
}

/** Whether the locks hold this part. */
export const isKept = (locks: SpeakerOptimizerLocks, item: KeepItem): boolean =>
  (locks[item.kind] ?? []).some((r) => r === item.ref);

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

/** Every part held and every box axis exact: the "lock all" state, to unlock from. */
export function allKept(items: readonly KeepItem[]): SpeakerOptimizerLocks {
  return items.reduce<SpeakerOptimizerLocks>(
    (locks, item) => (isKept(locks, item) ? locks : toggleKeep(locks, item)),
    { size: { w: "exact", h: "exact", d: "exact" } },
  );
}

/** How many locks are set: each part held, and each box axis that is not free. */
export const countKept = (locks: SpeakerOptimizerLocks): number =>
  (locks.drivers?.length ?? 0) +
  (locks.horns?.length ?? 0) +
  (locks.vents?.length ?? 0) +
  (locks.highpass?.length ?? 0) +
  (locks.lowpass?.length ?? 0) +
  (locks.amps?.length ?? 0) +
  SIZE_AXES.filter((a) => (locks.size?.[a] ?? "free") !== "free").length;

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
