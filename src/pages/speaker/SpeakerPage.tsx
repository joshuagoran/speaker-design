import { useState } from "react";
import type { BandId, PaPlannerDesign } from "../../types";
import { alpha, bandLine } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { SelectField } from "../../components/ui/SelectField";
import { Notice } from "../../components/ui/Notice";
import { WarningChips } from "../../components/chips/WarningChips";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { SpeakerView3D } from "../../components/stack-view/SpeakerView3D";
import { SpeakerFront } from "../../components/drawings/SpeakerFront";
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
import { DEFAULT_HIFI, DEFAULT_PA, DEFAULT_SPEAKER_CHAMBER } from "../../lib/defaults";
import {
  RESULT_MAX_WIDTH,
  READING_WIDTH,
  RESULTS_TWO_COLUMN_PX,
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
} from "../../constants/chartScales";
import {
  SPEAKER_SETTINGS_SECTIONS,
  type SpeakerSettingsSection,
} from "../../constants/settingsSections";
import { ARCH_BLOCK_TEXT, SPEAKER_TEXT, MODEL_GAP_TEXT } from "../../constants/speakerPage";
import {
  CABINET_CONSTRUCTION,
  CABINET_CONSTRUCTION_NAMES,
  CABINET_TOP,
  CABINET_TOP_NAMES,
} from "../../constants/speakerSpec";
import {
  SPEAKER_START,
  SPEAKER_START_NAMES,
  SPEAKER_START_TEXT,
  type SpeakerStart,
} from "../../constants/speakerStarts";
import { ChamberSettings } from "./ChamberSettings";
import { BandSettings } from "./BandSettings";
import { AutoBalanceButton } from "../../components/ui/AutoBalanceButton";
import { FilterFields } from "./FilterFields";
import { bandText, bracingText, chamberText, countText, inputText } from "./speakerText";
import { braceNoteLines } from "../../lib/bracingNotes";
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

/** The PA design as the planner holds it, every field set. */
export const paPlannerDesign = (planner: PaPlanner): PaPlannerDesign => ({
  ...planner.snapshot(),
  panel: planner.wallPanel,
  hornMount: planner.hornMount,
  spacerH: planner.spacerHeightIn,
  hardware: planner.hardware,
});

/**
 * The Speaker page: one speaker from its chambers, drivers and bands, its response and its maximum output on fixed axes
 * with the limits' checks, and the speaker library. A design starts from a template (empty, the PA, Hi-fi, monitor,
 * fill and PA v2 boxes), from a saved speaker, or from the current PA or Hi-fi design.
 */
export function SpeakerPage({ speakerPage, planner, hifi }: Props) {
  const pal = usePalette();
  const { spec, response, limits, build, store, snapshot, restore } = speakerPage;
  const folds = useFolds("speaker.settingsFolds", keysOf(SPEAKER_SETTINGS_SECTIONS));
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
  const { chambers, construction, top, insetIn, braceStyle, braceTargetHz, backJoint } =
    spec.cabinet;
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
      braceStyle === NO_BRACING
        ? SPEAKER_TEXT.notBracedSummary
        : `braced with ${BRACE_STYLE_SUMMARY[braceStyle]} to ${formatHz(braceTargetHz)}`,
      BACK_JOINT_SUMMARY[backJoint],
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
  const buildTiles: StatTileItem[] = [
    [SPEAKER_TEXT.weight, build.lb.toFixed(0), "lb"],
    ...(one
      ? []
      : build.chambers.map((c, i): StatTileItem => [
          SPEAKER_TEXT.chamberWeight(i + 1),
          c.lb.total.toFixed(0),
          "lb",
        ])),
  ];
  const [resultsGrid, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  const cell = (place: string) => resultsCellClass(wide, place);
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
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">{SPEAKER_TEXT.views}</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
              <Viewer3DCard boxClassName={`relative ${VIEW_HEIGHT}`}>
                {(cutaway) => (
                  <SpeakerView3D
                    spec={{ cabinet: spec.cabinet, look: spec.look }}
                    cutaway={cutaway}
                  />
                )}
              </Viewer3DCard>
              <Card className={`flex flex-col ${VIEW_HEIGHT}`}>
                <div className="flex-1 min-h-0">
                  <SpeakerFront spec={spec} />
                </div>
                <p className="text-xs text-stone-500 mt-2">{SPEAKER_TEXT.front}</p>
              </Card>
            </div>
            {flares.some((f) => f.placeholder) && <Notice>{SPEAKER_TEXT.hornPlaceholder}</Notice>}
            {flares.some((f) => f.mouthClipped) && <Notice>{SPEAKER_TEXT.hornMouthClipped}</Notice>}
            {flares.some((f) => f.mouthMoved) && <Notice>{SPEAKER_TEXT.hornMouthMoved}</Notice>}
            {layout.chambers.some((c) =>
              c.chamber.drivers.some((d) => !hornFitsWhereSet(c, d)),
            ) && <Notice>{SPEAKER_TEXT.hornNoFit}</Notice>}
            {layout.chambers.some((c) => ventMoved(spec.cabinet, c)) && (
              <Notice>{SPEAKER_TEXT.ventMoved}</Notice>
            )}
          </section>
          {/* Response beside Maximum output (and Weight and bracing under Response) once the pane is wide enough */}
          <div ref={resultsGrid} className={`${RESULT_MAX_WIDTH} mt-5 ${resultsGridClass(wide)}`}>
            <section className={cell("col-start-1 row-start-1")}>
              <SectionHeading className="mb-3">{SPEAKER_TEXT.response}</SectionHeading>
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
              {response.bands.length === 0 && <Notice>{SPEAKER_TEXT.noBands}</Notice>}
              {response.gaps.length > 0 && (
                <Notice>
                  Not modeled:{" "}
                  {[...new Set(response.gaps)].map((g) => MODEL_GAP_TEXT[g]).join("; ")}.
                </Notice>
              )}
              <StatTileGrid tiles={tiles} className="mt-5 mb-3" />
              <p className={`${READING_WIDTH} text-sm text-stone-500`}>{SPEAKER_TEXT.modelNote}</p>
            </section>
            <section
              className={cell(
                limits.bands.length > 0 ? "col-start-1 row-start-2" : "col-start-2 row-start-1",
              )}
            >
              <SectionHeading className="mb-3">{SPEAKER_TEXT.build}</SectionHeading>
              <StatTileGrid tiles={buildTiles} className="mb-3" />
              {unbraced ? (
                <Notice>{SPEAKER_TEXT.notBraced}</Notice>
              ) : (
                <ul className="text-sm mb-3">
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
                          {SPEAKER_TEXT.underTarget(i + 1, formatHz(braceTargetHz))}
                        </Notice>,
                        ...lines.map((line) => <Notice key={line}>{line}</Notice>),
                      ]
                    : [];
                })}
              <p className={`${READING_WIDTH} text-sm text-stone-500 mt-3`}>
                {unbraced
                  ? SPEAKER_TEXT.buildNoteUnbraced
                  : SPEAKER_TEXT.buildNote(formatHz(braceTargetHz))}
              </p>
            </section>
            {limits.bands.length > 0 && (
              <section className={cell("col-start-2 row-start-1 row-span-2")}>
                <SectionHeading className="mb-3">{SPEAKER_TEXT.maxOutput}</SectionHeading>
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
                <StatTileGrid tiles={maxTiles} className="mt-5 mb-3" />
                <div className={`${READING_WIDTH} flex flex-col gap-3 mb-3`}>
                  {bandChips(spec, limits).map(({ id, chips }) => (
                    <div key={id}>
                      <h4 className="text-xs font-semibold text-stone-500 mb-1">{nameOf(id)}</h4>
                      <WarningChips chips={chips} />
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
        </>
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
              <SelectField
                label={SPEAKER_START_TEXT.startFrom}
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(o.id)}
                group={(o) => o.group}
              />
              <Button variant="primary" onClick={startFrom} className="mb-2">
                {SPEAKER_START_TEXT.startOver}
              </Button>
              <p className="text-xs text-stone-500 mb-2">{SPEAKER_TEXT.startOverHint}</p>
            </>,
          )}
          {section(
            "construction",
            <>
              <ToggleGroup
                label={SPEAKER_TEXT.construction}
                className="mb-3"
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
                  className="mb-3"
                />
              )}
              <ToggleGroup
                label={SPEAKER_TEXT.top}
                className="mb-2"
                value={top}
                onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, top: v }))}
                options={entriesOf(CABINET_TOP_NAMES)}
              />
              {top === CABINET_TOP.arched && arch !== null && (
                <div className="mb-3">
                  <Notice>
                    {SPEAKER_TEXT.archFlat} {ARCH_BLOCK_TEXT[arch]}
                  </Notice>
                </div>
              )}
              <ToggleGroup
                label={SPEAKER_TEXT.backJoint}
                className="mb-3"
                value={backJoint}
                onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, backJoint: v }))}
                options={keysOf(BACK_JOINT_NAMES).map(
                  (id) => [id, BACK_JOINT_NAMES[id], BACK_JOINT_TIPS[id]] as const,
                )}
              />
              <ToggleGroup
                label={SPEAKER_TEXT.braceStyle}
                className="mb-3"
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
                  className="mb-3"
                />
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
                className="mb-2"
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
              <Card className="mb-3">
                <CardHeading className="mb-1">
                  <Tooltip tip={SPEAKER_TEXT.inputTip}>{SPEAKER_TEXT.inputRange}</Tooltip>
                </CardHeading>
                <p className="text-xs text-stone-500 mb-2">{SPEAKER_TEXT.inputHint}</p>
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
              <Button variant="primary" className="mb-3" onClick={speakerPage.addBand}>
                Add band
              </Button>
              <AutoBalanceButton
                className="mb-2"
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
        </SettingsColumn>
      }
    />
  );
}
