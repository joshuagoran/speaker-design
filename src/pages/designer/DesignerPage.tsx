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
import { byId } from "../../lib/tables";
import { keysOf } from "../../lib/records";
import { DEFAULT_HIFI, DEFAULT_SPEAKER_BAND, DEFAULT_SPEAKER_CHAMBER } from "../../lib/defaults";
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
    // the top octave in the brand's yellow accent: drawn under the sum, it reads by its legend
    air: pal.yellow,
  };
  const usedIds = spec.bands.map((b) => b.id);
  const nextBandId = BAND_IDS.find((id) => !usedIds.includes(id));
  const { chambers } = spec.cabinet;
  const summaries: Record<DesignerSettingsSection, string> = {
    speaker: `${spec.name} · ${countText(chambers.length, "chamber", "chambers")} · ${countText(spec.bands.length, "band", "bands")}`,
    chambers: chambers.map(chamberText).join("; "),
    bands: spec.bands.map(bandText).join(" · "),
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
        </SettingsColumn>
      }
    />
  );
}
