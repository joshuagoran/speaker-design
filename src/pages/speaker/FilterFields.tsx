import { Tooltip } from "../../components/ui/Tooltip";
import type { BandFilter, FilterType, SpeakerBand } from "../../types";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { FILTER_TYPE_NAMES, SPEAKER_TEXT } from "../../constants/speakerPage";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";

/** The filter types, as the picker lists them after its first choice. */
const TYPE_OPTIONS: readonly SelectOption[] = entriesOf(FILTER_TYPE_NAMES).map(([id, name]) => ({
  id,
  name,
}));

/** A filter's type from the picker's id; null for the first choice (no filter). */
const filterTypeOf = (id: string): FilterType | null =>
  keysOf(FILTER_TYPE_NAMES).find((t) => t === id) ?? null;

/** A highpass and a lowpass, as a band and the input range carry them. */
type Filters = Pick<SpeakerBand, "highpass" | "lowpass">;

interface Props {
  filters: Filters;
  /** a new filter's corner, Hz */
  newCornerHz: number;
  /** what the picker calls no filter */
  offName: string;
  onEdit: (edit: (filters: Filters) => Filters) => void;
}

/** A highpass and a lowpass: each a type (or none) and its corner. A band's filters and the input range take them. */
export function FilterFields({ filters, newCornerHz, offName, onEdit }: Props) {
  const off: SelectOption = { id: "", name: offName };
  const options = [off, ...TYPE_OPTIONS];
  const field = (side: keyof Filters, label: string) => {
    const filter = filters[side];
    const set = (f: BandFilter | null) => onEdit((b) => ({ ...b, [side]: f }));
    return (
      // one grid for every row: the select spans both columns when there is no corner, so each row has the same width
      // and the select and the corner field sit on one line
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-start mb-4">
        <SelectField
          label={label}
          className={filter ? "" : "col-span-2"}
          options={options}
          value={filter ? byId(options, filter.type) : off}
          onChange={(o) => {
            const type = filterTypeOf(o.id);
            set(type ? { hz: filter?.hz ?? newCornerHz, type } : null);
          }}
        />
        {filter && (
          <NumberField
            label={<Tooltip tip={SPEAKER_TEXT.cornerTip}>Corner</Tooltip>}
            value={filter.hz}
            min={10}
            step={SPEAKER_STEPS.filterHz}
            unit="Hz"
            onChange={(hz) => set({ ...filter, hz })}
          />
        )}
      </div>
    );
  };
  return (
    <>
      {field("highpass", "Highpass")}
      {field("lowpass", "Lowpass")}
    </>
  );
}
