import { useEffect, useMemo, useRef, useState } from "react";
import type { BandId, DispersionPlane, FrequencyPoint } from "../../types";
import { PREVIEW_DASH, alpha } from "../../styles/palette";
import { bandColor } from "../../lib/speaker/bandColor";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { useSettingsSheet } from "../../components/ui/SettingsSheetTabs";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Notice } from "../../components/ui/Notice";
import { SharedNotice, type SharedNoticeProps } from "../../components/ui/SharedNotice";
import { WarningChips } from "../../components/chips/WarningChips";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { DispersionBlock } from "../../components/charts/DispersionBlock";
import { dispersionModeled, speakerDispersionMap } from "../../lib/speaker/stackDispersion";
import { DISPERSION_HEADING, DISPERSION_START_PLANE } from "../../constants/dispersionPlanes";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { STATS } from "../../components/stats/StatLabel";
import { priceText } from "../../lib/speaker/speakerTotals";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { SpeakerView3D } from "../../components/stack-view/SpeakerView3D";
import { SpeakerFront } from "../../components/drawings/SpeakerFront";
import { SpeakerSide } from "../../components/drawings/SpeakerSide";
import { SpeakerTop } from "../../components/drawings/SpeakerTop";
import { AssumptionsList } from "../../components/ui/AssumptionsList";
import { UI_TEXT } from "../../constants/uiText";
import { FoldHornCard } from "./FoldHornCard";
import { withHornFold } from "./chamberLoad";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Ellipsis } from "../../components/ui/Ellipsis";
import { DriverCompareTable } from "./DriverCompareTable";
import { useDriverCompare, type OpenCompare } from "./useDriverCompare";
import { ownOption } from "../../lib/speaker/driverCompare";
import { withPart } from "../../lib/speaker/optimize/space";
import { DRIVER_COMPARE_TEXT } from "../../constants/driverCompare";
import {
  hornFlare,
  speakerLayout,
  ventMoved,
  hornFitsWhereSet,
} from "../../lib/speaker/speakerLayout";
import { keysOf } from "../../lib/records";
import { formatInches, formatDb } from "../../lib/format";
import {
  RESULTS_TWO_COLUMN_PX,
  RESULT_MAX_WIDTH,
  GAP_Y,
  MD_UP,
  resultsCellClass,
  resultsGridClass,
} from "../../styles/layout";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { useMediaQuery } from "../../hooks/useMediaQuery";
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
import { SPEAKER_TEXT, MODEL_GAP_TEXT, FOLD_EDITOR_TEXT } from "../../constants/speakerPage";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import { CHAMBER_LOAD, HORN_PATH } from "../../constants/speakerSpec";
import {
  BRACING_TILE_TEXT,
  CHECK_ROW_TEXT,
  SPEAKER_SAVE_WORDS,
  SPEAKER_VIEW,
  SPEAKER_VIEW_HINTS,
  SPEAKER_VIEW_NAMES,
  type SpeakerView,
} from "../../constants/speakerResults";
import { SpeakerSettings } from "./SpeakerSettings";
import { SpeakerOptimizerResults } from "./SpeakerOptimizerResults";
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
import { StackEditNotice, type StackEditNoticeProps } from "./StackEditNotice";

interface Props {
  speakerPage: SpeakerPageState;
  /** the shared view's notice, while a link's speaker shows in place of the page's own */
  sharedNotice: SharedNoticeProps | null;
  /** the notice while a Stack's speaker shows in place of the page's own, for an edit */
  stackEditNotice: StackEditNoticeProps | null;
}

/** The sum's key on the charts: no band id takes it (the adapters' are band words, the Speaker page's "band1"…). */
const SUM_SERIES_ID = "sum";

/** The sum's line width on the charts, px: it reads over its bands' (2 px). */
const SUM_LINE_PX = 4;

/** The 3D view's and the front drawing's height. */
const VIEW_HEIGHT = "h-[280px] md:h-[clamp(300px,46vh,480px)]";

/** The settings sections that start closed: only Chambers starts open. */
const FOLDS_START = { construction: false, bands: false, look: false, optimizer: false } as const;

/**
 * The Speaker page: one speaker from its chambers, drivers and bands, its response and its maximum output on fixed axes
 * with the limits' checks, and the speaker library. A design starts from a template (empty, the PA, Hi-fi, monitor,
 * fill, and PA v2 boxes) or from a saved speaker.
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
function SpeakerPageBody({ speakerPage, sharedNotice, stackEditNotice }: Props) {
  const pal = usePalette();
  const { spec, response, limits, build, price, optimizer, store, snapshot, holds, restore } =
    speakerPage;
  const folds = useFolds(
    "speaker.settingsFolds",
    keysOf(SPEAKER_SETTINGS_SECTIONS),
    {},
    FOLDS_START,
  );
  const sheet = useSettingsSheet<SpeakerSettingsSection>("speaker", "chambers");
  const { options: startOptions, startWith } = useSpeakerStart(speakerPage);
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
  const { chambers } = spec.cabinet;
  const layout = speakerLayout(spec.cabinet);
  /** the horns built into the chambers, as the views draw them */
  const flares = layout.chambers.flatMap((c) => hornFlare(spec.cabinet, c) ?? []);
  const one = chambers.length === 1;
  const tiles: StatTileItem[] = [
    ...response.chambers.flatMap((c, i): StatTileItem[] => {
      const which = one ? "" : ` ${i + 1}`;
      return [
        [`${SPEAKER_TEXT.netAir}${which}`, c.netLiters.toFixed(1), "L"],
        c.qtc !== null
          ? [`Qtc${which}`, c.qtc.toFixed(2), ""]
          : [
              `${SPEAKER_TEXT.fb}${which}`,
              c.fb !== null ? c.fb.toFixed(1) : "—",
              c.fb !== null ? "Hz" : "",
            ],
      ];
    }),
    ...response.bands.map((b): StatTileItem => [
      `${nameOf(b.id)} band`,
      formatDb(b.passbandDb),
      "dB",
      `band:${b.id}`,
    ]),
  ];
  const maxTiles: StatTileItem[] = [
    ...limits.bands.map((b): StatTileItem => [
      `${nameOf(b.id)} max`,
      formatDb(b.musicDb),
      "dB",
      `max:${b.id}`,
    ]),
    ...(limits.musicDb !== null && limits.bands.length > 1
      ? [[SPEAKER_TEXT.speakerMax, formatDb(limits.musicDb), "dB"] satisfies StatTileItem]
      : []),
  ];
  const [plane, setPlane] = useState<DispersionPlane>(DISPERSION_START_PLANE);
  const dispersion = useMemo(
    () =>
      response.bands.length && dispersionModeled([spec])
        ? speakerDispersionMap(spec, response, plane)
        : null,
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
      // faint while an option is previewed, so its curves stand out
      ghost: previewed !== undefined,
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
    ghost: previewed !== undefined,
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
    straightHorn: flares.length > 0,
  });
  /** the focused position field's driver, while it still exists (a field removed with focus sends no blur) */
  const focus =
    positionFocus.focus &&
    chambers[positionFocus.focus.chamber]?.drivers[positionFocus.focus.driver]
      ? positionFocus.focus
      : null;
  const view = shownView(picked2d, focus);
  // the driver comparison: the entry it is open on (with the chamber list it was opened in), and the row previewed
  const [compare, setCompare] = useState<(OpenCompare & { key: string; opened: number }) | null>(
    null,
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const compareOpen =
    compare && compare.key === speakerPage.chamberKey(compare.chamber) ? compare : null;
  const cmp = useDriverCompare(spec, compareOpen);
  // an entry that went away (removed, or its chamber) closes the block
  if (compare && !cmp.driver) setCompare(null);
  /** from md up: the comparison sits in the settings column and a click uses a row; on a phone it fills the sheet */
  const mdUp = useMediaQuery(MD_UP);
  const compareBlock = useRef<HTMLElement>(null);
  /** the Response section: on a phone it comes into view above the sheet while the comparison is open */
  const responseBlock = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!compare) return;
    if (mdUp) compareBlock.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else {
      // on a phone the block takes the sheet from its top, and the response chart shows above it
      compareBlock.current?.scrollIntoView({ block: "start" });
      responseBlock.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [compare?.opened]);
  const openCompare = (chamber: number, entry: number) => {
    const d = spec.cabinet.chambers[chamber]?.drivers[entry];
    if (!d) return;
    setPreviewId(null);
    setCompare((c) => ({
      chamber,
      entry,
      origin: { ...ownOption(d), kind: d.kind },
      key: speakerPage.chamberKey(chamber),
      opened: (c?.opened ?? 0) + 1,
    }));
  };
  /** the row previewed on the charts (not yours: yours is drawn already) */
  const previewed = compareOpen ? cmp.rows.find((r) => r.id === previewId && !r.yours) : undefined;
  /**
   * what the charts' legends hold room for while the block is open: the previewed row, or (hidden) the row with the
   * longest name, so a preview that comes and goes doesn't move the table under the pointer
   */
  const preview =
    previewed ??
    (compareOpen
      ? cmp.rows.reduce<(typeof cmp.rows)[number] | undefined>(
          (long, r) => (!long || r.name.length > long.name.length ? r : long),
          undefined,
        )
      : undefined);
  /** the previewed option's curves on a chart: its bands' in their colors, then its sum in ink, dashed */
  const previewSeries = (pick: "curve" | "max") =>
    preview
      ? [
          ...preview.run.bands.map((b) => ({
            curve: b[pick],
            clipAtFloor: true,
            id: `preview:${b.id}`,
            label: `${nameOf(b.id)} · ${preview.name}`,
            stroke: lineOf(b.id).stroke,
            dash: PREVIEW_DASH,
            swatch: "dot" as const,
            tint: "transparent",
            hidden: !previewed,
            ownLine: true,
          })),
          {
            curve: pick === "curve" ? preview.run.sum : preview.run.maxSum,
            clipAtFloor: true,
            id: "preview:sum",
            label: `${SPEAKER_TEXT.sum} · ${preview.name}`,
            stroke: pal.ink,
            dash: PREVIEW_DASH,
            tint: "transparent",
            hidden: !previewed,
            ownLine: true,
          },
        ]
      : [];
  /** the response chart, in the results */
  const responseChart = (
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
        ...previewSeries("curve"),
      ]}
      marks={fbMarks}
    />
  );
  /** the driver comparison in the settings column (on a phone, the sheet), while it is open */
  const compareView =
    compareOpen && cmp.driver ? (
      <section ref={compareBlock} className={`min-w-0 ${GAP_Y}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading>{DRIVER_COMPARE_TEXT.heading}</SectionHeading>
          <Button size="xs" onClick={() => setCompare(null)}>
            {DRIVER_COMPARE_TEXT.close}
          </Button>
        </div>
        <p className="text-xs text-stone-500">
          {DRIVER_COMPARE_TEXT.line(mdUp ? DRIVER_COMPARE_TEXT.hover : DRIVER_COMPARE_TEXT.tap)}
          {mdUp && <>{DRIVER_COMPARE_TEXT.clickToSwap}</>}
        </p>
        <DriverCompareTable
          rowUse={mdUp}
          rows={cmp.rows}
          kind={cmp.driver.kind}
          previewId={previewId}
          onPreview={setPreviewId}
          onUse={(o) =>
            speakerPage.editDriver(compareOpen.chamber, compareOpen.entry, (d) =>
              withPart(d, o.driverId, o.hornId),
            )
          }
        />
        {cmp.pending && (
          <p className="text-xs text-stone-500">
            <Ellipsis />
          </p>
        )}
      </section>
    ) : undefined;
  return (
    <SettingsLayout
      sheet={sheet}
      results={
        <div className="flex flex-col gap-5">
          {stackEditNotice ? (
            <StackEditNotice {...stackEditNotice} />
          ) : sharedNotice ? (
            <SharedNotice {...sharedNotice} />
          ) : (
            <SaveRow
              store={store}
              snapshot={snapshot}
              holds={holds}
              restore={restore}
              name={spec.name}
              onName={speakerPage.setName}
              openId={spec.id}
              onOpenId={speakerPage.setOpenId}
              words={SPEAKER_SAVE_WORDS}
              starts={startOptions}
              group={(o) => o.group}
              onStart={(o) => startWith(o.id)}
            />
          )}
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
                      onPickDriver={(i, j) => {
                        // its box is in the Chambers section: open it (on a phone, the sheet on its tab), and the
                        // box opens and scrolls into view
                        if (!folds.open.chambers) folds.toggle("chambers");
                        if (!mdUp) sheet.show("chambers");
                        positionFocus.pickDriver(i, j);
                      }}
                      focus={focus}
                    />
                  ) : view === SPEAKER_VIEW.side ? (
                    <SpeakerSide spec={spec} focus={focus} />
                  ) : (
                    <SpeakerTop spec={spec} />
                  )}
                </div>
                <p className="text-xs text-stone-500">{SPEAKER_VIEW_HINTS[view]}</p>
              </Card>
              {spec.cabinet.chambers.map((c, i) =>
                c.load.kind === CHAMBER_LOAD.horn && c.load.horn.path === HORN_PATH.folded ? (
                  <FoldHornCard
                    key={`fold${i}`}
                    cabinet={spec.cabinet}
                    chamber={c}
                    horn={c.load.horn}
                    name={
                      spec.cabinet.chambers.length === 1 ? null : FOLD_EDITOR_TEXT.chamber(i + 1)
                    }
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
                  {SPEAKER_TEXT.hornNoRoom({
                    depth: formatInches(f.path.needs.depthIn),
                    height: formatInches(f.path.needs.heightIn),
                  })}
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
            <section ref={responseBlock} className={`${cell("col-start-1 row-start-1")} ${GAP_Y}`}>
              <SectionHeading>{SPEAKER_TEXT.response}</SectionHeading>
              {responseChart}
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
                    ...previewSeries("max"),
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
        <SpeakerSettings
          speakerPage={speakerPage}
          folds={folds}
          sheet={sheet}
          onCompare={openCompare}
          compareView={compareView}
          onCloseCompare={() => setCompare(null)}
        />
      }
    />
  );
}
