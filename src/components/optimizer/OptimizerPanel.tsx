import { ToggleButton } from "../ui/ToggleButton";
import { Card } from "../ui/Card";
import { SectionHeading } from "../ui/SectionHeading";
import { NumberField } from "../ui/NumberField";
import { Notice } from "../ui/Notice";
import { formatDollars } from "../../lib/format";
import { toggled } from "../../lib/lists";
import { OptimizerResultCard } from "./OptimizerResultCard";
import { GoalPicker } from "./GoalPicker";
import { KeepDetails } from "./KeepDetails";
import { RunRow } from "./RunRow";
import { ResultCards } from "./ResultCards";
import { roomRequiredSpl, ROOMS, OPTIMIZER_GOALS } from "../../lib/pa/optimize";
import { keepLines, PA_KEEP_WORDS } from "../../lib/optimizer/goalKeeps";
import { OPTIMIZER_PANEL_TEXT } from "../../constants/optimizerText";
import type {
  OptimizerProgress,
  PaGoal,
  PaOptimizerCard,
  PaOptimizerInputState,
  PaOptimizerResult,
  PaRoom,
  PaRunMode,
  PaSearchOverrides,
} from "../../types";
import { FONT } from "../../styles/fonts";

interface Props {
  optIn: PaOptimizerInputState;
  setOpt: (o: Partial<PaOptimizerInputState>) => void;
  /** starts a search; given limits to change first, or called as the run button's click handler */
  run: (over?: PaSearchOverrides) => unknown;
  /** starts the exact search (Fully optimize) */
  runFull: () => unknown;
  /** which search is running; null when none is */
  runningMode: PaRunMode | null;
  /** the grid Fully optimize searches, one line per part */
  fullGridLines: readonly string[];
  busy: boolean;
  /** how far the running search has got; null before its first report */
  progress: OptimizerProgress | null;
  /** stops the running search */
  onCancel: () => void;
  res: PaOptimizerResult | null;
  err: string;
  /** the current design's clean sub output in dB; null when it can't be scored */
  curOut: number | null;
  /** the card being previewed, if any */
  previewCard: PaOptimizerCard | null;
  onPreview: (card: PaOptimizerCard) => void;
  onLoad: (card: PaOptimizerCard) => void;
  onSave: (card: PaOptimizerCard) => void;
  canSave: boolean;
}

/** Goal picker, run button and result cards for the PA optimizer. */
export function OptimizerPanel({
  optIn,
  setOpt,
  run,
  runFull,
  runningMode,
  fullGridLines,
  busy,
  progress,
  onCancel,
  res,
  err,
  curOut,
  previewCard,
  onPreview,
  onLoad,
  onSave,
  canSave,
}: Props) {
  const need = roomRequiredSpl(optIn.room),
    target = Math.max(curOut != null ? curOut : need, need);
  const goals = optIn.goals,
    g = goals[0];
  // tap adds a goal at the end of the order; tap again removes it (none selected is allowed; the search waits for one)
  const tapGoal = (k: PaGoal) => setOpt({ goals: toggled(goals, k) });
  const tgtText = !g
    ? "pick a goal"
    : (g === "louder"
        ? "as loud as it gets, F3 within 3 Hz"
        : g === "lower"
          ? `lowest F3, at least ${(target - 1.5).toFixed(0)} dB per stack`
          : `clean ${target.toFixed(0)} dB per stack`) +
      (goals.length > 1
        ? `, and ${goals
            .slice(1)
            .map(
              (x) =>
                ({ cheaper: "cheaper", lighter: "lighter", lower: "lower", louder: "louder" })[x],
            )
            .join(" and ")} than yours`
        : "");
  return (
    <section className="max-w-6xl mx-auto px-4 md:px-8 pb-4" style={{ fontFamily: FONT }}>
      <Card pad="lg">
        <SectionHeading>{OPTIMIZER_PANEL_TEXT.heading}</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div className="mt-3">
            <div className="text-sm text-stone-500 mb-1">Room, sq ft</div>
            <div className="flex flex-wrap gap-1">
              {/* the cast below is a boundary: Object.entries types the keys as string; they are the rooms in ROOMS */}
              {Object.entries(ROOMS).map(([k, r]) => (
                <ToggleButton
                  key={k}
                  aria-label={r.name}
                  on={String(optIn.room) === k}
                  onClick={() => setOpt({ room: k === "outdoor" ? k : (+k as PaRoom) })}
                >
                  {r.short}
                </ToggleButton>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <NumberField
              label="Max per box"
              value={optIn.maxLb}
              min={30}
              max={250}
              unit="lb"
              onChange={(n) => setOpt({ maxLb: n })}
              className=""
            />
          </div>
          <div className="mt-3">
            <NumberField
              label={
                <>
                  Driver budget, per stack{" "}
                  <span className="text-xs">(sub + mid + CD, at the listed prices)</span>
                </>
              }
              value={optIn.budget}
              min={100}
              step={25}
              unit="$"
              onChange={(n) => setOpt({ budget: n })}
              className=""
            />
          </div>
          <GoalPicker defs={OPTIMIZER_GOALS} selected={goals} onTap={tapGoal} />
          <KeepDetails lines={keepLines(goals, OPTIMIZER_GOALS, PA_KEEP_WORDS, curOut != null)} />
        </div>
        <div className="mt-3 text-sm px-3 py-2 rounded border border-dashed border-stone-300 bg-stone-50">
          Target: {tgtText}
          {curOut != null && (
            <div className="text-xs text-stone-500 mt-0.5">
              Music limit, 40–90 Hz. Yours: {curOut.toFixed(0)} dB ·{" "}
              {ROOMS[optIn.room] ? ROOMS[optIn.room].name : ""} needs about {need.toFixed(0)} dB
            </div>
          )}
        </div>
        <RunRow
          busy={busy}
          hasGoal={!!g}
          onRun={run}
          runLabel="Improve"
          alt={{ label: "Fully optimize", onRun: runFull, running: runningMode === "full" }}
          onCancel={onCancel}
          progress={progress}
          stats={res && res.stats}
          note={
            res && res.cards.length
              ? " · every design shown passes the planner's build checks (warnings are listed on the card)"
              : ""
          }
        >
          {err && <span className="text-xs text-red-700">{err}</span>}
        </RunRow>
        <KeepDetails
          summary="Improve or Fully optimize"
          lines={[
            "Improve: a quick search around your design (about a second).",
            "Fully optimize: every design on the grid below, so its first card is the best there is on it (under a minute):",
            ...fullGridLines.map((line) => `· ${line}`),
          ]}
        />
        {res && !busy && res.curProblems && res.curProblems.length > 0 && (
          <Notice>
            Your design fails: {res.curProblems.join("; ")}. Fixes may cost or weigh more.
          </Notice>
        )}
        {res && !busy && (
          <ResultCards
            cards={res.cards}
            render={(k, i) => (
              <OptimizerResultCard
                key={i}
                result={k}
                index={i}
                total={res.cards.length}
                currentDesign={res.cur}
                previewing={previewCard === k}
                canSave={canSave}
                onPreview={() => onPreview(k)}
                onLoad={() => onLoad(k)}
                onSave={() => onSave(k)}
              />
            )}
          />
        )}
        {res && !busy && res.goalMissing && <Notice>{res.goalMissing}</Notice>}
        {res &&
          !busy &&
          res.cards.length > 0 &&
          res.nearMiss &&
          res.nearMiss.options.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-stone-500">
              Reaches the goal with a looser limit:
              {res.nearMiss.options.map((o) => (
                <ToggleButton key={o.text} on={false} onClick={() => run(o.set)}>
                  {o.text}
                </ToggleButton>
              ))}
            </div>
          )}
        {res && !busy && !res.cards.length && res.nearMiss && (
          <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 px-3 py-3">
            <h3 className="text-base" style={{ fontFamily: FONT, fontWeight: 700 }}>
              Nothing fits all your limits
            </h3>
            <div className="text-xs text-orange-900 mt-1">
              {res.nearMiss.closest
                ? `Closest: ${res.nearMiss.closest.names.sub}, ${res.nearMiss.closest.metrics.heaviest.toFixed(0)} lb, ${formatDollars(res.nearMiss.closest.metrics.price)} per stack, ${res.nearMiss.closest.metrics.out.toFixed(1)} dB. `
                : ""}
              Blocked by: {res.nearMiss.blocking.join("; ")}.
            </div>
            {res.nearMiss.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {res.nearMiss.options.map((o) => (
                  <ToggleButton key={o.text} on={false} onClick={() => run(o.set)}>
                    {o.text}
                  </ToggleButton>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
