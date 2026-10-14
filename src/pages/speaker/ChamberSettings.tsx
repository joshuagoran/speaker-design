import { useState } from "react";
import type {
  BandId,
  ChamberVent,
  Dims3,
  DriverKind,
  HornAttachment,
  HornPlacement,
  SpeakerBand,
  SpeakerCabinet,
  SpeakerChamber,
  SpeakerChamberResponse,
  SpeakerDriver,
  SpeakerPanel,
  SpeakerPort,
  SpeakerRoundPort,
  SpeakerSlotPort,
} from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CardHeading } from "../../components/ui/CardHeading";
import { SettingsFold } from "../../components/ui/SettingsFold";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { HIFI_PASSIVES_BY_SIZE } from "../../lib/hifi/hifiDriverLists";
import {
  CHAMBER_LOAD_NAMES,
  SPEAKER_TEXT,
  ALL_SIZES,
  DRIVER_TYPE_NAMES,
  wooferSizeName,
  HORN_PLACEMENT_NAMES,
  HORN_PLACEMENT_NO_FIT,
  MODEL_GAP_TEXT,
  PORT_SHAPE_NAMES,
  SET_BY,
  SET_BY_NAMES,
  SLOT_KIND_NAMES,
  SLOT_KIND_TIPS,
  SLOT_FOLD_NAMES,
  TUBE_ENDS_NAMES,
  TUBE_LAYOUT_NAMES,
  ELBOW_COUNT_NAMES,
  VENT_KIND_NAMES,
  VENT_PANEL_NAMES,
} from "../../constants/speakerPage";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_PLACEMENT,
  PA_SLOT_FINS,
  PORT_SHAPE,
  SLOT_KIND,
  TUBE_ENDS,
  TUBE_LAYOUT,
  VENT_KIND,
} from "../../constants/speakerSpec";
import {
  DEFAULT_PORTS,
  DEFAULT_VENTS,
  DRIVER_OPTIONS,
  NO_HORN,
  WOOFER_OPTIONS,
  WOOFER_SIZES,
  driverOfKind,
  hornOptions,
  isWooferKind,
  withWoofer,
  wooferClearIn,
  wooferFor,
  wooferSizeOf,
} from "./speakerParts";
import { mouthPlace, ventPlace, withMouthPosition, withVentPosition } from "./speakerPlaces";
import { PlaceFields } from "./PlaceFields";
import { HornSettings } from "./HornSettings";
import { FIELD_ROW, onFieldStep, shownIn, shownTenth } from "./speakerFields";
import { hornRoom, startingHorn, withChamberLoad } from "./chamberLoad";
import {
  defaultHornPlacement,
  hornFits,
  onTop,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import { CD_OPTIONS, hornById } from "../../lib/data";
import { hornMountChoice } from "../../components/stack-view/hornMountChoice";
import { HornMountField } from "../../components/ui/HornMountField";
import { takesHornMountAt } from "../../lib/pa/hornMount";
import { HORN_MOUNT_DEFAULT } from "../../constants/hornMount";
import { UI_TEXT } from "../../constants/uiText";
import { Notice } from "../../components/ui/Notice";
import { formatInches } from "../../lib/format";
import { mismatchedHornExit } from "../../lib/speaker/driverParts";
import { PANEL_NOMINAL_OPTIONS } from "../../lib/panel";
import { ductDividerOf, withDuctDivider } from "../../lib/speaker/cabinetPanels";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";
import { maxSlotFins, slotFinsOf, slotFolds } from "../../lib/pa/calc";
import { ELBOW_COUNTS, elbowCountOf } from "../../lib/tubeFold";

/** The driver types as the type picker lists them: one woofer type, then the other kinds. */
const TYPE_OPTIONS: readonly SelectOption[] = entriesOf(DRIVER_TYPE_NAMES).map(([id, name]) => ({
  id,
  name,
}));

/** The woofer size filter's choices: every size, then each catalog size (the id is the size, in). */
const ALL_SIZES_OPTION: SelectOption = { id: "", name: ALL_SIZES };
const SIZE_OPTIONS: readonly SelectOption[] = [
  ALL_SIZES_OPTION,
  ...WOOFER_SIZES.map((s) => ({ id: String(s), name: wooferSizeName(s) })),
];

/** Where a chamber's net air comes from: worked out from its size (Auto), or typed in (Custom). */
const NET_AIR = SET_BY;

interface Props {
  index: number;
  chamber: SpeakerChamber;
  /** the model's reading of it */
  result: SpeakerChamberResponse | undefined;
  bands: readonly SpeakerBand[];
  /** the cabinet it is in, and where its layout places it: its vent's and horn mouth's places read them */
  cabinet: Pick<SpeakerCabinet, "panel" | "construction" | "insetIn">;
  placed: PlacedChamber | undefined;
  onEdit: (edit: (chamber: SpeakerChamber) => SpeakerChamber) => void;
  /** absent for the last chamber left */
  onRemove?: () => void;
}

/** One chamber's settings: size, air, place, horn, vent and drivers. */
export function ChamberSettings({
  index,
  chamber,
  result,
  bands,
  cabinet,
  placed,
  onEdit,
  onRemove,
}: Props) {
  const { vent } = chamber;
  const vents = placed ? ventPlace(cabinet, placed) : null;
  const mouth = placed ? mouthPlace(cabinet, placed) : null;
  const bandOptions = bands.map((b): readonly [BandId, string] => [b.id, b.name]);
  const setDim = (k: keyof Dims3, v: number) =>
    onEdit((c) => ({ ...c, dims: { ...c.dims, [k]: v } }));
  const setVent = (v: ChamberVent) => onEdit((c) => ({ ...c, vent: v }));
  const setPort = (port: SpeakerPort) =>
    setVent(vent.kind === VENT_KIND.vented ? { ...vent, port } : { ...DEFAULT_VENTS.vented, port });
  const editDriver = (i: number, edit: (d: SpeakerDriver) => SpeakerDriver) =>
    onEdit((c) => ({ ...c, drivers: c.drivers.map((d, k) => (k === i ? edit(d) : d)) }));
  const firstBand = bands[0]?.id;
  /** the room a starting horn fills */
  const room = hornRoom(cabinet, chamber, placed);
  /** the chamber's clear room, in: a new woofer's size fits it */
  const clearIn = wooferClearIn(chamber, cabinet.panel.thicknessIn);
  /**
   * how many times a driver was removed: each driver's fields take it with their index as their key, so no field state
   * (the woofer size filter) carries over to the next driver
   */
  const [driverRound, setDriverRound] = useState(0);
  return (
    <Card className="mb-3">
      <CardHeading
        className="mb-3"
        action={
          onRemove && (
            <Button size="xs" onClick={onRemove}>
              Remove chamber
            </Button>
          )
        }
      >
        Chamber {index + 1}
      </CardHeading>
      <div className={FIELD_ROW}>
        {(["w", "h", "d"] as const).map((k) => (
          <NumberField
            key={k}
            label={`${{ w: "Width", h: "Height", d: "Depth" }[k]}, in`}
            value={shownIn(chamber.dims[k])}
            min={1}
            step={SPEAKER_STEPS.sizeIn}
            onChange={(v) => setDim(k, v)}
          />
        ))}
      </div>
      {/* most designs never move a chamber: its position waits in a closed fold */}
      <SettingsFold
        title={SPEAKER_TEXT.advanced}
        summary={SPEAKER_TEXT.chamberAt(shownIn(chamber.at.xIn), shownIn(chamber.at.yIn))}
      >
        <div className={FIELD_ROW}>
          {/* the chamber's lower-left corner, in from the cabinet's (`SpeakerChamber.at`) */}
          <NumberField
            label={SPEAKER_TEXT.fromLeft}
            value={shownIn(chamber.at.xIn)}
            step={SPEAKER_STEPS.sizeIn}
            onChange={(xIn) => onEdit((c) => ({ ...c, at: { ...c.at, xIn } }))}
          />
          <NumberField
            label={SPEAKER_TEXT.fromBottom}
            value={shownIn(chamber.at.yIn)}
            step={SPEAKER_STEPS.sizeIn}
            onChange={(yIn) => onEdit((c) => ({ ...c, at: { ...c.at, yIn } }))}
          />
        </div>
      </SettingsFold>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.netAirTip}>Net air</Tooltip>}
        className="mb-2"
        value={chamber.netLiters === null ? NET_AIR.auto : NET_AIR.custom}
        onChange={(v) =>
          onEdit((c) => ({
            ...c,
            netLiters: v === NET_AIR.auto ? null : shownTenth(result?.netLiters ?? 20),
          }))
        }
        options={entriesOf(SET_BY_NAMES)}
      />
      <NumberField
        label="Volume, L"
        // Auto: the model's value, read-only
        value={chamber.netLiters ?? shownTenth(result?.netLiters ?? 0)}
        disabled={chamber.netLiters === null}
        min={0.5}
        step={SPEAKER_STEPS.netL}
        onChange={(netLiters) => onEdit((c) => ({ ...c, netLiters }))}
        className="mb-3"
      />
      <NumberField
        label={<Tooltip tip={SPEAKER_TEXT.stuffingTip}>Stuffing, %</Tooltip>}
        value={chamber.stuffingPct}
        min={0}
        step={5}
        onChange={(stuffingPct) => onEdit((c) => ({ ...c, stuffingPct }))}
        className="mb-3"
      />
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.loadTip}>{SPEAKER_TEXT.load}</Tooltip>}
        className="mb-3"
        value={chamber.load.kind}
        onChange={(kind) => onEdit((c) => withChamberLoad(c, kind, room, result?.netLiters))}
        options={entriesOf(CHAMBER_LOAD_NAMES)}
        disabled={
          chamber.load.kind === CHAMBER_LOAD.direct && !startingHorn(chamber, room)
            ? { values: [CHAMBER_LOAD.horn], why: SPEAKER_TEXT.loadNoCone }
            : undefined
        }
      />
      {chamber.load.kind === CHAMBER_LOAD.horn && (
        <HornSettings
          horn={chamber.load.horn}
          drivers={chamber.drivers}
          onEdit={(edit) =>
            onEdit((c) =>
              c.load.kind === CHAMBER_LOAD.horn
                ? { ...c, load: { ...c.load, horn: edit(c.load.horn) } }
                : c,
            )
          }
        />
      )}
      {mouth && (
        <PlaceFields
          label={SPEAKER_TEXT.mouthPlace}
          value={mouth.position}
          auto={mouth.auto}
          widthIn={chamber.dims.w}
          onChange={(p) => onEdit((c) => ({ ...c, load: withMouthPosition(c.load, p) }))}
        />
      )}
      <ToggleGroup
        label="Vent"
        className="mb-3"
        value={vent.kind}
        onChange={(kind) => setVent(kind === vent.kind ? vent : DEFAULT_VENTS[kind])}
        options={entriesOf(VENT_KIND_NAMES)}
      />
      {vent.kind === VENT_KIND.vented && (
        <>
          <ToggleGroup
            label="Port"
            className="mb-3"
            value={vent.port.shape ?? PORT_SHAPE.round}
            onChange={(shape) =>
              setPort(
                shape === (vent.port.shape ?? PORT_SHAPE.round) ? vent.port : DEFAULT_PORTS[shape],
              )
            }
            options={entriesOf(PORT_SHAPE_NAMES)}
          />
          <PortFields
            port={vent.port}
            walls={cabinet.panel}
            chamber={chamber}
            clearW={placed?.clear.w ?? chamber.dims.w - 2 * cabinet.panel.thicknessIn}
            onChange={setPort}
          />
          {!vents && <p className="text-xs text-stone-500 mb-3">{SPEAKER_TEXT.ventFixed}</p>}
          <NumberField
            label={<Tooltip tip={SPEAKER_TEXT.airSpeedTip}>Air speed limit</Tooltip>}
            value={vent.maxSpeedMs}
            min={1}
            step={0.5}
            unit="m/s"
            onChange={(maxSpeedMs) => setVent({ ...vent, maxSpeedMs })}
            className="mb-3"
          />
        </>
      )}
      {vent.kind === VENT_KIND.radiator && (
        <>
          <SelectField
            label="Passive radiator"
            options={HIFI_PASSIVES_BY_SIZE}
            value={byId(HIFI_PASSIVES_BY_SIZE, vent.radiators.id)}
            onChange={(p) => setVent({ ...vent, radiators: { ...vent.radiators, id: p.id } })}
          />
          <div className={FIELD_ROW}>
            <NumberField
              label="Count"
              value={vent.radiators.n}
              min={1}
              step={1}
              onChange={(n) => setVent({ ...vent, radiators: { ...vent.radiators, n } })}
            />
            <NumberField
              label={<Tooltip tip={SPEAKER_TEXT.radiatorMassTip}>Added mass, g</Tooltip>}
              value={vent.radiators.addG}
              min={0}
              step={SPEAKER_STEPS.addG}
              onChange={(addG) => setVent({ ...vent, radiators: { ...vent.radiators, addG } })}
            />
          </div>
        </>
      )}
      {vents && (
        <PlaceFields
          label={
            vents.what === VENT_KIND.radiator ? SPEAKER_TEXT.radiatorPlace : SPEAKER_TEXT.portPlace
          }
          value={vents.position}
          auto={vents.auto}
          widthIn={chamber.dims.w}
          onChange={(p) => onEdit((c) => ({ ...c, vent: withVentPosition(c.vent, p) }))}
        >
          {vents.position && (
            <ToggleGroup
              label={SPEAKER_TEXT.panel}
              className="mb-2"
              value={vents.position.panel}
              onChange={(panel) =>
                onEdit((c) => ({
                  ...c,
                  vent: withVentPosition(c.vent, vents.position && { ...vents.position, panel }),
                }))
              }
              options={entriesOf(VENT_PANEL_NAMES)}
            />
          )}
        </PlaceFields>
      )}
      <CardHeading sub className="mt-1 mb-2">
        Drivers
      </CardHeading>
      {chamber.drivers.map((driver, i) => (
        <DriverFields
          key={`${driverRound}:${i}`}
          driver={driver}
          widthIn={chamber.dims.w}
          clearIn={clearIn}
          placed={placed}
          bandOptions={bandOptions}
          onEdit={(edit) => editDriver(i, edit)}
          onRemove={() => {
            setDriverRound((r) => r + 1);
            onEdit((c) => ({ ...c, drivers: c.drivers.filter((_, k) => k !== i) }));
          }}
        />
      ))}
      {firstBand && (
        <Button
          variant="primary"
          size="xs"
          onClick={() =>
            onEdit((c) => ({
              ...c,
              drivers: [
                ...c.drivers,
                // a woofer of the largest size that fits the chamber
                withWoofer(
                  driverOfKind(DRIVER_KIND.woofer, {
                    count: 1,
                    position: { xIn: 0, yIn: c.dims.h / 2 },
                    bands: [firstBand],
                  }),
                  wooferFor(clearIn),
                ),
              ],
            }))
          }
        >
          Add driver
        </Button>
      )}
      {result && result.gaps.length > 0 && (
        <p className="text-sm text-orange-900 mt-3">
          Not modeled: {result.gaps.map((g) => MODEL_GAP_TEXT[g]).join("; ")}.
        </p>
      )}
    </Card>
  );
}

/**
 * A port's settings: round tubes (plain, or the PA sub's flared tubes in a row or the corners, and their elbows), a slot
 * (the PA sub's letterbox with its fins, or a plain slot: its opening's narrow side, its long side, Auto the chamber's
 * clear width, and whether it folds up the back) or side ducts. Everything a template sets on a port is set here too.
 */
export function PortFields({
  port,
  walls,
  chamber,
  clearW,
  onChange,
}: {
  port: SpeakerPort;
  /** the walls: side-duct dividers of their size take their thickness, and a letterbox's fins */
  walls: Pick<SpeakerPanel, "nominal" | "thicknessIn">;
  /** the chamber: its size folds a letterbox, its drivers take flared tubes */
  chamber: Pick<SpeakerChamber, "dims" | "drivers">;
  /** the chamber's clear width, in: a plain slot's long side when Auto */
  clearW: number;
  onChange: (p: SpeakerPort) => void;
}) {
  if (port.shape === PORT_SHAPE.slot)
    return (
      <SlotFields
        port={port}
        t={walls.thicknessIn}
        chamber={chamber}
        clearW={clearW}
        onChange={onChange}
      />
    );
  if (port.shape === PORT_SHAPE.duct)
    return (
      <>
        <ToggleGroup
          label="Ducts"
          className="mb-3"
          value={port.n}
          onChange={(n) => onChange({ ...port, n })}
          options={[
            [1, "One"],
            [2, "Two"],
          ]}
        />
        <div className={FIELD_ROW}>
          <NumberField
            label="Throat, in"
            {...onFieldStep(port.throat, SPEAKER_STEPS.portSizeIn)}
            min={0.25}
            onChange={(throat) => onChange({ ...port, throat })}
          />
          <PortLengthField port={port} onChange={(len) => onChange({ ...port, len })} />
        </div>
        <ToggleGroup
          label={<Tooltip tip={SPEAKER_TEXT.ductDividersTip}>{UI_TEXT.ductDividers}</Tooltip>}
          className="mb-3"
          value={ductDividerOf(port)}
          onChange={(divider) => onChange(withDuctDivider(port, divider, walls))}
          options={PANEL_NOMINAL_OPTIONS}
        />
      </>
    );
  return <RoundFields port={port} chamber={chamber} onChange={onChange} />;
}

/** A port's length, in: the path the air takes (a folded port's whole path). */
function PortLengthField({
  port,
  onChange,
}: {
  port: Pick<SpeakerPort, "len">;
  onChange: (len: number) => void;
}) {
  return (
    <NumberField
      label={SPEAKER_TEXT.portLength}
      {...onFieldStep(port.len, SPEAKER_STEPS.portLenIn)}
      min={0.5}
      onChange={onChange}
    />
  );
}

/**
 * A slot: the PA sub's letterbox (its fins, its height and length; it folds up the back by the PA rule when too long to
 * run straight) or a plain slot (stacked, its sides, and whether it may fold up the back).
 */
function SlotFields({
  port,
  t,
  chamber,
  clearW,
  onChange,
}: {
  port: SpeakerSlotPort;
  t: SpeakerPanel["thicknessIn"];
  chamber: Pick<SpeakerChamber, "dims">;
  clearW: number;
  onChange: (p: SpeakerPort) => void;
}) {
  const letterbox = port.fins !== undefined;
  const { h, len } = port;
  const kind = (
    <ToggleGroup
      label={<Tooltip tip={SPEAKER_TEXT.slotKindTip}>{SPEAKER_TEXT.slotKind}</Tooltip>}
      className="mb-1"
      value={letterbox ? SLOT_KIND.letterbox : SLOT_KIND.plain}
      onChange={(k) =>
        onChange(
          k === SLOT_KIND.letterbox
            ? { shape: PORT_SHAPE.slot, n: 1, h, len, fins: port.fins ?? PA_SLOT_FINS }
            : { shape: PORT_SHAPE.slot, n: 1, h, len },
        )
      }
      options={entriesOf(SLOT_KIND_NAMES).map(([k, name]) => [k, name, SLOT_KIND_TIPS[k]] as const)}
    />
  );
  const resets = <p className="text-xs text-stone-500 mb-3">{SPEAKER_TEXT.slotKindResets}</p>;
  if (letterbox)
    return (
      <>
        {kind}
        {resets}
        <div className={FIELD_ROW}>
          <NumberField
            label={<Tooltip tip={SPEAKER_TEXT.slotFinsTip}>{SPEAKER_TEXT.slotFins}</Tooltip>}
            {...onFieldStep(
              slotFinsOf({ fins: port.fins, slotH: h }, clearW, t),
              SPEAKER_STEPS.count,
            )}
            min={0}
            max={maxSlotFins(clearW, t, h)}
            onChange={(fins) =>
              onChange({
                ...port,
                fins: Math.min(maxSlotFins(clearW, t, h), Math.max(0, Math.round(fins))),
              })
            }
          />
          <NumberField
            label={SPEAKER_TEXT.slotHeight}
            {...onFieldStep(h, SPEAKER_STEPS.slotHIn)}
            min={0.25}
            onChange={(slotH) => onChange({ ...port, h: slotH })}
          />
          <PortLengthField port={port} onChange={(l) => onChange({ ...port, len: l })} />
        </div>
        <p className="text-xs text-stone-500 mb-3">
          {slotFolds(chamber.dims, { slotH: h, len }, t)
            ? SPEAKER_TEXT.slotFolds
            : SPEAKER_TEXT.slotStraight}
        </p>
      </>
    );
  return (
    <>
      {kind}
      {resets}
      <div className={FIELD_ROW}>
        <NumberField
          label="Count"
          {...onFieldStep(port.n, SPEAKER_STEPS.count)}
          min={1}
          onChange={(n) => onChange({ ...port, n: Math.max(1, Math.round(n)) })}
        />
        <NumberField
          label={SPEAKER_TEXT.slotNarrow}
          {...onFieldStep(h, SPEAKER_STEPS.slotHIn)}
          min={0.25}
          onChange={(slotH) => onChange({ ...port, h: slotH })}
        />
        <PortLengthField port={port} onChange={(l) => onChange({ ...port, len: l })} />
      </div>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.slotLongSetByTip}>{SPEAKER_TEXT.slotLongSetBy}</Tooltip>}
        className="mb-2"
        value={port.w === undefined ? SET_BY.auto : SET_BY.custom}
        onChange={(v) => {
          const { w: _w, ...rest } = port;
          onChange(v === SET_BY.auto ? rest : { ...rest, w: shownIn(clearW) });
        }}
        options={entriesOf(SET_BY_NAMES)}
      />
      <NumberField
        label={SPEAKER_TEXT.slotLong}
        // Auto: the chamber's clear width, read-only
        {...onFieldStep(port.w ?? clearW, SPEAKER_STEPS.portSizeIn)}
        disabled={port.w === undefined}
        min={0.25}
        onChange={(w) => onChange({ ...port, w })}
        className="mb-3"
      />
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.slotFoldTip}>{SPEAKER_TEXT.slotFold}</Tooltip>}
        className="mb-3"
        value={!!port.folded}
        onChange={(folded) => {
          const { folded: _f, ...rest } = port;
          onChange(folded ? { ...rest, folded } : rest);
        }}
        options={[
          [false, SLOT_FOLD_NAMES.straight],
          [true, SLOT_FOLD_NAMES.folded],
        ]}
      />
    </>
  );
}

/**
 * Round tubes: their count and size, their ends (plain, or the PA sub's flared tubes, in a row at the bottom or in the
 * corners round the driver) and the elbows each takes.
 */
function RoundFields({
  port,
  chamber,
  onChange,
}: {
  port: SpeakerRoundPort;
  chamber: Pick<SpeakerChamber, "drivers">;
  onChange: (p: SpeakerPort) => void;
}) {
  const { n, dia, len, elbows } = port;
  const base = { shape: PORT_SHAPE.round, n, dia, len, elbows };
  const hasSub = chamber.drivers.some((d) => d.kind === DRIVER_KIND.sub);
  return (
    <>
      <div className={FIELD_ROW}>
        <NumberField
          label="Count"
          {...onFieldStep(n, SPEAKER_STEPS.count)}
          min={1}
          onChange={(count) => onChange({ ...port, n: count })}
        />
        <NumberField
          label="Diameter, in"
          {...onFieldStep(dia, SPEAKER_STEPS.portSizeIn)}
          min={0.5}
          onChange={(d) => onChange({ ...port, dia: d })}
        />
        <PortLengthField port={port} onChange={(l) => onChange({ ...port, len: l })} />
      </div>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.tubeEndsTip}>{SPEAKER_TEXT.tubeEnds}</Tooltip>}
        className="mb-3"
        value={port.flared ? TUBE_ENDS.flared : TUBE_ENDS.plain}
        onChange={(ends) =>
          onChange(ends === TUBE_ENDS.flared ? { ...base, flared: true, corners: false } : base)
        }
        options={entriesOf(TUBE_ENDS_NAMES)}
      />
      {port.flared && !hasSub && (
        <p className="text-xs text-stone-500 mb-3">{SPEAKER_TEXT.tubeEndsNoSub}</p>
      )}
      {port.flared && (
        <ToggleGroup
          label={SPEAKER_TEXT.tubeLayout}
          className="mb-3"
          value={port.corners ? TUBE_LAYOUT.corners : TUBE_LAYOUT.row}
          onChange={(at) =>
            onChange({ ...base, flared: true, corners: at === TUBE_LAYOUT.corners })
          }
          options={entriesOf(TUBE_LAYOUT_NAMES)}
        />
      )}
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.elbowsTip}>{SPEAKER_TEXT.elbows}</Tooltip>}
        className="mb-3"
        value={elbowCountOf(elbows ?? 0)}
        onChange={(e) => onChange({ ...port, elbows: e })}
        options={ELBOW_COUNTS.map((e) => [e, ELBOW_COUNT_NAMES[e]] as const)}
      />
    </>
  );
}

interface DriverProps {
  driver: SpeakerDriver;
  /** its chamber's width: the position shows from its left side */
  widthIn: number;
  /** its chamber's clear room, in (`wooferClearIn`): a woofer picked by type fits it */
  clearIn: number;
  /** its chamber as the layout places it: which places its horn fits */
  placed: PlacedChamber | undefined;
  bandOptions: readonly (readonly [BandId, string])[];
  onEdit: (edit: (d: SpeakerDriver) => SpeakerDriver) => void;
  onRemove: () => void;
}

/**
 * One driver entry: its type, part, count, place, band (a coaxial's two) and horn. Woofers are one list (the PA subs,
 * the PA mid-bass drivers and the Hi-fi woofers), with a size filter that starts at the woofer's own size.
 */
function DriverFields({
  driver,
  widthIn,
  clearIn,
  placed,
  bandOptions,
  onEdit,
  onRemove,
}: DriverProps) {
  const woofer = isWooferKind(driver.kind);
  const type = isWooferKind(driver.kind) ? DRIVER_KIND.woofer : driver.kind;
  /** every woofer size shows; else only the woofer's own size */
  const [allSizes, setAllSizes] = useState(false);
  const size = allSizes ? null : wooferSizeOf(driver);
  const woofers = size === null ? WOOFER_OPTIONS : WOOFER_OPTIONS.filter((o) => o.size === size);
  const coaxial = driver.kind === DRIVER_KIND.coaxial;
  const horns = hornOptions(driver.kind);
  const horn = driver.horn && hornById(driver.horn.hornId);
  /** a compression driver and its horn whose throat and exit differ */
  const exitGap = mismatchedHornExit(driver);
  /** the places its horn doesn't fit */
  const noFit = keysOf(HORN_PLACEMENT_NAMES).filter(
    (p) => horn && placed && !hornFits(horn, placed, p),
  );
  /** its horn at `placement`, with the mount a horn on a top takes where it applies */
  const placedAt = (hornId: string, placement: HornPlacement, mount: HornAttachment["mount"]) => {
    const picked = hornById(hornId);
    return {
      hornId,
      placement,
      mount: picked && takesHornMountAt(picked, placement) ? (mount ?? HORN_MOUNT_DEFAULT) : null,
    };
  };
  /** the mount under a compression driver's horn on the top, as the 3D view draws it; null where none applies */
  const cd =
    driver.kind === DRIVER_KIND.compression ? byId(CD_OPTIONS, driver.driverId) : undefined;
  const mountChoice =
    horn && cd && driver.horn?.mount ? hornMountChoice(horn, cd, widthIn, driver.horn.mount) : null;
  const [lowBand, highBand = lowBand] = driver.bands;
  const setBand = (slot: 0 | 1, band: BandId) =>
    onEdit((d) => ({
      ...d,
      bands: coaxial ? (slot === 0 ? [band, d.bands[1] ?? band] : [d.bands[0], band]) : [band],
    }));
  return (
    <div className="border-t border-stone-300 pt-3 mb-3">
      <div className="grid grid-cols-2 gap-x-3">
        <SelectField
          label="Type"
          className={woofer ? undefined : "col-span-2 mb-4"}
          options={TYPE_OPTIONS}
          value={byId(TYPE_OPTIONS, type)}
          onChange={(o) => {
            // the picker lists exactly the types (TYPE_OPTIONS)
            const next = keysOf(DRIVER_TYPE_NAMES).find((k) => k === o.id);
            if (!next || next === type) return;
            if (next === DRIVER_KIND.woofer) {
              setAllSizes(false);
              onEdit((d) => withWoofer(d, wooferFor(clearIn)));
            } else onEdit((d) => kindChanged(d, next));
          }}
        />
        {woofer && (
          <SelectField
            label="Size"
            options={SIZE_OPTIONS}
            value={size === null ? ALL_SIZES_OPTION : byId(SIZE_OPTIONS, String(size))}
            onChange={(o) => {
              const picked = WOOFER_SIZES.find((s) => String(s) === o.id);
              setAllSizes(picked === undefined);
              // a size the woofer is not: the first woofer of that size
              const first = WOOFER_OPTIONS.find((w) => w.size === picked);
              if (first && picked !== wooferSizeOf(driver)) onEdit((d) => withWoofer(d, first));
            }}
          />
        )}
      </div>
      {woofer ? (
        <SelectField
          label="Model"
          options={woofers}
          value={byId(woofers, driver.driverId)}
          onChange={(o) => onEdit((d) => withWoofer(d, o))}
          group={size === null ? (o) => wooferSizeName(o.size) : undefined}
        />
      ) : (
        <SelectField
          label="Model"
          options={DRIVER_OPTIONS[driver.kind]}
          value={byId(DRIVER_OPTIONS[driver.kind], driver.driverId)}
          onChange={(o) => onEdit((d) => ({ ...d, driverId: o.id }))}
        />
      )}
      <NumberField
        label="Count"
        value={driver.count}
        min={1}
        step={1}
        onChange={(count) => onEdit((d) => ({ ...d, count: Math.max(1, Math.round(count)) }))}
        className="mb-3"
      />
      <div className={FIELD_ROW}>
        {/* the group's center (`SpeakerDriver.position`): across from the center line, shown from the left side */}
        <NumberField
          label={SPEAKER_TEXT.fromLeft}
          value={shownIn(driver.position.xIn + widthIn / 2)}
          step={SPEAKER_STEPS.sizeIn}
          onChange={(v) =>
            onEdit((d) => ({ ...d, position: { ...d.position, xIn: v - widthIn / 2 } }))
          }
        />
        <NumberField
          // a horn on the top: back from the baffle's front
          label={onTop(driver) ? SPEAKER_TEXT.backFromFront : SPEAKER_TEXT.fromBottom}
          value={shownIn(driver.position.yIn)}
          step={SPEAKER_STEPS.sizeIn}
          onChange={(yIn) => onEdit((d) => ({ ...d, position: { ...d.position, yIn } }))}
        />
      </div>
      <ToggleGroup
        label={coaxial ? "Cone's band" : "Band"}
        className="mb-3"
        value={lowBand ?? null}
        onChange={(b) => setBand(0, b)}
        options={bandOptions}
      />
      {coaxial && (
        <ToggleGroup
          label="HF section's band"
          className="mb-3"
          value={highBand ?? null}
          onChange={(b) => setBand(1, b)}
          options={bandOptions}
        />
      )}
      {horns.length > 0 && (
        <SelectField
          label={<Tooltip tip={SPEAKER_TEXT.driverHornTip}>Horn or waveguide</Tooltip>}
          options={horns}
          value={driver.horn ? byId(horns, driver.horn.hornId) : NO_HORN}
          onChange={(o) =>
            onEdit((d) => {
              const picked = hornById(o.id);
              if (o.id === NO_HORN.id || !picked) return { ...d, horn: null };
              // a new horn takes the place its catalog entry suggests, where it fits
              const placement = placed
                ? defaultHornPlacement(picked, placed)
                : (d.horn?.placement ?? HORN_PLACEMENT.baffle);
              return { ...d, horn: placedAt(o.id, placement, d.horn?.mount ?? null) };
            })
          }
        />
      )}
      {exitGap && (
        <div className="mb-3">
          <Notice>
            {UI_TEXT.hornExitMismatch(
              formatInches(exitGap.horn.exit),
              formatInches(exitGap.driver.exit),
            )}
          </Notice>
        </div>
      )}
      {driver.horn && (
        <ToggleGroup
          label={<Tooltip tip={SPEAKER_TEXT.hornMountTip}>Horn mounting</Tooltip>}
          className="mb-3"
          value={driver.horn.placement}
          onChange={(placement) =>
            onEdit((d) =>
              d.horn ? { ...d, horn: placedAt(d.horn.hornId, placement, d.horn.mount) } : d,
            )
          }
          options={entriesOf(HORN_PLACEMENT_NAMES)}
          disabled={
            noFit.length
              ? { values: noFit, why: noFit.map((p) => HORN_PLACEMENT_NO_FIT[p]).join(" ") }
              : undefined
          }
        />
      )}
      {mountChoice && (
        <HornMountField
          choice={mountChoice}
          onChange={(mount) => onEdit((d) => (d.horn ? { ...d, horn: { ...d.horn, mount } } : d))}
          className="mb-3"
        />
      )}
      <Button size="xs" onClick={onRemove}>
        Remove driver
      </Button>
    </div>
  );
}

/** A driver turned to another kind: that kind's starting part, its count, place and first band kept. */
function kindChanged(d: SpeakerDriver, kind: DriverKind): SpeakerDriver {
  const [first] = d.bands;
  return driverOfKind(kind, {
    count: d.count,
    position: d.position,
    bands: kind === DRIVER_KIND.coaxial ? [first, d.bands[1] ?? first] : [first],
  });
}
