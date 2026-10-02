import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { SheetDrawing } from "../../components/drawings/SheetDrawing";
import {
  PLYWOOD_SHEETS,
  formatInches,
  formatThickness,
  cutParts,
  packSheets,
} from "../../lib/pa/calc";

/** Cutlist page: plywood parts for each box and how they pack onto sheets. */
export function CutlistPage({ planner }) {
  const {
    subDriver,
    midDriver,
    subBox,
    effectiveMidBoxDims,
    wallThicknessIn,
    baffleInsetIn,
    cornerJoint,
    setCornerJoint,
    plywoodSheetKind,
    setPlywoodSheetKind,
    boxSetCount,
    setBoxSetCount,
    portStyle,
    subVentSpec,
    layout,
  } = planner;
  const { parts, vent } = cutParts({
    sub: subDriver,
    mid: midDriver,
    subBox,
    midDims: effectiveMidBoxDims,
    wall: wallThicknessIn,
    inset: baffleInsetIn,
    joint: cornerJoint,
    portStyle,
    cVent: subVentSpec,
    layout,
  });
  const sheetSize = PLYWOOD_SHEETS[plywoodSheetKind],
    kerfIn = 0.125;
  const partsByThickness = {};
  parts.forEach((p) => {
    for (let i = 0; i < p.qty * boxSetCount; i++)
      (partsByThickness[p.t] = partsByThickness[p.t] || []).push(p);
  });
  const packedSheets = Object.keys(partsByThickness)
    .sort((a, b) => b - a)
    .map((t) => ({ t: +t, ...packSheets(partsByThickness[t], sheetSize, kerfIn) }));
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16" style={{ fontFamily: "var(--font)" }}>
      <div className="flex flex-wrap gap-6 mb-5">
        <div>
          <div className="text-sm text-stone-500 mb-1">Corner joints</div>
          <div className="flex gap-1">
            {[
              ["butt", "Butt"],
              ["rabbet", "Rabbet"],
              ["miter", "Miter"],
            ].map(([k, l]) => (
              <ToggleButton key={k} on={cornerJoint === k} onClick={() => setCornerJoint(k)}>
                {l}
              </ToggleButton>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm text-stone-500 mb-1">Sheet</div>
          <div className="flex gap-1">
            {Object.entries(PLYWOOD_SHEETS).map(([k, s]) => (
              <ToggleButton
                key={k}
                on={plywoodSheetKind === k}
                onClick={() => setPlywoodSheetKind(k)}
              >
                {s.name}
              </ToggleButton>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm text-stone-500 mb-1">Stacks</div>
          <div className="flex gap-1">
            {[1, 2, 4].map((n) => (
              <ToggleButton key={n} on={boxSetCount === n} onClick={() => setBoxSetCount(n)}>
                {n}
              </ToggleButton>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-stone-500 mb-4 max-w-3xl">
        From the planner's current boxes: {formatThickness(wallThicknessIn)} walls, 3/4″ baffles set{" "}
        {formatInches(baffleInsetIn)}″ back, back panels in a rabbet. Sizes are finished dimensions
        in inches (width × length); {formatInches(kerfIn)}″ kerf allowed in the layout. Quantities
        are for {boxSetCount} stack{boxSetCount > 1 ? "s" : ""}.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="text-sm w-full sm:min-w-[640px] border-collapse">
          <thead>
            <tr className="text-stone-500 text-left border-b border-stone-300">
              <th className="py-1 pr-3 font-normal">Box</th>
              <th className="py-1 pr-3 font-normal">Part</th>
              <th className="py-1 pr-3 font-normal text-right">Qty</th>
              <th className="py-1 pr-3 font-normal text-right">Width × length</th>
              <th className="py-1 pr-3 font-normal">Ply</th>
              <th className="py-1 font-normal hidden sm:table-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => (
              <tr key={i} className="border-b border-stone-300 align-top">
                <td className="py-1 pr-3">{p.box}</td>
                <td className="py-1 pr-3">
                  {p.part}
                  {p.note && (
                    <span className="block sm:hidden text-xs text-stone-500">{p.note}</span>
                  )}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">{p.qty * boxSetCount}</td>
                <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">
                  {formatInches(Math.min(p.a, p.b))} × {formatInches(Math.max(p.a, p.b))}
                </td>
                <td className="py-1 pr-3">{formatThickness(p.t)}</td>
                <td className="py-1 text-stone-500 hidden sm:table-cell">{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vent.length > 0 && <p className="text-sm text-stone-500 mb-6">Also: {vent.join("; ")}.</p>}
      <SectionHeading className="mb-2">Sheet layout, {sheetSize.name}</SectionHeading>
      {packedSheets.map((pk) => (
        <div key={pk.t} className="mb-6">
          <div className="text-sm font-medium mb-2">
            {formatThickness(pk.t)} birch: {pk.sheets.length} sheet{pk.sheets.length > 1 ? "s" : ""}
          </div>
          {pk.tooBig.length > 0 && (
            <div className="text-sm text-red-700 mb-2">
              Doesn't fit on one {sheetSize.name} sheet:{" "}
              {pk.tooBig.map((r) => `${r.box} ${r.part}`).join(", ")}.
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
            {pk.sheets.map((sh, i) => (
              <SheetDrawing key={i} sheet={sh} S={sheetSize} idx={i} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-sm text-stone-500">
        <Tooltip tip="Simple row-by-row layout, grain direction ignored. Treat it as a sheet count and a starting point for your own cut plan. Driver cutouts are typical values; use the datasheet's.">
          About this layout
        </Tooltip>
      </p>
    </main>
  );
}
