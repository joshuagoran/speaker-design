import { ToggleGroup } from "./ToggleGroup";
import { Slider } from "./Slider";
import { Tooltip } from "./Tooltip";
import { HANDLE_CHOICES, handlePart } from "../../lib/pa/hardware";
import {
  HANDLE_AXIS_NAMES,
  HANDLE_OFFSET_SLIDER,
  NO_HANDLES,
  NO_HANDLES_LABEL,
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
  className?: string;
}

/**
 * A box's handles: the model (or none), and with a model its two offsets from the preset place. The PA page's Build
 * settings and the Speaker page's Construction fold both show it.
 */
export function HandleFields({ label, handles, onChange, className = "mb-3" }: Props) {
  return (
    <div className={className}>
      <ToggleGroup
        label={label}
        value={handles.model}
        onChange={(model) => onChange({ model })}
        options={HANDLE_CHOICES.map((id) => {
          const part = handlePart(id);
          return [
            id,
            id === NO_HANDLES || !part ? NO_HANDLES_LABEL : part.name,
            part ? `One each side, $${part.price.toFixed(2)} each (${part.src})` : undefined,
          ] as const;
        })}
      />
      {handles.model !== NO_HANDLES &&
        keysOf(HANDLE_AXIS_NAMES).map((k) => (
          <div key={k} className="mt-2">
            <Slider
              label={<Tooltip tip={handleOffsetTip(k)}>{handleOffsetLabel(k)}</Tooltip>}
              value={handles[k]}
              min={HANDLE_OFFSET_SLIDER.min}
              max={HANDLE_OFFSET_SLIDER.max}
              step={HANDLE_OFFSET_SLIDER.step}
              unit="″"
              onChange={(v) => onChange({ [k]: v })}
            />
          </div>
        ))}
    </div>
  );
}
