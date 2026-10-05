import { useMemo, useState } from "react";
import type {
  CornerJoint,
  CutBoxId,
  CutPart,
  CutStyle,
  CutlistSettings,
  GrainDir,
  GrainPanel,
  GrainPreset,
  OffcutShape,
} from "../../types";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import { Tooltip } from "../../components/ui/Tooltip";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { DetailsDropdown } from "../../components/ui/DetailsDropdown";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import {
  SETTINGS_SHEET_CLASS,
  SettingsSheetTabs,
  settingsSheetBodyClass,
  settingsSheetRoomClass,
} from "../../components/ui/SettingsSheetTabs";
import { StatTileGrid } from "../../components/stats/StatTileGrid";
import { SheetDrawing } from "../../components/drawings/SheetDrawing";
import { PLYWOOD_SHEETS, formatInches, formatThickness, cutParts } from "../../lib/pa/calc";
import {
  FROM_OFFCUT,
  GRAIN_PRESETS,
  KERF_OPTIONS,
  TRIM_OPTIONS,
  cutRowKey,
  cutRows,
  grainPresetOf,
  layoutCutlist,
} from "../../lib/pa/cutlist";
import { useCutlistLayout } from "../../hooks/useCutlistLayout";
import { useFolds } from "../../hooks/useFolds";
import { usePalette } from "../../hooks/useTheme";
import { entriesOf, keysOf } from "../../lib/records";
import { CUT_BOX_NAMES, CUT_BOX_TAGS, CUT_PART_NAMES } from "../../constants/cutParts";
import {
  CUTLIST_SETTINGS_SECTIONS,
  type CutlistSettingsSection,
} from "../../constants/settingsSections";
import { UI_TEXT } from "../../constants/uiText";

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
    | "cutStyle"
    | "setCutStyle"
    | "portStyle"
    | "subVentSpec"
    | "layout"
  >;
}

const JOINT_NAMES: Record<CornerJoint, string> = { butt: "Butt", rabbet: "Rabbet", miter: "Miter" };
const PRESET_NAMES: Record<GrainPreset, string> = {
  wrap: "Wrap",
  horizontal: "Horizontal",
  none: "None (MDF)",
};
const OFFCUT_NAMES: Record<OffcutShape, string> = { strip: "Long strip", panel: "Wide panel" };
const CUT_STYLE_NAMES: Record<CutStyle, string> = { sheets: "Fewest sheets", rips: "Rip first" };
const STACK_CHOICES = [1, 2, 4] as const;
/** Each panel's grain choices: what `b` and `a` along the grain look like on the box. */
const GRAIN_ROWS: [GrainPanel, string, [GrainDir, string][]][] = [
  [
    "side",
    "Sides",
    [
      ["b", "Vertical"],
      ["a", "Front-to-back"],
      ["any", "Any"],
    ],
  ],
  [
    "topBottom",
    "Top/bottom",
    [
      ["b", "Across"],
      ["a", "Front-to-back"],
      ["any", "Any"],
    ],
  ],
  [
    "baffle",
    "Baffle",
    [
      ["b", "Vertical"],
      ["a", "Horizontal"],
      ["any", "Any"],
    ],
  ],
  [
    "back",
    "Back",
    [
      ["b", "Vertical"],
      ["a", "Horizontal"],
      ["any", "Any"],
    ],
  ],
];

const plural = (n: number, what: string) => `${n} ${what}${n === 1 ? "" : "s"}`;
/** A part as the notes under a layout name it: its box, then the part, e.g. "Sub Baffle". */
const partName = (p: Pick<CutPart, "box" | "part">) =>
  `${CUT_BOX_NAMES[p.box]} ${CUT_PART_NAMES[p.part]}`;

/** A part's size: along the grain first when it is locked, otherwise short side first. */
const sizeOf = (p: CutPart): [string, string] => {
  const [first, second] =
    p.grain === "b"
      ? [p.b, p.a]
      : p.grain === "a"
        ? [p.a, p.b]
        : [Math.min(p.a, p.b), Math.max(p.a, p.b)];
  return [formatInches(first), formatInches(second)];
};
const trimName = (v: number) => (v ? `${formatInches(v)}″` : "None");

/** Cutlist page: the settings beside the plywood parts for each box and how they pack onto sheets. */
export function CutlistPage({ planner }: Props) {
  const pal = usePalette();
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
    cutStyle,
    setCutStyle,
    portStyle,
    subVentSpec,
    layout,
  } = planner;
  const folds = useFolds("cutlist.settingsFolds", keysOf(CUTLIST_SETTINGS_SECTIONS));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<CutlistSettingsSection>("boxes");
  const tabClass = (t: CutlistSettingsSection) => (tab === t ? "" : "max-md:hidden");
  /** the row (by `cutRowKey`) highlighted with its pieces on the sheets */
  const [hot, setHot] = useState<string | null>(null);

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
    cuts: cutStyle,
  };
  // the inputs as one string: the layout is redone only when it changes
  const key = JSON.stringify({ parts, settings });
  // the quick deterministic layout shows at once; the worker's longer search replaces it when it is done
  const quick = useMemo(() => layoutCutlist(parts, settings), [key]);
  const cut = useCutlistLayout({ parts, settings }) ?? quick;
  const sheetSize = PLYWOOD_SHEETS[plywoodSheetKind];
  const preset = grainPresetOf(grain);
  const kerfName = KERF_OPTIONS.find((k) => k.v === kerfIn)?.label ?? `${formatInches(kerfIn)}″`;

  // each row's tag, numbered per box in table order (S1, S2 … M1 …); its pieces on the sheets carry the same tag. Rows
  // are one per key (`cutRows`), so no two share a tag.
  const allRows = cutRows(cut.parts);
  const tags = new Map<string, string>();
  const byBox = new Map<CutBoxId, CutPart[]>();
  for (const p of allRows) {
    const rows = byBox.get(p.box) ?? [];
    rows.push(p);
    byBox.set(p.box, rows);
    tags.set(cutRowKey(p), `${CUT_BOX_TAGS[p.box]}${rows.length}`);
  }
  const tagOf = (p: CutPart) => tags.get(cutRowKey(p)) ?? CUT_BOX_TAGS[p.box];
  // the highlighted row, while it is still in the list (a settings change can take it away)
  const hotRow = hot != null && tags.has(hot) ? hot : null;
  const boxes = entriesOf(CUT_BOX_NAMES).flatMap(([box, name]) => {
    const rows = byBox.get(box);
    return rows
      ? [{ box, name, rows, pieces: rows.reduce((a, p) => a + p.qty, 0) * boxSetCount }]
      : [];
  });
  const drawn = new Set(
    cut.groups.flatMap((g) => g.sheets.flatMap((s) => s.items.map((it) => cutRowKey(it)))),
  );
  const hotDrawn = hotRow != null && drawn.has(hotRow) ? hotRow : null;
  const totalPieces = boxes.reduce((a, b) => a + b.pieces, 0);
  const totalSheets = cut.groups.reduce((a, g) => a + g.sheets.length, 0);
  const rips = cut.groups.reduce((a, g) => a + g.cuts.rips, 0);
  const crosscuts = cut.groups.reduce((a, g) => a + g.cuts.crosscuts, 0);
  const boxColour: Record<CutBoxId, string> = { sub: pal.subTint, mid: pal.midTint };

  const summaries: Record<CutlistSettingsSection, string> = {
    boxes: `${JOINT_NAMES[cornerJoint]} joints, ${plural(boxSetCount, "stack")}`,
    sheets: `${sheetSize.name}, ${kerfName} kerf, ${edgeTrimIn ? `${trimName(edgeTrimIn)} trim` : "no trim"}`,
    grain: `${preset ? PRESET_NAMES[preset] : "Custom"}${waterfall ? ", waterfall" : ""}`,
    cuts: `${CUT_STYLE_NAMES[cutStyle]}, keep ${OFFCUT_NAMES[cutStyle === "rips" ? "strip" : offcutShape].toLowerCase()}`,
  };
  const section = (id: CutlistSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={CUTLIST_SETTINGS_SECTIONS[id]}
      folds={folds}
      foldsAt="desktop"
      summary={summaries[id]}
    >
      <div className={`flex flex-col gap-4 pb-2 ${tabClass(id)}`}>{children}</div>
    </SettingsSection>
  );
  const th = "py-1 font-normal text-stone-500";
  const td = "py-1.5 align-top";

  const panelList = (
    <section aria-labelledby="cutlist-panels">
      <h3 id="cutlist-panels" className="text-lg font-bold mb-1">
        Panels
      </h3>
      <p className="text-sm text-stone-500 mb-2">
        Finished sizes in inches, along the grain first (↕) for grain-locked parts. Quantities for{" "}
        {plural(boxSetCount, "stack")}. Hover or focus a row to find its pieces on the sheets.
      </p>
      <div className="overflow-x-auto">
        <table className="text-sm w-full border-collapse tabular-nums">
          <thead>
            <tr className="text-left border-b border-stone-900">
              <th className={`${th} pr-2`}>Tag</th>
              <th className={`${th} pr-3`}>Part</th>
              <th className={`${th} pr-3 text-right`}>Qty</th>
              <th className={`${th} text-center`} colSpan={3}>
                Size, in
              </th>
              <th className={`${th} px-2 text-center`} title="Grain direction">
                Grain
              </th>
              <th className={`${th} text-right`}>Ply</th>
            </tr>
          </thead>
          {boxes.map(({ box, name, rows, pieces }) => (
            <tbody key={box}>
              <tr>
                <th
                  colSpan={8}
                  scope="rowgroup"
                  className="pt-4 pb-1 text-left border-b border-stone-300"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-bold">{name} box</span>
                    <span className="text-xs font-normal text-stone-500">
                      {plural(rows.length, "part")} · {plural(pieces, "piece")}
                    </span>
                  </span>
                </th>
              </tr>
              {rows.map((p, i) => {
                const k = cutRowKey(p);
                const isHot = hotRow === k;
                const note = FROM_OFFCUT.has(p.part)
                  ? `cut from offcut${p.note ? `; ${p.note}` : ""}`
                  : p.note;
                const [first, second] = sizeOf(p);
                return (
                  <tr
                    key={i}
                    tabIndex={0}
                    onMouseEnter={() => setHot(k)}
                    onMouseLeave={() => setHot(null)}
                    onFocus={() => setHot(k)}
                    onBlur={() => setHot(null)}
                    // the focus ring sits inside the row: drawn outside, the table's scroll box clips it away
                    className={`border-b border-stone-300 focus-visible:-outline-offset-2 ${isHot ? "bg-stone-300" : ""}`}
                  >
                    <td className={`${td} pr-2`}>
                      {/* the box's colour on the sheets, so the tag reads the same in both places */}
                      <span
                        className="inline-block min-w-[2.5rem] px-1 rounded border border-stone-500 text-center font-bold"
                        style={{ background: boxColour[p.box] }}
                      >
                        {tagOf(p)}
                      </span>
                    </td>
                    <td className={`${td} pr-3`}>
                      {CUT_PART_NAMES[p.part]}
                      {note && <span className="block text-xs text-stone-500">{note}</span>}
                    </td>
                    <td className={`${td} pr-3 text-right`}>{p.qty * boxSetCount}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>{first}</td>
                    <td className={`${td} px-1 text-center text-stone-500`}>×</td>
                    <td className={`${td} text-left whitespace-nowrap`}>{second}</td>
                    <td
                      className={`${td} px-2 text-center`}
                      title={p.grain ? "first size runs along the grain" : "either way"}
                    >
                      {p.grain ? "↕" : "·"}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>{formatThickness(p.t)}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t-2 border-stone-900 font-bold">
              <td className="py-1.5" colSpan={2}>
                Total
              </td>
              <td className="py-1.5 pr-3 text-right">{totalPieces}</td>
              <td className="py-1.5 text-stone-500 font-normal" colSpan={5}>
                {plural(allRows.length, "part")}, {plural(totalSheets, "sheet")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {vent.length > 0 && <p className="text-sm text-stone-500 mt-3">Also: {vent.join("; ")}.</p>}
    </section>
  );

  const sheetLayout = (
    <section aria-labelledby="cutlist-sheets">
      <h3 id="cutlist-sheets" className="text-lg font-bold mb-1">
        Sheet layout
      </h3>
      {cut.groups.map((g) => {
        const crossed = g.sheets.flatMap((s) => s.items.filter((it) => it.crossed));
        return (
          <div key={g.t} className="mb-6">
            <h4 className="text-base font-semibold">
              {formatThickness(g.t)} ply: {plural(g.sheets.length, "sheet")} of {sheetSize.name}
            </h4>
            <p className="text-sm text-stone-500 mb-3">
              {plural(g.cuts.rips, "full-length rip")},{" "}
              {plural(g.cuts.crosscuts, "full-width crosscut")}
              {g.cuts.widestCrosscut > 0 &&
                `; widest crosscut ${formatInches(g.cuts.widestCrosscut)}″`}
              {g.offcut &&
                `; keeps a ${formatInches(g.offcut.w)} × ${formatInches(g.offcut.h)}″ offcut on sheet ${g.offcut.sheet + 1}`}
              {g.fewestSheets !== null &&
                g.fewestSheets < g.sheets.length &&
                `. Rip first costs ${plural(g.sheets.length - g.fewestSheets, "sheet")} more than the fewest-sheets layout`}
              .
            </p>
            {g.tooBig.length > 0 && (
              <p className="text-sm text-red-700 mb-2">
                Doesn't fit on one {sheetSize.name} sheet: {g.tooBig.map(partName).join(", ")}.
              </p>
            )}
            {crossed.length > 0 && (
              <p className="text-sm text-orange-700 mb-2">
                Only fits across the grain (orange edge):{" "}
                {[...new Set(crossed.map((it) => `${tagOf(it)} ${partName(it)}`))].join(", ")}.
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-6">
              {g.sheets.map((sh, i) => (
                <SheetDrawing
                  key={i}
                  sheet={sh}
                  S={sheetSize}
                  idx={i}
                  count={g.sheets.length}
                  t={g.t}
                  offcut={g.offcut?.sheet === i ? g.offcut : null}
                  tagOf={tagOf}
                  hot={hotDrawn}
                  onHot={setHot}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );

  return (
    <SettingsLayout
      className={settingsSheetRoomClass(sheetOpen)}
      results={
        <div className="min-w-0 flex flex-col gap-5">
          <div>
            <SectionHeading className="mb-1">Cutlist</SectionHeading>
            <p className="text-sm text-stone-500">
              The plywood parts of the Design page's boxes, {formatThickness(wallThicknessIn)}{" "}
              walls, for {plural(boxSetCount, "stack")}, packed onto {sheetSize.name} sheets.
            </p>
          </div>
          <StatTileGrid
            tiles={[
              ["Sheets", totalSheets],
              ["Pieces", totalPieces],
              ["Full-length rips", rips],
              ["Full-width crosscuts", crosscuts],
            ]}
          />
          {cut.notes.map((n) => (
            <p key={n} className="text-sm text-orange-700">
              {n}
            </p>
          ))}
          <div className="grid grid-cols-1 gap-8 min-[1400px]:grid-cols-[minmax(0,1fr)_26rem]">
            {panelList}
            {sheetLayout}
          </div>
          <div className="max-w-prose">
            <DetailsDropdown summary={UI_TEXT.details}>
              <span>
                From the planner's current boxes: {formatThickness(wallThicknessIn)} walls, 3/4″
                baffles set {formatInches(baffleInsetIn)}″ back, back panels in a rabbet. {kerfName}{" "}
                kerf allowed between parts in the layout.
              </span>
              <span>
                Every layout cuts with straight through-cuts (a table saw or track saw can make each
                one edge to edge). Grain runs along each sheet's length: load the sheet that way.
                Cleats and duct dividers come from offcuts and aren't in the sheet count. Driver
                cutouts are typical values; use the datasheet's.
              </span>
              <span>
                Tags: S for the sub's parts, M for the mid's. A row and its pieces on the sheets
                share a tag; colours on the sheets follow the box.
              </span>
            </DetailsDropdown>
          </div>
        </div>
      }
      settings={
        <SettingsColumn
          label="Cutlist settings"
          folds={folds}
          foldsAt="desktop"
          className={SETTINGS_SHEET_CLASS}
          bodyClassName={`md:pb-4 ${settingsSheetBodyClass(sheetOpen)}`}
          top={
            <SettingsSheetTabs
              tabs={entriesOf(CUTLIST_SETTINGS_SECTIONS)}
              open={sheetOpen}
              active={tab}
              onOpen={(t) => {
                setTab(t);
                setSheetOpen(true);
              }}
              onClose={() => setSheetOpen(false)}
            />
          }
        >
          {section(
            "boxes",
            <>
              <ToggleGroup
                label="Corner joints"
                value={cornerJoint}
                onChange={(k) => {
                  // mitred boxes get waterfall strips by default; other changes keep your choice
                  if ((k === "miter") !== (cornerJoint === "miter")) setWaterfall(k === "miter");
                  setCornerJoint(k);
                }}
                options={entriesOf(JOINT_NAMES)}
              />
              <ToggleGroup
                label="Stacks"
                value={boxSetCount}
                onChange={setBoxSetCount}
                options={STACK_CHOICES.map((n) => [n, n] as const)}
              />
            </>,
          )}
          {section(
            "sheets",
            <>
              <ToggleGroup
                label="Sheet"
                value={plywoodSheetKind}
                onChange={setPlywoodSheetKind}
                options={entriesOf(PLYWOOD_SHEETS).map(([k, s]) => [k, s.name] as const)}
              />
              <ToggleGroup
                label="Kerf"
                value={kerfIn}
                onChange={setKerfIn}
                options={KERF_OPTIONS.map((k) => [k.v, k.label, k.tip] as const)}
              />
              <ToggleGroup
                label={
                  <Tooltip tip="Squares off each factory edge before the parts are cut: factory edges are often dinged or slightly out of square.">
                    Edge trim
                  </Tooltip>
                }
                value={edgeTrimIn}
                onChange={setEdgeTrimIn}
                options={TRIM_OPTIONS.map((v) => [v, trimName(v)] as const)}
              />
            </>,
          )}
          {section(
            "grain",
            <>
              <div>
                <ToggleGroup
                  label={
                    <Tooltip tip="Which way the face grain runs on each panel. A locked panel lies along the sheet's length; Any lets the layout turn it to save ply.">
                      Grain
                    </Tooltip>
                  }
                  value={preset}
                  onChange={(k) => setGrain(GRAIN_PRESETS[k])}
                  options={entriesOf(PRESET_NAMES)}
                  className="mb-2"
                />
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 items-center">
                  {GRAIN_ROWS.map(([panel, label, opts]) => (
                    <div key={panel} className="contents">
                      <div className="text-xs text-stone-500">{label}</div>
                      <ToggleGroup
                        size="xs"
                        value={grain[panel]}
                        onChange={(g) => setGrain({ ...grain, [panel]: g })}
                        options={opts}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <ToggleGroup
                label={
                  <Tooltip tip="Cuts each box's side, top and side in order from one strip, so the grain runs unbroken over both top corners. On by default with mitre joints.">
                    Waterfall
                  </Tooltip>
                }
                value={waterfall}
                onChange={setWaterfall}
                options={
                  [
                    [false, "Off"],
                    [true, "Side-top-side"],
                  ] as const
                }
              />
            </>,
          )}
          {section(
            "cuts",
            <>
              <ToggleGroup
                label={
                  <Tooltip tip="Rip first: every sheet is ripped into full-length strips before any crosscut, so you never crosscut a whole sheet on the table saw. It can cost a sheet; the layout says how many.">
                    Cut style
                  </Tooltip>
                }
                value={cutStyle}
                onChange={setCutStyle}
                options={entriesOf(CUT_STYLE_NAMES)}
              />
              <ToggleGroup
                label={
                  <Tooltip tip="The least-full sheet is laid out again to leave one big usable piece: a strip the full length of the sheet, or a panel its full width. It never costs a sheet.">
                    Keep offcut
                  </Tooltip>
                }
                value={cutStyle === "rips" ? "strip" : offcutShape}
                onChange={setOffcutShape}
                options={entriesOf(OFFCUT_NAMES)}
                disabled={
                  cutStyle === "rips"
                    ? {
                        value: "panel",
                        why: "Keeping a full-width panel takes a full-width crosscut",
                      }
                    : undefined
                }
              />
            </>,
          )}
        </SettingsColumn>
      }
    />
  );
}
