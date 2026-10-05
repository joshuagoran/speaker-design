import { DISPERSION_PLANES } from "../../constants/dispersionPlanes";
import type { DispersionPlane } from "../../types";
import { ToggleButton } from "./ToggleButton";

interface Props {
  value: DispersionPlane;
  onChange: (plane: DispersionPlane) => void;
}

/** Horizontal / Vertical buttons above a dispersion map. */
export function DispersionPlaneToggle({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 mb-2" role="group" aria-label="Dispersion plane">
      {DISPERSION_PLANES.map(([p, name]) => (
        <ToggleButton key={p} onClick={() => onChange(p)} on={value === p}>
          {name}
        </ToggleButton>
      ))}
    </div>
  );
}
