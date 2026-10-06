import { ToggleGroup } from "../../../components/ui/ToggleGroup";
import { Slider } from "../../../components/ui/Slider";
import { Tooltip } from "../../../components/ui/Tooltip";
import { WarningChips } from "../../../components/chips/WarningChips";
import { hardwareChip } from "../../../lib/pa/chips";
import { boxTakesHardware, HANDLE_CHOICES, handlePart } from "../../../lib/pa/hardware";
import { HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../../../data/catalog/cabinet-hardware";
import {
  HANDLE_AXIS_NAMES,
  HANDLE_OFFSET_SLIDER,
  HARDWARE_KIND_NAMES,
  HARDWARE_PRESET_WORDS,
  NO_HANDLES,
  NO_HANDLES_LABEL,
  handleOffsetLabel,
  handleOffsetTip,
} from "../../../constants/hardware";
import { PA_SETTINGS_TABS } from "../../../constants/paSettingsTabs";
import { keysOf } from "../../../lib/records";
import type { BoxHandles, HardwareBoxId } from "../../../types";
import type { PaPlanner } from "../hooks/usePaPlanner";

interface Props {
  planner: Pick<PaPlanner, "hardware" | "setHardware" | "subHardware" | "midHardware" | "layout">;
}

/** The Build section's handles and input dishes: each box's handle model and offsets, and the fit chips. */
export function HardwareSettings({ planner }: Props) {
  const { hardware, setHardware, subHardware, midHardware, layout } = planner;
  const setBox = (box: HardwareBoxId, change: Partial<BoxHandles>) =>
    setHardware((h) => ({ ...h, [box]: { ...h[box], ...change } }));
  const boxes = keysOf(hardware).filter((b) => boxTakesHardware(b, layout));
  const chips = [subHardware, ...(midHardware ? [midHardware] : [])].map(hardwareChip);
  return (
    <div className="mt-3">
      {boxes.map((box) => {
        const h = hardware[box];
        return (
          <div key={box} className="mb-3">
            <ToggleGroup
              label={`${PA_SETTINGS_TABS[box]} handles`}
              value={h.model}
              onChange={(model) => setBox(box, { model })}
              options={HANDLE_CHOICES.map((id) => {
                const part = handlePart(id);
                return [
                  id,
                  id === NO_HANDLES || !part ? NO_HANDLES_LABEL : part.name,
                  part ? `One each side, $${part.price.toFixed(2)} each (${part.src})` : undefined,
                ] as const;
              })}
            />
            {h.model !== NO_HANDLES &&
              keysOf(HANDLE_AXIS_NAMES).map((k) => (
                <div key={k} className="mt-2">
                  <Slider
                    label={<Tooltip tip={handleOffsetTip(k)}>{handleOffsetLabel(k)}</Tooltip>}
                    value={h[k]}
                    min={HANDLE_OFFSET_SLIDER.min}
                    max={HANDLE_OFFSET_SLIDER.max}
                    step={HANDLE_OFFSET_SLIDER.step}
                    unit="″"
                    onChange={(v) => setBox(box, { [k]: v })}
                  />
                </div>
              ))}
          </div>
        );
      })}
      <div className="text-xs text-stone-500 mb-2">
        Each box: {INPUT_PLATE.name} {HARDWARE_KIND_NAMES.plate} with 2 × {INPUT_JACK.name} (in,
        link), {HARDWARE_PRESET_WORDS.plate}.{" "}
        {boxTakesHardware("mid", layout) &&
          `${PA_SETTINGS_TABS.mid} box: ${HORN_POSTS.name} for the horn, ${HARDWARE_PRESET_WORDS.posts}.`}
      </div>
      <WarningChips chips={chips} />
    </div>
  );
}
