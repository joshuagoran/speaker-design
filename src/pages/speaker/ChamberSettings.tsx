import { useMemo, useState } from "react";
import type {
  BandId,
  ChamberBracing,
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
import { FoldBox } from "../../components/ui/FoldBox";
import { InsetGroup } from "../../components/ui/InsetGroup";
import { BandDot } from "../../components/ui/BandDot";
import { IconButton, TrashIcon } from "../../components/ui/IconButton";
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
  SLOT_KIND_NAMES,
  SLOT_PLACE_NAMES,
  SLOT_KIND_TIPS,
  SLOT_FOLD_NAMES,
  TUBE_ENDS_NAMES,
  TUBE_LAYOUT_NAMES,
  ELBOW_COUNT_NAMES,
  VENT_KIND_NAMES,
  VENT_PANEL_NAMES,
  HORN_PATH_NAMES,
} from "../../constants/speakerPage";
import {
  FILL_NAMES,
  FILL_TIPS,
  POSITION_LABELS,
  POSITION_TIPS,
  SETTINGS_TEXT,
} from "../../constants/speakerSettings";
import {
  BACK_JOINT_NAMES,
  BACK_JOINT_TIPS,
  BRACE_TARGET_RANGE_HZ,
  NO_BRACING,
  SPEAKER_BRACE_STYLE_NAMES,
  SPEAKER_BRACE_STYLE_TIPS,
} from "../../constants/bracing";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_DRIVE,
  HORN_PATH,
  HORN_PLACEMENT,
  PORT_SHAPE,
  SLOT_KIND,
  SLOT_PLACE,
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
import { onFieldStep, shownIn, shownTenth } from "./speakerFields";
import { FIELD_ROW, PAIR_ROW, PICK_ROW, TRIO_ROW } from "../../styles/layout";
import {
  hornGoalCheck,
  hornRoom,
  startingHorn,
  withChamberLoad,
  withGoalHorn,
  withHornDrive,
} from "./chamberLoad";
import { hornFromRecord } from "./hornrespImport";
import {
  defaultHornPlacement,
  driversOnBaffle,
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
import { formatHz, formatInches } from "../../lib/format";
import { mismatchedHornExit } from "../../lib/speaker/driverParts";
import { PANEL_NOMINAL_OPTIONS } from "../../lib/panel";
import { withDuctDivider } from "../../lib/speaker/cabinetPanels";
import { withSlotKind, withSlotPlace } from "../../lib/speaker/slotPort";
import { FILL_LEVEL_PCT, SPEAKER_STEPS } from "../../constants/speakerSteps";
import { maxSlotFins, slotFinsOf, slotFolds } from "../../lib/pa/calc";
import { stuffedLiters, tubeDriverOf } from "../../lib/speaker/chamberAir";
import { ELBOW_COUNTS, elbowCountOf } from "../../lib/tubeFold";
import { PA_PANEL_TARGET_HZ } from "../../lib/pa/bracing";
import { fillBracingSummary, fillLevelOf, driverSummary, ventSummary } from "./settingsSummaries";
import { atXForOffset, atYForOffset, chamberOffset } from "./chamberPlace";

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

/** The bracing choices, as the Bracing picker lists them (the style ids, and none). */
const BRACING_OPTIONS = entriesOf(SPEAKER_BRACE_STYLE_NAMES).map(([id, name]) => ({ id, name }));

/** The Bracing label's tooltip: each choice and what it does. */
const BRACING_TIP = (
  <>
    {keysOf(SPEAKER_BRACE_STYLE_NAMES).map((k) => (
      <span key={k} className="block">
        {SPEAKER_BRACE_STYLE_NAMES[k]}: {SPEAKER_BRACE_STYLE_TIPS[k]}
      </span>
    ))}
  </>
);

/** The Fiber fill buttons: each level named, with what to do in its tooltip. */
const FILL_OPTIONS = keysOf(FILL_LEVEL_PCT).map((k) => [k, FILL_NAMES[k], FILL_TIPS[k]] as const);

interface Props {
  index: number;
  chamber: SpeakerChamber;
  /** the model's reading of it */
  result: SpeakerChamberResponse | undefined;
  bands: readonly SpeakerBand[];
  /** the cabinet it is in, and where its layout places it: its vent's and horn mouth's places read them */
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">;
  placed: PlacedChamber | undefined;
  onEdit: (edit: (chamber: SpeakerChamber) => SpeakerChamber) => void;
  /** absent for the last chamber left */
  onRemove?: () => void;
}

/**
 * One chamber's settings, in sub-sections: Size (its type, path, size and, in Advanced, its position), then a Box's
 * Vent and Fill and bracing, or a horn's goals and Horn settings (and a straight horn's vent), then its Drivers.
 */
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
  const setDim = (k: keyof Dims3, v: number) =>
    onEdit((c) => ({ ...c, dims: { ...c.dims, [k]: v } }));
  const setVent = (v: ChamberVent) => onEdit((c) => ({ ...c, vent: v }));
  const setPort = (port: SpeakerPort) =>
    setVent(vent.kind === VENT_KIND.vented ? { ...vent, port } : { ...DEFAULT_VENTS.vented, port });
  const setBracing = (change: Partial<ChamberBracing>) =>
    onEdit((c) => ({ ...c, bracing: { ...c.bracing, ...change } }));
  const removeDriver = (i: number) => {
    setDriverRound((r) => r + 1);
    onEdit((c) => ({ ...c, drivers: c.drivers.filter((_, k) => k !== i) }));
  };
  const editDriver = (i: number, edit: (d: SpeakerDriver) => SpeakerDriver) =>
    onEdit((c) => ({ ...c, drivers: c.drivers.map((d, k) => (k === i ? edit(d) : d)) }));
  const firstBand = bands[0]?.id;
  /** the room a starting horn fills */
  const room = hornRoom(cabinet, chamber, placed);
  const box = chamber.load.kind === CHAMBER_LOAD.direct;
  /** a tapped horn: its chamber takes no vent */
  const tapped =
    chamber.load.kind === CHAMBER_LOAD.horn && chamber.load.horn.drive.kind === HORN_DRIVE.tapped;
  /** a folded horn: its vent is drawn in its side view, so the chamber's vent settings are hidden */
  const folded =
    chamber.load.kind === CHAMBER_LOAD.horn && chamber.load.horn.path === HORN_PATH.folded;
  /** how the horn meets its goals, and whether it holds more air than the chamber has */
  const netLiters = result?.netLiters ?? chamber.netLiters ?? undefined;
  /** the clear face, as numbers: the layout is new each render, the face often is not */
  const { x: clearX, y: clearY, w: clearW, h: clearH } = placed?.clear ?? {};
  const goalCheck = useMemo(
    () =>
      hornGoalCheck(
        cabinet,
        chamber,
        clearX === undefined || clearY === undefined || clearW === undefined || clearH === undefined
          ? undefined
          : { clear: { x: clearX, y: clearY, w: clearW, h: clearH } },
        netLiters,
      ),
    [cabinet, chamber, clearX, clearY, clearW, clearH, netLiters],
  );
  /** the chamber's clear room, in: a new woofer's size fits it */
  const clearIn = wooferClearIn(chamber, cabinet.panel.thicknessIn);
  /**
   * how many times a driver was removed: each driver's fields take it with their index as their key, so no field state
   * (the woofer size filter) carries over to the next driver
   */
  const [driverRound, setDriverRound] = useState(0);
  /** its position in the cabinet, as the Advanced fold shows it; with one chamber it is the cabinet */
  const offset = chamberOffset(cabinet.chambers, index);
  const alone = cabinet.chambers.length < 2;
  /** the fill: its level, and the air it makes the box act as beside it (a drawn tapped horn has no rear chamber) */
  const fill = !(folded && tapped) && (
    <FillField chamber={chamber} netLiters={result?.netLiters} onEdit={onEdit} />
  );
  const ventFold = !folded && (
    <FoldBox title={SETTINGS_TEXT.vent} summary={ventSummary(vent)}>
      <ToggleGroup
        label={SETTINGS_TEXT.ventType}
        value={vent.kind}
        onChange={(kind) => setVent(kind === vent.kind ? vent : DEFAULT_VENTS[kind])}
        options={entriesOf(VENT_KIND_NAMES)}
        disabled={
          tapped
            ? { values: [VENT_KIND.vented, VENT_KIND.radiator], why: SPEAKER_TEXT.ventTapped }
            : undefined
        }
      />
      {vent.kind === VENT_KIND.vented && (
        <>
          <ToggleGroup
            label="Port"
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
          {!vents && <p className="text-xs text-stone-500">{SPEAKER_TEXT.ventFixed}</p>}
          <NumberField
            label={<Tooltip tip={SPEAKER_TEXT.airSpeedTip}>Air speed limit</Tooltip>}
            value={vent.maxSpeedMs}
            min={1}
            step={0.5}
            unit="m/s"
            onChange={(maxSpeedMs) => setVent({ ...vent, maxSpeedMs })}
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
          <div className={PAIR_ROW}>
            <NumberField
              label="Count"
              value={vent.radiators.n}
              min={1}
              step={1}
              fill
              onChange={(n) => setVent({ ...vent, radiators: { ...vent.radiators, n } })}
            />
            <NumberField
              label={<Tooltip tip={SPEAKER_TEXT.radiatorMassTip}>Added mass</Tooltip>}
              value={vent.radiators.addG}
              min={0}
              step={SPEAKER_STEPS.addG}
              unit="g"
              fill
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
          onChange={(p) => onEdit((c) => ({ ...c, vent: withVentPosition(c.vent, p) }))}
        >
          {vents.position && (
            <ToggleGroup
              label={SPEAKER_TEXT.panel}
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
    </FoldBox>
  );
  const { braceStyle, braceTargetHz, backJoint } = chamber.bracing;
  return (
    <Card>
      <CardHeading
        action={
          onRemove && (
            <Button size="xs" onClick={onRemove}>
              {SETTINGS_TEXT.removeChamber}
            </Button>
          )
        }
      >
        Chamber {index + 1}
      </CardHeading>
      <InsetGroup title={SETTINGS_TEXT.size}>
        <div className={FIELD_ROW}>
          <ToggleGroup
            label={<Tooltip tip={SPEAKER_TEXT.loadTip}>{SPEAKER_TEXT.load}</Tooltip>}
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
            <ToggleGroup
              label={<Tooltip tip={SPEAKER_TEXT.hornPathTip}>{SPEAKER_TEXT.hornPath}</Tooltip>}
              value={chamber.load.horn.path}
              onChange={(path) =>
                onEdit((c) =>
                  c.load.kind === CHAMBER_LOAD.horn
                    ? {
                        ...c,
                        load: { ...c.load, horn: { ...c.load.horn, path } },
                        // a folded horn's vent is drawn: its chamber is sealed (its vent settings are hidden)
                        ...(path === HORN_PATH.folded ? { vent: DEFAULT_VENTS.sealed } : {}),
                      }
                    : c,
                )
              }
              options={entriesOf(HORN_PATH_NAMES)}
            />
          )}
        </div>
        <div className={TRIO_ROW}>
          {(["w", "h", "d"] as const).map((k) => (
            <NumberField
              key={k}
              label={{ w: "Width", h: "Height", d: "Depth" }[k]}
              value={shownIn(chamber.dims[k])}
              min={1}
              step={SPEAKER_STEPS.sizeIn}
              fill
              onChange={(v) => setDim(k, v)}
            />
          ))}
        </div>
        {/* most designs never move a chamber: its position waits in a closed fold */}
        <SettingsFold
          title={SETTINGS_TEXT.advanced}
          summary={SETTINGS_TEXT.chamberAt(shownIn(offset.x), shownIn(offset.y))}
        >
          <div className={PAIR_ROW}>
            {/* its center from the cabinet's center line, its bottom from the cabinet's bottom (lib: `SpeakerChamber.at`) */}
            <NumberField
              label={
                <Tooltip tip={alone ? POSITION_TIPS.oneChamber : POSITION_TIPS.chamberX}>
                  {POSITION_LABELS.x}
                </Tooltip>
              }
              value={shownIn(offset.x)}
              step={SPEAKER_STEPS.sizeIn}
              disabled={alone}
              fill
              onChange={(x) =>
                onEdit((c) => ({
                  ...c,
                  at: { ...c.at, xIn: atXForOffset(cabinet.chambers, index, x) },
                }))
              }
            />
            <NumberField
              label={
                <Tooltip tip={alone ? POSITION_TIPS.oneChamber : POSITION_TIPS.chamberY}>
                  {POSITION_LABELS.y}
                </Tooltip>
              }
              value={shownIn(offset.y)}
              min={0}
              step={SPEAKER_STEPS.sizeIn}
              disabled={alone}
              fill
              onChange={(y) =>
                onEdit((c) => ({
                  ...c,
                  at: { ...c.at, yIn: atYForOffset(cabinet.chambers, index, y) },
                }))
              }
            />
          </div>
        </SettingsFold>
      </InsetGroup>
      {box && (
        <>
          {ventFold}
          <FoldBox title={SETTINGS_TEXT.fillBracing} summary={fillBracingSummary(chamber)}>
            {fill}
            <div className={PAIR_ROW}>
              <SelectField
                label={<Tooltip tip={BRACING_TIP}>{SETTINGS_TEXT.bracing}</Tooltip>}
                options={BRACING_OPTIONS}
                value={byId(BRACING_OPTIONS, braceStyle)}
                onChange={(o) => {
                  // the picker lists exactly the choices (BRACING_OPTIONS)
                  const style = keysOf(SPEAKER_BRACE_STYLE_NAMES).find((k) => k === o.id);
                  if (style) setBracing({ braceStyle: style });
                }}
              />
              {braceStyle !== NO_BRACING && (
                <NumberField
                  label={
                    <Tooltip tip={SPEAKER_TEXT.braceTargetTip(formatHz(PA_PANEL_TARGET_HZ))}>
                      {SETTINGS_TEXT.braceTarget}
                    </Tooltip>
                  }
                  value={braceTargetHz}
                  min={BRACE_TARGET_RANGE_HZ.min}
                  max={BRACE_TARGET_RANGE_HZ.max}
                  step={10}
                  unit="Hz"
                  fill
                  onChange={(v) =>
                    setBracing({
                      braceTargetHz: Math.min(
                        BRACE_TARGET_RANGE_HZ.max,
                        Math.max(BRACE_TARGET_RANGE_HZ.min, v),
                      ),
                    })
                  }
                />
              )}
            </div>
            <ToggleGroup
              label={SETTINGS_TEXT.backPanel}
              value={backJoint}
              onChange={(v) => setBracing({ backJoint: v })}
              options={keysOf(BACK_JOINT_NAMES).map(
                (id) => [id, BACK_JOINT_NAMES[id], BACK_JOINT_TIPS[id]] as const,
              )}
            />
          </FoldBox>
        </>
      )}
      {chamber.load.kind === CHAMBER_LOAD.horn && (
        <>
          <HornSettings
            horn={chamber.load.horn}
            drivers={chamber.drivers}
            wallIn={cabinet.panel.thicknessIn}
            fit={goalCheck?.fit ?? null}
            overAir={goalCheck?.overAir ?? null}
            rearLiters={chamber.netLiters}
            onRearLiters={(liters) => onEdit((c) => ({ ...c, netLiters: liters }))}
            onEdit={(edit) =>
              onEdit((c) => {
                if (c.load.kind !== CHAMBER_LOAD.horn) return c;
                const horn = edit(c.load.horn);
                return {
                  ...c,
                  load: { ...c.load, horn },
                  // a folded horn's vent is drawn: its chamber is sealed (its vent settings are hidden)
                  ...(horn.path === HORN_PATH.folded ? { vent: DEFAULT_VENTS.sealed } : {}),
                };
              })
            }
            onDrive={(kind) => onEdit((c) => withHornDrive(c, kind))}
            onDesign={(goals) => {
              const drive = chamber.load.kind === CHAMBER_LOAD.horn && chamber.load.horn.drive.kind;
              if (!drive || drive === HORN_DRIVE.back) return false;
              const found = withGoalHorn(cabinet, chamber, placed, drive, goals);
              if (found) onEdit(() => found.chamber);
              return found !== null;
            }}
            onImport={(text) => {
              const read = hornFromRecord(
                text,
                chamber.load.kind === CHAMBER_LOAD.horn ? chamber.load.horn : null,
                room.depthIn,
              );
              if (read.ok)
                onEdit((c) => ({
                  ...c,
                  load: { kind: CHAMBER_LOAD.horn, horn: read.horn },
                  netLiters: read.netLiters,
                  vent: read.horn.path === HORN_PATH.folded ? DEFAULT_VENTS.sealed : read.vent,
                }));
              return read;
            }}
          >
            {fill}
            {mouth && (
              <PlaceFields
                label={SPEAKER_TEXT.mouthPlace}
                value={mouth.position}
                auto={mouth.auto}
                onChange={(p) => onEdit((c) => ({ ...c, load: withMouthPosition(c.load, p) }))}
              />
            )}
          </HornSettings>
          {ventFold}
        </>
      )}
      <InsetGroup title={SETTINGS_TEXT.drivers} boxed={false}>
        {chamber.drivers.length === 0 && (
          <p className="text-xs text-stone-500">{SETTINGS_TEXT.noDrivers}</p>
        )}
        {chamber.drivers.map((driver, i) => (
          <DriverFields
            key={`${driverRound}:${i}`}
            index={i}
            driver={driver}
            widthIn={chamber.dims.w}
            clearIn={clearIn}
            placed={placed}
            inBay={!driversOnBaffle(chamber)}
            bands={bands}
            onEdit={(edit) => editDriver(i, edit)}
            onRemove={() => removeDriver(i)}
          />
        ))}
        {firstBand && (
          <div>
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
              {SETTINGS_TEXT.addDriver}
            </Button>
          </div>
        )}
      </InsetGroup>
      {result &&
        [...new Set(result.gaps)].map((g) => (
          <Notice key={g}>{SPEAKER_TEXT.speakerGap(MODEL_GAP_TEXT[g])}</Notice>
        ))}
    </Card>
  );
}

/** The air a chamber's fill makes it act as, L, in the readout: whole liters from 100 L, else to 0.1 L. */
const actsAsLiters = (liters: number) =>
  liters >= 100 ? String(Math.round(liters)) : String(shownTenth(liters));

/**
 * A chamber's fiber fill: None, Lined, Half or Full (each button's tooltip says what to do), and beside it the air the
 * fill makes the box act as, from the model's net air, with its gain.
 */
function FillField({
  chamber,
  netLiters,
  onEdit,
}: {
  chamber: Pick<SpeakerChamber, "stuffingPct">;
  /** the model's net air, L; undefined while it is not known */
  netLiters: number | undefined;
  onEdit: (edit: (chamber: SpeakerChamber) => SpeakerChamber) => void;
}) {
  const acts = netLiters && netLiters > 0 ? stuffedLiters(chamber, netLiters) : null;
  return (
    <ToggleGroup
      label={
        <span className="flex items-center justify-between gap-2">
          <Tooltip tip={SETTINGS_TEXT.fillTip}>{SETTINGS_TEXT.fill}</Tooltip>
          {acts !== null && netLiters && (
            <span className="font-value text-stone-900 whitespace-nowrap">
              {SETTINGS_TEXT.actsAs(actsAsLiters(acts), Math.round((acts / netLiters - 1) * 100))}
            </span>
          )}
        </span>
      }
      value={fillLevelOf(chamber.stuffingPct)}
      onChange={(level) => onEdit((c) => ({ ...c, stuffingPct: FILL_LEVEL_PCT[level] }))}
      options={FILL_OPTIONS}
    />
  );
}

/**
 * A port's settings: round tubes (plain, or the PA sub's flared tubes in a row or the corners, and their elbows), a slot
 * (the PA sub's letterbox with its fins, or a plain slot: its opening's narrow side, and whether it folds up the back;
 * it always runs the chamber's whole clear face) or side ducts. Everything a template sets on a port is set here too.
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
  /** the chamber's clear width, in: a letterbox's fins fit it */
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
          value={port.n}
          onChange={(n) => onChange({ ...port, n })}
          options={[
            [1, "One"],
            [2, "Two"],
          ]}
        />
        <div className={FIELD_ROW}>
          <NumberField
            label="Throat"
            {...onFieldStep(port.throat, SPEAKER_STEPS.portSizeIn)}
            min={0.25}
            onChange={(throat) => onChange({ ...port, throat })}
          />
          <PortLengthField port={port} onChange={(len) => onChange({ ...port, len })} />
        </div>
        <ToggleGroup
          label={<Tooltip tip={SPEAKER_TEXT.ductDividersTip}>{UI_TEXT.ductDividers}</Tooltip>}
          value={port.divider}
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
 * run straight) or a plain slot (stacked, its narrow side, and whether it may fold up the back). A plain slot runs the
 * whole clear face: it has no long side to set.
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
      value={letterbox ? SLOT_KIND.letterbox : SLOT_KIND.plain}
      onChange={(k) => onChange(withSlotKind(port, k))}
      options={entriesOf(SLOT_KIND_NAMES).map(([k, name]) => [k, name, SLOT_KIND_TIPS[k]] as const)}
    />
  );
  const resets = <p className="text-xs text-stone-500">{SPEAKER_TEXT.slotKindResets}</p>;
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
        <p className="text-xs text-stone-500">
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
          label={<Tooltip tip={SPEAKER_TEXT.slotNarrowTip}>{SPEAKER_TEXT.slotNarrow}</Tooltip>}
          {...onFieldStep(h, SPEAKER_STEPS.slotHIn)}
          min={0.25}
          onChange={(slotH) => onChange({ ...port, h: slotH })}
        />
        <PortLengthField port={port} onChange={(l) => onChange({ ...port, len: l })} />
      </div>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.slotPlaceTip}>{SPEAKER_TEXT.slotPlace}</Tooltip>}
        value={port.place ?? SLOT_PLACE.floor}
        onChange={(place) => onChange(withSlotPlace(port, place))}
        options={entriesOf(SLOT_PLACE_NAMES)}
      />
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.slotFoldTip}>{SPEAKER_TEXT.slotFold}</Tooltip>}
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
  /** a cone driver: flared tubes are laid out round it */
  const flaredFits = tubeDriverOf(chamber) !== null;
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
          label="Diameter"
          {...onFieldStep(dia, SPEAKER_STEPS.portSizeIn)}
          min={0.5}
          onChange={(d) => onChange({ ...port, dia: d })}
        />
        <PortLengthField port={port} onChange={(l) => onChange({ ...port, len: l })} />
      </div>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.tubeEndsTip}>{SPEAKER_TEXT.tubeEnds}</Tooltip>}
        value={port.flared ? TUBE_ENDS.flared : TUBE_ENDS.plain}
        onChange={(ends) =>
          onChange(ends === TUBE_ENDS.flared ? { ...base, flared: true, corners: false } : base)
        }
        options={entriesOf(TUBE_ENDS_NAMES)}
        disabled={
          flaredFits ? undefined : { values: [TUBE_ENDS.flared], why: SPEAKER_TEXT.tubeEndsNoSub }
        }
      />
      {port.flared && !flaredFits && (
        <p className="text-xs text-stone-500">{SPEAKER_TEXT.tubeEndsNoSub}</p>
      )}
      {port.flared && (
        <ToggleGroup
          label={SPEAKER_TEXT.tubeLayout}
          value={port.corners ? TUBE_LAYOUT.corners : TUBE_LAYOUT.row}
          onChange={(at) =>
            onChange({ ...base, flared: true, corners: at === TUBE_LAYOUT.corners })
          }
          options={entriesOf(TUBE_LAYOUT_NAMES)}
        />
      )}
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.elbowsTip}>{SPEAKER_TEXT.elbows}</Tooltip>}
        value={elbowCountOf(elbows ?? 0)}
        onChange={(e) => onChange({ ...port, elbows: e })}
        options={ELBOW_COUNTS.map((e) => [e, ELBOW_COUNT_NAMES[e]] as const)}
      />
    </>
  );
}

interface DriverProps {
  /** its place in the chamber, from 0 */
  index: number;
  driver: SpeakerDriver;
  /** its chamber's width, in: a horn on the top's mount fits it */
  widthIn: number;
  /** its chamber's clear room, in (`wooferClearIn`): a woofer picked by type fits it */
  clearIn: number;
  /** its chamber as the layout places it: which places its horn fits */
  placed: PlacedChamber | undefined;
  /** its chamber's horn holds it in the bay behind the throat: the layout places it, with no position to set */
  inBay: boolean;
  bands: readonly SpeakerBand[];
  onEdit: (edit: (d: SpeakerDriver) => SpeakerDriver) => void;
  onRemove: () => void;
}

/**
 * One driver, in a box that folds to its summary ("2 × B&C 18TBX100 · Low band", with its band's dot) and a trash icon:
 * its type and size, model and count, horn, band (a coaxial's cone and HF section each pick one) and position. Woofers
 * are one list (the PA subs, the PA mid-bass drivers and the Hi-fi woofers), with a size filter that starts at the
 * woofer's own size. (The catalog has no triaxial type yet, so no driver picks three bands.)
 */
function DriverFields({
  index,
  driver,
  widthIn,
  clearIn,
  placed,
  inBay,
  bands,
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
  const bandOptions: readonly SelectOption[] = bands.map((b) => ({ id: b.id, name: b.name }));
  /** a band picker for one section of the driver */
  const bandField = (slot: 0 | 1, label: string, tip: string, value: BandId | undefined) => (
    <SelectField
      label={<Tooltip tip={tip}>{label}</Tooltip>}
      options={bandOptions}
      value={value === undefined ? undefined : byId(bandOptions, value)}
      onChange={(o) => setBand(slot, o.id)}
    />
  );
  /** each section's band: its dot in the summary */
  const sectionBands = coaxial ? [lowBand, highBand] : [lowBand];
  const top = onTop(driver);
  return (
    <FoldBox
      summary={driverSummary(driver, bands)}
      lead={sectionBands.map((id, k) => {
        const at = bands.findIndex((b) => b.id === id);
        return at < 0 ? null : <BandDot key={k} index={at} count={bands.length} />;
      })}
      actions={
        <IconButton size="sm" label={SETTINGS_TEXT.deleteDriver(index + 1)} onClick={onRemove}>
          <TrashIcon />
        </IconButton>
      }
    >
      <div className={PAIR_ROW}>
        <SelectField
          label="Type"
          className={woofer ? undefined : "col-span-2"}
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
      <div className={PICK_ROW}>
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
          fill
          onChange={(count) => onEdit((d) => ({ ...d, count: Math.max(1, Math.round(count)) }))}
        />
      </div>
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
        <Notice>
          {UI_TEXT.hornExitMismatch(
            formatInches(exitGap.horn.exit),
            formatInches(exitGap.driver.exit),
          )}
        </Notice>
      )}
      {driver.horn && (
        <ToggleGroup
          label={<Tooltip tip={SPEAKER_TEXT.hornMountTip}>Horn mounting</Tooltip>}
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
        />
      )}
      {coaxial ? (
        <div className={PAIR_ROW}>
          {bandField(0, SETTINGS_TEXT.coneBand, SETTINGS_TEXT.bandTip, lowBand)}
          {bandField(1, SETTINGS_TEXT.hfBand, SETTINGS_TEXT.hfBandTip, highBand)}
        </div>
      ) : (
        bandField(0, SETTINGS_TEXT.band, SETTINGS_TEXT.bandTip, lowBand)
      )}
      {/* in a horn's bay the layout stacks and centers the drivers: no position to set */}
      {!(inBay && !top) && (
        <div className={PAIR_ROW}>
          {/* the group's center (`SpeakerDriver.position`): across from the chamber's center line */}
          <NumberField
            label={<Tooltip tip={POSITION_TIPS.partX}>{POSITION_LABELS.x}</Tooltip>}
            value={shownIn(driver.position.xIn)}
            step={SPEAKER_STEPS.sizeIn}
            fill
            onChange={(xIn) => onEdit((d) => ({ ...d, position: { ...d.position, xIn } }))}
          />
          <NumberField
            // a horn on the top: back from the chamber's front edge
            label={
              top ? (
                <Tooltip tip={POSITION_TIPS.partZ}>{POSITION_LABELS.z}</Tooltip>
              ) : (
                <Tooltip tip={POSITION_TIPS.partY}>{POSITION_LABELS.y}</Tooltip>
              )
            }
            value={shownIn(driver.position.yIn)}
            step={SPEAKER_STEPS.sizeIn}
            fill
            onChange={(yIn) => onEdit((d) => ({ ...d, position: { ...d.position, yIn } }))}
          />
        </div>
      )}
    </FoldBox>
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
