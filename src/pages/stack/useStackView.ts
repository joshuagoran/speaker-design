import { useMemo, useState } from "react";
import type { DispersionPlane, FrequencyPoint } from "../../types";
import { bandLine } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { formatHz } from "../../lib/format";
import { dispersionModeled, stackDispersionMap } from "../../lib/speaker/stackDispersion";
import { DISPERSION_START_PLANE } from "../../constants/dispersionPlanes";
import { stackCheckRows } from "./stackChips";
import type { StackPlanner } from "./useStack";

/**
 * What the Stack's results show, worked out once for every layout that shows them (the Stack page and the new shell):
 * each member's name, the modeled members, the crossover marks, each member's chart line, the dispersion map on its
 * plane, and the check rows.
 */
export function useStackView(stack: Pick<StackPlanner, "design" | "response" | "limits">) {
  const pal = usePalette();
  const { design, response, limits } = stack;
  const { members } = design.stack;
  /** each member's name: its speaker's, numbered */
  const names = useMemo(
    () =>
      members.map(
        (m, k) =>
          `${k + 1}. ${design.speakers.find((s) => s.id === m.speakerId)?.name ?? m.speakerId}`,
      ),
    [members, design.speakers],
  );
  const modeled = response.members.flatMap((m, k) => (m ? [{ m, k }] : []));
  /** the crossover corners, marked on the charts */
  const marks = [
    ...new Set(
      members.flatMap((m) =>
        [m.crossover.highpass?.hz, m.crossover.lowpass?.hz].filter((f) => f !== undefined),
      ),
    ),
  ].map((f) => ({ f, label: formatHz(f) }));
  /** each member's curve on a chart: its line, and its dot in the legend */
  const memberSeries = (curves: readonly { k: number; curve: FrequencyPoint[] }[]) =>
    curves.map(({ k, curve }) => ({
      curve,
      clipAtFloor: true,
      id: `m${k}`,
      label: names[k],
      ...bandLine(pal, k, members.length),
      swatch: "dot" as const,
      tint: "transparent",
    }));
  const [plane, setPlane] = useState<DispersionPlane>(DISPERSION_START_PLANE);
  const dispersion = useMemo(
    () =>
      modeled.length && dispersionModeled(design.speakers)
        ? stackDispersionMap(design.stack, design.speakers, response, plane)
        : null,
    [design, response, plane, modeled.length],
  );
  /** the checks, one compact row per crossing between members, then per band and chamber of each member */
  const checkRows = useMemo(
    () => stackCheckRows(design.stack, response, limits, names),
    [design.stack, response, limits, names],
  );
  return { names, modeled, marks, memberSeries, plane, setPlane, dispersion, checkRows };
}
