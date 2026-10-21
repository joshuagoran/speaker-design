import type { Folds } from "../../hooks/useFolds";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import {
  SETTINGS_SHEET_CLASS,
  SHEET_BELOW_CHART_CLASS,
  SettingsSheetTabs,
  settingsSheetBodyClass,
  type SettingsSheet,
} from "../../components/ui/SettingsSheetTabs";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CardHeading } from "../../components/ui/CardHeading";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { HandleOffsetFields } from "../../components/ui/HandleFields";
import { Tooltip } from "../../components/ui/Tooltip";
import { Notice } from "../../components/ui/Notice";
import { BandDot } from "../../components/ui/BandDot";
import { CalculateGainsButton } from "../../components/ui/CalculateGainsButton";
import { AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import {
  BaffleColorPicker,
  CabinetFinishPicker,
  HornColorPicker,
} from "../../components/ui/FinishPickers";
import { cabinetFinishName, paintName } from "../../lib/data";
import { archBlock, driverHorn, speakerLayout } from "../../lib/speaker/speakerLayout";
import { byId } from "../../lib/tables";
import { entriesOf } from "../../lib/records";
import { PANEL_NOMINAL_OPTIONS, formatThickness } from "../../lib/build/panel";
import { withWallPanel } from "../../lib/speaker/cabinetPanels";
import { BAFFLE_PLY_IN } from "../../lib/acoustics/boxModels";
import { DEFAULT_HARDWARE } from "../../lib/build/hardware";
import { DEFAULT_HIFI, DEFAULT_PA, DEFAULT_SPEAKER_CHAMBER } from "../../lib/defaults";
import { HANDLES } from "../../data/catalog/cabinet-hardware";
import { HORN_COLOR_CATALOG_LABEL } from "../../constants/hornColor";
import {
  SPEAKER_SETTINGS_SECTIONS,
  SPEAKER_SETTINGS_TABS,
  type SpeakerSettingsSection,
} from "../../constants/settingsSections";
import { ARCH_BLOCK_TEXT, SPEAKER_TEXT } from "../../constants/speakerPage";
import { SETTINGS_TEXT } from "../../constants/speakerSettings";
import {
  CABINET_CONSTRUCTION,
  CABINET_CONSTRUCTION_NAMES,
  CABINET_TOP,
  CABINET_TOP_NAMES,
} from "../../constants/speakerSpec";
import { ChamberSettings } from "./ChamberSettings";
import { BandSettings } from "./BandSettings";
import { FilterFields } from "./FilterFields";
import { SpeakerOptimizerSettings, optimizerSummary } from "./SpeakerOptimizerSettings";
import { allBox, bandRange, chamberSummary, constructionSummary } from "./settingsSummaries";
import type { SpeakerPageState } from "./useSpeakerPage";

/** The Handles choices: none, or handles. */
const HANDLES_OPTIONS = [
  [false, SETTINGS_TEXT.handlesNone],
  [true, SETTINGS_TEXT.handlesOn],
] as const;

/** The Input dish choices: none, or on the back. */
const DISH_OPTIONS = [
  [false, SETTINGS_TEXT.dishNone],
  [true, SETTINGS_TEXT.dishOn],
] as const;

/** The handle types, as the Handle type picker lists them (the catalog's handles). */
const HANDLE_OPTIONS = HANDLES.map((h) => ({ id: h.id, name: h.name }));

interface Props {
  speakerPage: SpeakerPageState;
  folds: Folds<SpeakerSettingsSection>;
  /** the phone settings sheet: its tabs are the sections */
  sheet: SettingsSheet<SpeakerSettingsSection>;
  /** opens the driver comparison for a chamber's driver entry */
  onCompare: (chamber: number, entry: number) => void;
  /** the driver comparison, while it is open: it takes the whole column (on a phone, the sheet) in place of the settings */
  compareView?: React.ReactNode;
  /** closes the driver comparison: a tap on a sheet tab does */
  onCloseCompare: () => void;
}

/**
 * The Speaker page's settings column: Construction (the shell, its walls, its top and its hardware), Chambers (each
 * chamber's card), Bands and filters (the external crossover and each band), Look and Optimizer. From md up each
 * section folds to a summary of its key facts; on a phone each is a tab of the settings sheet.
 */
export function SpeakerSettings({
  speakerPage,
  folds,
  sheet,
  onCompare,
  compareView,
  onCloseCompare,
}: Props) {
  const { spec, response, optimizer } = speakerPage;
  const { cabinet } = spec;
  const { chambers, construction, top, insetIn, panel, handles, inputDish } = cabinet;
  const framed = construction === CABINET_CONSTRUCTION.frameInset;
  const boxOnly = allBox(chambers);
  const layout = speakerLayout(cabinet);
  /** why an arched top stays flat; null when it applies */
  const arch = archBlock(cabinet, layout);
  const cabFinish = spec.look.cabFinish ?? DEFAULT_PA.cabFinish;
  const baffleColor = spec.look.baffleColor ?? DEFAULT_PA.baffleColor;
  /** the first catalog horn the drivers take: the horn color picker shows its catalog finish */
  const firstHorn = chambers.flatMap((c) => c.drivers.map(driverHorn)).find((h) => h !== null);
  const one = chambers.length === 1;
  const summaries: Record<SpeakerSettingsSection, React.ReactNode> = {
    construction: constructionSummary(cabinet),
    chambers: chambers.map(chamberSummary).join("; "),
    bands: spec.bands.map((b, i) => (
      <span key={b.id} className="whitespace-nowrap">
        {i > 0 && " · "}
        <span className="mr-1.5">
          <BandDot index={i} count={spec.bands.length} />
        </span>
        {b.name} {bandRange(b)}
      </span>
    )),
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
      foldsAt="desktop"
      summary={summaries[id]}
      className={sheet.tabClass(id)}
    >
      {children}
    </SettingsSection>
  );
  // the same column either way, so its scroll pane, the divider's measure and the phone sheet stay
  return (
    <SettingsColumn
      folds={compareView ? undefined : folds}
      foldsAt="desktop"
      className={SETTINGS_SHEET_CLASS}
      bodyClassName={`${settingsSheetBodyClass(sheet.open, !compareView)} ${compareView ? SHEET_BELOW_CHART_CLASS : ""}`}
      top={
        <SettingsSheetTabs
          sections={SPEAKER_SETTINGS_SECTIONS}
          labels={SPEAKER_SETTINGS_TABS}
          sheet={sheet}
          heading={!compareView}
          onTab={onCloseCompare}
        />
      }
    >
      {compareView ?? (
        <>
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
                  speakerPage.editCabinet((c) => ({ ...c, panel: withWallPanel(c.panel, nominal) }))
                }
                options={PANEL_NOMINAL_OPTIONS}
              />
              {/* an arched top only for a speaker of Box chambers (a horn chamber turns it flat: useSpeakerPage) */}
              {boxOnly && (
                <ToggleGroup
                  label={<Tooltip tip={SETTINGS_TEXT.topTip}>{SETTINGS_TEXT.top}</Tooltip>}
                  value={top}
                  onChange={(v) => speakerPage.editCabinet((c) => ({ ...c, top: v }))}
                  options={entriesOf(CABINET_TOP_NAMES)}
                />
              )}
              {boxOnly && top === CABINET_TOP.arched && arch !== null && (
                <Notice>
                  {SPEAKER_TEXT.archFlat} {ARCH_BLOCK_TEXT[arch]}
                </Notice>
              )}
              <ToggleGroup
                label={<Tooltip tip={SETTINGS_TEXT.handlesTip}>{SETTINGS_TEXT.handles}</Tooltip>}
                value={handles !== null}
                onChange={(on) =>
                  speakerPage.editCabinet((c) => ({
                    ...c,
                    // on: the PA sub box's preset handles
                    handles: on ? (c.handles ?? DEFAULT_HARDWARE.sub) : null,
                  }))
                }
                options={HANDLES_OPTIONS}
              />
              {handles && (
                <>
                  <SelectField
                    label={SETTINGS_TEXT.handleType}
                    options={HANDLE_OPTIONS}
                    value={byId(HANDLE_OPTIONS, handles.model)}
                    onChange={(o) => {
                      // the picker lists exactly the catalog's handles
                      const model = HANDLES.find((h) => h.id === o.id)?.id;
                      if (model)
                        speakerPage.editCabinet((c) => ({
                          ...c,
                          handles: c.handles && { ...c.handles, model },
                        }));
                    }}
                  />
                  <HandleOffsetFields
                    handles={handles}
                    onChange={(change) =>
                      speakerPage.editCabinet((c) => ({
                        ...c,
                        handles: c.handles && { ...c.handles, ...change },
                      }))
                    }
                  />
                </>
              )}
              <ToggleGroup
                label={<Tooltip tip={SETTINGS_TEXT.dishTip}>{SETTINGS_TEXT.dish}</Tooltip>}
                value={inputDish}
                onChange={(on) => speakerPage.editCabinet((c) => ({ ...c, inputDish: on }))}
                options={DISH_OPTIONS}
              />
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
                  cabinet={cabinet}
                  placed={layout.chambers[i]}
                  onEdit={(edit) => speakerPage.editChamber(i, edit)}
                  onRemove={one ? undefined : () => speakerPage.removeChamber(i)}
                  onCompare={(entry) => onCompare(i, entry)}
                />
              ))}
              <div>
                <Button
                  variant="primary"
                  onClick={() =>
                    speakerPage.editChambers((list) => {
                      // stacked on the highest chamber, braced as the last one (its walls and back panel)
                      const height = Math.max(0, ...list.map((c) => c.at.yIn + c.dims.h));
                      const bracing = list.at(-1)?.bracing ?? DEFAULT_SPEAKER_CHAMBER.bracing;
                      return [
                        ...list,
                        { ...DEFAULT_SPEAKER_CHAMBER, bracing, at: { xIn: 0, yIn: height } },
                      ];
                    })
                  }
                >
                  {SETTINGS_TEXT.addChamber}
                </Button>
              </div>
            </>,
          )}
          {section(
            "bands",
            <>
              <Card>
                <CardHeading>
                  <Tooltip tip={SETTINGS_TEXT.externalCrossoverTip}>
                    {SETTINGS_TEXT.externalCrossover}
                  </Tooltip>
                </CardHeading>
                <FilterFields
                  filters={spec.input}
                  // a new corner at the PA's crossover to its subs
                  newCornerHz={DEFAULT_PA.xoLo}
                  onEdit={speakerPage.editInput}
                />
              </Card>
              {spec.bands.map((band, i) => (
                <BandSettings
                  key={band.id}
                  band={band}
                  index={i}
                  count={spec.bands.length}
                  newCornerHz={DEFAULT_HIFI.crossoverHz}
                  onEdit={(edit) => speakerPage.editBand(i, edit)}
                  onRemove={
                    spec.bands.length > 1 ? () => speakerPage.removeBand(band.id) : undefined
                  }
                />
              ))}
              <div className="flex flex-wrap gap-1">
                <Button variant="primary" onClick={speakerPage.addBand}>
                  Add band
                </Button>
              </div>
              <CalculateGainsButton
                balance={speakerPage.balance}
                onApply={speakerPage.applyBalance}
                tip={AUTO_BALANCE_TEXT.speakerTip}
                oneBand={AUTO_BALANCE_TEXT.oneBand}
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
        </>
      )}
    </SettingsColumn>
  );
}
