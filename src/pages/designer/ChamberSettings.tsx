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
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { HIFI_PASSIVES_BY_SIZE } from "../hifi/hifiDriverLists";
import {
  DESIGNER_TEXT,
  DRIVER_KIND_NAMES,
  HORN_PLACEMENT_NAMES,
  HORN_PLACEMENT_NO_FIT,
  MODEL_GAP_TEXT,
  PORT_SHAPE_NAMES,
  SET_BY,
  SET_BY_NAMES,
  VENT_KIND_NAMES,
  VENT_PANEL_NAMES,
} from "../../constants/designer";
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
  driverOfKind,
  hornOptions,
} from "./designerParts";
import { mouthPlace, ventPlace, withMouthPosition, withVentPosition } from "./designerPlaces";
import { PlaceFields } from "./PlaceFields";
import { HornSettings } from "./HornSettings";
import { FIELD_ROW, shownIn } from "./designerFields";
import {
  defaultHornPlacement,
  hornFits,
  onTop,
  type PlacedChamber,
} from "../../lib/speaker/speakerLayout";
import { hornById } from "../../lib/data";
import { takesHornMountAt } from "../../lib/pa/hornMount";
import { HORN_MOUNT_DEFAULT } from "../../constants/hornMount";

/** The driver kinds as the kind picker lists them. */
const KIND_OPTIONS: readonly SelectOption[] = entriesOf(DRIVER_KIND_NAMES).map(([id, name]) => ({
  id,
  name,
}));

/** Where a chamber's net air comes from: worked out from its size (Auto), or typed in (Custom). */
const NET_AIR = SET_BY;

/** What the net air's Auto value takes off the inside volume. */
const NET_AIR_TIP = "Inside volume less walls, bracing, drivers and vent.";

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
  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold">Chamber {index + 1}</h4>
        {onRemove && (
          <Button size="xs" onClick={onRemove}>
            Remove chamber
          </Button>
        )}
      </div>
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
      <div className="text-sm text-stone-500 mb-1">Position</div>
      <div className={FIELD_ROW}>
        {/* the chamber's lower-left corner, in from the cabinet's (`SpeakerChamber.at`) */}
        <NumberField
          label="From left, in"
          value={shownIn(chamber.at.xIn)}
          step={0.25}
          onChange={(xIn) => onEdit((c) => ({ ...c, at: { ...c.at, xIn } }))}
        />
        <NumberField
          label="From bottom, in"
          value={shownIn(chamber.at.yIn)}
          step={0.25}
          onChange={(yIn) => onEdit((c) => ({ ...c, at: { ...c.at, yIn } }))}
        />
      </div>
      <ToggleGroup
        label={<Tooltip tip={NET_AIR_TIP}>Net air</Tooltip>}
        className="mb-2"
        value={chamber.netLiters === null ? NET_AIR.auto : NET_AIR.custom}
        onChange={(v) =>
          onEdit((c) => ({
            ...c,
            netLiters: v === NET_AIR.auto ? null : Math.round((result?.netLiters ?? 20) * 10) / 10,
          }))
        }
        options={entriesOf(SET_BY_NAMES)}
      />
      <NumberField
        label={<Tooltip tip={NET_AIR_TIP}>Liters</Tooltip>}
        // Auto: the model's value, read-only
        value={chamber.netLiters ?? Math.round((result?.netLiters ?? 0) * 10) / 10}
        disabled={chamber.netLiters === null}
        min={0.5}
        step={0.5}
        unit="L"
        onChange={(netLiters) => onEdit((c) => ({ ...c, netLiters }))}
        className="mb-3"
      />
      <NumberField
        label={
          <Tooltip tip="Fill makes the box act larger. 10% is normal. 15% is heavy.">
            Stuffing (%)
          </Tooltip>
        }
        value={chamber.stuffingPct}
        min={0}
        step={5}
        onChange={(stuffingPct) => onEdit((c) => ({ ...c, stuffingPct }))}
        className="mb-3"
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
          label={DESIGNER_TEXT.mouthPlace}
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
          {!vents && <p className="text-xs text-stone-500 mb-3">{DESIGNER_TEXT.ventFixed}</p>}
          <NumberField
            label="Air speed limit"
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
              label="Added mass, g"
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
            vents.what === VENT_KIND.radiator
              ? DESIGNER_TEXT.radiatorPlace
              : DESIGNER_TEXT.portPlace
          }
          value={vents.position}
          auto={vents.auto}
          widthIn={chamber.dims.w}
          onChange={(p) => onEdit((c) => ({ ...c, vent: withVentPosition(c.vent, p) }))}
        >
          {vents.position && (
            <ToggleGroup
              label={DESIGNER_TEXT.panel}
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
      <h5 className="text-sm font-semibold mt-1 mb-2">Drivers</h5>
      {chamber.drivers.map((driver, i) => (
        <DriverFields
          key={i}
          driver={driver}
          widthIn={chamber.dims.w}
          placed={placed}
          bandOptions={bandOptions}
          onEdit={(edit) => editDriver(i, edit)}
          onRemove={() => onEdit((c) => ({ ...c, drivers: c.drivers.filter((_, k) => k !== i) }))}
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
                driverOfKind(DRIVER_KIND.woofer, {
                  count: 1,
                  position: { xIn: 0, yIn: c.dims.h / 2 },
                  bands: [firstBand],
                }),
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
          label={DESIGNER_TEXT.slotNarrow}
          value={shownIn(port.h)}
          min={0.25}
          step={0.125}
          onChange={(h) => onChange({ ...port, h })}
        />
        {port.w !== undefined && (
          <NumberField
            label={DESIGNER_TEXT.slotLong}
            value={shownIn(port.w)}
            min={0.25}
            step={0.25}
            onChange={(w) => onChange({ ...port, w })}
          />
        )}
        <NumberField
          label={DESIGNER_TEXT.portLength}
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
            label={DESIGNER_TEXT.portLength}
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
        label={DESIGNER_TEXT.portLength}
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
  /** its chamber as the layout places it: which places its horn fits */
  placed: PlacedChamber | undefined;
  bandOptions: readonly (readonly [BandId, string])[];
  onEdit: (edit: (d: SpeakerDriver) => SpeakerDriver) => void;
  onRemove: () => void;
}

/** One driver entry: its kind, part, count, place, band (a coaxial's two) and horn. */
function DriverFields({ driver, widthIn, placed, bandOptions, onEdit, onRemove }: DriverProps) {
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
      <SelectField
        label="Kind"
        options={KIND_OPTIONS}
        value={byId(KIND_OPTIONS, driver.kind)}
        onChange={(o) => {
          // the picker lists exactly the kinds (KIND_OPTIONS)
          const kind = keysOf(DRIVER_KIND_NAMES).find((k) => k === o.id);
          if (kind && kind !== driver.kind) onEdit((d) => kindChanged(d, kind));
        }}
      />
      <SelectField
        label="Model"
        options={DRIVER_OPTIONS[driver.kind]}
        value={byId(DRIVER_OPTIONS[driver.kind], driver.driverId)}
        onChange={(o) => onEdit((d) => ({ ...d, driverId: o.id }))}
      />
      <NumberField
        label="Count"
        value={driver.count}
        min={1}
        step={1}
        onChange={(count) => onEdit((d) => ({ ...d, count: Math.max(1, Math.round(count)) }))}
      />
      <div className={FIELD_ROW}>
        {/* the group's center (`SpeakerDriver.position`): across from the center line, shown from the left side */}
        <NumberField
          label={DESIGNER_TEXT.fromLeft}
          value={shownIn(driver.position.xIn + widthIn / 2)}
          step={0.25}
          onChange={(v) =>
            onEdit((d) => ({ ...d, position: { ...d.position, xIn: v - widthIn / 2 } }))
          }
        />
        <NumberField
          // a horn on the top: back from the baffle's front
          label={onTop(driver) ? DESIGNER_TEXT.backFromFront : DESIGNER_TEXT.fromBottom}
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
          label="Horn or waveguide"
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
          label="Horn mounting"
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
