import { CROSSOVER_SLOPES } from "../../constants/crossovers";
import type { CrossoverOrder } from "../../types";
import { ToggleButton } from "./ToggleButton";

interface Props {
  order: CrossoverOrder;
  onChange: (order: CrossoverOrder) => void;
  /** names the crossover the buttons set, for screen readers */
  label: string;
}

/** LR24 / LR48 buttons under a crossover's slider. */
export function CrossoverSlopeButtons({ order, onChange, label }: Props) {
  return (
    <div className="flex gap-1 -mt-1 mb-3" role="group" aria-label={label}>
      {CROSSOVER_SLOPES.map(([v, name]) => (
        <ToggleButton key={v} onClick={() => onChange(v)} on={order === v} size="xs">
          {name}
        </ToggleButton>
      ))}
    </div>
  );
}
