import { BRACE_PANEL_NAMES } from "../../constants/bracing";
import { formatHz } from "../../lib/format";
import type { PanelResonance } from "../../types";

interface Props {
  /** each panel's first resonance: without braces (its own parts only) and, when braced, with them */
  panels: readonly PanelResonance[];
  /** the frequency every panel should clear; a panel under it reads red */
  targetHz?: number;
  /** whether to show the braced column (the boxes the rule braces) */
  braced?: boolean;
  caption: React.ReactNode;
}

/** A box's panels and their first plate resonances (lib/bracing), unbraced and braced, against the target. */
export function PanelResonanceTable({ panels, targetHz, braced = true, caption }: Props) {
  const tone = (hz: number) =>
    targetHz != null && hz < targetHz - 1e-9 ? "text-red-700" : "text-stone-900";
  return (
    <table className="text-sm w-full max-w-[420px] border-collapse mt-1">
      <caption className="text-left text-stone-500 pb-1">{caption}</caption>
      <thead>
        <tr className="text-stone-500 text-left border-b border-stone-300">
          <th className="py-1 pr-4 font-normal">Panel</th>
          <th className="py-1 pr-4 font-normal text-right">Unbraced</th>
          {braced && <th className="py-1 font-normal text-right">Braced</th>}
        </tr>
      </thead>
      <tbody>
        {panels.map((p) => (
          <tr key={p.id} className="border-b border-stone-300">
            <td className="py-1 pr-4">{BRACE_PANEL_NAMES[p.id]}</td>
            <td className={`py-1 pr-4 text-right tabular-nums ${braced ? "" : tone(p.bareHz)}`}>
              {formatHz(p.bareHz)}
            </td>
            {braced && (
              <td className={`py-1 text-right tabular-nums ${tone(p.hz)}`}>{formatHz(p.hz)}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
