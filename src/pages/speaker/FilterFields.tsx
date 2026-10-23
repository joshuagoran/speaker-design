import { Tooltip } from "../../components/ui/Tooltip";
import type { BandFilter, FilterType, SpeakerBand } from "../../types";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { FILTER_TYPE_NAMES } from "../../constants/speakerPage";
import { SETTINGS_TEXT } from "../../constants/speakerSettings";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";
import { PICK_ROW } from "../../styles/layout";
import { WithLock, type LockControl } from "../../components/ui/LockButton";

/** The filter types, as the picker lists them after its first choice (no filter). */
const TYPE_OPTIONS: readonly SelectOption[] = entriesOf(FILTER_TYPE_NAMES).map(([id, name]) => ({
  id,
  name,
}));

/** A filter's type from the picker's id; null for Off. */
const filterTypeOf = (id: string): FilterType | null =>
  keysOf(FILTER_TYPE_NAMES).find((t) => t === id) ?? null;

/** A high-pass and a low-pass, as a band and the external crossover carry them. */
type Filters = Pick<SpeakerBand, "highpass" | "lowpass">;

interface Props {
  filters: Filters;
  /** a new filter's corner, Hz */
  newCornerHz: number;
  /** what the picker calls no filter (default Off) */
  offName?: string;
  onEdit: (edit: (filters: Filters) => Filters) => void;
  /** the optimizer's lock beside each filter's type; none where the optimizer can't change it */
  locks?: Partial<Record<keyof Filters, LockControl | null>>;
}

/**
 * A high-pass and a low-pass: each a type in a dropdown, with its corner beside it. A filter that is off is one short
 * row. A band's filters and the external crossover take them.
 */
export function FilterFields({
  filters,
  newCornerHz,
  offName = SETTINGS_TEXT.filterOff,
  onEdit,
  locks = {},
}: Props) {
  const off: SelectOption = { id: "", name: offName };
  const options = [off, ...TYPE_OPTIONS];
  const field = (side: keyof Filters, label: string) => {
    const filter = filters[side];
    const set = (f: BandFilter | null) => onEdit((b) => ({ ...b, [side]: f }));
    const picker = (
      <SelectField
        label={label}
        inline={!filter}
        options={options}
        value={filter ? byId(options, filter.type) : off}
        onChange={(o) => {
          const type = filterTypeOf(o.id);
          set(type ? { hz: filter?.hz ?? newCornerHz, type } : null);
        }}
      />
    );
    if (!filter) return picker;
    return (
      <div className={PICK_ROW}>
        <WithLock lock={locks[side]}>{picker}</WithLock>
        <NumberField
          label={<Tooltip tip={SETTINGS_TEXT.cornerTip}>{SETTINGS_TEXT.corner}</Tooltip>}
          value={filter.hz}
          min={10}
          step={SPEAKER_STEPS.filterHz}
          unit="Hz"
          fill
          onChange={(hz) => set({ ...filter, hz })}
        />
      </div>
    );
  };
  return (
    <>
      {field("highpass", SETTINGS_TEXT.highPass)}
      {field("lowpass", SETTINGS_TEXT.lowPass)}
    </>
  );
}
