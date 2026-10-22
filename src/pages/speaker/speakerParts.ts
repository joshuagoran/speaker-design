// The Speaker page's pickers: each driver kind's catalog, the horns a driver can take, and the passive radiators; and the
// driver entries the settings build. Read from the catalog (src/lib/data) and the defaults.
import type {
  ChamberVent,
  DriverKind,
  Horn,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerPort,
} from "../../types";
import type { SelectOption } from "../../components/ui/SelectField";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  HIFI_WAVEGUIDES,
  HIFI_WOOFERS,
  HORN_OPTIONS,
  MID_OPTIONS,
  SPEAKER_SUB_OPTIONS,
} from "../../lib/data";
import { byId } from "../../lib/tables";
import {
  DEFAULT_DRIVER_IDS,
  DEFAULT_HIFI,
  DEFAULT_PA,
  DEFAULT_PORT_SIZE,
} from "../../lib/defaults";
import { HIFI_TWEETERS_BY_TYPE, HIFI_WOOFERS_BY_SIZE } from "../../lib/speaker/driverLists";
import { DRIVER_KIND, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";
import { HIFI_PORT_MAX_MS } from "../../constants/hifiEngine";
import { NO_HORN_NAME } from "../../constants/speakerPage";

/** Each driver kind's catalog, as its picker lists it. */
export const DRIVER_OPTIONS: Record<DriverKind, readonly SelectOption[]> = {
  sub: SPEAKER_SUB_OPTIONS,
  mid: MID_OPTIONS,
  compression: CD_OPTIONS,
  woofer: HIFI_WOOFERS_BY_SIZE,
  tweeter: HIFI_TWEETERS_BY_TYPE,
  coaxial: FILL_OPTIONS,
};

/** The horn picker's first choice: no horn. */
export const NO_HORN: SelectOption = { id: "", name: NO_HORN_NAME };

/** The PA horns, then the Hi-fi-only waveguides: every catalog horn once. */
const ALL_HORNS: readonly Horn[] = [
  ...HORN_OPTIONS,
  ...HIFI_WAVEGUIDES.filter((w) => !byId(HORN_OPTIONS, w.id)),
];

/** The horns a driver kind can drive, after "None"; none for a cone. */
export const hornOptions = (kind: DriverKind): readonly SelectOption[] =>
  kind === DRIVER_KIND.compression
    ? [NO_HORN, ...ALL_HORNS]
    : kind === DRIVER_KIND.tweeter
      ? [NO_HORN, ...HIFI_WAVEGUIDES]
      : [];

/** A driver's catalog name; its id where its table doesn't have it. */
export const driverName = (driver: Pick<SpeakerDriver, "kind" | "driverId">) =>
  byId(DRIVER_OPTIONS[driver.kind], driver.driverId)?.name ?? driver.driverId;

/** The port each shape starts at: the default hi-fi design's round port and slot, the PA designs' side ducts. */
export const DEFAULT_PORTS = {
  round: { shape: PORT_SHAPE.round, ...DEFAULT_HIFI.portSpec },
  slot: { shape: PORT_SHAPE.slot, n: 1, h: DEFAULT_PORT_SIZE.h, len: DEFAULT_HIFI.portSpec.len },
  duct: {
    shape: PORT_SHAPE.duct,
    n: 2,
    throat: DEFAULT_PA.cVent.throat,
    len: DEFAULT_PA.cVent.len,
    divider: DEFAULT_PA.divider,
  },
} as const satisfies Record<NonNullable<SpeakerPort["shape"]>, SpeakerPort>;

/** The vent each kind starts at: the round port at the hi-fi air-speed limit, or the default hi-fi design's radiators. */
export const DEFAULT_VENTS = {
  sealed: { kind: VENT_KIND.sealed },
  vented: { kind: VENT_KIND.vented, port: DEFAULT_PORTS.round, maxSpeedMs: HIFI_PORT_MAX_MS },
  radiator: { kind: VENT_KIND.radiator, radiators: DEFAULT_HIFI.radiatorSelection },
} as const satisfies { [K in ChamberVent["kind"]]: Extract<ChamberVent, { kind: K }> };

/** A driver entry of `kind` on its kind's starting part, keeping the rest of `base`. */
export function driverOfKind(
  kind: DriverKind,
  base: Pick<SpeakerDriver, "count" | "position" | "bands">,
): SpeakerDriver {
  const common = { ...base, horn: null };
  switch (kind) {
    case DRIVER_KIND.sub:
      return { ...common, kind, driverId: DEFAULT_DRIVER_IDS.sub };
    case DRIVER_KIND.mid:
      return { ...common, kind, driverId: DEFAULT_DRIVER_IDS.mid };
    case DRIVER_KIND.compression:
      return { ...common, kind, driverId: DEFAULT_DRIVER_IDS.compression };
    case DRIVER_KIND.woofer:
      return { ...common, kind, driverId: DEFAULT_DRIVER_IDS.woofer };
    case DRIVER_KIND.tweeter:
      return { ...common, kind, driverId: DEFAULT_DRIVER_IDS.tweeter };
    case DRIVER_KIND.coaxial:
      return { ...common, kind, driverId: DEFAULT_DRIVER_IDS.coaxial };
  }
}

/** The catalog kinds that are woofers: the PA subs, the PA mid-bass drivers and the Hi-fi woofers. */
export type WooferKind = Extract<DriverKind, "sub" | "mid" | "woofer">;

/** Whether a driver kind is a woofer: the driver picker shows the three in one list. */
export const isWooferKind = (kind: DriverKind): kind is WooferKind =>
  kind === DRIVER_KIND.sub || kind === DRIVER_KIND.mid || kind === DRIVER_KIND.woofer;

/** A woofer as the one woofer list shows it: its catalog kind and its nominal size, in. */
export interface WooferOption extends SelectOption {
  kind: WooferKind;
  size: number;
}

/** Every woofer in the catalog in one list, smallest first, A–Z within a size. */
export const WOOFER_OPTIONS: readonly WooferOption[] = [
  ...SPEAKER_SUB_OPTIONS.map((d) => ({ ...d, kind: DRIVER_KIND.sub })),
  ...MID_OPTIONS.map((d) => ({ ...d, kind: DRIVER_KIND.mid })),
  ...HIFI_WOOFERS.map((d) => ({ ...d, kind: DRIVER_KIND.woofer })),
]
  .map(({ id, name, price, size, kind }): WooferOption => ({ id, name, price, size, kind }))
  .sort((a, b) => a.size - b.size || a.name.localeCompare(b.name));

/** The woofer sizes the catalog has, in, smallest first: the size filter's choices. */
export const WOOFER_SIZES: readonly number[] = [...new Set(WOOFER_OPTIONS.map((o) => o.size))];

/** A driver's size in the woofer list, in; null for a driver that is not a woofer. */
export const wooferSizeOf = (driver: Pick<SpeakerDriver, "driverId">) =>
  byId(WOOFER_OPTIONS, driver.driverId)?.size ?? null;

/** A driver turned to a woofer from the list: its kind and part, its count, place and bands kept. */
export function withWoofer(d: SpeakerDriver, o: WooferOption): SpeakerDriver {
  const common = { count: d.count, position: d.position, bands: d.bands.slice(0, 1), horn: null };
  switch (o.kind) {
    case DRIVER_KIND.sub:
      return { ...common, kind: o.kind, driverId: o.id };
    case DRIVER_KIND.mid:
      return { ...common, kind: o.kind, driverId: o.id };
    case DRIVER_KIND.woofer:
      return { ...common, kind: o.kind, driverId: o.id };
  }
}

/**
 * The woofer a new driver in a chamber starts on: the largest size that fits its clear width (else the smallest), and
 * of that size the kind's default part where it is that size, else the first.
 */
export function wooferFor(clearIn: number): WooferOption {
  const fits = WOOFER_SIZES.filter((s) => s <= clearIn);
  const size = fits.length ? fits[fits.length - 1] : WOOFER_SIZES[0];
  const ofSize = WOOFER_OPTIONS.filter((o) => o.size === size);
  return ofSize.find((o) => o.id === DEFAULT_DRIVER_IDS[o.kind]) ?? ofSize[0];
}

/**
 * The clear room a new woofer's size must fit in a chamber, in: the smaller of its clear width and height (a wide,
 * short chamber takes no driver taller than it is).
 */
export const wooferClearIn = (chamber: Pick<SpeakerChamber, "dims">, wallIn: number) =>
  Math.min(chamber.dims.w, chamber.dims.h) - 2 * wallIn;
