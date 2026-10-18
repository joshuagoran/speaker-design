import { useMemo, useState } from "react";
import type { BandId, DispersionPlane, FrequencyPoint, PaPlannerDesign } from "../../types";
import { alpha } from "../../styles/palette";
import { bandColor } from "../../lib/speaker/bandColor";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { HandleFields } from "../../components/ui/HandleFields";
import { Tooltip } from "../../components/ui/Tooltip";
import { StartPicker } from "../../components/ui/StartPicker";
import { Notice } from "../../components/ui/Notice";
import { WarningChips } from "../../components/chips/WarningChips";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { DispersionBlock } from "../../components/charts/DispersionBlock";
import { speakerDispersionMap } from "../../lib/speaker/stackDispersion";
import { DISPERSION_HEADING, DISPERSION_START_PLANE } from "../../constants/dispersionPlanes";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { STATS } from "../../components/optimizer/StatRow";
import { priceText } from "../../lib/speaker/speakerTotals";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { SpeakerView3D } from "../../components/stack-view/SpeakerView3D";
import { SpeakerFront } from "../../components/drawings/SpeakerFront";
import { SpeakerSection } from "../../components/drawings/SpeakerSection";
import { SpeakerSide } from "../../components/drawings/SpeakerSide";
import { AssumptionsList } from "../../components/ui/AssumptionsList";
import { UI_TEXT } from "../../constants/uiText";
import { FoldHornCard } from "./FoldHornCard";
import { withHornFold } from "./chamberLoad";
import {
  BaffleColorPicker,
  CabinetFinishPicker,
  HornColorPicker,
} from "../../components/ui/FinishPickers";
import { cabinetFinishName, paintName } from "../../lib/data";
import { Card } from "../../components/ui/Card";
import { CardHeading } from "../../components/ui/CardHeading";
import { HORN_COLOR_CATALOG_LABEL } from "../../constants/hornColor";
import {
  archBlock,
  driverHorn,
  hornFlare,
  speakerLayout,
  ventMoved,
  hornFitsWhereSet,
} from "../../lib/speaker/speakerLayout";
import { byId } from "../../lib/tables";
import { entriesOf, keysOf } from "../../lib/records";
import { formatInches } from "../../lib/format";
import { PANEL_NOMINAL_OPTIONS, formatThickness } from "../../lib/panel";
import { withWallPanel } from "../../lib/speaker/cabinetPanels";
import { BAFFLE_PLY_IN } from "../../lib/pa/calc";
import { DEFAULT_HIFI, DEFAULT_PA, DEFAULT_SPEAKER_CHAMBER } from "../../lib/defaults";
import { handlePart } from "../../lib/pa/hardware";
import { HORN_POSTS, INPUT_JACK, INPUT_PLATE } from "../../data/catalog/cabinet-hardware";
import { HARDWARE_PRESET_WORDS, NO_HANDLES_LABEL, hardwareNote } from "../../constants/hardware";
import {
  HEADING_GROUP,
  RESULTS_TWO_COLUMN_PX,
  RESULT_MAX_WIDTH,
  GAP_Y,
  resultsCellClass,
  resultsGridClass,
} from "../../styles/layout";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import {
  HIFI_BOT,
  HIFI_TOP,
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
  MAX_OUTPUT_BOT,
  MAX_OUTPUT_TOP,
  DISPERSION_DISTANCE_M,
} from "../../constants/chartScales";
import {
  SPEAKER_SETTINGS_SECTIONS,
  type SpeakerSettingsSection,
} from "../../constants/settingsSections";
import { ARCH_BLOCK_TEXT, SPEAKER_TEXT, MODEL_GAP_TEXT } from "../../constants/speakerPage";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import {
  CABINET_CONSTRUCTION,
  CABINET_CONSTRUCTION_NAMES,
  CABINET_TOP,
  CABINET_TOP_NAMES,
  CHAMBER_LOAD,
  HORN_PATH,
} from "../../constants/speakerSpec";
import { SPEAKER_START, type SpeakerStart } from "../../constants/speakerStarts";
import {
  BRACING_TILE_TEXT,
  CHECK_ROW_TEXT,
  SPEAKER_SAVE_WORDS,
  SPEAKER_VIEW,
  SPEAKER_VIEW_HINTS,
  SPEAKER_VIEW_NAMES,
  type SpeakerView,
} from "../../constants/speakerResults";
import { ChamberSettings } from "./ChamberSettings";
import { BandSettings } from "./BandSettings";
import { AutoBalanceButton } from "../../components/ui/AutoBalanceButton";
import { FilterFields } from "./FilterFields";
import { SpeakerOptimizerResults } from "./SpeakerOptimizerResults";
import { SpeakerOptimizerSettings, optimizerSummary } from "./SpeakerOptimizerSettings";
import { bandText, chamberText, countText, inputText } from "./speakerText";
import { PA_PANEL_TARGET_HZ } from "../../lib/pa/bracing";
import { formatHz } from "../../lib/format";
import {
  BACK_JOINT_NAMES,
  BACK_JOINT_SUMMARY,
  BACK_JOINT_TIPS,
  NO_BRACING,
  SPEAKER_BRACE_STYLE_NAMES,
  SPEAKER_BRACE_STYLE_TIPS,
  BRACE_TARGET_RANGE_HZ,
  BRACE_STYLE_SUMMARY,
} from "../../constants/bracing";
import { bandChips, chamberChips } from "./speakerChips";
import { chamberBraceChips, chamberFitChips, chamberUnbraced } from "../../lib/speaker/fitChips";
import { useSpeakerStart } from "./useSpeakerStart";
import { SaveRow } from "../../components/saved-configs/SaveRow";
import { speakerDetails } from "./speakerDetails";
import {
  PositionFocusContext,
  shownView,
  usePositionFocus,
  usePositionFocusState,
} from "./positionFocus";
import type { SpeakerPageState } from "./useSpeakerPage";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type { HifiPlanner } from "../hifi/useHifiPlanner";

interface Props {
  speakerPage: SpeakerPageState;
  planner: PaPlanner;
  hifi: HifiPlanner;
}

/** The sum's key on the charts: no band id takes it (the adapters' are band words, the Speaker page's "band1"…). */
const SUM_SERIES_ID = "sum";

/** The sum's line width on the charts, px: it reads over its bands' (2 px). */
const SUM_LINE_PX = 4;

/** The 3D view's and the front drawing's height, as the Hi-fi page's 3D view. */
const VIEW_HEIGHT = "h-[280px] md:h-[clamp(300px,46vh,480px)]";

/** The sections' height: the top and the side section, side by side across the pane. */
const SECTION_HEIGHT = "h-[260px] md:h-[clamp(280px,42vh,440px)]";

/** The hardware setting's choices: none, or the PA boxes' handles, input dish and horn posts. */
const HARDWARE_OPTIONS = [
  [false, SPEAKER_TEXT.hardwareNone],
  [true, SPEAKER_TEXT.hardwareOn],
] as const;

/** The PA design as the planner holds it, every field set. */
export const paPlannerDesign = (planner: PaPlanner): PaPlannerDesign => ({
  ...planner.snapshot(),
  panel: planner.wallPanel,
  hornMount: planner.hornMount,
  spacerH: planner.spacerHeightIn,
  hardware: planner.hardware,
  divider: planner.ductDividerPanel,
});

/**
 * The Speaker page: one speaker from its chambers, drivers and bands, its response and its maximum output on fixed axes
 * with the limits' checks, and the speaker library. A design starts from a template (empty, the PA, Hi-fi, monitor,
 * fill and PA v2 boxes), from a saved speaker, or from the current PA or Hi-fi design.
 */
export function SpeakerPage(props: Props) {
  // which driver position field has focus: the settings set it, the 2D view marks its point
  const positionFocus = usePositionFocusState();
  return (
    <PositionFocusContext.Provider value={positionFocus}>
      <SpeakerPageBody {...props} />
    </PositionFocusContext.Provider>
  );
}

/** The page inside its position focus (`SpeakerPage`). */
function SpeakerPageBody({ speakerPage, planner, hifi }: Props) {
  const pal = usePalette();
  const { spec, response, limits, build, price, optimizer, store, snapshot, restore } = speakerPage;
  const folds = useFolds("speaker.settingsFolds", keysOf(SPEAKER_SETTINGS_SECTIONS));
  const { options: startOptions, startWith } = useSpeakerStart(speakerPage, planner, hifi);
  const [start, setStart] = useState<SpeakerStart>(SPEAKER_START.empty);
  const startFrom = () => startWith(start);
  /** the 2D view picked (a position field with focus shows the one that marks its point: `shownView`) */
  const [picked2d, setPicked2d] = useState<SpeakerView>(SPEAKER_VIEW.front);
  const positionFocus = usePositionFocus();
  /** each band's line, by its place in the spec (yellow, magenta, cyan: `bandColor`); the sum in ink */
  const lineOf = (id: BandId) => {
    const { stroke, dash } = bandColor(spec.bands, id, pal);
    return { stroke, dash };
  };
  /** each band's name, by id */
  const nameOf = (id: BandId) => spec.bands.find((b) => b.id === id)?.name ?? id;
  const {
    chambers,
    construction,
    top,
    insetIn,
    braceStyle,
    braceTargetHz,
    backJoint,
    panel,
    hardware,
  } = spec.cabinet;
  const framed = construction === CABINET_CONSTRUCTION.frameInset;
  /** no bracing: the panels are left unbraced */
  const unbraced = braceStyle === NO_BRACING;
  const cabFinish = spec.look.cabFinish ?? DEFAULT_PA.cabFinish;
  const baffleColor = spec.look.baffleColor ?? DEFAULT_PA.baffleColor;
  /** the first catalog horn the drivers take: the horn color picker shows its catalog finish */
  const firstHorn = chambers.flatMap((c) => c.drivers.map(driverHorn)).find((h) => h !== null);
  const layout = speakerLayout(spec.cabinet);
  /** why an arched top stays flat; null when it applies */
  const arch = archBlock(spec.cabinet, layout);
  /** the horns built into the chambers, as the views draw them */
  const flares = layout.chambers.flatMap((c) => hornFlare(spec.cabinet, c) ?? []);
  const summaries: Record<SpeakerSettingsSection, string> = {
    speaker: `${spec.name} · ${countText(chambers.length, "chamber", "chambers")} · ${countText(spec.bands.length, "band", "bands")}`,
    construction: [
      `${CABINET_CONSTRUCTION_NAMES[construction]}${framed ? `, inset ${formatInches(insetIn)}` : ""}`,
      `${CABINET_TOP_NAMES[top].toLowerCase()} top`,
      SPEAKER_TEXT.wallPanelSummary(formatThickness(panel.thicknessIn)),
      braceStyle === NO_BRACING
        ? SPEAKER_TEXT.notBracedSummary
        : `braced with ${BRACE_STYLE_SUMMARY[braceStyle]} to ${formatHz(braceTargetHz)}`,
      BACK_JOINT_SUMMARY[backJoint],
      hardware
        ? SPEAKER_TEXT.hardwareSummary(
            handlePart(hardware.model)?.name ?? NO_HANDLES_LABEL.toLowerCase(),
          )
        : SPEAKER_TEXT.noHardwareSummary,
    ].join(" · "),
    chambers: chambers.map(chamberText).join("; "),
    bands: [
      countText(spec.bands.length, "band", "bands"),
      inputText(spec.input),
      ...spec.bands.map(bandText),
    ]
      .filter(Boolean)
      .join(" · "),
    look: [
      cabinetFinishName(cabFinish),
      `baffle ${paintName(baffleColor)}`,
      firstHorn &&
        `horn ${spec.look.hornColor ? paintName(spec.look.hornColor) : HORN_COLOR_CATALOG_LABEL.toLowerCase()}`,
    ]
      .filter(Boolean)
      .join(" · "),
    optimizer: optimizerSummary(optimizer),
  };
  const section = (id: SpeakerSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={SPEAKER_SETTINGS_SECTIONS[id]}
      folds={folds}
      summary={summaries[id]}
    >
      {children}
    </SettingsSection>
  );
  const one = chambers.length === 1;
  const tiles: StatTileItem[] = [
    ...response.chambers.flatMap((c, i): StatTileItem[] => {
      const which = one ? "" : ` ${i + 1}`;
      return [
        [`Net air${which}`, c.netLiters.toFixed(1), "L"],
        c.qtc !== null
          ? [`Qtc${which}`, c.qtc.toFixed(2), ""]
          : [`Fb${which}`, c.fb !== null ? c.fb.toFixed(1) : "—", c.fb !== null ? "Hz" : ""],
      ];
    }),
    ...response.bands.map((b): StatTileItem => [
      `${nameOf(b.id)} band`,
      b.passbandDb.toFixed(1),
      "dB",
      `band:${b.id}`,
    ]),
  ];
  const maxTiles: StatTileItem[] = [
    ...limits.bands.map((b): StatTileItem => [
      `${nameOf(b.id)} max`,
      b.musicDb.toFixed(0),
      "dB",
      `max:${b.id}`,
    ]),
    ...(limits.musicDb !== null && limits.bands.length > 1
      ? [[SPEAKER_TEXT.speakerMax, limits.musicDb.toFixed(0), "dB"] satisfies StatTileItem]
      : []),
  ];
  const [plane, setPlane] = useState<DispersionPlane>(DISPERSION_START_PLANE);
  const dispersion = useMemo(
    () => (response.bands.length ? speakerDispersionMap(spec, response, plane) : null),
    [spec, response, plane],
  );
  /** price, weight and bracing in one row of tiles */
  const buildTiles: StatTileItem[] = [
    [STATS.partsPrice, priceText(price), ""],
    [SPEAKER_TEXT.weight, build.lb.toFixed(0), "lb"],
    ...(one
      ? []
      : build.chambers.map((c, i): StatTileItem => [
          SPEAKER_TEXT.chamberWeight(i + 1),
          c.lb.total.toFixed(0),
          "lb",
        ])),
    ...build.chambers.map(({ bracing }, i): StatTileItem => {
      const label = BRACING_TILE_TEXT.label(one ? null : i + 1);
      if (chamberUnbraced(spec.cabinet, i)) return [label, BRACING_TILE_TEXT.none, ""];
      const windows =
        bracing.windows.x.length + bracing.windows.y.length + bracing.windows.z.length;
      const ribs = bracing.ribs.reduce((sum, r) => sum + r.at.length, 0);
      return [label, windows + ribs, BRACING_TILE_TEXT.unit];
    }),
  ];
  /** each chamber's fit and bracing checks */
  const fitChips = chamberFitChips(spec.cabinet, build);
  const braceChips = chamberBraceChips(spec.cabinet, build);
  const [resultsGrid, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  const cell = (place: string) => resultsCellClass(wide, place);
  /** the model left a chamber or a filter out: its notices say which and why (the empty-chart notice stays quiet) */
  const hasGaps = response.gaps.length > 0 || response.chambers.some((c) => c.gaps.length > 0);
  const fbMarks = response.chambers.flatMap((c, i) =>
    c.fb !== null ? [{ f: c.fb, label: one ? "Fb" : `Fb ${i + 1}` }] : [],
  );
  /** each band's curve on a chart: its line, and its dot in the legend */
  const bandSeries = (curves: readonly { id: BandId; curve: FrequencyPoint[] }[]) =>
    curves.map((b) => ({
      curve: b.curve,
      clipAtFloor: true,
      id: b.id,
      label: nameOf(b.id),
      ...lineOf(b.id),
      swatch: "dot" as const,
      tint: "transparent",
    }));
  const sumSeries = (curve: FrequencyPoint[]) => ({
    curve,
    id: SUM_SERIES_ID,
    label: SPEAKER_TEXT.sum,
    stroke: pal.ink,
    width: SUM_LINE_PX,
    tint: alpha(pal.ink, 0.05),
    // below the floor it would run along the axis as if it were data
    clipAtFloor: true,
  });
  /** the checks, one compact row per band, then per chamber (its limits, fit and bracing checks) */
  const checkRows = [
    ...bandChips(spec, limits, response).map(({ id, chips }) => ({
      key: `band:${id}`,
      row: CHECK_ROW_TEXT.band(nameOf(id)),
      chips,
    })),
    ...chambers.map((_, i) => {
      const c = limits.chambers[i];
      return {
        key: `chamber:${i}`,
        row: CHECK_ROW_TEXT.chamber(i + 1),
        chips: [
          ...(c ? chamberChips(c, nameOf(c.band)) : []),
          ...(fitChips[i] ?? []),
          ...(braceChips[i] ?? []),
        ],
      };
    }),
  ].filter((r) => r.chips.length > 0);
  const details = speakerDetails({
    bracing: build.chambers.map((c, i) => ({
      unbraced: chamberUnbraced(spec.cabinet, i),
      bracing: c.bracing,
    })),
    fb: fbMarks.length > 0,
    pricePartial: price.partial,
    sections: flares.length > 0,
  });
  const view = shownView(picked2d, positionFocus.focus);
  return (
    <SettingsLayout
      results={
        <div className="flex flex-col gap-5">
          <SaveRow
            store={store}
            snapshot={snapshot}
            restore={restore}
            name={spec.name}
            onName={speakerPage.setName}
            words={SPEAKER_SAVE_WORDS}
            starts={startOptions}
            group={(o) => o.group}
            onStart={(o) => startWith(o.id)}
          />
          <SpeakerOptimizerResults optimizer={optimizer} />
          <section className={`${RESULT_MAX_WIDTH} min-w-0 ${GAP_Y}`}>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
              <Viewer3DCard boxClassName={`relative ${VIEW_HEIGHT}`} driversButton>
                {(cutaway, look) => (
                  <SpeakerView3D
                    spec={{ cabinet: spec.cabinet, look: spec.look }}
                    cutaway={cutaway}
                    drivers={look.drivers}
                  />
                )}
              </Viewer3DCard>
              <Card gapY={false} className={`flex flex-col gap-2 ${VIEW_HEIGHT}`}>
                <ToggleGroup
                  value={view}
                  onChange={setPicked2d}
                  options={keysOf(SPEAKER_VIEW_NAMES).map(
                    (id) => [id, SPEAKER_VIEW_NAMES[id]] as const,
                  )}
                  size="xs"
                />
                <div className="flex-1 min-h-0">
                  {view === SPEAKER_VIEW.front ? (
                    <SpeakerFront
                      spec={spec}
                      onMoveDriver={(i, j, position) =>
                        speakerPage.editChamber(i, (ch) => ({
                          ...ch,
                          drivers: ch.drivers.map((d, k) => (k === j ? { ...d, position } : d)),
                        }))
                      }
                      focus={positionFocus.focus}
                    />
                  ) : (
                    <SpeakerSide spec={spec} focus={positionFocus.focus} />
                  )}
                </div>
                <p className="text-xs text-stone-500">{SPEAKER_VIEW_HINTS[view]}</p>
              </Card>
              {flares.length > 0 && (
                <Card gapY={false} className={`flex flex-col sm:col-span-2 ${SECTION_HEIGHT}`}>
                  <SpeakerSection spec={spec} />
                </Card>
              )}
              {spec.cabinet.chambers.map((c, i) =>
                c.load.kind === CHAMBER_LOAD.horn && c.load.horn.path === HORN_PATH.folded ? (
                  <FoldHornCard
                    key={`fold${i}`}
                    cabinet={spec.cabinet}
                    chamber={c}
                    horn={c.load.horn}
                    name={spec.cabinet.chambers.length === 1 ? null : `${i + 1}`}
                    onFold={(fold) => speakerPage.editChamber(i, (ch) => withHornFold(ch, fold))}
                    onResize={({ depthIn, heightIn }) =>
                      speakerPage.editChamber(i, (ch) => ({
                        ...ch,
                        dims: { ...ch.dims, d: ch.dims.d + depthIn, h: ch.dims.h + heightIn },
                      }))
                    }
                  />
                ) : null,
              )}
            </div>
            {flares
              .filter((f) => !f.path.fits)
              .map((f, i) => (
                <Notice key={i}>
                  {SPEAKER_TEXT.hornNoRoom(
                    {
                      depth: formatInches(f.path.needs.depthIn),
                      height: formatInches(f.path.needs.heightIn),
                    },
                    {
                      depth: formatInches(f.path.room.depthIn),
                      height: formatInches(f.path.room.heightIn),
                    },
                  )}
                </Notice>
              ))}
            {flares.some((f) => f.mouthClipped) && <Notice>{SPEAKER_TEXT.hornMouthClipped}</Notice>}
            {flares.some((f) => f.mouthMoved) && <Notice>{SPEAKER_TEXT.hornMouthMoved}</Notice>}
            {layout.chambers.some((c) =>
              c.chamber.drivers.some((d) => !hornFitsWhereSet(c, d)),
            ) && <Notice>{SPEAKER_TEXT.hornNoFit}</Notice>}
            {layout.chambers.some((c) => ventMoved(spec.cabinet, c)) && (
              <Notice>{SPEAKER_TEXT.ventMoved}</Notice>
            )}
          </section>
          {/* Response beside Maximum output once the pane is wide enough, the tiles under each */}
          <div ref={resultsGrid} className={`${RESULT_MAX_WIDTH} ${resultsGridClass(wide)}`}>
            <section className={`${cell("col-start-1 row-start-1")} ${GAP_Y}`}>
              <SectionHeading>{SPEAKER_TEXT.response}</SectionHeading>
              <ResponseChart
                fmin={FREQ_AXIS_MIN_HZ}
                fmax={FREQ_AXIS_MAX_HZ}
                top={HIFI_TOP}
                bot={HIFI_BOT}
                step={10}
                yLabel={SPEAKER_TEXT.yLabel}
                series={[
                  ...(response.bands.length ? [sumSeries(response.sum)] : []),
                  ...bandSeries(response.bands),
                ]}
                marks={fbMarks}
              />
              {/* a chamber the model leaves out is named with its reason, never dropped silently */}
              {response.chambers.flatMap((c, i) =>
                [...new Set(c.gaps)].map((g) => (
                  <Notice key={`gap${i}.${g}`}>
                    {SPEAKER_TEXT.chamberGap(i + 1, MODEL_GAP_TEXT[g])}
                  </Notice>
                )),
              )}
              {[...new Set(response.gaps)].map((g) => (
                <Notice key={`gap.${g}`}>{SPEAKER_TEXT.speakerGap(MODEL_GAP_TEXT[g])}</Notice>
              ))}
              {response.bands.length === 0 && !hasGaps && <Notice>{SPEAKER_TEXT.noBands}</Notice>}
              <StatTileGrid tiles={tiles} />
            </section>
            {limits.bands.length > 0 && (
              <section className={`${cell("col-start-2 row-start-1")} ${GAP_Y}`}>
                <SectionHeading>{SPEAKER_TEXT.maxOutput}</SectionHeading>
                <ResponseChart
                  fmin={FREQ_AXIS_MIN_HZ}
                  fmax={FREQ_AXIS_MAX_HZ}
                  top={MAX_OUTPUT_TOP}
                  bot={MAX_OUTPUT_BOT}
                  step={10}
                  yLabel={SPEAKER_TEXT.maxYLabel}
                  series={[
                    sumSeries(limits.sum),
                    ...bandSeries(limits.bands.map((b) => ({ id: b.id, curve: b.max }))),
                  ]}
                  marks={fbMarks}
                />
                <StatTileGrid tiles={maxTiles} />
              </section>
            )}
          </div>
          {checkRows.length > 0 && (
            <section
              aria-label={CHECK_ROW_TEXT.checks}
              className={`${RESULT_MAX_WIDTH} flex flex-col gap-2`}
            >
              {checkRows.map(({ key, row, chips }) => (
                <WarningChips
                  key={key}
                  row={row}
                  chips={chips}
                  tips={{ speakerKeepsUp: KEEP_UP_TEXT.tip }}
                />
              ))}
            </section>
          )}
          <StatTileGrid tiles={buildTiles} />
          {dispersion && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 ${GAP_Y}`}>
              <SectionHeading>{DISPERSION_HEADING}</SectionHeading>
              <DispersionBlock
                map={dispersion}
                plane={plane}
                onPlane={setPlane}
                distM={DISPERSION_DISTANCE_M}
                axis="listening"
              />
            </section>
          )}
          <AssumptionsList groups={details} summary={UI_TEXT.details} columns />
        </div>
      }
      settings={
        <SettingsColumn folds={folds}>
          {section(
            "speaker",
            <>
              <TextField
                label="Name"
                value={spec.name}
                maxLength={60}
                onChange={speakerPage.setName}
              />
              <StartPicker
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(o.id)}
                group={(o) => o.group}
                onStart={startFrom}
                hint={SPEAKER_TEXT.startOverHint}
              />
            </>,
          )}
          {section(
            "construction",
            <>
              <ToggleGroup
                label={SPEAKER_TEXT.construction}
                value={construction}
                onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, construction: v }))}
                options={entriesOf(CABINET_CONSTRUCTION_NAMES)}
              />
              {framed && (
                <NumberField
                  label={<Tooltip tip={SPEAKER_TEXT.insetTip}>{SPEAKER_TEXT.inset}</Tooltip>}
                  value={insetIn}
                  min={0}
                  step={0.125}
                  onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, insetIn: v }))}
                />
              )}
              <ToggleGroup
                label={
                  <Tooltip tip={SPEAKER_TEXT.wallPanelTip(formatThickness(BAFFLE_PLY_IN))}>
                    {SPEAKER_TEXT.wallPanel}
                  </Tooltip>
                }
                value={panel.nominal}
                onChange={(nominal) =>
                  speakerPage.editCabinet((c) => ({
                    ...c,
                    panel: withWallPanel(c.panel, nominal),
                  }))
                }
                options={PANEL_NOMINAL_OPTIONS}
              />
              <ToggleGroup
                label={SPEAKER_TEXT.top}
                value={top}
                onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, top: v }))}
                options={entriesOf(CABINET_TOP_NAMES)}
              />
              {top === CABINET_TOP.arched && arch !== null && (
                <Notice>
                  {SPEAKER_TEXT.archFlat} {ARCH_BLOCK_TEXT[arch]}
                </Notice>
              )}
              <ToggleGroup
                label={SPEAKER_TEXT.backJoint}
                value={backJoint}
                onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, backJoint: v }))}
                options={keysOf(BACK_JOINT_NAMES).map(
                  (id) => [id, BACK_JOINT_NAMES[id], BACK_JOINT_TIPS[id]] as const,
                )}
              />
              <ToggleGroup
                label={SPEAKER_TEXT.braceStyle}
                value={braceStyle}
                onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, braceStyle: v }))}
                options={keysOf(SPEAKER_BRACE_STYLE_NAMES).map(
                  (id) =>
                    [id, SPEAKER_BRACE_STYLE_NAMES[id], SPEAKER_BRACE_STYLE_TIPS[id]] as const,
                )}
              />
              {!unbraced && (
                <NumberField
                  label={
                    <Tooltip tip={SPEAKER_TEXT.braceTargetTip(formatHz(PA_PANEL_TARGET_HZ))}>
                      {SPEAKER_TEXT.braceTarget}
                    </Tooltip>
                  }
                  value={braceTargetHz}
                  min={BRACE_TARGET_RANGE_HZ.min}
                  max={BRACE_TARGET_RANGE_HZ.max}
                  step={10}
                  unit="Hz"
                  onChange={(v) =>
                    speakerPage.editCabinet((c) => ({
                      ...c,
                      braceTargetHz: Math.min(
                        BRACE_TARGET_RANGE_HZ.max,
                        Math.max(BRACE_TARGET_RANGE_HZ.min, v),
                      ),
                    }))
                  }
                />
              )}
              <ToggleGroup
                label={<Tooltip tip={SPEAKER_TEXT.hardwareTip}>{SPEAKER_TEXT.hardware}</Tooltip>}
                value={hardware !== null}
                onChange={(on) =>
                  speakerPage.editCabinet((c) => ({
                    ...c,
                    // on: the PA sub box's preset handles
                    hardware: on ? (c.hardware ?? DEFAULT_PA.hardware.sub) : null,
                  }))
                }
                options={HARDWARE_OPTIONS}
              />
              {hardware && (
                <>
                  <HandleFields
                    label={SPEAKER_TEXT.handles}
                    handles={hardware}
                    onChange={(change) =>
                      speakerPage.editCabinet((c) => ({
                        ...c,
                        hardware: c.hardware && { ...c.hardware, ...change },
                      }))
                    }
                  />
                  <p className="text-xs text-stone-500">
                    {hardwareNote(
                      {
                        box: SPEAKER_TEXT.hardwareDishBox,
                        name: INPUT_PLATE.name,
                        jack: INPUT_JACK.name,
                        place: HARDWARE_PRESET_WORDS.plate,
                      },
                      {
                        box: SPEAKER_TEXT.hardwarePostsBox,
                        name: HORN_POSTS.name,
                        place: HARDWARE_PRESET_WORDS.posts,
                      },
                    )}
                  </p>
                </>
              )}
            </>,
          )}
          {section(
            "chambers",
            <>
              {chambers.map((chamber, i) => (
                <ChamberSettings
                  key={speakerPage.chamberKey(i)}
                  index={i}
                  chamber={chamber}
                  result={response.chambers[i]}
                  bands={spec.bands}
                  cabinet={spec.cabinet}
                  placed={layout.chambers[i]}
                  onEdit={(edit) => speakerPage.editChamber(i, edit)}
                  onRemove={one ? undefined : () => speakerPage.removeChamber(i)}
                />
              ))}
              <Button
                variant="primary"
                onClick={() =>
                  speakerPage.editChambers((list) => {
                    // stacked on the highest chamber
                    const top = Math.max(0, ...list.map((c) => c.at.yIn + c.dims.h));
                    return [...list, { ...DEFAULT_SPEAKER_CHAMBER, at: { xIn: 0, yIn: top } }];
                  })
                }
              >
                Add chamber
              </Button>
            </>,
          )}
          {section(
            "bands",
            <>
              <Card>
                <div className={HEADING_GROUP}>
                  <CardHeading>
                    <Tooltip tip={SPEAKER_TEXT.inputTip}>{SPEAKER_TEXT.inputRange}</Tooltip>
                  </CardHeading>
                  <p className="text-xs text-stone-500">{SPEAKER_TEXT.inputHint}</p>
                </div>
                <FilterFields
                  filters={spec.input}
                  // a new corner at the PA's crossover to its subs
                  newCornerHz={DEFAULT_PA.xoLo}
                  offName={SPEAKER_TEXT.inputOff}
                  onEdit={speakerPage.editInput}
                />
              </Card>
              {spec.bands.map((band, i) => (
                <BandSettings
                  key={band.id}
                  band={band}
                  newCornerHz={DEFAULT_HIFI.crossoverHz}
                  onEdit={(edit) => speakerPage.editBand(i, edit)}
                  onRemove={
                    spec.bands.length > 1 ? () => speakerPage.removeBand(band.id) : undefined
                  }
                />
              ))}
              <Button variant="primary" onClick={speakerPage.addBand}>
                Add band
              </Button>
              <AutoBalanceButton
                balance={speakerPage.balance}
                onApply={speakerPage.applyBalance}
                mode={speakerPage.balanceMode}
                onMode={speakerPage.setBalanceMode}
              />
            </>,
          )}
          {section(
            "look",
            <>
              <CabinetFinishPicker
                value={cabFinish}
                onChange={(v) => speakerPage.editLook({ cabFinish: v })}
              />
              <BaffleColorPicker
                value={baffleColor}
                onChange={(v) => speakerPage.editLook({ baffleColor: v })}
              />
              {firstHorn && (
                <HornColorPicker
                  value={spec.look.hornColor}
                  onChange={(hornColor) => speakerPage.editLook({ hornColor })}
                  horn={firstHorn}
                />
              )}
            </>,
          )}
          {section("optimizer", <SpeakerOptimizerSettings optimizer={optimizer} />)}
        </SettingsColumn>
      }
    />
  );
}
