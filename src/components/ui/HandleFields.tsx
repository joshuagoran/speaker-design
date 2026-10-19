import { Slider } from "./Slider";
import { Tooltip } from "./Tooltip";
import {
  HANDLE_AXIS_NAMES,
  HANDLE_OFFSET_SLIDER,
  handleOffsetLabel,
  handleOffsetTip,
} from "../../constants/hardware";
import { keysOf } from "../../lib/records";
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
  return (
    <>
      {keysOf(HANDLE_AXIS_NAMES).map((k) => (
        <Slider
          key={k}
          label={<Tooltip tip={handleOffsetTip(k)}>{handleOffsetLabel(k)}</Tooltip>}
          value={handles[k]}
          min={HANDLE_OFFSET_SLIDER.min}
          max={HANDLE_OFFSET_SLIDER.max}
          step={HANDLE_OFFSET_SLIDER.step}
          unit="″"
          onChange={(v) => onChange({ [k]: v })}
        />
      ))}
    </>
  );
}
