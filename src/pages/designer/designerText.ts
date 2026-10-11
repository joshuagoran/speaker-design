// The Designer's one-line summaries, built from the spec and the catalog.
import type { BandFilter, SpeakerBand, SpeakerChamber, SpeakerSpec } from "../../types";
import { formatDims, formatHz } from "../../lib/format";
import { BAND_NAMES, PORT_SHAPE_NAMES, VENT_KIND_NAMES } from "../../constants/designer";
import { CHAMBER_LOAD, PORT_SHAPE, VENT_KIND } from "../../constants/speakerSpec";
import { driverName } from "./designerParts";

/** "1 chamber", "2 chambers". */
export const countText = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A filter in words: its type and corner. */
export const filterText = (f: BandFilter) => `${f.type} ${formatHz(f.hz)}`;

/** A chamber in one line: its size, vent and drivers. */
export function chamberText(chamber: SpeakerChamber) {
  const { vent } = chamber;
  const ventText =
    vent.kind === VENT_KIND.vented
      ? `${VENT_KIND_NAMES.vented.toLowerCase()} (${PORT_SHAPE_NAMES[vent.port.shape ?? PORT_SHAPE.round].toLowerCase()})`
      : VENT_KIND_NAMES[vent.kind].toLowerCase();
  const drivers = chamber.drivers.map((d) => `${d.count} × ${driverName(d)}`).join(" + ");
  return [
    formatDims(chamber.dims),
    ventText,
    chamber.load.kind === CHAMBER_LOAD.horn ? "horn loaded" : null,
    drivers || "no drivers",
  ]
    .filter(Boolean)
    .join(", ");
}

/** A band in one line: its name, filters and level. */
export function bandText(band: SpeakerBand) {
  const filters = [
    band.highpass && `HP ${filterText(band.highpass)}`,
    band.lowpass && `LP ${filterText(band.lowpass)}`,
  ]
    .filter(Boolean)
    .join(", ");
  return `${BAND_NAMES[band.id]}${filters ? ` ${filters}` : ""}${band.levelDb ? ` ${band.levelDb.toFixed(1)} dB` : ""}`;
}

/** The speaker in one line, as the library lists it: its chambers and bands. */
export const speakerSummary = (spec: Pick<SpeakerSpec, "cabinet" | "bands">) =>
  [
    spec.cabinet.chambers.map(chamberText).join("; "),
    countText(spec.bands.length, "band", "bands"),
  ].join(" · ");
