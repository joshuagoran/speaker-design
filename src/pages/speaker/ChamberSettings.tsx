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
  SpeakerPort,
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
import { HIFI_PASSIVES_BY_SIZE } from "../hifi/hifiDriverLists";
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
  VENT_KIND_NAMES,
  VENT_PANEL_NAMES,
} from "../../constants/speakerPage";
import {
  CHAMBER_LOAD,
  DRIVER_KIND,
  HORN_PLACEMENT,
  PORT_SHAPE,
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
import { FIELD_ROW, shownIn, shownTenth } from "./speakerFields";
import { hornRoom, startingHorn, withChamberLoad } from "./chamberLoad";
import {
  defaultHornPlacement,
  hornFits,
  onTop,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import { hornById } from "../../lib/data";
import { takesHornMountAt } from "../../lib/pa/hornMount";
import { HORN_MOUNT_DEFAULT } from "../../constants/hornMount";

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
            step={0.25}
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
            step={0.25}
            onChange={(xIn) => onEdit((c) => ({ ...c, at: { ...c.at, xIn } }))}
          />
          <NumberField
            label={SPEAKER_TEXT.fromBottom}
            value={shownIn(chamber.at.yIn)}
            step={0.25}
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
        step={0.5}
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
          <PortFields port={vent.port} onChange={setPort} />
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
              step={5}
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
 * A port's size: round tubes, a slot (its opening's narrow side, and its long side where it sets one: else the chamber's
 * clear width) or side ducts.
 */
function PortFields({ port, onChange }: { port: SpeakerPort; onChange: (p: SpeakerPort) => void }) {
  if (port.shape === PORT_SHAPE.slot)
    return (
      <div className={FIELD_ROW}>
        <NumberField
          label="Count"
          value={port.n}
          min={1}
          step={1}
          onChange={(n) => onChange({ ...port, n: Math.max(1, Math.round(n)) })}
        />
        <NumberField
          label={SPEAKER_TEXT.slotNarrow}
          value={shownIn(port.h)}
          min={0.25}
          step={0.125}
          onChange={(h) => onChange({ ...port, h })}
        />
        {port.w !== undefined && (
          <NumberField
            label={SPEAKER_TEXT.slotLong}
            value={shownIn(port.w)}
            min={0.25}
            step={0.25}
            onChange={(w) => onChange({ ...port, w })}
          />
        )}
        <NumberField
          label={SPEAKER_TEXT.portLength}
          value={shownIn(port.len)}
          min={0.5}
          step={0.5}
          onChange={(len) => onChange({ ...port, len })}
        />
      </div>
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
            value={shownIn(port.throat)}
            min={0.25}
            step={0.25}
            onChange={(throat) => onChange({ ...port, throat })}
          />
          <NumberField
            label={SPEAKER_TEXT.portLength}
            value={shownIn(port.len)}
            min={0.5}
            step={0.5}
            onChange={(len) => onChange({ ...port, len })}
          />
        </div>
      </>
    );
  return (
    <div className={FIELD_ROW}>
      <NumberField
        label="Count"
        value={port.n}
        min={1}
        step={1}
        onChange={(n) => onChange({ ...port, n })}
      />
      <NumberField
        label="Diameter, in"
        value={shownIn(port.dia)}
        min={0.5}
        step={0.25}
        onChange={(dia) => onChange({ ...port, dia })}
      />
      <NumberField
        label={SPEAKER_TEXT.portLength}
        value={shownIn(port.len)}
        min={0.5}
        step={0.5}
        onChange={(len) => onChange({ ...port, len })}
      />
    </div>
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
          step={0.25}
          onChange={(v) =>
            onEdit((d) => ({ ...d, position: { ...d.position, xIn: v - widthIn / 2 } }))
          }
        />
        <NumberField
          // a horn on the top: back from the baffle's front
          label={onTop(driver) ? SPEAKER_TEXT.backFromFront : SPEAKER_TEXT.fromBottom}
          value={shownIn(driver.position.yIn)}
          step={0.25}
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
