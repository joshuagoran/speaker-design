import { useMemo, useState } from "react";
import type { DispersionPlane, SpeakerSpec } from "../../types";
import { alpha, bandLine } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TextField } from "../../components/ui/TextField";
import { SelectField } from "../../components/ui/SelectField";
import { StartPicker } from "../../components/ui/StartPicker";
import { Notice } from "../../components/ui/Notice";
import { AutoBalanceButton } from "../../components/ui/AutoBalanceButton";
import { AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { DispersionBlock } from "../../components/charts/DispersionBlock";
import { dispersionModeled, stackDispersionMap } from "../../lib/speaker/stackDispersion";
import {
  DISPERSION_HEADING,
  DISPERSION_HORN_NOTE,
  DISPERSION_START_PLANE,
} from "../../constants/dispersionPlanes";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { STATS } from "../../components/stats/StatLabel";
import { priceText } from "../../lib/speaker/speakerTotals";
import { PURCHASED_PARTIAL_NOTE } from "../../constants/purchasedParts";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { StackFront } from "../../components/drawings/StackFront";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { MembersView3D } from "../../components/stack-view/MembersView3D";
import { byId } from "../../lib/tables";
import { keysOf } from "../../lib/records";
import { formatHz } from "../../lib/format";
import { DEFAULT_PA } from "../../lib/defaults";
import { READING_WIDTH, RESULT_MAX_WIDTH, GAP_Y } from "../../styles/layout";
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
import { STACK_TEXT } from "../../constants/stack";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import { FilterFields } from "../speaker/FilterFields";
import { inputText } from "../speaker/speakerText";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import { readSavedSpeaker } from "../../lib/speaker/speakerSaves";
import { MemberSettings } from "./MemberSettings";
import { stackDispersionChips, stackKeepUpChips } from "./stackChips";
import { stackSummary } from "./stackSummary";
import { StackOptimizerResults } from "./StackOptimizerResults";
import { StackOptimizerSettings, stackOptimizerSummary } from "./StackOptimizerSettings";
import { SummaryStrip } from "../../components/ui/SummaryStrip";
import { WarningChips } from "../../components/chips/WarningChips";
import { DRAFT_STACK_ID, emptyStack } from "./stackSaves";
import { STACK_PRESETS, presetLayers } from "./stackPresets";
import {
  STACK_PRESET,
  STACK_START_DESIGN_NAMES,
  STACK_START_GROUPS,
  STACK_START_NAMES,
  type StackPreset,
} from "../../constants/stackPresets";
import type { StackPlanner } from "./useStack";

interface Props {
  stack: StackPlanner;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store">;
}

/** The sum's key on the charts: no member's key ("m0", "m1"…) takes it. */
const SUM_SERIES_ID = "sum";

/** The sum's line width on the charts, px: it reads over its members' (2 px). */
const SUM_LINE_PX = 4;

/** The front drawing's height. */
const VIEW_HEIGHT = "h-[300px] md:h-[clamp(320px,50vh,520px)]";

/**
 * The Stack page: speakers in a fixed relationship (docs/speaker-designer-plan.md, L4a). Members from the speaker
 * library or a preset, where each stands, its crossover, level and delay; the stack's response and maximum
 * output at its listening point on fixed axes, with each member's curve, and the stacks' library.
 */
export function StackPage({ stack, speakerPage }: Props) {
  const pal = usePalette();
  const { design, response, limits, totals, optimizer, store, snapshot, restore } = stack;
  const { members, name, notes } = design.stack;
  const folds = useFolds("stack.settingsFolds", keysOf(STACK_SETTINGS_SECTIONS));
  /** the library's speakers, as the picker lists them */
  const library = (speakerPage.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    const spec = readSavedSpeaker(saved);
    return spec ? [{ id: c.id, name: c.name, spec }] : [];
  });
  const [pick, setPick] = useState<string>("");
  const picked = library.find((o) => o.id === pick) ?? library[0];
  /** each member's name: its speaker's, numbered */
  const names = members.map(
    (m, k) => `${k + 1}. ${design.speakers.find((s) => s.id === m.speakerId)?.name ?? m.speakerId}`,
  );
  const lineOf = (k: number) => bandLine(pal, k, members.length);
  const startOptions = STACK_PRESETS.map((id) => ({
    id,
    name: STACK_START_NAMES[id],
    group: STACK_START_GROUPS.presets,
  }));
  const [start, setStart] = useState<StackPreset>(STACK_PRESET.paStack);
  /** replaces the stack with the preset's */
  const startFrom = () => {
    const { stack: started, speakers } = presetLayers(start, {
      id: DRAFT_STACK_ID,
      name: STACK_START_DESIGN_NAMES[start],
    });
    stack.setDesign({ stack: started, speakers });
  };
  const summaries: Record<StackSettingsSection, string> = {
    stack: `${name} · ${members.length} box${members.length === 1 ? "" : "es"}`,
    members: names.join(" · ") || STACK_TEXT.noMembers,
    crossovers:
      members
        .map((m, k) => `${k + 1}. ${inputText(m.crossover) ?? STACK_TEXT.fullRange}`)
        .join(" · ") || STACK_TEXT.noMembers,
    optimizer: stackOptimizerSummary(optimizer),
  };
  const section = (id: StackSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={STACK_SETTINGS_SECTIONS[id]}
      folds={folds}
      summary={summaries[id]}
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
    [STACK_TEXT.listenHeight, response.listenHeightIn.toFixed(0), "in"],
    ...modeled.map(({ m, k }): StatTileItem => [`${names[k]} delay`, m.delayMs.toFixed(2), "ms"]),
    ...(limits.musicDb !== null
      ? [[STACK_TEXT.stackMax, limits.musicDb.toFixed(0), "dB"] satisfies StatTileItem]
      : []),
  ];
  const totalTiles: StatTileItem[] = [
    [STATS.partsPrice, priceText(totals), ""],
    [SPEAKER_TEXT.weight, totals.lb.toFixed(0), "lb"],
    [STATS.stackHeight, totals.heightIn.toFixed(0), "in"],
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
  const summary = stackSummary(response, limits, totals.lb);
  /** keep-up at each crossover between members, then each box's dispersion check at its own crossovers */
  const keepUps = [
    ...stackKeepUpChips(design.stack, response, limits, names),
    ...stackDispersionChips(design.stack, design.speakers, names),
  ];
  return (
    <SettingsLayout
      results={
        <>
          <SavedConfigs
            bare
            store={store}
            snapshot={snapshot}
            restore={restore}
            saveName={name}
            manage
          />
          {summary && <SummaryStrip items={summary} />}
          <StackOptimizerResults optimizer={optimizer} />
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
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
                <p className="text-xs text-stone-500 mt-2">{STACK_TEXT.front}</p>
              </Card>
            </div>
            {members.length > 0 && (
              <>
                <StatTileGrid tiles={totalTiles} />
                {totals.partial && <Notice>{PURCHASED_PARTIAL_NOTE}</Notice>}
                <p className={`${READING_WIDTH} text-sm text-stone-500`}>{STACK_TEXT.totalsNote}</p>
              </>
            )}
            {members.length === 0 && <Notice>{STACK_TEXT.noMembers}</Notice>}
            {response.members.some((m) => m === null) && <Notice>{STACK_TEXT.missing}</Notice>}
          </section>
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
            <SectionHeading>{STACK_TEXT.response}</SectionHeading>
            <ResponseChart
              fmin={FREQ_AXIS_MIN_HZ}
              fmax={FREQ_AXIS_MAX_HZ}
              top={HIFI_TOP}
              bot={HIFI_BOT}
              step={10}
              yLabel={STACK_TEXT.yLabel}
              series={[
                ...(modeled.length
                  ? [
                      {
                        curve: response.sum,
                        id: SUM_SERIES_ID,
                        label: STACK_TEXT.sum,
                        stroke: pal.ink,
                        width: SUM_LINE_PX,
                        tint: alpha(pal.ink, 0.05),
                      },
                    ]
                  : []),
                ...modeled.map(({ m, k }) => ({
                  // a member drawn only where it is on the chart: below the floor it would run along the axis
                  curve: m.curve.filter((o) => o.spl >= HIFI_BOT),
                  id: `m${k}`,
                  label: names[k],
                  ...lineOf(k),
                  tint: "transparent",
                })),
              ]}
              marks={marks}
            />
            {gaps && <Notice>{STACK_TEXT.gaps}</Notice>}
            <StatTileGrid tiles={tiles} />
            <p className={`${READING_WIDTH} text-sm text-stone-500`}>{STACK_TEXT.modelNote}</p>
          </section>
          {limits.sum.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-6 ${GAP_Y}`}>
              <SectionHeading>{STACK_TEXT.maxOutput}</SectionHeading>
              <ResponseChart
                fmin={FREQ_AXIS_MIN_HZ}
                fmax={FREQ_AXIS_MAX_HZ}
                top={MAX_OUTPUT_TOP}
                bot={MAX_OUTPUT_BOT}
                step={10}
                yLabel={STACK_TEXT.maxYLabel}
                series={[
                  {
                    curve: limits.sum,
                    id: SUM_SERIES_ID,
                    label: STACK_TEXT.sum,
                    stroke: pal.ink,
                    width: SUM_LINE_PX,
                    tint: alpha(pal.ink, 0.05),
                  },
                  ...limits.members.flatMap((m, k) =>
                    m
                      ? [
                          {
                            curve: m.atLimit.filter((o) => o.spl >= MAX_OUTPUT_BOT),
                            id: `m${k}`,
                            label: names[k],
                            ...lineOf(k),
                            tint: "transparent",
                          },
                        ]
                      : [],
                  ),
                ]}
                marks={marks}
              />
              {keepUps.length > 0 && (
                <div className={`${READING_WIDTH} flex flex-col gap-3`}>
                  {keepUps.map(({ heading, chips }) => (
                    <div key={heading}>
                      <h4 className="text-xs font-semibold text-stone-500 mb-1">{heading}</h4>
                      <WarningChips chips={chips} tips={{ stackKeepsUp: KEEP_UP_TEXT.tip }} />
                    </div>
                  ))}
                </div>
              )}
              <p className={`${READING_WIDTH} text-sm text-stone-500`}>{STACK_TEXT.maxNote}</p>
            </section>
          )}
          {modeled.length > 0 && !dispersionModeled(design.speakers) && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-6 ${GAP_Y}`}>
              <SectionHeading>{DISPERSION_HEADING}</SectionHeading>
              <Notice>{DISPERSION_HORN_NOTE}</Notice>
            </section>
          )}
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
      settings={
        <SettingsColumn folds={folds}>
          {section(
            "stack",
            <>
              <TextField label="Name" value={name} maxLength={60} onChange={stack.setName} />
              <TextField
                label={STACK_TEXT.notes}
                value={notes}
                maxLength={200}
                onChange={stack.setNotes}
              />
              <StartPicker
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(o.id)}
                group={(o) => o.group}
                onStart={startFrom}
                secondary={{
                  label: STACK_TEXT.clear,
                  onClick: () => stack.setDesign(emptyStack()),
                }}
                hint={STACK_TEXT.startHint}
              />
            </>,
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
                <AutoBalanceButton
                  balance={stack.balance}
                  onApply={stack.applyBalance}
                  mode={stack.balanceMode}
                  onMode={stack.setBalanceMode}
                  tipExtra={AUTO_BALANCE_TEXT.stackTip}
                  notes={stack.shared.map((ks) => AUTO_BALANCE_TEXT.sharedCrossover(ks))}
                />
              )}
            </>,
          )}
          {section(
            "crossovers",
            <>
              <p className="text-xs text-stone-500">{STACK_TEXT.crossoverHint}</p>
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
          {section("optimizer", <StackOptimizerSettings optimizer={optimizer} names={names} />)}
        </SettingsColumn>
      }
    />
  );
}
