import { useMemo, useState } from "react";
import type { StackMember } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { useUnits } from "../../hooks/useUnits";
import { AppShell } from "../../components/shell/AppShell";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { StackFront } from "../../components/drawings/StackFront";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { MembersView3D } from "../../components/stack-view/MembersView3D";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { sumSeries } from "../../components/charts/sumSeries";
import { DispersionBlock } from "../../components/charts/DispersionBlock";
import { WarningChips } from "../../components/chips/WarningChips";
import { ExpandableChart } from "../../components/ui/ExpandPanel";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Notice } from "../../components/ui/Notice";
import { TextField } from "../../components/ui/TextField";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { CalculateGainsButton } from "../../components/ui/CalculateGainsButton";
import { MarkedText } from "../../components/ui/MarkedText";
import { f3Of } from "../../lib/speaker/optimize/evaluate";
import { beamWidthDeg, stackDispersionMap } from "../../lib/speaker/stackDispersion";
import { priceText } from "../../lib/speaker/speakerTotals";
import { formatDb } from "../../lib/format";
import { DEFAULT_PA } from "../../lib/defaults";
import {
  DISPERSION_DISTANCE_M,
  FREQ_AXIS_MAX_HZ,
  FREQ_AXIS_MIN_HZ,
  HIFI_BOT,
  HIFI_TOP,
  MAX_OUTPUT_BOT,
  MAX_OUTPUT_TOP,
} from "../../constants/chartScales";
import { DISPERSION_HEADING } from "../../constants/dispersionPlanes";
import { AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import { CHECK_ROW_TEXT } from "../../constants/speakerResults";
import { KEEP_UP_TEXT } from "../../constants/keepUp";
import { STACK_SETTINGS_SECTIONS } from "../../constants/settingsSections";
import { STACK_TEXT } from "../../constants/stack";
import {
  PREDICTION_LOW_DB,
  PREDICTION_TILES,
  PREDICTION_WIDE_DB,
  PREDICTION_WIDE_HZ,
  SHELL_TEXT,
} from "../../constants/shell";
import { FilterFields } from "../speaker/FilterFields";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import { MemberSettings } from "./MemberSettings";
import { designStartOptions, stackFromStart } from "./stackPresets";
import { librarySpec, speakerLibrary } from "./speakerLibrary";
import { useStackView } from "./useStackView";
import type { StackPlanner } from "./useStack";

interface Props {
  stack: StackPlanner;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store">;
  /** opens the speaker a member names, by its id, on the Speaker page for an edit */
  onEditSpeaker: (speakerId: StackMember["speakerId"]) => void;
}

/** The example Stacks the library lists: the presets (not the empty start). */
const EXAMPLES = designStartOptions(STACK_TEXT.empty).slice(1);

/** The canvas's two views. */
type CanvasView = "front" | "3d";

/**
 * A test of the new layout on the Stack level, on the same Stack as the Stack page: the four answers on top, the library
 * on the left, the drawing in the middle (click a box to select it, double-click to open its Speaker), the selected box
 * in the inspector, and the charts and checks in the results panel.
 */
export function StackShellPage({ stack, speakerPage, onEditSpeaker }: Props) {
  const pal = usePalette();
  const units = useUnits();
  const { design, response, limits, totals } = stack;
  const { members, notes } = design.stack;
  const { names, modeled, marks, memberSeries, plane, setPlane, dispersion, checkRows } =
    useStackView(stack);
  const library = speakerLibrary(speakerPage.store.saved);
  const [view, setView] = useState<CanvasView>("front");
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked !== null && picked < members.length ? picked : null;
  // the "How wide" tile reads the horizontal map, whichever plane the results show
  const across = useMemo(
    () =>
      dispersion && plane !== "h"
        ? stackDispersionMap(design.stack, design.speakers, response, "h")
        : dispersion,
    [dispersion, plane, design, response],
  );
  const low = f3Of(response.sum, PREDICTION_LOW_DB);
  const answers: StatTileItem[] = [
    [PREDICTION_TILES.loud, limits.musicDb !== null ? formatDb(limits.musicDb) : "–", "dB"],
    [PREDICTION_TILES.low, low !== null ? low.toFixed(0) : "–", "Hz"],
    [
      PREDICTION_TILES.wide,
      across ? beamWidthDeg(across, PREDICTION_WIDE_HZ, PREDICTION_WIDE_DB).toFixed(0) : "–",
      "°",
    ],
    [PREDICTION_TILES.cost, priceText(totals), ""],
    [PREDICTION_TILES.weight, units.amount("mass", totals.lb, 0), units.unit("mass")],
  ];
  const openSpeaker = (k: number) => {
    const member = members[k];
    if (member && design.speakers.some((s) => s.id === member.speakerId))
      onEditSpeaker(member.speakerId);
  };

  const top = (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-stone-500">{SHELL_TEXT.preview}</p>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <SectionHeading>{design.stack.name}</SectionHeading>
      </div>
      {members.length > 0 && <StatTileGrid tiles={answers} />}
    </div>
  );

  const libraryPanel = (
    <div className="flex flex-col gap-4">
      <h2 className="font-title text-lg">{SHELL_TEXT.library}</h2>
      <section className="flex flex-col gap-2">
        <h3 className="font-label text-sm text-stone-500">{SHELL_TEXT.yourSpeakers}</h3>
        {library.length ? (
          library.map((o) => (
            <div key={o.id} className="flex items-start justify-between gap-2">
              <span className="min-w-0 text-sm leading-snug">{o.name}</span>
              <Button size="xs" onClick={() => stack.addSpeaker(librarySpec(o))}>
                {STACK_TEXT.addMember}
              </Button>
            </div>
          ))
        ) : (
          <p className="text-xs text-stone-500">{STACK_TEXT.noLibrary}</p>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="font-label text-sm text-stone-500">{SHELL_TEXT.examples}</h3>
        {EXAMPLES.map((o) => (
          <div key={o.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0 text-sm leading-snug">{o.name}</span>
            <Button
              size="xs"
              onClick={() => {
                setPicked(null);
                stack.setDesign(stackFromStart(o.id));
              }}
            >
              {SHELL_TEXT.open}
            </Button>
          </div>
        ))}
      </section>
    </div>
  );

  const canvas = (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <ToggleGroup
        size="xs"
        value={view}
        onChange={setView}
        options={[
          ["front", SHELL_TEXT.front],
          ["3d", SHELL_TEXT.view3d],
        ]}
      />
      <div className="flex-1 min-h-[280px] md:min-h-0 relative">
        {members.length === 0 ? (
          <Notice>{STACK_TEXT.noMembers}</Notice>
        ) : view === "front" ? (
          <StackFront
            stack={design.stack}
            speakers={design.speakers}
            listenHeightIn={response.listenHeightIn}
            selected={selected}
            onSelect={setPicked}
            onOpen={openSpeaker}
          />
        ) : (
          <Viewer3DCard boxClassName="absolute inset-0">
            {(cutaway) => (
              <MembersView3D stack={design.stack} speakers={design.speakers} cutaway={cutaway} />
            )}
          </Viewer3DCard>
        )}
      </div>
      {view === "front" && members.length > 0 && (
        <p className="text-xs text-stone-500">
          <MarkedText text={SHELL_TEXT.canvasHint} />
        </p>
      )}
    </div>
  );

  const member = selected !== null ? members[selected] : undefined;
  const inspector =
    selected !== null && member ? (
      <div className="flex flex-col gap-3">
        <MemberSettings
          index={selected}
          member={member}
          names={names}
          delayMs={response.members[selected]?.delayMs ?? null}
          onEdit={(edit) => stack.editMember(selected, edit)}
          onRemove={() => {
            setPicked(null);
            stack.removeMember(selected);
          }}
          onEditSpeaker={
            design.speakers.some((s) => s.id === member.speakerId)
              ? () => openSpeaker(selected)
              : undefined
          }
        />
        <Card>
          <h3 className="font-semibold">{STACK_SETTINGS_SECTIONS.crossovers}</h3>
          <FilterFields
            filters={member.crossover}
            // a new corner at the PA's crossover to its subs
            newCornerHz={DEFAULT_PA.xoLo}
            offName={STACK_TEXT.noFilter}
            onEdit={(edit) =>
              stack.editMember(selected, (m) => ({ ...m, crossover: edit(m.crossover) }))
            }
          />
        </Card>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <h2 className="font-title text-lg">{SHELL_TEXT.stackHeading}</h2>
        <p className="text-xs text-stone-500">{SHELL_TEXT.selectHint}</p>
        <div className="flex flex-col gap-1">
          {names.map((n, k) => (
            <Button key={k} size="xs" className="text-left" onClick={() => setPicked(k)}>
              {n}
            </Button>
          ))}
        </div>
        {members.length > 0 && (
          <CalculateGainsButton
            balance={stack.balance}
            onApply={stack.applyBalance}
            tip={AUTO_BALANCE_TEXT.stackTip}
          />
        )}
        <TextField
          label={STACK_TEXT.notes}
          value={notes}
          maxLength={200}
          onChange={stack.setNotes}
        />
      </div>
    );

  const results = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="min-w-0 flex flex-col gap-2">
          <h3 className="font-semibold">{STACK_TEXT.response}</h3>
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
        </section>
        {limits.sum.length > 0 && (
          <section className="min-w-0 flex flex-col gap-2">
            <h3 className="font-semibold">{STACK_TEXT.maxOutput}</h3>
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
        <section aria-label={CHECK_ROW_TEXT.checks} className="flex flex-col gap-2">
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
        <section className="min-w-0 flex flex-col gap-2">
          <h3 className="font-semibold">{DISPERSION_HEADING}</h3>
          <DispersionBlock
            map={dispersion}
            plane={plane}
            onPlane={setPlane}
            distM={DISPERSION_DISTANCE_M}
            axis="listening"
          />
        </section>
      )}
    </div>
  );

  return (
    <AppShell
      top={top}
      library={libraryPanel}
      canvas={canvas}
      inspector={inspector}
      results={results}
    />
  );
}
