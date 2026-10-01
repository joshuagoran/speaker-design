import { WarningChips } from "../../../components/chips/WarningChips.jsx";
import { StatTileGrid } from "../../../components/stats/StatTileGrid.jsx";
import { FoldHeading } from "../../../components/ui/FoldHeading.jsx";
import { StatRow } from "../../../components/optimizer/StatRow.jsx";
import { midChips } from "../../../lib/pa/chips.js";

/** Mid-bass results: headline stats, details table and warning chips. */
export function MidSection({ planner }) {
  const { expandedSections, toggleSection, sectionClass, midDriver, midAmpWatts, midBandTiltDb, midSize, subMidCrossoverHz, effectiveMidBoxDims, midVoltage, midGrossL, midNetL, midEffL, midModel, midThermalVoltage, midUsedVoltage, midWeightLoadedLb, midMaxCurveNearest, subMusicAtCrossover } = planner;
  return (<>
        <section className="mt-2" style={{ fontFamily: "var(--font)" }}>
      <FoldHeading id="mid" title="Mid-bass" folds={expandedSections} toggle={toggleSection} className="mb-3" />
      <div className={sectionClass("mid")}>
      {midModel ? (<>
        <StatTileGrid tiles={[
            ["Net volume", midNetL.toFixed(0), "L"],
            ["Box resonance Fc", midModel.Fc.toFixed(0), "Hz"],
            ["Box F3", midModel.f3.toFixed(0), "Hz"],
            [`Max SPL @ ${subMidCrossoverHz} Hz`, midMaxCurveNearest(subMidCrossoverHz).spl.toFixed(1), "dB"],
            ["Weight", midWeightLoadedLb.toFixed(0), "lb"],
          ]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
          {[
            ["Gross internal", `${midGrossL.toFixed(0)} L`, `acts like ${midEffL.toFixed(0)} L stuffed`],
            ["Qtc", midModel.Qtc.toFixed(2), midModel.Qtc > 0.8 ? "peaky" : midModel.Qtc < 0.5 ? "very damped" : "well damped"],
            ["Midband sensitivity", `${(midModel.ref - 20 * Math.log10(midVoltage / 2.83)).toFixed(1)} dB`, "2.83 V, half space, 1 m"],
            ...[subMidCrossoverHz, 200, 500].map((f) => { const m = midMaxCurveNearest(f);
              return [`Max SPL at ${f} Hz`, `${m.spl.toFixed(1)} dB`, `sine, ${m.who}-limited`]; }),
            ["Peak excursion", `${(midModel.peakX * midUsedVoltage / midVoltage).toFixed(1)} mm`, `${(midModel.peakX * midUsedVoltage / midVoltage / midDriver.ts.Xmax * 100).toFixed(0)}% of Xmax`, `At ${Math.round(midUsedVoltage * midUsedVoltage / 8)} W, with the ${subMidCrossoverHz} Hz highpass.`],
          ]
    .map(([k, v, note, tip]) => <StatRow key={k} k={k} v={v} note={note} tip={tip} />)}
        </div>
        <WarningChips chips={midChips({ midSize, midDims: effectiveMidBoxDims, Qtc: midModel.Qtc, f3: midModel.f3, peakX: midModel.peakX, xoLo: subMidCrossoverHz, ts: midDriver.ts, V: midVoltage, useV: midUsedVoltage, vTherm: midThermalVoltage, mAmpW: midAmpWatts,
              subMusicAtXo: subMusicAtCrossover, tilt: midBandTiltDb, midAtXo: subMusicAtCrossover != null ? midMaxCurveNearest(subMidCrossoverHz) : null })} className="mt-4" />
      </>) : (
        <p className="text-sm text-stone-500">{midDriver.name} can't be modelled yet: its parameters are incomplete. {midDriver.note}</p>
      )}
      </div>
    </section>
  </>);
}
