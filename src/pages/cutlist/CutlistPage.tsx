import { useEffect, useMemo, useState } from "react";
import type {
  CutPart,
  CutlistLayout,
  CutlistSettings,
  GrainDir,
  GrainPanel,
  GrainPreset,
} from "../../types";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { SheetDrawing } from "../../components/drawings/SheetDrawing";
import { PLYWOOD_SHEETS, formatInches, formatThickness, cutParts } from "../../lib/pa/calc";
import {
  FROM_OFFCUT,
  GRAIN_PRESETS,
  KERF_OPTIONS,
  TRIM_OPTIONS,
  grainPresetOf,
  layoutCutlist,
} from "../../lib/pa/cutlist";
import { runCutlistLayout } from "../../lib/pa/runCutlist";
import { entriesOf } from "../../lib/records";

interface Props {
  planner: Pick<
    PaPlanner,
    | "subDriver"
    | "midDriver"
    | "subBox"
    | "effectiveMidBoxDims"
    | "wallThicknessIn"
    | "baffleInsetIn"
    | "cornerJoint"
    | "setCornerJoint"
    | "plywoodSheetKind"
    | "setPlywoodSheetKind"
    | "boxSetCount"
    | "setBoxSetCount"
    | "kerfIn"
    | "setKerfIn"
    | "edgeTrimIn"
    | "setEdgeTrimIn"
    | "grain"
    | "setGrain"
    | "waterfall"
    | "setWaterfall"
    | "offcutShape"
    | "setOffcutShape"
    | "portStyle"
    | "subVentSpec"
    | "layout"
  >;
}

const PRESETS: [GrainPreset, string][] = [
  ["wrap", "Wrap"],
  ["horizontal", "Horizontal"],
  ["none", "None (MDF)"],
];
/** Each panel's grain choices: what `b` and `a` along the grain look like on the box. */
const GRAIN_ROWS: [GrainPanel, string, [GrainDir, string][]][] = [
  [
    "Side",
    "Sides",
    [
      ["b", "Vertical"],
      ["a", "Front-to-back"],
      ["any", "Any"],
    ],
  ],
  [
    "Top / bottom",
    "Top/bottom",
    [
      ["b", "Across"],
      ["a", "Front-to-back"],
      ["any", "Any"],
    ],
  ],
  [
    "Baffle",
    "Baffle",
    [
      ["b", "Vertical"],
      ["a", "Horizontal"],
      ["any", "Any"],
    ],
  ],
  [
    "Back",
    "Back",
    [
      ["b", "Vertical"],
      ["a", "Horizontal"],
      ["any", "Any"],
    ],
  ],
];

/** A part's size: along the grain first when it is locked, otherwise short side first. */
const sizeOf = (p: CutPart) => {
  const [first, second] =
    p.grain === "b"
      ? [p.b, p.a]
      : p.grain === "a"
        ? [p.a, p.b]
        : [Math.min(p.a, p.b), Math.max(p.a, p.b)];
  return `${formatInches(first)} × ${formatInches(second)}`;
};

/** Cutlist page: plywood parts for each box and how they pack onto sheets. */
export function CutlistPage({ planner }: Props) {
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
    kerfIn,
    setKerfIn,
    edgeTrimIn,
    setEdgeTrimIn,
    grain,
    setGrain,
    waterfall,
    setWaterfall,
    offcutShape,
    setOffcutShape,
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
  const settings: CutlistSettings = {
    sheet: plywoodSheetKind,
    stacks: boxSetCount,
    kerf: kerfIn,
    trim: edgeTrimIn,
    grain,
    waterfall,
    joint: cornerJoint,
    offcut: offcutShape,
  };
  // the inputs as one string: the layout is redone only when it changes
  const key = JSON.stringify({ parts, settings });
  // the quick deterministic layout shows at once; the worker's longer search replaces it when it is done
  const quick = useMemo(() => layoutCutlist(parts, settings), [key]);
  const [refined, setRefined] = useState<{ key: string; out: CutlistLayout } | null>(null);
  useEffect(() => {
    let live = true;
    runCutlistLayout({ parts, settings }).then(
      (out) => live && setRefined({ key, out }),
      () => {}, // the quick layout stays
    );
    return () => {
      live = false;
    };
  }, [key]);
  const cut = refined && refined.key === key ? refined.out : quick;
  const sheetSize = PLYWOOD_SHEETS[plywoodSheetKind];
  const preset = grainPresetOf(grain);
  const toggles = <T extends string | number | boolean>(
    label: React.ReactNode,
    value: T,
    set: (v: T) => void,
    options: readonly (readonly [T, React.ReactNode])[],
  ) => (
    <div>
      <div className="text-sm text-stone-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([k, l]) => (
          <ToggleButton key={String(k)} on={value === k} onClick={() => set(k)}>
            {l}
          </ToggleButton>
        ))}
      </div>
    </div>
  );
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 pb-16" style={{ fontFamily: "var(--font)" }}>
      <div className="flex flex-wrap gap-6 mb-5">
        {toggles(
          "Corner joints",
          cornerJoint,
          (k) => {
            setCornerJoint(k);
            // mitred boxes get waterfall strips by default
            setWaterfall(k === "miter");
          },
          [
            ["butt", "Butt"],
            ["rabbet", "Rabbet"],
            ["miter", "Miter"],
          ] as const,
        )}
        {toggles(
          "Sheet",
          plywoodSheetKind,
          setPlywoodSheetKind,
          entriesOf(PLYWOOD_SHEETS).map(([k, s]) => [k, s.name] as const),
        )}
        {toggles(
          "Stacks",
          boxSetCount,
          setBoxSetCount,
          [1, 2, 4].map((n) => [n, n] as const),
        )}
        {toggles(
          "Kerf",
          kerfIn,
          setKerfIn,
          KERF_OPTIONS.map((k) => [k.v, <span title={k.tip}>{k.label}</span>] as const),
        )}
        {toggles(
          <Tooltip tip="Squares off each factory edge before the parts are cut: factory edges are often dinged or slightly out of square.">
            Edge trim
          </Tooltip>,
          edgeTrimIn,
          setEdgeTrimIn,
          TRIM_OPTIONS.map((v) => [v, v ? `${formatInches(v)}″` : "None"] as const),
        )}
      </div>
      <div className="flex flex-wrap gap-6 mb-5">
        <div>
          <div className="text-sm text-stone-500 mb-1">
            <Tooltip tip="Which way the face grain runs on each panel. A locked panel lies along the sheet's length; Any lets the layout turn it to save ply.">
              Grain
            </Tooltip>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {PRESETS.map(([k, l]) => (
              <ToggleButton key={k} on={preset === k} onClick={() => setGrain(GRAIN_PRESETS[k])}>
                {l}
              </ToggleButton>
            ))}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-center">
            {GRAIN_ROWS.map(([panel, label, opts]) => (
              <div key={panel} className="contents">
                <div className="text-xs text-stone-500">{label}</div>
                <div className="flex flex-wrap gap-1">
                  {opts.map(([g, l]) => (
                    <ToggleButton
                      key={g}
                      size="xs"
                      on={grain[panel] === g}
                      onClick={() => setGrain({ ...grain, [panel]: g })}
                    >
                      {l}
                    </ToggleButton>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        {toggles(
          <Tooltip tip="Cuts each box's side, top and side in order from one strip, so the grain runs unbroken over both top corners. On by default with mitre joints.">
            Waterfall
          </Tooltip>,
          waterfall,
          setWaterfall,
          [
            [false, "Off"],
            [true, "Side-top-side"],
          ] as const,
        )}
        {toggles(
          <Tooltip tip="The least-full sheet is laid out again to leave one big usable piece: a strip the full length of the sheet, or a panel its full width. It never costs a sheet.">
            Keep offcut
          </Tooltip>,
          offcutShape,
          setOffcutShape,
          [
            ["strip", "Long strip"],
            ["panel", "Wide panel"],
          ] as const,
        )}
      </div>
      <p className="text-sm text-stone-500 mb-4 max-w-3xl">
        From the planner's current boxes: {formatThickness(wallThicknessIn)} walls, 3/4″ baffles set{" "}
        {formatInches(baffleInsetIn)}″ back, back panels in a rabbet. Sizes are finished dimensions
        in inches, along the grain first for grain-locked parts; {formatInches(kerfIn)}″ kerf
        allowed in the layout. Quantities are for {boxSetCount} stack{boxSetCount > 1 ? "s" : ""}.
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="text-sm w-full sm:min-w-[640px] border-collapse">
          <thead>
            <tr className="text-stone-500 text-left border-b border-stone-300">
              <th className="py-1 pr-3 font-normal">Box</th>
              <th className="py-1 pr-3 font-normal">Part</th>
              <th className="py-1 pr-3 font-normal text-right">Qty</th>
              <th className="py-1 pr-1 font-normal text-center" title="Grain direction">
                Grain
              </th>
              <th className="py-1 pr-3 font-normal text-right">Size</th>
              <th className="py-1 pr-3 font-normal">Ply</th>
              <th className="py-1 font-normal hidden sm:table-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            {cut.parts.map((p, i) => {
              const note = FROM_OFFCUT.has(p.part)
                ? `cut from offcut${p.note ? `; ${p.note}` : ""}`
                : p.note;
              return (
                <tr key={i} className="border-b border-stone-300 align-top">
                  <td className="py-1 pr-3">{p.box}</td>
                  <td className="py-1 pr-3">
                    {p.part}
                    {note && <span className="block sm:hidden text-xs text-stone-500">{note}</span>}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">{p.qty * boxSetCount}</td>
                  <td
                    className="py-1 pr-1 text-center"
                    title={p.grain ? "first size runs along the grain" : "either way"}
                  >
                    {p.grain ? "↕" : "·"}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums whitespace-nowrap">
                    {sizeOf(p)}
                  </td>
                  <td className="py-1 pr-3">{formatThickness(p.t)}</td>
                  <td className="py-1 text-stone-500 hidden sm:table-cell">{note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {vent.length > 0 && <p className="text-sm text-stone-500 mb-6">Also: {vent.join("; ")}.</p>}
      {cut.notes.map((n) => (
        <p key={n} className="text-sm text-orange-700 mb-2">
          {n}
        </p>
      ))}
      <SectionHeading className="mb-2">Sheet layout, {sheetSize.name}</SectionHeading>
      {cut.groups.map((g) => {
        const crossed = g.sheets.flatMap((s) => s.items.filter((it) => it.crossed));
        return (
          <div key={g.t} className="mb-6">
            <div className="text-sm font-medium mb-2">
              {formatThickness(g.t)} ply: {g.sheets.length} sheet{g.sheets.length > 1 ? "s" : ""}
              {g.offcut && (
                <span className="font-normal text-stone-500">
                  {" "}
                  · keeps a {formatInches(g.offcut.w)} × {formatInches(g.offcut.h)}″ offcut
                </span>
              )}
            </div>
            {g.tooBig.length > 0 && (
              <div className="text-sm text-red-700 mb-2">
                Doesn't fit on one {sheetSize.name} sheet:{" "}
                {g.tooBig.map((r) => `${r.box} ${r.part}`).join(", ")}.
              </div>
            )}
            {crossed.length > 0 && (
              <div className="text-sm text-orange-700 mb-2">
                Only fits across the grain: {crossed.map((r) => `${r.box} ${r.part}`).join(", ")}.
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
              {g.sheets.map((sh, i) => (
                <SheetDrawing
                  key={i}
                  sheet={sh}
                  S={sheetSize}
                  idx={i}
                  offcut={g.offcut?.sheet === i ? g.offcut : null}
                />
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-sm text-stone-500">
        <Tooltip tip="Every layout cuts with straight through-cuts (a table saw or track saw can make each one edge to edge). Grain runs along each sheet's length: load the sheet that way. Cleats and duct dividers come from offcuts and aren't in the sheet count. Driver cutouts are typical values; use the datasheet's.">
          About this layout
        </Tooltip>
      </p>
    </main>
  );
}
