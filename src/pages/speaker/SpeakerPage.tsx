import { useMemo, useState } from "react";
import type { BandId, DispersionPlane, PaPlannerDesign } from "../../types";
import { alpha, bandLine } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Notice } from "../../components/ui/Notice";
import { WarningChips } from "../../components/chips/WarningChips";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { DispersionBlock } from "../../components/charts/DispersionBlock";
import { speakerDispersionMap } from "../../lib/speaker/stackDispersion";
import { DISPERSION_HEADING, DISPERSION_START_PLANE } from "../../constants/dispersionPlanes";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { STATS } from "../../components/optimizer/StatRow";
import { priceText } from "../../lib/speaker/speakerTotals";
import { PURCHASED_PARTIAL_NOTE } from "../../constants/purchasedParts";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { SpeakerView3D } from "../../components/stack-view/SpeakerView3D";
import { SpeakerFront } from "../../components/drawings/SpeakerFront";
import { SpeakerSection } from "../../components/drawings/SpeakerSection";
import { FoldHornCard } from "./FoldHornCard";
import { withHornFold } from "./chamberLoad";
import { Card } from "../../components/ui/Card";
import {
  hornFlare,
  speakerLayout,
  ventMoved,
  hornFitsWhereSet,
} from "../../lib/speaker/speakerLayout";
import { keysOf } from "../../lib/records";
import { formatInches } from "../../lib/format";
import {
  READING_WIDTH,
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
import { SPEAKER_SETTINGS_SECTIONS } from "../../constants/settingsSections";
import { SPEAKER_TEXT, MODEL_GAP_TEXT } from "../../constants/speakerPage";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import { CHAMBER_LOAD, HORN_PATH } from "../../constants/speakerSpec";
import {
  SPEAKER_START,
  SPEAKER_START_NAMES,
  type SpeakerStart,
} from "../../constants/speakerStarts";
import { SpeakerSettings } from "./SpeakerSettings";
import { bracingTaken, noChamberBraced } from "../../lib/speaker/chamberBracing";
import { SpeakerOptimizerResults } from "./SpeakerOptimizerResults";
import { bracingText } from "./speakerText";
import { braceNoteLines } from "../../lib/bracingNotes";
import { PA_PANEL_TARGET_HZ } from "../../lib/pa/bracing";
import { formatHz } from "../../lib/format";
import { NO_BRACING } from "../../constants/bracing";
import { bandChips, chamberChips } from "./speakerChips";
import { chamberFitChips } from "../../lib/speaker/fitChips";
import { speakerStarts, startGroup, startSpeaker } from "./speakerStarts";
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

/** The settings sections that start closed: only Chambers starts open. */
const FOLDS_START = { construction: false, bands: false, look: false, optimizer: false } as const;

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
export function SpeakerPage({ speakerPage, planner, hifi }: Props) {
  const pal = usePalette();
  const { spec, response, limits, build, price, optimizer, store, snapshot, restore } = speakerPage;
  const folds = useFolds(
    "speaker.settingsFolds",
    keysOf(SPEAKER_SETTINGS_SECTIONS),
    {},
    FOLDS_START,
  );
  const starts = speakerStarts(planner.layout);
  const startOptions = starts.map((id) => ({
    id,
    name: SPEAKER_START_NAMES[id],
    group: startGroup(id),
  }));
  const [start, setStart] = useState<SpeakerStart>(SPEAKER_START.empty);
  const startFrom = () =>
    speakerPage.setSpec(
      startSpeaker(start, {
        pa: paPlannerDesign(planner),
        hifi,
        hifiLook: { cabFinish: hifi.cabinetFinish, baffleColor: hifi.baffleColor },
      }),
    );
  /** each band's line, by its place in the spec (lighter gray, magenta, cyan); the sum in ink */
  const lineOf = (id: BandId) =>
    bandLine(
      pal,
      spec.bands.findIndex((b) => b.id === id),
      spec.bands.length,
    );
  /** each band's name, by id */
  const nameOf = (id: BandId) => spec.bands.find((b) => b.id === id)?.name ?? id;
  const { chambers } = spec.cabinet;
  /** no chamber takes braces: every Box chamber unbraced, or only horn chambers */
  const unbraced = noChamberBraced(chambers);
  /** the bracing target the notes name: the first braced Box chamber's */
  const braceTargetHz =
    chambers.map(bracingTaken).find((b) => b.braceStyle !== NO_BRACING)?.braceTargetHz ??
    PA_PANEL_TARGET_HZ;
  const layout = speakerLayout(spec.cabinet);
  /** the horns built into the chambers, as the views draw them */
  const flares = layout.chambers.flatMap((c) => hornFlare(spec.cabinet, c) ?? []);
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
  ];
  /** each chamber's duct and hardware fit checks */
  const fitChips = chamberFitChips(spec.cabinet, build);
  const [resultsGrid, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  const cell = (place: string) => resultsCellClass(wide, place);
  /** the model left a chamber or a filter out: its notices say which and why (the empty-chart notice stays quiet) */
  const hasGaps = response.gaps.length > 0 || response.chambers.some((c) => c.gaps.length > 0);
  const fbMarks = response.chambers.flatMap((c, i) =>
    c.fb !== null ? [{ f: c.fb, label: one ? "Fb" : `Fb ${i + 1}` }] : [],
  );
  return (
    <SettingsLayout
      results={
        <>
          <SavedConfigs
            bare
            store={store}
            snapshot={snapshot}
            restore={restore}
            saveName={spec.name}
            manage
          />
          <SpeakerOptimizerResults optimizer={optimizer} />
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
            <SectionHeading>{SPEAKER_TEXT.views}</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
              <Viewer3DCard boxClassName={`relative ${VIEW_HEIGHT}`}>
                {(cutaway) => (
                  <SpeakerView3D
                    spec={{ cabinet: spec.cabinet, look: spec.look }}
                    cutaway={cutaway}
                  />
                )}
              </Viewer3DCard>
              <Card gapY={false} className={`flex flex-col ${VIEW_HEIGHT}`}>
                <div className="flex-1 min-h-0">
                  <SpeakerFront spec={spec} />
                </div>
                <p className="text-xs text-stone-500 mt-2">{SPEAKER_TEXT.front}</p>
              </Card>
              {flares.length > 0 && (
                <Card gapY={false} className={`flex flex-col sm:col-span-2 ${SECTION_HEIGHT}`}>
                  <div className="flex-1 min-h-0">
                    <SpeakerSection spec={spec} />
                  </div>
                  <p className="text-xs text-stone-500 mt-2">{SPEAKER_TEXT.sectionNote}</p>
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
          {/* Response beside Maximum output (and Price, weight and bracing under Response) once the pane is wide enough */}
          <div ref={resultsGrid} className={`${RESULT_MAX_WIDTH} mt-5 ${resultsGridClass(wide)}`}>
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
                  ...(response.bands.length
                    ? [
                        {
                          curve: response.sum,
                          id: SUM_SERIES_ID,
                          label: SPEAKER_TEXT.sum,
                          stroke: pal.ink,
                          width: SUM_LINE_PX,
                          tint: alpha(pal.ink, 0.05),
                          clipAtFloor: true,
                        },
                      ]
                    : []),
                  ...response.bands.map((b) => ({
                    curve: b.curve,
                    clipAtFloor: true,
                    id: b.id,
                    label: nameOf(b.id),
                    ...lineOf(b.id),
                    tint: "transparent",
                  })),
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
              <p className={`${READING_WIDTH} text-sm text-stone-500`}>{SPEAKER_TEXT.modelNote}</p>
            </section>
            <section
              className={`${cell(
                limits.bands.length > 0 ? "col-start-1 row-start-2" : "col-start-2 row-start-1",
              )} ${GAP_Y}`}
            >
              <SectionHeading>{SPEAKER_TEXT.build}</SectionHeading>
              <StatTileGrid tiles={buildTiles} />
              {price.partial && <Notice>{PURCHASED_PARTIAL_NOTE}</Notice>}
              {unbraced ? (
                <Notice>{SPEAKER_TEXT.notBraced}</Notice>
              ) : (
                <ul className="text-sm">
                  {build.chambers.map((c, i) => (
                    <li key={c.box}>
                      {SPEAKER_TEXT.chamber} {i + 1}: {bracingText(c.bracing)}
                    </li>
                  ))}
                </ul>
              )}
              {!unbraced &&
                build.chambers.flatMap((c, i) => {
                  const lines = braceNoteLines(`${SPEAKER_TEXT.chamber} ${i + 1}`, c.bracing);
                  return lines.length
                    ? [
                        <Notice key={`under${i}`}>
                          {SPEAKER_TEXT.underTarget(i + 1, formatHz(c.bracing.targetHz))}
                        </Notice>,
                        ...lines.map((line) => <Notice key={line}>{line}</Notice>),
                      ]
                    : [];
                })}
              {fitChips.some((chips) => chips.length > 0) && (
                <div className={`${READING_WIDTH} flex flex-col gap-3`}>
                  {fitChips.map(
                    (chips, i) =>
                      chips.length > 0 && (
                        <div key={i}>
                          <h4 className="text-xs font-semibold text-stone-500 mb-1">
                            {SPEAKER_TEXT.chamber} {i + 1}
                          </h4>
                          <WarningChips chips={chips} />
                        </div>
                      ),
                  )}
                </div>
              )}
              <p className={`${READING_WIDTH} text-sm text-stone-500`}>
                {SPEAKER_TEXT.priceNote}{" "}
                {unbraced
                  ? SPEAKER_TEXT.buildNoteUnbraced
                  : SPEAKER_TEXT.buildNote(formatHz(braceTargetHz))}
              </p>
            </section>
            {limits.bands.length > 0 && (
              <section className={`${cell("col-start-2 row-start-1 row-span-2")} ${GAP_Y}`}>
                <SectionHeading>{SPEAKER_TEXT.maxOutput}</SectionHeading>
                <ResponseChart
                  fmin={FREQ_AXIS_MIN_HZ}
                  fmax={FREQ_AXIS_MAX_HZ}
                  top={MAX_OUTPUT_TOP}
                  bot={MAX_OUTPUT_BOT}
                  step={10}
                  yLabel={SPEAKER_TEXT.maxYLabel}
                  series={[
                    {
                      curve: limits.sum,
                      id: SUM_SERIES_ID,
                      label: SPEAKER_TEXT.sum,
                      stroke: pal.ink,
                      width: SUM_LINE_PX,
                      tint: alpha(pal.ink, 0.05),
                      // below the floor it would run along the axis as if it were data
                      clipAtFloor: true,
                    },
                    ...limits.bands.map((b) => ({
                      curve: b.max,
                      clipAtFloor: true,
                      id: b.id,
                      label: nameOf(b.id),
                      ...lineOf(b.id),
                      tint: "transparent",
                    })),
                  ]}
                  marks={fbMarks}
                />
                <StatTileGrid tiles={maxTiles} />
                <div className={`${READING_WIDTH} flex flex-col gap-3`}>
                  {bandChips(spec, limits, response).map(({ id, chips }) => (
                    <div key={id}>
                      <h4 className="text-xs font-semibold text-stone-500 mb-1">{nameOf(id)}</h4>
                      <WarningChips chips={chips} tips={{ speakerKeepsUp: KEEP_UP_TEXT.tip }} />
                    </div>
                  ))}
                  {limits.chambers.map(
                    (c, i) =>
                      c && (
                        <div key={i}>
                          <h4 className="text-xs font-semibold text-stone-500 mb-1">
                            {SPEAKER_TEXT.chamber} {i + 1}
                          </h4>
                          <WarningChips chips={chamberChips(c, nameOf(c.band))} />
                        </div>
                      ),
                  )}
                </div>
                <p className={`${READING_WIDTH} text-sm text-stone-500`}>{SPEAKER_TEXT.maxNote}</p>
              </section>
            )}
          </div>
          {dispersion && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-6 ${GAP_Y}`}>
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
        </>
      }
      settings={<SpeakerSettings speakerPage={speakerPage} folds={folds} />}
    />
  );
}
