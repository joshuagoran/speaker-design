import { useId, useRef } from "react";

/** Decimals a slider readout needs: 0 for whole steps, else as many as the step has (0.5 -> 1, 0.25 -> 2) */
export const countDecimals = (step: number) => {
  const t = String(step);
  const i = t.indexOf(".");
  return i < 0 ? 0 : t.length - i - 1;
};

/** The values a slider may take, as closed ranges, lowest first; between two of them it jumps over. */
export type SliderRanges = readonly (readonly [number, number])[];

/**
 * `ranges` within `min`–`max`, each shrunk to the slider's steps (counted from `min`), dropping any that holds no
 * step. The browser rounds a value off the steps, so an edge off them moves inward to the nearest step.
 */
export function rangesOnSteps(ranges: SliderRanges, min: number, max: number, step: number) {
  const k = 1e-9; // float slack, so an edge on a step stays put
  return ranges
    .map(
      ([a, b]) =>
        [
          min + Math.ceil((Math.max(a, min) - min) / step - k) * step,
          min + Math.floor((Math.min(b, max) - min) / step + k) * step,
        ] as const,
    )
    .filter(([a, b]) => b >= a);
}

/**
 * Where a slider moving from `from` to `to` lands when only `ranges` (lowest first) are allowed: `to` itself inside a
 * range; in a gap, the far side of it in the direction of travel (up: the next range's start; down: the last range's
 * end); past either end, that end.
 */
export function snapToRanges(ranges: SliderRanges, from: number, to: number) {
  const first = ranges[0],
    last = ranges[ranges.length - 1];
  if (!first || !last) return to;
  if (to <= first[0]) return first[0];
  if (to >= last[1]) return last[1];
  if (ranges.some(([a, b]) => to >= a && to <= b)) return to;
  const next = ranges.find(([a]) => a > to),
    prev = ranges.findLast(([, b]) => b < to);
  return to >= from ? (next?.[0] ?? last[1]) : (prev?.[1] ?? first[0]);
}

/**
 * Where a pointer drag lands when only `ranges` are allowed: as snapToRanges, from the pointer's last raw position
 * `from`, except that a pointer still inside the same gap holds `current` when it sits on that gap's edge. Without the
 * hold, each small move back and forth in a gap reads as a turn and flips the value from one side to the other.
 */
export function snapDrag(ranges: SliderRanges, from: number, to: number, current: number) {
  const gapAt = (x: number) => {
    if (ranges.some(([a, b]) => x >= a && x <= b)) return null;
    const below = ranges.findLast(([, b]) => b < x),
      above = ranges.find(([a]) => a > x);
    return below && above ? ([below[1], above[0]] as const) : null;
  };
  const gap = gapAt(to),
    was = gapAt(from);
  if (gap && was && gap[0] === was[0] && (current === gap[0] || current === gap[1])) return current;
  return snapToRanges(ranges, from, to);
}

interface Props {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  extra?: React.ReactNode;
  /**
   * The values it may take, when not all of `min`–`max`: stepping or dragging into a gap jumps across it, and it stops
   * at the last range's end. A value already in a gap (a saved one, say) still shows as it is.
   */
  ranges?: SliderRanges;
}

/** Labelled range slider with a numeric readout. */
export function Slider({ label, value, min, max, step, unit, onChange, extra, ranges }: Props) {
  const id = useId();
  const shown = typeof value === "number" ? value.toFixed(countDecimals(step)) : value;
  const allowed = ranges && rangesOnSteps(ranges, min, max, step);
  const top = allowed?.[allowed.length - 1]?.[1] ?? max;
  // While a pointer drags, the way it moves is from its own last position, not from the value it snapped to: from the
  // snapped value, a slow drag through a gap would read as turning back each move and flip from side to side. Inside a
  // gap the drag holds the side it jumped to (snapDrag). Keys step from the value itself, so a key press drops the
  // pointer's position.
  const dragFrom = useRef<number | null>(null);
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center gap-3 mb-1">
        <span className="flex items-center gap-2">
          <label htmlFor={id} className="text-sm text-stone-500">
            {label}
          </label>
          {extra}
        </span>
        <span className="text-sm tabular-nums font-medium">
          {shown}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={Math.max(min, top)}
        step={step}
        value={value}
        aria-valuetext={`${shown}${unit || ""}`}
        onPointerDown={() => {
          dragFrom.current = value;
        }}
        onPointerUp={() => {
          dragFrom.current = null;
        }}
        onPointerCancel={() => {
          dragFrom.current = null;
        }}
        onKeyDown={() => {
          dragFrom.current = null;
        }}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          const from = dragFrom.current;
          if (from !== null) dragFrom.current = v;
          if (!allowed) return onChange(v);
          const next =
            from === null ? snapToRanges(allowed, value, v) : snapDrag(allowed, from, v, value);
          if (next !== value) onChange(next);
        }}
        className="w-full accent-stone-900"
      />
    </div>
  );
}
