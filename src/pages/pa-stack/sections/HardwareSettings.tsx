import { WarningChips } from "../../../components/chips/WarningChips";
import { HandleFields } from "../../../components/ui/HandleFields";
import { hardwareChip } from "../../../lib/pa/chips";
import { boxTakesHardware } from "../../../lib/pa/hardware";
import { HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../../../data/catalog/cabinet-hardware";
import { HARDWARE_PRESET_WORDS, hardwareNote } from "../../../constants/hardware";
import { PA_SETTINGS_TABS } from "../../../constants/paSettingsTabs";
import { keysOf } from "../../../lib/records";
import type { BoxHandles, HardwareBoxId } from "../../../types";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { GAP_Y } from "../../../styles/layout";

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
    <div className={GAP_Y}>
      {boxes.map((box) => (
        <HandleFields
          key={box}
          label={`${PA_SETTINGS_TABS[box]} handles`}
          handles={hardware[box]}
          onChange={(change) => setBox(box, change)}
        />
      ))}
      <div className="text-xs text-stone-500">
        {hardwareNote(
          {
            box: "Each box",
            name: INPUT_PLATE.name,
            jack: INPUT_JACK.name,
            place: HARDWARE_PRESET_WORDS.plate,
          },
          boxTakesHardware("mid", layout)
            ? {
                box: `${PA_SETTINGS_TABS.mid} box`,
                name: `${HORN_POSTS.name} for the horn`,
                place: HARDWARE_PRESET_WORDS.posts,
              }
            : null,
        )}
      </div>
      <WarningChips chips={chips} />
    </div>
  );
}
