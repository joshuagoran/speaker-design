import { FoldHeading } from "../../../components/ui/FoldHeading.jsx";

/** Cost, weight and height totals for the current selection, per stack and per pair. */
export function TotalsSection({ planner }) {
  const { expandedSections, toggleSection, sectionClass, subDriver, midDriver, hornOption, compressionDriver, plinthHeightIn, effectiveMidBoxDims, subBox, midCabinetLb, subWeightLoadedLb, stackHeightIn } = planner;
  return (<>
        <section className="min-w-0 md:col-span-5 mt-6" style={{ fontFamily: "var(--font)" }}>
      <FoldHeading id="totals" title="Totals for the current selection" folds={expandedSections} toggle={toggleSection} className="mb-2" />
      <div className={sectionClass("totals")}>
      {(() => {
        const subBoxLb = subWeightLoadedLb - (subDriver.lb || 0); // same estimate as the stats row
        const midBoxLb = midCabinetLb;   // same estimate as the mid-bass stats row
        const rows = [
          ["Sub column", subDriver.price, subDriver.lb, subBoxLb, subBox.h],
          ["Mid-bass box", midDriver.price, midDriver.lb, midBoxLb, effectiveMidBoxDims.h],
          ["Compression driver", compressionDriver.price, compressionDriver.lb || 0, 0, 0],
          ["Horn", hornOption.price, (hornOption.lb || 0) + 1, 0, hornOption.size.h + 1],
        ];
        const sum = (i) => rows.reduce((a, r) => a + (r[i] || 0), 0);
        const stackLb = sum(2) + sum(3) + (plinthHeightIn ? 6 : 0);
        return (
          <div className="overflow-x-auto max-w-3xl"><table className="text-sm w-full min-w-[340px] border-collapse">
            <thead><tr className="text-stone-500 text-left border-b border-stone-300">
              <th className="py-1 pr-4 font-normal">Per stack</th><th className="py-1 pr-4 font-normal text-right">Drivers $</th><th className="py-1 pr-4 font-normal text-right">Driver lb</th><th className="py-1 pr-4 font-normal text-right">Cabinet lb</th><th className="py-1 pr-4 font-normal text-right">Box lb</th><th className="py-1 font-normal text-right">Height in</th>
            </tr></thead>
            <tbody>
              {rows.map(([n, pr, dl, cl, h]) => (
                <tr key={n} className="border-b border-stone-300"><td className="py-1 pr-4">{n}</td><td className="py-1 pr-4 text-right tabular-nums">{pr ? `$${pr}` : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{dl.toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{cl ? cl.toFixed(0) : "—"}</td><td className="py-1 pr-4 text-right tabular-nums">{(dl + cl).toFixed(0)}</td><td className="py-1 text-right tabular-nums">{h.toFixed(1)}</td></tr>
              ))}
              <tr className="font-medium"><td className="py-1 pr-4">One stack{plinthHeightIn ? ` + ${plinthHeightIn}" plinth` : ""}</td><td className="py-1 pr-4 text-right tabular-nums">${sum(1).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{sum(2).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(sum(3) + (plinthHeightIn ? 6 : 0)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{stackLb.toFixed(0)}</td><td className="py-1 text-right tabular-nums">{stackHeightIn.toFixed(0)}</td></tr>
              <tr className="font-medium text-stone-900"><td className="py-1 pr-4">Pair</td><td className="py-1 pr-4 text-right tabular-nums">${(2 * sum(1)).toLocaleString()}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * sum(2)).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * (sum(3) + (plinthHeightIn ? 6 : 0))).toFixed(0)}</td><td className="py-1 pr-4 text-right tabular-nums">{(2 * stackLb).toFixed(0)}</td><td></td></tr>
            </tbody>
          </table></div>
        );
      })()}
      </div>
    </section>
  </>);
}
