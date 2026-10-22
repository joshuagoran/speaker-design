import { useId } from "react";
import { ToggleGroup } from "./ToggleGroup";
import { NumberField } from "./NumberField";
import { UI_TEXT } from "../../constants/uiText";
import { MarkedText } from "./MarkedText";
import { COVERAGE_BANDS, SINGLE_FREQ_RANGE } from "../../lib/acoustics/coverage";
import { formatHz } from "../../lib/format";
import { GAP_Y } from "../../styles/layout";
import type { CoverageBand } from "../../types";

/** The named bands, in the picker's order. */
const NAMED_BANDS = ["sub", "kick", "mid", "high"] as const;

/** A frequency's place on the slider (0–1000, log), and back. */
const logPos = (f: number) =>
  Math.round(
    (Math.log(f / SINGLE_FREQ_RANGE[0]) / Math.log(SINGLE_FREQ_RANGE[1] / SINGLE_FREQ_RANGE[0])) *
      1000,
  );
const fromPos = (p: number) =>
  Math.round(
    SINGLE_FREQ_RANGE[0] * Math.pow(SINGLE_FREQ_RANGE[1] / SINGLE_FREQ_RANGE[0], p / 1000),
  );

interface Props {
  band: CoverageBand;
  freqHz: number;
  onBand: (band: CoverageBand) => void;
  onFreqHz: (f: number) => void;
  /** what one frequency shows, under its slider */
  oneNote: string;
}

/** What a coverage map shows: a named band (its range beside it), or one frequency on a log slider. */
export function CoverageBandPicker({ band, freqHz, onBand, onFreqHz, oneNote }: Props) {
  const freqId = useId();
  return (
    <div className={GAP_Y}>
      <ToggleGroup
        label="Band"
        value={band}
        onChange={onBand}
        options={[
          ...NAMED_BANDS.map(
            (b) =>
              [
                b,
                <>
                  {COVERAGE_BANDS[b].name}{" "}
                  <span className="text-xs opacity-70">
                    {formatHz(COVERAGE_BANDS[b].lo)}–{formatHz(COVERAGE_BANDS[b].hi)}
                  </span>
                </>,
              ] as const,
          ),
          ["one", UI_TEXT.oneFrequency] as const,
        ]}
      />
      {band === "one" && (
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <label htmlFor={freqId} className="block text-sm text-stone-500 mb-1">
                {UI_TEXT.frequency}
              </label>
              <input
                id={freqId}
                type="range"
                min={0}
                max={1000}
                step={1}
                value={logPos(freqHz)}
                aria-valuetext={formatHz(freqHz)}
                onChange={(e) => onFreqHz(fromPos(parseFloat(e.target.value)))}
                className="w-full accent-stone-900"
              />
            </div>
            <NumberField
              label={<span className="sr-only">{UI_TEXT.frequency}</span>}
              value={freqHz}
              min={SINGLE_FREQ_RANGE[0]}
              max={SINGLE_FREQ_RANGE[1]}
              step={1}
              unit="Hz"
              onChange={(f) => onFreqHz(Math.round(f))}
            />
          </div>
          <p className="text-xs text-stone-500 mt-1">
            <MarkedText text={oneNote} />
          </p>
        </div>
      )}
    </div>
  );
}
