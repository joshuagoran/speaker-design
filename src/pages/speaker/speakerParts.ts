// The Speaker page's pickers: each driver kind's catalog, the horns a driver can take, and the passive radiators; and the
// driver entries the settings build. Read from the catalog (src/lib/data) and the defaults.
import type { ChamberVent, DriverKind, Horn, SpeakerDriver, SpeakerPort } from "../../types";
import type { SelectOption } from "../../components/ui/SelectField";
import {
  CD_OPTIONS,
  FILL_OPTIONS,
  HIFI_WAVEGUIDES,
  HORN_OPTIONS,
  MID_OPTIONS,
  SUB_OPTIONS,
} from "../../lib/data";
import { byId } from "../../lib/tables";
import {
  DEFAULT_DRIVER_IDS,
  DEFAULT_HIFI,
  DEFAULT_PA,
  DEFAULT_PORT_SIZE,
} from "../../lib/defaults";
import { HIFI_TWEETERS_BY_TYPE, HIFI_WOOFERS_BY_SIZE } from "../../lib/hifi/hifiDriverLists";
import { DRIVER_KIND, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";
import { HIFI_PORT_MAX_MS } from "../../constants/hifiEngine";

/** Each driver kind's catalog, as its picker lists it. */
export const DRIVER_OPTIONS: Record<DriverKind, readonly SelectOption[]> = {
  sub: SUB_OPTIONS,
  mid: MID_OPTIONS,
  compression: CD_OPTIONS,
  woofer: HIFI_WOOFERS_BY_SIZE,
  tweeter: HIFI_TWEETERS_BY_TYPE,
  coaxial: FILL_OPTIONS,
};

/** The horn picker's first choice: no horn. */
export const NO_HORN: SelectOption = { id: "", name: "None" };

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

/** The port each shape starts at: the Hi-fi page's round port and slot, the PA page's side ducts. */
export const DEFAULT_PORTS = {
  round: { shape: PORT_SHAPE.round, ...DEFAULT_HIFI.portSpec },
  slot: { shape: PORT_SHAPE.slot, n: 1, h: DEFAULT_PORT_SIZE.h, len: DEFAULT_HIFI.portSpec.len },
  duct: {
    shape: PORT_SHAPE.duct,
    n: 2,
    throat: DEFAULT_PA.cVent.throat,
    len: DEFAULT_PA.cVent.len,
  },
} as const satisfies Record<NonNullable<SpeakerPort["shape"]>, SpeakerPort>;

/** The vent each kind starts at: the round port at the Hi-fi page's air-speed limit, or the Hi-fi page's radiators. */
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
