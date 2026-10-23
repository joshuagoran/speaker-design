import { useUnits } from "../../hooks/useUnits";
import { useMemo, useState } from "react";
import type { DispersionPlane, FrequencyPoint, SpeakerSpec, StackMember } from "../../types";
import { bandLine } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import {
  SETTINGS_SHEET_CLASS,
  SettingsSheetTabs,
  settingsSheetBodyClass,
  useSettingsSheet,
} from "../../components/ui/SettingsSheetTabs";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { MarkedText } from "../../components/ui/MarkedText";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TextField } from "../../components/ui/TextField";
import { SelectField } from "../../components/ui/SelectField";
import { Notice } from "../../components/ui/Notice";
import { SharedNotice, type SharedNoticeProps } from "../../components/ui/SharedNotice";
import { CalculateGainsButton } from "../../components/ui/CalculateGainsButton";
import { AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { sumSeries } from "../../components/charts/sumSeries";
import { AssumptionsList } from "../../components/ui/AssumptionsList";
import { UI_TEXT } from "../../constants/uiText";
import { CHECK_ROW_TEXT } from "../../constants/speakerResults";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { DispersionBlock } from "../../components/charts/DispersionBlock";
import { dispersionModeled, stackDispersionMap } from "../../lib/speaker/stackDispersion";
import { DISPERSION_HEADING, DISPERSION_START_PLANE } from "../../constants/dispersionPlanes";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { STATS } from "../../components/stats/StatLabel";
import { priceText } from "../../lib/speaker/speakerTotals";
import { PURCHASED_PARTIAL_NOTE } from "../../constants/purchasedParts";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { SaveRow } from "../../components/saved-configs/SaveRow";
import { StackFront } from "../../components/drawings/StackFront";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { ExpandableChart } from "../../components/ui/ExpandPanel";
import { MembersView3D } from "../../components/stack-view/MembersView3D";
import { keysOf } from "../../lib/records";
import { formatHz, formatDelayMs, formatDb } from "../../lib/format";
import { DEFAULT_PA } from "../../lib/defaults";
import {
  RESULTS_TWO_COLUMN_PX,
  RESULT_MAX_WIDTH,
  GAP_Y,
  resultsCellClass,
  resultsGridClass,
} from "../../styles/layout";
import {
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
  HIFI_BOT,
  HIFI_TOP,
  MAX_OUTPUT_BOT,
  MAX_OUTPUT_TOP,
  DISPERSION_DISTANCE_M,
} from "../../constants/chartScales";
import {
  STACK_SETTINGS_SECTIONS,
  type StackSettingsSection,
} from "../../constants/settingsSections";
import { STACK_SAVE_WORDS, STACK_TEXT } from "../../constants/stack";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import { FilterFields } from "../speaker/FilterFields";
import { inputText } from "../speaker/speakerText";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import { readSavedSpeaker } from "../../lib/speaker/speakerSaves";
import { MemberSettings } from "./MemberSettings";
import { stackCheckRows } from "./stackChips";
import { stackSummary } from "./stackSummary";
import { SummaryStrip } from "../../components/ui/SummaryStrip";
import { WarningChips } from "../../components/chips/WarningChips";
import { designStartOptions, stackFromStart } from "./stackPresets";
import type { StackPlanner } from "./useStack";

interface Props {
  stack: StackPlanner;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store">;
  /** the shared view's notice, while a link's stack shows in place of the page's own */
  sharedNotice: SharedNoticeProps | null;
  /** opens the speaker a member names, by its id, on the Speaker page for an edit */
  onEditSpeaker: (speakerId: StackMember["speakerId"]) => void;
}

/** The starts "New from…" lists: the empty stack, then the presets. */
const START_OPTIONS = designStartOptions(STACK_TEXT.empty);

/** The front drawing's height. */
const VIEW_HEIGHT = "h-[300px] md:h-[clamp(320px,50vh,520px)]";

/**
 * The Stack page: speakers in a fixed relationship. Members from the speaker
 * library or a preset, where each stands, its crossover, level and delay; the stack's response and maximum
 * output at its listening point on fixed axes, with each member's curve, and the stacks' library.
 */
export function StackPage({ stack, speakerPage, sharedNotice, onEditSpeaker }: Props) {
  const units = useUnits();
  const pal = usePalette();
  const { design, response, limits, totals, store, snapshot, holds, restore } = stack;
  const { members, name, notes } = design.stack;
  // a viewer's stored folds from when the page had an Optimizer fold still name it: the page ignores that entry
  const folds = useFolds("stack.settingsFolds", keysOf(STACK_SETTINGS_SECTIONS));
  const sheet = useSettingsSheet<StackSettingsSection>("stack", "stack");
  /** the library's speakers, as the picker lists them */
  const library = (speakerPage.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    const spec = readSavedSpeaker(saved);
    return spec ? [{ id: c.id, name: c.name, spec }] : [];
  });
  const [pick, setPick] = useState<string>("");
  const picked = library.find((o) => o.id === pick) ?? library[0];
  /** each member's name: its speaker's, numbered */
  const names = useMemo(
    () =>
      members.map(
        (m, k) =>
          `${k + 1}. ${design.speakers.find((s) => s.id === m.speakerId)?.name ?? m.speakerId}`,
      ),
    [members, design.speakers],
  );
  const lineOf = (k: number) => bandLine(pal, k, members.length);
  const summaries: Record<StackSettingsSection, string> = {
    stack: `${name} · ${members.length} box${members.length === 1 ? "" : "es"}`,
    members: names.join(" · ") || STACK_TEXT.noMembers,
    crossovers:
      members
        .map((m, k) => `${k + 1}. ${inputText(m.crossover) ?? STACK_TEXT.fullRange}`)
        .join(" · ") || STACK_TEXT.noMembers,
  };
  const section = (id: StackSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={STACK_SETTINGS_SECTIONS[id]}
      folds={folds}
      foldsAt="desktop"
      summary={summaries[id]}
      className={sheet.tabClass(id)}
    >
      {children}
    </SettingsSection>
  );
  const modeled = response.members.flatMap((m, k) => (m ? [{ m, k }] : []));
  /** the crossover corners, marked on the charts */
  const marks = [
    ...new Set(
      members.flatMap((m) =>
        [m.crossover.highpass?.hz, m.crossover.lowpass?.hz].filter((f) => f !== undefined),
      ),
    ),
  ].map((f) => ({ f, label: formatHz(f) }));
  const tiles: StatTileItem[] = [
    [
      STACK_TEXT.listenHeight,
      units.amount("boxLength", response.listenHeightIn, 0),
      units.unit("boxLength"),
    ],
    ...modeled.map(({ m, k }): StatTileItem => [
      `${names[k]} delay`,
      formatDelayMs(m.delayMs),
      "ms",
    ]),
    ...(limits.musicDb !== null
      ? [[STACK_TEXT.stackMax, formatDb(limits.musicDb), "dB"] satisfies StatTileItem]
      : []),
  ];
  const totalTiles: StatTileItem[] = [
    [STATS.partsPrice, priceText(totals), ""],
    [SPEAKER_TEXT.weight, units.amount("mass", totals.lb, 0), units.unit("mass")],
    [STATS.stackHeight, units.amount("boxLength", totals.heightIn, 0), units.unit("boxLength")],
  ];
  const gaps = modeled.some(({ m }) => m.response.gaps.length > 0);
  const [plane, setPlane] = useState<DispersionPlane>(DISPERSION_START_PLANE);
  const dispersion = useMemo(
    () =>
      modeled.length && dispersionModeled(design.speakers)
        ? stackDispersionMap(design.stack, design.speakers, response, plane)
        : null,
    [design, response, plane, modeled.length],
  );
  /** the phone strip's headline figures */
  const summary = stackSummary(response, limits, totals.lb, units);
  /** the checks, one compact row per crossing between members, then per band and chamber of each member */
  const checkRows = useMemo(
    () => stackCheckRows(design.stack, response, limits, names),
    [design.stack, response, limits, names],
  );
  /** each member's curve on a chart: its line, and its dot in the legend */
  const memberSeries = (curves: readonly { k: number; curve: FrequencyPoint[] }[]) =>
    curves.map(({ k, curve }) => ({
      curve,
      clipAtFloor: true,
      id: `m${k}`,
      label: names[k],
      ...lineOf(k),
      swatch: "dot" as const,
      tint: "transparent",
    }));
  const [resultsGrid, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  const cell = (place: string) => resultsCellClass(wide, place);
  /** the notes on the totals and the charts, in the results' order */
  const details = [
    ...(members.length > 0 ? [[STACK_TEXT.views, [STACK_TEXT.totalsNote]] as const] : []),
    [STACK_TEXT.response, [STACK_TEXT.modelNote]] as const,
    ...(limits.sum.length > 0 ? [[STACK_TEXT.maxOutput, [STACK_TEXT.maxNote]] as const] : []),
  ];
  return (
    <SettingsLayout
      sheet={sheet}
      results={
        <div className="flex flex-col gap-5">
          {sharedNotice ? (
            <SharedNotice {...sharedNotice} />
          ) : (
            <SaveRow
              store={store}
              snapshot={snapshot}
              holds={holds}
              restore={restore}
              name={name}
              onName={stack.setName}
              openId={design.stack.id}
              onOpenId={stack.setOpenId}
              words={STACK_SAVE_WORDS}
              starts={START_OPTIONS}
              group={(o) => o.group}
              onStart={(o) => stack.setDesign(stackFromStart(o.id))}
            />
          )}
          {summary && <SummaryStrip items={summary} />}
          <section className={`${RESULT_MAX_WIDTH} min-w-0 ${GAP_Y}`}>
            <SectionHeading>{STACK_TEXT.views}</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
              <Viewer3DCard boxClassName={`relative ${VIEW_HEIGHT}`}>
                {(cutaway) => (
                  <MembersView3D
                    stack={design.stack}
                    speakers={design.speakers}
                    cutaway={cutaway}
                  />
                )}
              </Viewer3DCard>
              <Card gapY={false} className={`flex flex-col ${VIEW_HEIGHT}`}>
                <div className="flex-1 min-h-0">
                  <StackFront
                    stack={design.stack}
                    speakers={design.speakers}
                    listenHeightIn={response.listenHeightIn}
                  />
                </div>
                <p className="text-xs text-stone-500 mt-2">
                  <MarkedText text={STACK_TEXT.front} />
                </p>
              </Card>
            </div>
            {members.length > 0 && (
              <>
                <StatTileGrid tiles={totalTiles} />
                {totals.partial && <Notice>{PURCHASED_PARTIAL_NOTE}</Notice>}
              </>
            )}
            {members.length === 0 && <Notice>{STACK_TEXT.noMembers}</Notice>}
            {response.members.some((m) => m === null) && <Notice>{STACK_TEXT.missing}</Notice>}
          </section>
          {/* Response beside Maximum output once the pane is wide enough, the tiles under each */}
          <div ref={resultsGrid} className={`${RESULT_MAX_WIDTH} ${resultsGridClass(wide)}`}>
            <section className={`${cell("col-start-1 row-start-1")} ${GAP_Y}`}>
              <SectionHeading>{STACK_TEXT.response}</SectionHeading>
              <ExpandableChart title={STACK_TEXT.response}>
                <ResponseChart
                  fmin={FREQ_AXIS_MIN_HZ}
                  fmax={FREQ_AXIS_MAX_HZ}
                  top={HIFI_TOP}
                  bot={HIFI_BOT}
                  step={10}
                  yLabel={STACK_TEXT.yLabel}
                  series={[
                    ...(modeled.length ? [sumSeries(response.sum, STACK_TEXT.sum, pal)] : []),
                    ...memberSeries(modeled.map(({ m, k }) => ({ k, curve: m.curve }))),
                  ]}
                  marks={marks}
                />
              </ExpandableChart>
              {gaps && <Notice>{STACK_TEXT.gaps}</Notice>}
              <StatTileGrid tiles={tiles} />
            </section>
            {limits.sum.length > 0 && (
              <section className={`${cell("col-start-2 row-start-1")} ${GAP_Y}`}>
                <SectionHeading>{STACK_TEXT.maxOutput}</SectionHeading>
                <ExpandableChart title={STACK_TEXT.maxOutput}>
                  <ResponseChart
                    fmin={FREQ_AXIS_MIN_HZ}
                    fmax={FREQ_AXIS_MAX_HZ}
                    top={MAX_OUTPUT_TOP}
                    bot={MAX_OUTPUT_BOT}
                    step={10}
                    yLabel={STACK_TEXT.maxYLabel}
                    series={[
                      sumSeries(limits.sum, STACK_TEXT.sum, pal),
                      ...memberSeries(
                        limits.members.flatMap((m, k) => (m ? [{ k, curve: m.atLimit }] : [])),
                      ),
                    ]}
                    marks={marks}
                  />
                </ExpandableChart>
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
                  tips={{ stackKeepsUp: KEEP_UP_TEXT.tip, speakerKeepsUp: KEEP_UP_TEXT.tip }}
                />
              ))}
            </section>
          )}
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
        <SettingsColumn
          folds={folds}
          foldsAt="desktop"
          className={SETTINGS_SHEET_CLASS}
          bodyClassName={settingsSheetBodyClass(sheet.open)}
          top={<SettingsSheetTabs sections={STACK_SETTINGS_SECTIONS} sheet={sheet} />}
        >
          {section(
            "stack",
            <TextField
              label={STACK_TEXT.notes}
              value={notes}
              maxLength={200}
              onChange={stack.setNotes}
            />,
          )}
          {section(
            "members",
            <>
              {members.map((member, k) => (
                <MemberSettings
                  key={k}
                  index={k}
                  member={member}
                  names={names}
                  delayMs={response.members[k]?.delayMs ?? null}
                  onEdit={(edit) => stack.editMember(k, edit)}
                  onRemove={() => stack.removeMember(k)}
                  onEditSpeaker={
                    design.speakers.some((s) => s.id === member.speakerId)
                      ? () => onEditSpeaker(member.speakerId)
                      : undefined
                  }
                />
              ))}
              {picked ? (
                <>
                  <SelectField
                    label={STACK_TEXT.librarySpeaker}
                    options={library}
                    value={picked}
                    onChange={(o) => setPick(o.id)}
                  />
                  <Button
                    variant="primary"
                    onClick={() => {
                      const speaker: SpeakerSpec = {
                        ...picked.spec,
                        id: picked.id,
                        name: picked.name,
                      };
                      stack.addSpeaker(speaker);
                    }}
                  >
                    {STACK_TEXT.addMember}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-stone-500">{STACK_TEXT.noLibrary}</p>
              )}
              {members.length > 0 && (
                <CalculateGainsButton
                  balance={stack.balance}
                  onApply={stack.applyBalance}
                  tip={AUTO_BALANCE_TEXT.stackTip}
                />
              )}
            </>,
          )}
          {section(
            "crossovers",
            <>
              <p className="text-xs text-stone-500">
                <MarkedText text={STACK_TEXT.crossoverHint} />
              </p>
              {members.map((member, k) => (
                <Card key={k}>
                  <h4 className="font-semibold min-w-0 truncate">{names[k]}</h4>
                  <FilterFields
                    filters={member.crossover}
                    // a new corner at the PA's crossover to its subs
                    newCornerHz={DEFAULT_PA.xoLo}
                    offName={STACK_TEXT.noFilter}
                    onEdit={(edit) =>
                      stack.editMember(k, (m) => ({ ...m, crossover: edit(m.crossover) }))
                    }
                  />
                </Card>
              ))}
              {members.length === 0 && (
                <p className="text-xs text-stone-500">{STACK_TEXT.noMembers}</p>
              )}
            </>,
          )}
        </SettingsColumn>
      }
    />
  );
}
