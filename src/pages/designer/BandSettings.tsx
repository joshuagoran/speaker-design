import type { BandFilter, BandId, FilterType, SpeakerBand } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { BAND_NAMES, DRIVE_NAMES, FILTER_TYPE_NAMES } from "../../constants/designer";
import { HIFI_DRIVE } from "../../constants/hifiEngine";

/** The filter picker's first choice: no filter. */
const NO_FILTER: SelectOption = { id: "", name: "None" };

/** The filter picker: none, then each type. */
const FILTER_OPTIONS: readonly SelectOption[] = [
  NO_FILTER,
  ...entriesOf(FILTER_TYPE_NAMES).map(([id, name]) => ({ id, name })),
];

/** A filter's type from the picker's id; null for "None". */
const filterTypeOf = (id: string): FilterType | null =>
  keysOf(FILTER_TYPE_NAMES).find((t) => t === id) ?? null;

interface Props {
  band: SpeakerBand;
  /** the band ids it may take: its own and those no other band has */
  freeIds: readonly BandId[];
  /** a new filter's corner, Hz */
  newCornerHz: number;
  onEdit: (edit: (band: SpeakerBand) => SpeakerBand) => void;
  /** gives the band another id (its drivers follow) */
  onRename: (id: BandId) => void;
  /** absent for the last band left */
  onRemove?: () => void;
}

/** One band's settings: its id, highpass and lowpass, level, drive and amp power. */
export function BandSettings({ band, freeIds, newCornerHz, onEdit, onRename, onRemove }: Props) {
  const filterField = (side: "highpass" | "lowpass", label: string) => {
    const filter = band[side];
    const set = (f: BandFilter | null) => onEdit((b) => ({ ...b, [side]: f }));
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-end">
        <SelectField
          label={label}
          options={FILTER_OPTIONS}
          value={filter ? byId(FILTER_OPTIONS, filter.type) : NO_FILTER}
          onChange={(o) => {
            const type = filterTypeOf(o.id);
            set(type ? { hz: filter?.hz ?? newCornerHz, type } : null);
          }}
        />
        {filter && (
          <NumberField
            label="Corner"
            value={filter.hz}
            min={10}
            step={10}
            unit="Hz"
            onChange={(hz) => set({ ...filter, hz })}
          />
        )}
      </div>
    );
  };
  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold">{BAND_NAMES[band.id]} band</h4>
        {onRemove && (
          <Button size="xs" onClick={onRemove}>
            Remove band
          </Button>
        )}
      </div>
      <ToggleGroup
        label="Band"
        className="mb-3"
        value={band.id}
        onChange={onRename}
        options={freeIds.map((id) => [id, BAND_NAMES[id]] as const)}
      />
      {filterField("highpass", "Highpass")}
      {filterField("lowpass", "Lowpass")}
      <NumberField
        label="Level"
        // shown to 0.1 dB (the Hi-fi level match is exact)
        value={Math.round(band.levelDb * 10) / 10}
        step={0.5}
        unit="dB"
        onChange={(levelDb) => onEdit((b) => ({ ...b, levelDb }))}
      />
      <ToggleGroup
        label="Drive"
        value={band.drive}
        onChange={(drive) => onEdit((b) => ({ ...b, drive }))}
        options={entriesOf(DRIVE_NAMES)}
      />
      <NumberField
        // passive: the channel it shares
        label={band.drive === HIFI_DRIVE.passive ? "Shared amp channel" : "Amp power"}
        value={band.ampW}
        min={1}
        step={10}
        unit="W"
        onChange={(ampW) => onEdit((b) => ({ ...b, ampW }))}
      />
    </Card>
  );
}
