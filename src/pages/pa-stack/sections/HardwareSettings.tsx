import { WarningChips } from "../../../components/chips/WarningChips";
import { HandleFields } from "../../../components/ui/HandleFields";
import { hardwareChip } from "../../../lib/pa/chips";
import { boxTakesHardware } from "../../../lib/pa/hardware";
import { HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../../../data/catalog/cabinet-hardware";
import { HARDWARE_KIND_NAMES, HARDWARE_PRESET_WORDS } from "../../../constants/hardware";
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
  const chips = [subHardware, ...(midHardware ? [midHardware] : [])].map((plan) =>
    hardwareChip(plan),
  );
  return (
    <div className="mt-3">
      {boxes.map((box) => (
        <HandleFields
          key={box}
          label={`${PA_SETTINGS_TABS[box]} handles`}
          handles={hardware[box]}
          onChange={(change) => setBox(box, change)}
        />
      ))}
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
