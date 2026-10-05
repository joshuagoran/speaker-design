import { ON_DATA } from "../../styles/palette";
import { useId } from "react";
import type { PaintSwatch } from "../../types";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches: readonly PaintSwatch[];
  /** named presets, by key (the cabinet finishes) */
  presets?: Record<string, { name: string; swatch: string }>;
  titlePrefix?: string;
  note?: React.ReactNode;
}

/** Colour choice: optional named presets, a row of paint swatches and a custom picker */
export function SwatchPicker({
  label,
  value,
  onChange,
  swatches,
  presets,
  titlePrefix = "",
  note,
}: Props) {
  const id = useId();
  const preset = presets && Object.hasOwn(presets, value) ? presets[value] : undefined;
  const ring = (on: boolean) => (on ? "border-stone-900" : "border-stone-300");
  return (
    <div className="mb-5">
      <div id={id} className="text-sm text-stone-500 mb-1">
        {label}
      </div>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5 items-center">
        {presets &&
          Object.entries(presets).map(([k, f]) => (
            <button
              key={k}
              type="button"
              title={f.name}
              aria-pressed={value === k}
              onClick={() => onChange(k)}
              className={`px-2.5 h-7 rounded-full border-2 text-xs ${ring(value === k)}`}
              style={{ background: f.swatch, color: k === "walnut" ? ON_DATA.white : ON_DATA.ink }}
            >
              {f.name}
            </button>
          ))}
        {swatches.map(([hex, name]) => (
          <button
            key={hex}
            type="button"
            title={titlePrefix + name}
            aria-label={titlePrefix + name}
            aria-pressed={!preset && value.toLowerCase() === hex}
            onClick={() => onChange(hex)}
            className={`swatch w-7 h-7 rounded-full border-2 ${ring(!preset && value.toLowerCase() === hex)}`}
            style={{ background: hex }}
          />
        ))}
        <label
          className="swatch w-7 h-7 rounded-full border-2 border-stone-300 overflow-hidden cursor-pointer relative"
          title="Custom colour"
        >
          <span
            className="absolute inset-0"
            style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
          />
          <input
            type="color"
            aria-label={`Custom ${label.toLowerCase()}`}
            value={preset ? ON_DATA.white : value}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
        </label>
        <span className="text-xs text-stone-500 ml-1 tabular-nums">{note}</span>
      </div>
    </div>
  );
}
