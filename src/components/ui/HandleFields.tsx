import { useUnits } from "../../hooks/useUnits";
import { NumberField } from "./NumberField";
import { Tooltip } from "./Tooltip";
import {
  HANDLE_AXIS_NAMES,
  HANDLE_OFFSET_RANGE,
  handleOffsetLabel,
  handleOffsetTip,
} from "../../constants/hardware";
import { keysOf } from "../../lib/records";
import { FIELD_ROW } from "../../styles/layout";
import type { BoxHandles } from "../../types";

interface Props {
  /** the handle choice's label ("Sub handles") */
  label: React.ReactNode;
  handles: BoxHandles;
  onChange: (change: Partial<BoxHandles>) => void;
}

/**
 * A box's handles' two offsets from the preset place, up and back. `HandleFields` shows them under its model; the
 * Speaker page's Construction fold shows them under its Handle type.
 */
export function HandleOffsetFields({ handles, onChange }: Pick<Props, "handles" | "onChange">) {
  const units = useUnits();
  return (
    <div className={FIELD_ROW}>
      {keysOf(HANDLE_AXIS_NAMES).map((k) => (
        <NumberField
          key={k}
          label={<Tooltip tip={handleOffsetTip(k)}>{handleOffsetLabel(k)}</Tooltip>}
          value={handles[k]}
          min={HANDLE_OFFSET_RANGE.min}
          max={HANDLE_OFFSET_RANGE.max}
          step={HANDLE_OFFSET_RANGE.step}
          quantity="boxLength"
          unit={units.unit("boxLength")}
          onChange={(v) => onChange({ [k]: v })}
        />
      ))}
    </div>
  );
}
