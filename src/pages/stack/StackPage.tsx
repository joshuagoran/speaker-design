import { useState } from "react";
import type { SpeakerSpec } from "../../types";
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
import { Notice } from "../../components/ui/Notice";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { StackFront } from "../../components/drawings/StackFront";
import { byId } from "../../lib/tables";
import { keysOf } from "../../lib/records";
import { formatHz } from "../../lib/format";
import { DEFAULT_PA } from "../../lib/defaults";
import { RESULT_MAX_WIDTH, READING_WIDTH } from "../../styles/layout";
import {
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
  HIFI_BOT,
  HIFI_TOP,
  MAX_OUTPUT_BOT,
  MAX_OUTPUT_TOP,
} from "../../constants/chartScales";
import {
  STACK_SETTINGS_SECTIONS,
  type StackSettingsSection,
} from "../../constants/settingsSections";
import { STACK_TEXT } from "../../constants/stack";
import { DEFAULT_COVERAGE_LAYOUT } from "../../lib/pa/coverageLayout";
import { FilterFields } from "../speaker/FilterFields";
import { inputText } from "../speaker/speakerText";
import { isSavedSpeaker, type SpeakerPageState } from "../speaker/useSpeakerPage";
import { paPlannerDesign } from "../speaker/SpeakerPage";
import { MemberSettings } from "./MemberSettings";
import { DRAFT_STACK_ID, emptyStack } from "./stackSaves";
import { STACK_STARTS, startGroup, startLayers } from "./stackPresets";
import {
  STACK_START,
  STACK_START_NAMES,
  STACK_START_TEXT,
  type StackStart,
} from "../../constants/stackPresets";
import type { StackPlanner } from "./useStack";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";

interface Props {
  stack: StackPlanner;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store">;
  planner: PaPlanner;
}

/** The sum's key on the charts: no member's key ("m0", "m1"…) takes it. */
const SUM_SERIES_ID = "sum";

/** The sum's line width on the charts, px: it reads over its members' (2 px). */
const SUM_LINE_PX = 4;

/** The front drawing's height. */
const VIEW_HEIGHT = "h-[300px] md:h-[clamp(320px,50vh,520px)]";

/**
 * The Stack page: speakers in a fixed relationship (docs/speaker-designer-plan.md, L4a). Members from the speaker
 * library or the current PA design, where each stands, its crossover, level and delay; the stack's response and maximum
 * output at its listening point on fixed axes, with each member's curve, and the stacks' library.
 */
export function StackPage({ stack, speakerPage, planner }: Props) {
  const pal = usePalette();
  const { design, response, limits, store, snapshot, restore } = stack;
  const { members, name, notes } = design.stack;
  const folds = useFolds("stack.settingsFolds", keysOf(STACK_SETTINGS_SECTIONS));
  /** the library's speakers, as the picker lists them */
  const library = (speakerPage.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    return isSavedSpeaker(saved) ? [{ id: c.id, name: c.name, spec: saved }] : [];
  });
  const [pick, setPick] = useState<string>("");
  const picked = library.find((o) => o.id === pick) ?? library[0];
  /** each member's name: its speaker's, numbered */
  const names = members.map(
    (m, k) => `${k + 1}. ${design.speakers.find((s) => s.id === m.speakerId)?.name ?? m.speakerId}`,
  );
  const lineOf = (k: number) => bandLine(pal, k, members.length);
  const startOptions = STACK_STARTS.map((id) => ({
    id,
    name: STACK_START_NAMES[id],
    group: startGroup(id),
  }));
  const [start, setStart] = useState<StackStart>(STACK_START.paStack);
  /** replaces the stack with the start's: a preset, or the current PA design on the PA floor's starting layout */
  const startFrom = () => {
    const { stack: started, speakers } = startLayers(
      start,
      { id: DRAFT_STACK_ID, name: STACK_START_NAMES[start] },
      { pa: paPlannerDesign(planner), floor: DEFAULT_COVERAGE_LAYOUT },
    );
    stack.setDesign({ stack: started, speakers });
  };
  const summaries: Record<StackSettingsSection, string> = {
    stack: `${name} · ${members.length} member${members.length === 1 ? "" : "s"}`,
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
  const gaps = modeled.some(({ m }) => m.response.gaps.length > 0);
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
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">{STACK_TEXT.views}</SectionHeading>
            <Card className={`flex flex-col ${VIEW_HEIGHT}`}>
              <div className="flex-1 min-h-0">
                <StackFront
                  stack={design.stack}
                  speakers={design.speakers}
                  listenHeightIn={response.listenHeightIn}
                />
              </div>
              <p className="text-xs text-stone-500 mt-2">{STACK_TEXT.front}</p>
            </Card>
            {members.length === 0 && <Notice>{STACK_TEXT.noMembers}</Notice>}
            {response.members.some((m) => m === null) && <Notice>{STACK_TEXT.missing}</Notice>}
          </section>
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">{STACK_TEXT.response}</SectionHeading>
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
            <StatTileGrid tiles={tiles} className="mt-5 mb-3" />
            <p className={`${READING_WIDTH} text-sm text-stone-500`}>{STACK_TEXT.modelNote}</p>
          </section>
          {limits.sum.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-6`}>
              <SectionHeading className="mb-3">{STACK_TEXT.maxOutput}</SectionHeading>
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
              <p className={`${READING_WIDTH} text-sm text-stone-500 mt-3`}>{STACK_TEXT.maxNote}</p>
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
              <SelectField
                label={STACK_START_TEXT.startFrom}
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(o.id)}
                group={(o) => o.group}
              />
              <div className="flex flex-wrap gap-2 mb-2">
                <Button onClick={startFrom}>{STACK_START_TEXT.startOver}</Button>
                <Button onClick={() => stack.setDesign(emptyStack())}>{STACK_TEXT.clear}</Button>
              </div>
              <p className="text-xs text-stone-500 mb-2">{STACK_TEXT.startHint}</p>
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
                    className="mb-2"
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
                <p className="text-xs text-stone-500 mb-2">{STACK_TEXT.noLibrary}</p>
              )}
            </>,
          )}
          {section(
            "crossovers",
            <>
              <p className="text-xs text-stone-500 mb-2">{STACK_TEXT.crossoverHint}</p>
              {members.map((member, k) => (
                <Card key={k} className="mb-3">
                  <h4 className="font-semibold mb-1 min-w-0 truncate">{names[k]}</h4>
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
                <p className="text-xs text-stone-500 mb-2">{STACK_TEXT.noMembers}</p>
              )}
            </>,
          )}
        </SettingsColumn>
      }
    />
  );
}
