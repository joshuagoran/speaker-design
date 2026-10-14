import { SwatchPicker } from "./SwatchPicker";
import { CABINET_FINISHES, PAINT_SWATCHES, cabinetFinishName } from "../../lib/data";
import { cssHex, hornBodyColor, pickedHornColor } from "../../lib/pa/hornColor";
import {
  HORN_COLOR_CATALOG,
  HORN_COLOR_CATALOG_LABEL,
  HORN_FINISH_NAMES,
} from "../../constants/hornColor";
import { ON_DATA } from "../../styles/palette";
import type { Horn, PaDesignConfig } from "../../types";

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

/**
 * The horn body's paint: the horn's catalog finish (a preset that clears the picked color), the paint swatches or a
 * custom color (the PA page and the Speaker page alike). `value` undefined is the catalog finish.
 */
export function HornColorPicker({
  value,
  onChange,
  horn,
}: {
  value: PaDesignConfig["hornColor"];
  onChange: (value: PaDesignConfig["hornColor"]) => void;
  /** the horn whose catalog finish the preset shows */
  horn: Pick<Horn, "finish">;
}) {
  const presets = {
    [HORN_COLOR_CATALOG]: {
      name: HORN_COLOR_CATALOG_LABEL,
      swatch: cssHex(hornBodyColor(horn)),
      ink: horn.finish ? ON_DATA.white : ON_DATA.ink,
    },
  };
  return (
    <SwatchPicker
      label="Horn color"
      value={value ?? HORN_COLOR_CATALOG}
      onChange={(v) => onChange(pickedHornColor(v))}
      swatches={PAINT_SWATCHES}
      presets={presets}
      titlePrefix={PAINTED_PREFIX}
      note={value ?? `${HORN_COLOR_CATALOG_LABEL}: ${HORN_FINISH_NAMES[horn.finish ?? "printed"]}`}
    />
  );
}
