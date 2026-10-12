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
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
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
import { HORN_COLOR_CATALOG_LABEL } from "../../constants/hornColor";
import { driverHorn, hornFlare, speakerLayout, ventMoved } from "../../lib/speaker/speakerLayout";
import { byId } from "../../lib/tables";
import { keysOf } from "../../lib/records";
import { DEFAULT_HIFI, DEFAULT_PA, DEFAULT_SPEAKER_CHAMBER } from "../../lib/defaults";
import { RESULT_MAX_WIDTH, READING_WIDTH } from "../../styles/layout";
import {
  HIFI_BOT,
  HIFI_TOP,
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
  MAX_OUTPUT_BOT,
  MAX_OUTPUT_TOP,
} from "../../constants/chartScales";
import {
  DESIGNER_SETTINGS_SECTIONS,
  type DesignerSettingsSection,
} from "../../constants/settingsSections";
import { DESIGNER_TEXT, MODEL_GAP_TEXT } from "../../constants/designer";
import {
  DESIGNER_START,
  DESIGNER_START_NAMES,
  DESIGNER_START_TEXT,
  type DesignerStart,
} from "../../constants/designerStarts";
import { ChamberSettings } from "./ChamberSettings";
import { BandSettings } from "./BandSettings";
import { FilterFields } from "./FilterFields";
import { bandText, chamberText, countText, inputText } from "./designerText";
import { bandChips, chamberChips } from "./designerChips";
import { paStarts, startSpeaker } from "./designerStarts";
import type { Designer } from "./useDesigner";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type { HifiPlanner } from "../hifi/useHifiPlanner";

interface Props {
  designer: Designer;
  planner: PaPlanner;
  hifi: HifiPlanner;
}

/** The sum's key on the charts: no band id takes it (the adapters' are band words, the Designer's "band1"…). */
const SUM_SERIES_ID = "sum";

/** The sum's line width on the charts, px: it reads over its bands' (2 px). */
const SUM_LINE_PX = 4;

/** The 3D view's and the front drawing's height, as the Hi-fi page's 3D view. */
const VIEW_HEIGHT = "h-[280px] md:h-[clamp(300px,46vh,480px)]";

/** The PA design as the planner holds it, every field set. */
const paPlannerDesign = (planner: PaPlanner): PaPlannerDesign => ({
  ...planner.snapshot(),
  panel: planner.wallPanel,
  hornMount: planner.hornMount,
  spacerH: planner.spacerHeightIn,
  hardware: planner.hardware,
});

/**
 * The Designer: one speaker from its chambers, drivers and bands, its response and its maximum output on fixed axes
 * with the limits' checks, and the speaker library. A design starts empty, from a saved speaker, or from the current PA
 * or Hi-fi design.
 */
export function DesignerPage({ designer, planner, hifi }: Props) {
  const pal = usePalette();
  const { spec, response, limits, store, snapshot, restore } = designer;
  const folds = useFolds("designer.settingsFolds", keysOf(DESIGNER_SETTINGS_SECTIONS));
  const starts: DesignerStart[] = [
    DESIGNER_START.empty,
    DESIGNER_START.hifi,
    ...paStarts(planner.layout),
  ];
  const startOptions: SelectOption[] = starts.map((id) => ({ id, name: DESIGNER_START_NAMES[id] }));
  const [start, setStart] = useState<DesignerStart>(DESIGNER_START.empty);
  const startFrom = () =>
    designer.setSpec(
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
  const cabFinish = spec.look.cabFinish ?? DEFAULT_PA.cabFinish;
  const baffleColor = spec.look.baffleColor ?? DEFAULT_PA.baffleColor;
  /** the first catalog horn the drivers take: the horn color picker shows its catalog finish */
  const firstHorn = chambers.flatMap((c) => c.drivers.map(driverHorn)).find((h) => h !== null);
  const layout = speakerLayout(spec.cabinet);
  /** the horns built into the chambers, as the views draw them */
  const flares = layout.chambers.flatMap((c) => hornFlare(spec.cabinet, c) ?? []);
  const summaries: Record<DesignerSettingsSection, string> = {
    speaker: `${spec.name} · ${countText(chambers.length, "chamber", "chambers")} · ${countText(spec.bands.length, "band", "bands")}`,
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
  const section = (id: DesignerSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={DESIGNER_SETTINGS_SECTIONS[id]}
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
      ? [[DESIGNER_TEXT.speakerMax, limits.musicDb.toFixed(0), "dB"] satisfies StatTileItem]
      : []),
  ];
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
            <SectionHeading className="mb-3">{DESIGNER_TEXT.views}</SectionHeading>
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
                <p className="text-xs text-stone-500 mt-2">{DESIGNER_TEXT.front}</p>
              </Card>
            </div>
            {flares.some((f) => f.placeholder) && <Notice>{DESIGNER_TEXT.hornPlaceholder}</Notice>}
            {flares.some((f) => f.mouthClipped) && (
              <Notice>{DESIGNER_TEXT.hornMouthClipped}</Notice>
            )}
            {flares.some((f) => f.mouthMoved) && <Notice>{DESIGNER_TEXT.hornMouthMoved}</Notice>}
            {layout.chambers.some((c) => ventMoved(spec.cabinet, c)) && (
              <Notice>{DESIGNER_TEXT.ventMoved}</Notice>
            )}
          </section>
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">{DESIGNER_TEXT.response}</SectionHeading>
            <ResponseChart
              fmin={FREQ_AXIS_MIN_HZ}
              fmax={FREQ_AXIS_MAX_HZ}
              top={HIFI_TOP}
              bot={HIFI_BOT}
              step={10}
              yLabel={DESIGNER_TEXT.yLabel}
              series={[
                ...(response.bands.length
                  ? [
                      {
                        curve: response.sum,
                        id: SUM_SERIES_ID,
                        label: DESIGNER_TEXT.sum,
                        stroke: pal.ink,
                        width: SUM_LINE_PX,
                        tint: alpha(pal.ink, 0.05),
                      },
                    ]
                  : []),
                ...response.bands.map((b) => ({
                  // a band drawn only where it is on the chart: below the floor it would run along the axis
                  curve: b.curve.filter((o) => o.spl >= HIFI_BOT),
                  id: b.id,
                  label: nameOf(b.id),
                  ...lineOf(b.id),
                  tint: "transparent",
                })),
              ]}
              marks={fbMarks}
            />
            {response.bands.length === 0 && <Notice>{DESIGNER_TEXT.noBands}</Notice>}
            {response.gaps.length > 0 && (
              <Notice>
                Not modeled: {[...new Set(response.gaps)].map((g) => MODEL_GAP_TEXT[g]).join("; ")}.
              </Notice>
            )}
            <StatTileGrid tiles={tiles} className="mt-5 mb-3" />
            <p className={`${READING_WIDTH} text-sm text-stone-500`}>{DESIGNER_TEXT.modelNote}</p>
          </section>
          {limits.bands.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-6`}>
              <SectionHeading className="mb-3">{DESIGNER_TEXT.maxOutput}</SectionHeading>
              <ResponseChart
                fmin={FREQ_AXIS_MIN_HZ}
                fmax={FREQ_AXIS_MAX_HZ}
                top={MAX_OUTPUT_TOP}
                bot={MAX_OUTPUT_BOT}
                step={10}
                yLabel={DESIGNER_TEXT.maxYLabel}
                series={[
                  {
                    curve: limits.sum,
                    id: SUM_SERIES_ID,
                    label: DESIGNER_TEXT.sum,
                    stroke: pal.ink,
                    width: SUM_LINE_PX,
                    tint: alpha(pal.ink, 0.05),
                  },
                  ...limits.bands.map((b) => ({
                    curve: b.max.filter((o) => o.spl >= MAX_OUTPUT_BOT),
                    id: b.id,
                    label: nameOf(b.id),
                    ...lineOf(b.id),
                    tint: "transparent",
                  })),
                ]}
                marks={fbMarks}
              />
              <StatTileGrid tiles={maxTiles} className="mt-5 mb-3" />
              <div className="flex flex-col gap-3 mb-3">
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
                          {DESIGNER_TEXT.chamber} {i + 1}
                        </h4>
                        <WarningChips chips={chamberChips(c, nameOf(c.band))} />
                      </div>
                    ),
                )}
              </div>
              <p className={`${READING_WIDTH} text-sm text-stone-500`}>{DESIGNER_TEXT.maxNote}</p>
            </section>
          )}
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
                onChange={designer.setName}
              />
              <SelectField
                label={DESIGNER_START_TEXT.startFrom}
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(starts.find((s) => s === o.id) ?? DESIGNER_START.empty)}
              />
              <Button onClick={startFrom} className="mb-2">
                {DESIGNER_START_TEXT.startOver}
              </Button>
              <p className="text-xs text-stone-500 mb-2">
                Starting over replaces this design; open a saved speaker from the library above.
              </p>
            </>,
          )}
          {section(
            "chambers",
            <>
              {chambers.map((chamber, i) => (
                <ChamberSettings
                  key={i}
                  index={i}
                  chamber={chamber}
                  result={response.chambers[i]}
                  bands={spec.bands}
                  onEdit={(edit) => designer.editChamber(i, edit)}
                  onRemove={
                    one
                      ? undefined
                      : () => designer.editChambers((list) => list.filter((_, k) => k !== i))
                  }
                />
              ))}
              <Button
                className="mb-2"
                onClick={() =>
                  designer.editChambers((list) => {
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
                <h4 className="font-semibold mb-1">{DESIGNER_TEXT.inputRange}</h4>
                <p className="text-xs text-stone-500 mb-2">{DESIGNER_TEXT.inputHint}</p>
                <FilterFields
                  filters={spec.input}
                  // a new corner at the PA's crossover to its subs
                  newCornerHz={DEFAULT_PA.xoLo}
                  offName={DESIGNER_TEXT.inputOff}
                  onEdit={designer.editInput}
                />
              </Card>
              {spec.bands.map((band, i) => (
                <BandSettings
                  key={band.id}
                  band={band}
                  newCornerHz={DEFAULT_HIFI.crossoverHz}
                  onEdit={(edit) => designer.editBand(i, edit)}
                  onRemove={spec.bands.length > 1 ? () => designer.removeBand(band.id) : undefined}
                />
              ))}
              <Button className="mb-2" onClick={designer.addBand}>
                Add band
              </Button>
            </>,
          )}
          {section(
            "look",
            <>
              <CabinetFinishPicker
                value={cabFinish}
                onChange={(v) => designer.editLook({ cabFinish: v })}
              />
              <BaffleColorPicker
                value={baffleColor}
                onChange={(v) => designer.editLook({ baffleColor: v })}
              />
              {firstHorn && (
                <HornColorPicker
                  value={spec.look.hornColor}
                  onChange={(hornColor) => designer.editLook({ hornColor })}
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
