import { ToggleButton } from "../ui/ToggleButton";
import { Card } from "../ui/Card";
import { SectionHeading } from "../ui/SectionHeading";
import { NumberField } from "../ui/NumberField";
import { Notice } from "../ui/Notice";
import { formatDollars } from "../../lib/format";
import { OptimizerResultCard } from "./OptimizerResultCard";
import { GoalPicker } from "./GoalPicker";
import { RunRow } from "./RunRow";
import { ResultCards } from "./ResultCards";
import { roomRequiredSpl, ROOMS, OPTIMIZER_GOALS } from "../../lib/pa/optimize";

/** Goal picker, run button and result cards for the PA optimizer. */
export function OptimizerPanel({
  optIn,
  setOpt,
  run,
  busy,
  res,
  err,
  curOut,
  previewCard,
  onPreview,
  onLoad,
  onSave,
  canSave,
}) {
  const need = roomRequiredSpl(optIn.room),
    target = Math.max(curOut != null ? curOut : need, need);
  const goals = optIn.goals,
    g = goals[0];
  // tap adds a goal at the end of the order; tap again removes it (none selected is allowed; the search waits for one)
  const tapGoal = (k) =>
    setOpt({ goals: goals.includes(k) ? goals.filter((x) => x !== k) : [...goals, k] });
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
    <section className="max-w-6xl mx-auto px-4 md:px-8 pb-4" style={{ fontFamily: "var(--font)" }}>
      <Card pad="lg">
        <SectionHeading>Find a better design</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div className="mt-3">
            <div className="text-sm text-stone-500 mb-1">Room, sq ft</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(ROOMS).map(([k, r]) => (
                <ToggleButton
                  key={k}
                  aria-label={r.name}
                  on={String(optIn.room) === k}
                  onClick={() => setOpt({ room: k === "outdoor" ? k : +k })}
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
          stats={res && res.stats}
          note={
            res && res.cards.length
              ? " · every design shown passes the planner's build checks (warnings are listed on the card)"
              : ""
          }
        >
          {err && <span className="text-xs text-red-700">{err}</span>}
        </RunRow>
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
        {res && !busy && !res.cards.length && res.nearMiss && (
          <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 px-3 py-3">
            <h3 className="text-base" style={{ fontFamily: "var(--font)", fontWeight: 700 }}>
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
