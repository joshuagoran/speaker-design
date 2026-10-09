import { FoldBody, FoldHeading } from "../../../components/ui/FoldHeading";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { isRoundPort } from "../../../lib/pa/calc";
import { subTubeKit } from "../../../lib/pa/tubes";
import { priceTotal } from "../../../lib/pa/totals";
import { towerSpec } from "../../../lib/pa/tower";

/** The totals row for the boxes' hardware. */
const HARDWARE_ROW = "Handles, input dishes, jacks and horn posts (weight in the boxes)";

interface Props {
  planner: Pick<
    PaPlanner,
    | "expandedSections"
    | "toggleSection"
    | "subDriver"
    | "midDriver"
    | "hornOption"
    | "compressionDriver"
    | "plinthHeightIn"
    | "effectiveMidBoxDims"
    | "subBox"
    | "midCabinetLb"
    | "subWeightLoadedLb"
    | "stackHeightIn"
    | "portStyle"
    | "subVentSpec"
    | "wallThicknessIn"
    | "baffleInsetIn"
    | "subHardware"
    | "midHardware"
    | "isTower"
  >;
}

/** Cost, weight and height totals for the current selection, per stack and per pair. */
export function TotalsSection({ planner }: Props) {
  const {
    expandedSections,
    toggleSection,
    subDriver,
    midDriver,
    hornOption,
    compressionDriver,
    plinthHeightIn,
    effectiveMidBoxDims,
    subBox,
    midCabinetLb,
    subWeightLoadedLb,
    stackHeightIn,
    portStyle,
    subVentSpec,
    wallThicknessIn,
    baffleInsetIn,
    subHardware,
    midHardware,
    isTower,
  } = planner;
  return (
    <>
      <section className="min-w-0 mt-6" style={{ fontFamily: FONT }}>
        <FoldHeading
          id="totals"
          title="Totals for the current selection"
          folds={expandedSections}
          toggle={toggleSection}
          className="mb-2"
        />
        <FoldBody open={expandedSections.totals}>
          {(() => {
            const subBoxLb = subWeightLoadedLb - (subDriver.lb || 0); // same estimate as the stats row
            const midBoxLb = midCabinetLb; // same estimate as the mid-bass stats row
            const rows: [string, number | null, number, number, number][] = [
              ["Sub column", subDriver.price, subDriver.lb, subBoxLb, subBox.h],
              // the tower: its cabinet over the sub box, the mid chamber and the horn section
              isTower
                ? [
                    "Mid and horn sections",
                    midDriver.price,
                    midDriver.lb,
                    midBoxLb,
                    towerSpec(subBox, wallThicknessIn, hornOption).extH,
                  ]
                : ["Mid-bass box", midDriver.price, midDriver.lb, midBoxLb, effectiveMidBoxDims.h],
              ["Compression driver", compressionDriver.price, compressionDriver.lb || 0, 0, 0],
              ["Horn", hornOption.price, (hornOption.lb || 0) + 1, 0, hornOption.size.h + 1],
            ];
            // round tubes: the pipe and elbows from the catalog (no price where a part has no US vendor)
            if (isRoundPort(portStyle))
              rows.push([
                "Port tubes and elbows",
                subTubeKit(
                  subBox,
                  portStyle,
                  subVentSpec,
                  wallThicknessIn,
                  baffleInsetIn,
                  subDriver,
                ).price,
                0,
                0,
                0,
              ]);
            // the handles, input dishes, jacks and horn posts (their weight is in the boxes' rows)
            rows.push([HARDWARE_ROW, subHardware.price + (midHardware?.price ?? 0), 0, 0, 0]);
            const sum = (i: 2 | 3) => rows.reduce((a, r) => a + (r[i] || 0), 0);
            // a part with no price (null) leaves the totals short, and they carry the mark
            const price = priceTotal(rows.map((r) => r[1]));
            const stackLb = sum(2) + sum(3) + (plinthHeightIn ? 6 : 0);
            return (
              <div className="overflow-x-auto max-w-3xl">
                <table className="text-sm w-full min-w-[340px] border-collapse">
                  <thead>
                    <tr className="text-stone-500 text-left border-b border-stone-300">
                      <th className="py-1 pr-4 font-normal">Per stack</th>
                      <th className="py-1 pr-4 font-normal text-right">Parts $</th>
                      <th className="py-1 pr-4 font-normal text-right">Driver lb</th>
                      <th className="py-1 pr-4 font-normal text-right">Cabinet lb</th>
                      <th className="py-1 pr-4 font-normal text-right">Box lb</th>
                      <th className="py-1 font-normal text-right">Height in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([n, pr, dl, cl, h]) => (
                      <tr key={n} className="border-b border-stone-300">
                        <td className="py-1 pr-4">{n}</td>
                        <td className="py-1 pr-4 text-right tabular-nums">
                          {pr ? `$${Math.round(pr)}` : "—"}
                        </td>
                        <td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td>
                        <td className="py-1 pr-4 text-right tabular-nums">
                          {cl ? cl.toFixed(0) : "—"}
                        </td>
                        <td className="py-1 pr-4 text-right tabular-nums">
                          {(dl + cl).toFixed(0)}
                        </td>
                        <td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-1 pr-4">
                        One stack{plinthHeightIn ? ` + ${plinthHeightIn}" plinth` : ""}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        ${Math.round(price.sum).toLocaleString()}
                        {price.mark}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">{sum(2).toFixed(0)}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        {(sum(3) + (plinthHeightIn ? 6 : 0)).toFixed(0)}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">{stackLb.toFixed(0)}</td>
                      <td className="py-1 text-right tabular-nums">{stackHeightIn.toFixed(0)}</td>
                    </tr>
                    <tr className="font-medium text-stone-900">
                      <td className="py-1 pr-4">Pair</td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        ${Math.round(2 * price.sum).toLocaleString()}
                        {price.mark}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        {(2 * sum(2)).toFixed(0)}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        {(2 * (sum(3) + (plinthHeightIn ? 6 : 0))).toFixed(0)}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        {(2 * stackLb).toFixed(0)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
                {price.mark && (
                  <p className="text-xs text-stone-500 mt-1">
                    {price.mark} Some parts have no price, so the real total is higher.
                  </p>
                )}
              </div>
            );
          })()}
        </FoldBody>
      </section>
    </>
  );
}
