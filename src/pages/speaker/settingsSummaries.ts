// The Speaker settings column's summary lines: each fold's key facts, built from the spec and the catalog.
import type {
  BandFilter,
  ChamberVent,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerDriver,
  SpeakerHorn,
} from "../../types";
import { formatHz, formatWatts } from "../../lib/format";
import { formatThickness } from "../../lib/build/panel";
import { CONSTRUCTION_SHORT, FILL_SUMMARY, SETTINGS_TEXT } from "../../constants/speakerSettings";
import {
  CABINET_TOP_NAMES,
  CHAMBER_LOAD,
  DRIVER_KIND,
  FIRST_ORDER_FILTER,
  HORN_DRIVE,
  PORT_SHAPE,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  HORN_DRIVE_NAMES,
  HORN_PATH_NAMES,
  PORT_SHAPE_NAMES,
  VENT_KIND_NAMES,
} from "../../constants/speakerPage";
import { BACK_JOINT_SUMMARY, BRACE_STYLE_SUMMARY, NO_BRACING } from "../../constants/bracing";
import { FILL_LEVEL_PCT } from "../../constants/speakerSteps";
import { keysOf } from "../../lib/records";
import { byId } from "../../lib/tables";
import { hornById } from "../../lib/data";
import { HIFI_PASSIVES_BY_SIZE } from "../../lib/speaker/driverLists";
import { onTop } from "../../lib/speaker/speakerLayout";
import { driverName } from "../../lib/speaker/driverLists";
import { pathIn, shownInOfCm } from "./hornSections";

/** A fill level's id (`FILL_LEVEL_PCT`). */
export type FillLevel = keyof typeof FILL_LEVEL_PCT;

/** The fill level nearest a chamber's %: a saved value between levels shows as the nearest (a tie takes the lower). */
export function fillLevelOf(pct: number): FillLevel {
  return keysOf(FILL_LEVEL_PCT).reduce((a, b) =>
    Math.abs(FILL_LEVEL_PCT[b] - pct) < Math.abs(FILL_LEVEL_PCT[a] - pct) ? b : a,
  );
}

/** A length in a summary, in: to 0.01 in, no trailing zeros. */
const inches = (v: number) => String(+v.toFixed(2));

/** A band's name by id; "No band" when no band has it. */
const bandNameOf = (bands: readonly Pick<SpeakerBand, "id" | "name">[], id: string | undefined) =>
  bands.find((b) => b.id === id)?.name;

/**
 * A driver's summary: its count and model, a horn standing on the top, and its band (a coaxial's HF section's band
 * too), e.g. "2 × B&C 18TBX100 · Low band".
 */
export function driverSummary(
  driver: SpeakerDriver,
  bands: readonly Pick<SpeakerBand, "id" | "name">[],
): string {
  const [cone, hf] = driver.bands;
  const horn = driver.horn && onTop(driver) ? hornById(driver.horn.hornId) : undefined;
  const coneName = bandNameOf(bands, cone);
  const hfName = driver.kind === DRIVER_KIND.coaxial ? bandNameOf(bands, hf ?? cone) : undefined;
  return [
    `${driver.count} × ${driverName(driver)}`,
    horn && SETTINGS_TEXT.hornOnTop(horn.name),
    [
      coneName ? SETTINGS_TEXT.bandName(coneName) : SETTINGS_TEXT.noBand,
      hfName && SETTINGS_TEXT.hfBandName(hfName),
    ]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A vent's summary: sealed, the port's count, size and length, or the radiators, e.g. "Ported · 2 × 3 in round, 6 in long". */
export function ventSummary(vent: ChamberVent): string {
  if (vent.kind === VENT_KIND.sealed) return VENT_KIND_NAMES.sealed;
  if (vent.kind === VENT_KIND.radiator) {
    const part = byId(HIFI_PASSIVES_BY_SIZE, vent.radiators.id);
    return `${VENT_KIND_NAMES.radiator} · ${vent.radiators.n} × ${part?.name ?? vent.radiators.id}`;
  }
  const { port } = vent;
  const long = `${inches(port.len)} in long`;
  const size =
    port.shape === PORT_SHAPE.slot
      ? `${port.n} × ${inches(port.h)} in ${PORT_SHAPE_NAMES.slot.toLowerCase()}`
      : port.shape === PORT_SHAPE.duct
        ? `${port.n} × ${inches(port.throat)} in ${PORT_SHAPE_NAMES.duct.toLowerCase()}`
        : `${port.n} × ${inches(port.dia)} in ${PORT_SHAPE_NAMES.round.toLowerCase()}`;
  return `${VENT_KIND_NAMES.vented} · ${size}, ${long}`;
}

/** A Box chamber's Fill and bracing summary: its fill, its braces and target, its back, e.g. "Lined walls · ribs to 200 Hz · screwed back". */
export function fillBracingSummary(chamber: Pick<SpeakerChamber, "stuffingPct" | "bracing">) {
  const { braceStyle, braceTargetHz, backJoint } = chamber.bracing;
  return [
    FILL_SUMMARY[fillLevelOf(chamber.stuffingPct)],
    braceStyle === NO_BRACING
      ? SETTINGS_TEXT.noBraces
      : SETTINGS_TEXT.bracedTo(BRACE_STYLE_SUMMARY[braceStyle], formatHz(braceTargetHz)),
    BACK_JOINT_SUMMARY[backJoint],
  ].join(" · ");
}

/** How far along the straight horn the end of section `n` is, in from the closed end, to 0.1 in. */
const tapIn = (horn: Pick<SpeakerHorn, "segments">, n: number) =>
  String(+shownInOfCm(horn.segments.slice(0, n).reduce((sum, s) => sum + s.length, 0)).toFixed(1));

/** A horn's Horn settings summary: its type, then its taps or its sections, e.g. "Tapped · taps 9 / 112 in". */
export function hornSettingsSummary(horn: Pick<SpeakerHorn, "drive" | "segments">): string {
  const { drive } = horn;
  const name = HORN_DRIVE_NAMES[drive.kind];
  if (drive.kind === HORN_DRIVE.tapped)
    return `${name} · ${SETTINGS_TEXT.hornTaps(tapIn(horn, drive.frontTap), tapIn(horn, drive.rearTap))}`;
  if (drive.kind === HORN_DRIVE.offset)
    return `${name} · ${SETTINGS_TEXT.hornTapAt(tapIn(horn, drive.tap))}`;
  return `${name} · ${SETTINGS_TEXT.hornSections(horn.segments.length, inches(pathIn(horn)))}`;
}

/** A filter's type in a summary: its name, a first-order filter by its slope. */
const filterType = (f: BandFilter) =>
  f.type === FIRST_ORDER_FILTER ? SETTINGS_TEXT.firstOrder : f.type;

/** A filter in a summary: "High-pass LR24 1200 Hz", or "High-pass off". */
export const filterSummary = (side: string, f: BandFilter | null) =>
  f ? SETTINGS_TEXT.filterOn(side, filterType(f), formatHz(f.hz)) : SETTINGS_TEXT.filterIsOff(side);

/** A band's summary: its name, filters, level (where set) and amp power, e.g. "High · High-pass LR24 1200 Hz · Low-pass off · 100 W". */
export function bandSummary(band: SpeakerBand): string {
  const level = Math.round(band.levelDb * 10) / 10;
  return [
    band.name,
    filterSummary(SETTINGS_TEXT.highPass, band.highpass),
    filterSummary(SETTINGS_TEXT.lowPass, band.lowpass),
    level ? `${level > 0 ? "+" : "−"}${Math.abs(level)} dB` : null,
    formatWatts(band.ampW),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A band's pass range from its filters, e.g. "90 Hz–1200 Hz", "above 1200 Hz", "full range". */
export function bandRange(band: Pick<SpeakerBand, "highpass" | "lowpass">): string {
  const { highpass: hp, lowpass: lp } = band;
  if (hp && lp) return SETTINGS_TEXT.bandRange(formatHz(hp.hz), formatHz(lp.hz));
  if (hp) return SETTINGS_TEXT.bandAbove(formatHz(hp.hz));
  if (lp) return SETTINGS_TEXT.bandBelow(formatHz(lp.hz));
  return SETTINGS_TEXT.fullRange;
}

/** Whether every chamber is a Box: only then does the cabinet take an arched top. */
export const allBox = (chambers: readonly Pick<SpeakerChamber, "load">[]) =>
  chambers.every((c) => c.load.kind === CHAMBER_LOAD.direct);

/** The Construction summary: the construction, the walls, the top (Box-only speakers) and the hardware. */
export function constructionSummary(
  cabinet: Pick<
    SpeakerCabinet,
    "construction" | "panel" | "top" | "chambers" | "handles" | "inputDish"
  >,
): string {
  const hardware = [
    cabinet.handles && SETTINGS_TEXT.hardwareHandles,
    cabinet.inputDish && SETTINGS_TEXT.hardwareDish,
  ].filter(Boolean);
  return [
    CONSTRUCTION_SHORT[cabinet.construction],
    SETTINGS_TEXT.walls(formatThickness(cabinet.panel.thicknessIn)),
    allBox(cabinet.chambers) ? SETTINGS_TEXT.topSummary(CABINET_TOP_NAMES[cabinet.top]) : null,
    hardware.length ? hardware.join(", ") : SETTINGS_TEXT.noHardware,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A chamber in a few words: its type, its size and its drivers, e.g. "Ported box, 15.5 × 26 × 15 in, 2 drivers". */
export function chamberSummary(chamber: SpeakerChamber): string {
  const { dims, load } = chamber;
  return [
    load.kind === CHAMBER_LOAD.horn
      ? SETTINGS_TEXT.hornSummary(
          HORN_DRIVE_NAMES[load.horn.drive.kind],
          HORN_PATH_NAMES[load.horn.path],
        )
      : SETTINGS_TEXT.boxSummary(VENT_KIND_NAMES[chamber.vent.kind]),
    `${inches(dims.w)} × ${inches(dims.h)} × ${inches(dims.d)} in`,
    SETTINGS_TEXT.driverCount(chamber.drivers.length),
  ].join(", ");
}
