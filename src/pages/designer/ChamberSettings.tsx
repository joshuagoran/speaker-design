import type {
  BandId,
  ChamberVent,
  Dims3,
  DriverKind,
  SpeakerBand,
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
  BAND_NAMES,
  DRIVER_KIND_NAMES,
  MODEL_GAP_TEXT,
  PORT_SHAPE_NAMES,
  VENT_KIND_NAMES,
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
import { countText } from "./designerText";

/** The driver kinds as the kind picker lists them. */
const KIND_OPTIONS: readonly SelectOption[] = entriesOf(DRIVER_KIND_NAMES).map(([id, name]) => ({
  id,
  name,
}));

/** A row of number fields that wraps onto more lines where the pane is narrow. */
const ROW = "flex flex-wrap gap-x-3 gap-y-3 mb-3";

/** Where a chamber's net air comes from: worked out from its size (Auto), or typed in (Custom). */
const NET_AIR = {
  auto: "auto",
  custom: "custom",
} as const;

/** What the net air's Auto value takes off the inside volume. */
const NET_AIR_TIP = "Inside volume less walls, bracing, drivers and vent.";

interface Props {
  index: number;
  chamber: SpeakerChamber;
  /** the model's reading of it */
  result: SpeakerChamberResponse | undefined;
  bands: readonly SpeakerBand[];
  onEdit: (edit: (chamber: SpeakerChamber) => SpeakerChamber) => void;
  /** absent for the last chamber left */
  onRemove?: () => void;
}

/** One chamber's settings: size, air, place, vent and drivers. */
export function ChamberSettings({ index, chamber, result, bands, onEdit, onRemove }: Props) {
  const { vent } = chamber;
  const bandOptions = bands.map((b): readonly [BandId, string] => [b.id, BAND_NAMES[b.id]]);
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
      <div className={ROW}>
        {(["w", "h", "d"] as const).map((k) => (
          <NumberField
            key={k}
            label={`${{ w: "Width", h: "Height", d: "Depth" }[k]}, in`}
            value={chamber.dims[k]}
            min={1}
            step={0.25}
            onChange={(v) => setDim(k, v)}
          />
        ))}
      </div>
      <div className="text-sm text-stone-500 mb-1">Position</div>
      <div className={ROW}>
        {/* the chamber's lower-left corner, in from the cabinet's (`SpeakerChamber.at`) */}
        <NumberField
          label="From left, in"
          value={chamber.at.xIn}
          step={0.25}
          onChange={(xIn) => onEdit((c) => ({ ...c, at: { ...c.at, xIn } }))}
        />
        <NumberField
          label="From bottom, in"
          value={chamber.at.yIn}
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
        options={[
          [NET_AIR.auto, "Auto"],
          [NET_AIR.custom, "Custom"],
        ]}
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
        <p className="text-sm text-stone-500 mb-3">
          Horn loaded: {countText(chamber.load.horn.segments.length, "segment", "segments")} (its
          settings come in a later phase).
        </p>
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
          <NumberField
            label="Air speed limit"
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
          <div className={ROW}>
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
      <h5 className="text-sm font-semibold mt-1 mb-2">Drivers</h5>
      {chamber.drivers.map((driver, i) => (
        <DriverFields
          key={i}
          driver={driver}
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

/** A port's size: round tubes, a slot (the chamber's width unless it sets one) or side ducts. */
function PortFields({ port, onChange }: { port: SpeakerPort; onChange: (p: SpeakerPort) => void }) {
  if (port.shape === PORT_SHAPE.slot)
    return (
      <div className={ROW}>
        <NumberField
          label="Height, in"
          value={port.h}
          min={0.25}
          step={0.25}
          onChange={(h) => onChange({ ...port, h })}
        />
        <NumberField
          label="Length, in"
          value={port.len}
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
        <div className={ROW}>
          <NumberField
            label="Throat, in"
            value={port.throat}
            min={0.25}
            step={0.25}
            onChange={(throat) => onChange({ ...port, throat })}
          />
          <NumberField
            label="Length, in"
            value={port.len}
            min={0.5}
            step={0.5}
            onChange={(len) => onChange({ ...port, len })}
          />
        </div>
      </>
    );
  return (
    <div className={ROW}>
      <NumberField
        label="Count"
        value={port.n}
        min={1}
        step={1}
        onChange={(n) => onChange({ ...port, n })}
      />
      <NumberField
        label="Diameter, in"
        value={port.dia}
        min={0.5}
        step={0.25}
        onChange={(dia) => onChange({ ...port, dia })}
      />
      <NumberField
        label="Length, in"
        value={port.len}
        min={0.5}
        step={0.5}
        onChange={(len) => onChange({ ...port, len })}
      />
    </div>
  );
}

interface DriverProps {
  driver: SpeakerDriver;
  bandOptions: readonly (readonly [BandId, string])[];
  onEdit: (edit: (d: SpeakerDriver) => SpeakerDriver) => void;
  onRemove: () => void;
}

/** One driver entry: its kind, part, count, band (a coaxial's two) and horn. */
function DriverFields({ driver, bandOptions, onEdit, onRemove }: DriverProps) {
  const coaxial = driver.kind === DRIVER_KIND.coaxial;
  const horns = hornOptions(driver.kind);
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
            onEdit((d) => ({
              ...d,
              horn:
                o.id === NO_HORN.id
                  ? null
                  : {
                      hornId: o.id,
                      placement: d.horn?.placement ?? HORN_PLACEMENT.baffle,
                      mount: d.horn?.mount ?? null,
                    },
            }))
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
