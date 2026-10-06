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
  PanelMaterial,
  PanelNominal,
} from "../../types";
import type { CutlistOptions } from "../pa-stack/hooks/useCutlistOptions";
import { Tooltip } from "../../components/ui/Tooltip";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
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
import { PLYWOOD_SHEETS, formatInches } from "../../lib/pa/calc";
import {
  defaultPanelIn,
  formatThickness,
  panelExactRange,
  panelThicknessName,
} from "../../lib/panel";
import { PANEL_NOMINAL_NAMES } from "../../constants/panelSizes";
import { settingsForMaterial } from "../../lib/hifi/cutlist";
import {
  FROM_OFFCUT,
  FROM_OFFCUT_NOTE,
  GRAIN_PRESETS,
  KERF_OPTIONS,
  TRIM_OPTIONS,
  cutRowKey,
  cutRowTags,
  cutRows,
  grainPresetOf,
  layoutCutlist,
  noteLines,
} from "../../lib/pa/cutlist";
import { useCutlistLayout } from "../../hooks/useCutlistLayout";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { READING_WIDTH, RESULTS_TWO_COLUMN_PX, RESULT_MAX_WIDTH } from "../../styles/layout";
import { useFolds } from "../../hooks/useFolds";
import { usePalette } from "../../hooks/useTheme";
import { entriesOf, keysOf } from "../../lib/records";
import {
  CUT_BOX_NAMES,
  CUT_BOX_TAGS,
  CUT_BOX_TINTS,
  CUT_PART_NAMES,
  GRAIN_LOOK_NAMES,
  PANEL_MATERIAL_NAMES,
  type GrainLook,
} from "../../constants/cutParts";
import {
  CUTLIST_SETTINGS_SECTIONS,
  type CutlistSettingsSection,
} from "../../constants/settingsSections";
import { CUTLIST_PROJECTS } from "../../constants/cutlistProjects";
import type { ProjectId } from "../../constants/pages";

interface Props {
  /** whose boxes these are: the page's words and set choices follow it */
  project: ProjectId;
  /** this project's cutlist choices */
  options: CutlistOptions;
  /** one set's parts (one stack, one speaker) */
  parts: CutPart[];
  /** bought parts and other lines that aren't cut, shown under the list */
  also: string[];
  /** the walls' exact thickness (inches), nominal size and material */
  wall: number;
  panel: PanelNominal;
  material: PanelMaterial;
}

const JOINT_NAMES: Record<CornerJoint, string> = { butt: "Butt", rabbet: "Rabbet", miter: "Miter" };
const PRESET_NAMES: Record<GrainPreset, string> = {
  wrap: "Wrap",
  horizontal: GRAIN_LOOK_NAMES.horizontal,
  none: "None (MDF)",
};
const OFFCUT_NAMES: Record<OffcutShape, string> = { strip: "Long strip", panel: "Wide panel" };
const CUT_STYLE_NAMES: Record<CutStyle, string> = { sheets: "Fewest sheets", rips: "Rip first" };
/** Each panel's grain choices: what `b` and `a` along the grain look like on the box (`any` lets the layout turn it). */
const GRAIN_LOOKS: [GrainPanel, string, Record<Exclude<GrainDir, "any">, GrainLook>][] = [
  ["side", "Sides", { b: "vertical", a: "frontToBack" }],
  ["topBottom", "Top/bottom", { b: "across", a: "frontToBack" }],
  ["baffle", "Baffle", { b: "vertical", a: "horizontal" }],
  ["back", "Back", { b: "vertical", a: "horizontal" }],
];
const GRAIN_ROWS = GRAIN_LOOKS.map(
  ([panel, label, look]) =>
    [
      panel,
      label,
      [
        ["b", GRAIN_LOOK_NAMES[look.b]],
        ["a", GRAIN_LOOK_NAMES[look.a]],
        ["any", GRAIN_LOOK_NAMES.any],
      ],
    ] as const,
);

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

/**
 * Cutlist page, for either project: the settings beside the panels of each box and how they pack onto sheets. The
 * project's own page (`PaCutlistPage`, `HifiCutlistPage`) works out its parts and passes its choices.
 */
export function CutlistPage({ project, options, parts, also, wall, panel, material }: Props) {
  const pal = usePalette();
  const {
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
    setPanelExactIn,
  } = options;
  const proj = CUTLIST_PROJECTS[project];
  const mat = PANEL_MATERIAL_NAMES[material];
  // MDF has no grain: its panels turn freely and the grain settings step aside
  const grainless = material === "mdf";
  const folds = useFolds("cutlist.settingsFolds", keysOf(CUTLIST_SETTINGS_SECTIONS));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<CutlistSettingsSection>("boxes");
  const tabClass = (t: CutlistSettingsSection) => (tab === t ? "" : "max-md:hidden");
  // the parts list beside the sheet layout once the results pane is wide enough (the pane, not the viewport: the divider drags)
  const [twoColumnBox, twoColumns] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  /** the row (by `cutRowKey`) highlighted with its pieces on the sheets */
  const [hot, setHot] = useState<string | null>(null);

  const settings: CutlistSettings = settingsForMaterial(
    {
      sheet: plywoodSheetKind,
      stacks: boxSetCount,
      kerf: kerfIn,
      trim: edgeTrimIn,
      grain,
      waterfall,
      joint: cornerJoint,
      offcut: offcutShape,
      cuts: cutStyle,
    },
    material,
  );
  // the inputs as one string: the layout is redone only when it changes
  const key = JSON.stringify({ parts, settings });
  // the quick deterministic layout shows at once; the worker's longer search replaces it when it is done
  const quick = useMemo(() => layoutCutlist(parts, settings), [key]);
  const cut = useCutlistLayout({ parts, settings }) ?? quick;
  const sheetSize = PLYWOOD_SHEETS[plywoodSheetKind];
  const preset = grainPresetOf(grain);
  const kerfName = KERF_OPTIONS.find((k) => k.v === kerfIn)?.label ?? `${formatInches(kerfIn)}″`;
  // the walls' nominal size with its measured thickness beside it, and the range a measurement may take
  const wallName = panelThicknessName(panel, wall);
  const wallRange = panelExactRange(panel);
  const wallDefault = defaultPanelIn(panel, material);
  /** a thickness as the page names it: the walls' with their nominal size, any other (the PA baffle) on its own */
  const thicknessName = (t: number) => (t === wall ? wallName : formatThickness(t));
  /** sets the walls' measured thickness; the default is kept as no measurement, so it follows the material */
  const setWallExact = (t: number | null) =>
    setPanelExactIn((prev) => {
      const { [panel]: _old, ...rest } = prev;
      return t === null || t === wallDefault ? rest : { ...rest, [panel]: t };
    });

  // each row's tag (S1, S2 … M1 … H1 …); its pieces on the sheets carry the same tag
  const allRows = cutRows(cut.parts);
  const { tags, byBox } = cutRowTags(allRows);
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
  const boxColour = (box: CutBoxId) => pal[CUT_BOX_TINTS[box]];

  const summaries: Record<CutlistSettingsSection, string> = {
    boxes: `${JOINT_NAMES[cornerJoint]} joints, ${plural(boxSetCount, proj.set)}`,
    sheets: `${wallName}, ${sheetSize.name}, ${kerfName} kerf, ${edgeTrimIn ? `${trimName(edgeTrimIn)} trim` : "no trim"}`,
    grain: grainless
      ? `${mat.word}: no grain`
      : `${preset ? PRESET_NAMES[preset] : "Custom"}${waterfall ? ", waterfall" : ""}`,
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
        Finished sizes in inches,{" "}
        {grainless
          ? `short side first (${mat.word} has no grain)`
          : "along the grain first (↕) for grain-locked parts"}
        . Quantities for {plural(boxSetCount, proj.set)}. Hover or focus a row to find its pieces on
        the sheets.
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
              <th className={`${th} text-right`}>{mat.column}</th>
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
                // one short line per note (each cutout, joint or warning), so the list stays easy to scan
                const notes = [
                  ...(FROM_OFFCUT.has(p.part) ? [FROM_OFFCUT_NOTE] : []),
                  ...noteLines(p.note),
                ];
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
                        style={{ background: boxColour(p.box) }}
                      >
                        {tagOf(p)}
                      </span>
                    </td>
                    <td className={`${td} pr-3`}>
                      {CUT_PART_NAMES[p.part]}
                      {notes.length > 0 && (
                        <ul className="text-xs text-stone-500">
                          {notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      )}
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
      {also.length > 0 && <p className="text-sm text-stone-500 mt-3">Also: {also.join("; ")}.</p>}
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
              {thicknessName(g.t)} {mat.short}: {plural(g.sheets.length, "sheet")} of{" "}
              {sheetSize.name}
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
                  material={material}
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
            <p className={`${READING_WIDTH} text-sm text-stone-500`}>
              The {mat.word} parts of {proj.source}, {wallName} walls, for{" "}
              {plural(boxSetCount, proj.set)}, packed onto {sheetSize.name} sheets.
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
            <p key={n} className={`${READING_WIDTH} text-sm text-orange-700`}>
              {n}
            </p>
          ))}
          <div
            ref={twoColumnBox}
            className={`${RESULT_MAX_WIDTH} grid gap-8 ${twoColumns ? "grid-cols-[minmax(0,1fr)_26rem]" : "grid-cols-1"}`}
          >
            {panelList}
            {sheetLayout}
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
                label={proj.setsLabel}
                value={boxSetCount}
                onChange={setBoxSetCount}
                options={proj.sets.map((n) => [n, n] as const)}
              />
            </>,
          )}
          {section(
            "sheets",
            <>
              <NumberField
                label={
                  <Tooltip tip="Sheets are rarely their nominal size: 18 mm Baltic birch often measures 0.689″ and US ¾″ plywood 23/32″. Measure yours; the box volume, the panel sizes and joints, the 3D view and the weights all use it.">
                    {`Measured ${PANEL_NOMINAL_NAMES[panel].name}`}
                  </Tooltip>
                }
                value={wall}
                min={wallRange.min}
                max={wallRange.max}
                step={0.001}
                onChange={(t) => {
                  if (t >= wallRange.min && t <= wallRange.max) setWallExact(t);
                }}
                unit={
                  <>
                    <span className="text-stone-500">
                      ″ = {(wall * 25.4).toFixed(1)} mm ({wallRange.min}–{wallRange.max}″)
                    </span>
                    {wall !== wallDefault && (
                      <Button onClick={() => setWallExact(null)}>
                        {`Reset to ${formatThickness(wallDefault)}`}
                      </Button>
                    )}
                  </>
                }
              />
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
            grainless ? (
              <p className="text-sm text-stone-500">
                {mat.word} has no grain: every panel turns freely to save sheets, and there is no
                waterfall strip.
              </p>
            ) : (
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
              </>
            ),
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
                        values: ["panel"],
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
