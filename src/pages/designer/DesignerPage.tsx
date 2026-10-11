import { useState } from "react";
import type { BandId, PaPlannerDesign } from "../../types";
import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { Notice } from "../../components/ui/Notice";
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
import { cabinetFinishName } from "../../lib/data";
import { HORN_COLOR_CATALOG_LABEL } from "../../constants/hornColor";
import { driverHorn, hornFlare, speakerLayout } from "../../lib/speaker/speakerLayout";
import { byId } from "../../lib/tables";
import { keysOf } from "../../lib/records";
import {
  DEFAULT_HIFI,
  DEFAULT_PA,
  DEFAULT_SPEAKER_BAND,
  DEFAULT_SPEAKER_CHAMBER,
} from "../../lib/defaults";
import { RESULT_MAX_WIDTH, READING_WIDTH } from "../../styles/layout";
import {
  HIFI_BOT,
  HIFI_TOP,
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
} from "../../constants/chartScales";
import {
  DESIGNER_SETTINGS_SECTIONS,
  type DesignerSettingsSection,
} from "../../constants/settingsSections";
import {
  BAND_NAMES,
  DESIGNER_START,
  DESIGNER_START_NAMES,
  DESIGNER_TEXT,
  MODEL_GAP_TEXT,
  type DesignerStart,
} from "../../constants/designer";
import { SPEAKER_BAND } from "../../constants/speakerSpec";
import { ChamberSettings } from "./ChamberSettings";
import { BandSettings } from "./BandSettings";
import { bandText, chamberText, countText } from "./designerText";
import { paStarts, startSpeaker } from "./designerStarts";
import type { Designer } from "./useDesigner";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import type { HifiPlanner } from "../hifi/useHifiPlanner";

interface Props {
  designer: Designer;
  planner: PaPlanner;
  hifi: HifiPlanner;
}

/** The bands drawn dashed: the air band shares the high band's color. */
const BAND_DASH: Partial<Record<BandId, string>> = { air: "6 4" };

/** The 3D view's and the front drawing's height, as the Hi-fi page's 3D view. */
const VIEW_HEIGHT = "h-[280px] md:h-[clamp(300px,46vh,480px)]";

/** Every band id, low to high. */
const BAND_IDS = keysOf(SPEAKER_BAND);

/** The PA design as the planner holds it, every field set. */
const paPlannerDesign = (planner: PaPlanner): PaPlannerDesign => ({
  ...planner.snapshot(),
  panel: planner.wallPanel,
  hornMount: planner.hornMount,
  spacerH: planner.spacerHeightIn,
});

/**
 * The Designer: one speaker from its chambers, drivers and bands, its response on fixed axes, and the speaker library.
 * A design starts empty, from a saved speaker, or from the current PA or Hi-fi design.
 */
export function DesignerPage({ designer, planner, hifi }: Props) {
  const pal = usePalette();
  const { spec, response, store, snapshot, restore } = designer;
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
  /** each band's line color: the PA chart's (sub ink, mid-bass magenta, horn cyan); the sum in ink */
  const bandStroke: Record<BandId, string> = {
    low: pal.muted,
    mid: pal.magenta,
    high: pal.cyan,
    // the top octave: the high band's cyan, dashed (BAND_DASH)
    air: pal.cyan,
  };
  const usedIds = spec.bands.map((b) => b.id);
  const nextBandId = BAND_IDS.find((id) => !usedIds.includes(id));
  const { chambers } = spec.cabinet;
  const cabFinish = spec.look.cabFinish ?? DEFAULT_PA.cabFinish;
  const baffleColor = spec.look.baffleColor ?? DEFAULT_PA.baffleColor;
  /** the first catalog horn the drivers take: the horn color picker shows its catalog finish */
  const firstHorn = chambers.flatMap((c) => c.drivers.map(driverHorn)).find((h) => h !== null);
  const layout = speakerLayout(spec.cabinet);
  const hornPlaceholder = layout.chambers.some((c) => hornFlare(spec.cabinet, c)?.placeholder);
  const summaries: Record<DesignerSettingsSection, string> = {
    speaker: `${spec.name} · ${countText(chambers.length, "chamber", "chambers")} · ${countText(spec.bands.length, "band", "bands")}`,
    chambers: chambers.map(chamberText).join("; "),
    bands: spec.bands.map(bandText).join(" · "),
    look: `${cabinetFinishName(cabFinish)} · baffle ${baffleColor}${firstHorn ? ` · horn ${spec.look.hornColor ?? HORN_COLOR_CATALOG_LABEL}` : ""}`,
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
      `${BAND_NAMES[b.id]} band`,
      b.passbandDb.toFixed(1),
      "dB",
    ]),
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
              <figure
                className={`rounded-lg border border-stone-300 bg-panel p-3 flex flex-col ${VIEW_HEIGHT}`}
              >
                <div className="flex-1 min-h-0">
                  <SpeakerFront spec={spec} />
                </div>
                <figcaption className="text-xs text-stone-500 mt-2">
                  {DESIGNER_TEXT.front}
                </figcaption>
              </figure>
            </div>
            {hornPlaceholder && <Notice>{DESIGNER_TEXT.hornPlaceholder}</Notice>}
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
                        label: DESIGNER_TEXT.sum,
                        stroke: pal.ink,
                        tint: alpha(pal.ink, 0.05),
                      },
                    ]
                  : []),
                ...response.bands.map((b) => ({
                  // a band drawn only where it is on the chart: below the floor it would run along the axis
                  curve: b.curve.filter((o) => o.spl >= HIFI_BOT),
                  label: BAND_NAMES[b.id],
                  stroke: bandStroke[b.id],
                  dash: BAND_DASH[b.id],
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
                label="Start from"
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(starts.find((s) => s === o.id) ?? DESIGNER_START.empty)}
              />
              <Button onClick={startFrom} className="mb-2">
                Start over from this
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
              {spec.bands.map((band, i) => (
                <BandSettings
                  key={band.id}
                  band={band}
                  freeIds={BAND_IDS.filter((id) => id === band.id || !usedIds.includes(id))}
                  newCornerHz={DEFAULT_HIFI.crossoverHz}
                  onEdit={(edit) => designer.editBand(i, edit)}
                  onRename={(id) => designer.renameBand(band.id, id)}
                  onRemove={spec.bands.length > 1 ? () => designer.removeBand(band.id) : undefined}
                />
              ))}
              {nextBandId && (
                <Button
                  className="mb-2"
                  onClick={() =>
                    designer.editBands((list) => [
                      ...list,
                      { id: nextBandId, ...DEFAULT_SPEAKER_BAND },
                    ])
                  }
                >
                  Add band
                </Button>
              )}
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
