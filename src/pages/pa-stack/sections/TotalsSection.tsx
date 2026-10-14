import { FoldBody, FoldHeading } from "../../../components/ui/FoldHeading";
import type { PaPlanner } from "../hooks/usePaPlanner";
import { FONT } from "../../../styles/fonts";
import { paTotals, type PaTotalsInputs } from "../../../lib/pa/totals";
import { FLEX_STACK } from "../../../styles/layout";

interface Props {
  planner: Pick<PaPlanner, "expandedSections" | "toggleSection"> & PaTotalsInputs;
}

/** Cost, weight and height totals for the current selection, per stack and per pair. */
export function TotalsSection({ planner }: Props) {
  const { expandedSections, toggleSection, plinthHeightIn } = planner;
  return (
    <>
      <section className={`min-w-0 mt-6 ${FLEX_STACK}`} style={{ fontFamily: FONT }}>
        <FoldHeading
          id="totals"
          title="Totals for the current selection"
          folds={expandedSections}
          toggle={toggleSection}
        />
        <FoldBody open={expandedSections.totals}>
          {(() => {
            const { rows, price, driverLb, cabinetLb, stackLb, stackHeightIn } = paTotals(planner);
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
                      <td className="py-1 pr-4 text-right tabular-nums">{driverLb.toFixed(0)}</td>
                      <td className="py-1 pr-4 text-right tabular-nums">{cabinetLb.toFixed(0)}</td>
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
                        {(2 * driverLb).toFixed(0)}
                      </td>
                      <td className="py-1 pr-4 text-right tabular-nums">
                        {(2 * cabinetLb).toFixed(0)}
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
