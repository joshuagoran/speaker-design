import { SwatchPicker } from "./SwatchPicker";
import { CABINET_FINISHES, PAINT_SWATCHES, cabinetFinishName } from "../../lib/data";

/** Before a paint swatch's name in its tooltip, on a picker that also offers named finishes. */
export const PAINTED_PREFIX = "Painted: ";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** The cabinet's finish: the named wood finishes, the paint swatches or a custom paint (PA and Hi-fi alike). */
export function CabinetFinishPicker({ value, onChange }: Props) {
  return (
    <SwatchPicker
      label="Cabinet finish"
      value={value}
      onChange={onChange}
      swatches={PAINT_SWATCHES}
      presets={CABINET_FINISHES}
      titlePrefix={PAINTED_PREFIX}
      note={cabinetFinishName(value)}
    />
  );
}

/** The baffle's paint: the paint swatches or a custom color (PA and Hi-fi alike). */
export function BaffleColorPicker({ value, onChange }: Props) {
  return (
    <SwatchPicker
      label="Baffle color"
      value={value}
      onChange={onChange}
      swatches={PAINT_SWATCHES}
      note={value}
    />
  );
}
