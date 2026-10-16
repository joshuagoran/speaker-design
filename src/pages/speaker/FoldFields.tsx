import type { HornMount, HornRun } from "../../types";
import { fittedRuns, type HornFold } from "../../lib/speaker/hornFold";
import { CardHeading } from "../../components/ui/CardHeading";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { ReadOnlyField } from "../../components/ui/ReadOnlyField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Notice } from "../../components/ui/Notice";
import { Tooltip } from "../../components/ui/Tooltip";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import { CM_PER_IN } from "../../constants/units";
import { FIELD_ROW, GAP_Y_TIGHT } from "../../styles/layout";
import { shownIn, shownTenth } from "./speakerFields";
import { withRunAdded, withRunEdited, withRunRemoved, wallName } from "./foldRuns";

/** The length step of a run's field, in, and its angle step, degrees. */
const RUN_STEP_IN = 0.25;
const ANGLE_STEP_DEG = 1;

/** The drivers' spot a picked run starts with: its upper or left wall, at its start, the fronts in the run. */
const NEW_MOUNT: Omit<HornMount, "run"> = { side: 1, alongCm: 0, frontInRun: true };

interface RunsProps {
  /** the runs the fold lays out: the horn's own, or the automatic folds' */
  runs: readonly HornRun[];
  /** whether the runs are the horn's own (else the automatic folds, which Reset brings back) */
  own: boolean;
  /** the sections' path length, in: the runs' first run takes up any difference */
  pathIn: number;
  fold: HornFold | null;
  /** new runs (undefined: back to the automatic folds), and the run removed, if one was */
  onRuns: (runs: readonly HornRun[] | undefined, removed?: number) => void;
}

/**
 * A folded path's runs (`HornRun`): each run's length and angle, Add and Remove, Reset to the automatic folds, and the
 * checks: the runs' length against the sections', a run past the box, runs that cross, a sharp turn.
 */
export function FoldRunsFields({ runs, own, pathIn, fold, onRuns }: RunsProps) {
  // the first run's length is what the path leaves it, so it shows read-only
  const fitted = fittedRuns(runs, pathIn);
  const totalIn = fitted.reduce((sum, r) => sum + r.lengthIn, 0);
  return (
    <div className={GAP_Y_TIGHT}>
      <CardHeading sub>
        <Tooltip tip={SPEAKER_TEXT.foldRunsTip}>{SPEAKER_TEXT.foldRuns}</Tooltip>
      </CardHeading>
      {runs.map((run, i) => (
        <div key={i} className={FIELD_ROW}>
          {i === 0 ? (
            <ReadOnlyField
              label={
                <Tooltip tip={SPEAKER_TEXT.foldFirstRunTip}>
                  {SPEAKER_TEXT.foldRunLength(1)}
                </Tooltip>
              }
              value={shownIn(fitted[0].lengthIn)}
            />
          ) : (
            <NumberField
              label={SPEAKER_TEXT.foldRunLength(i + 1)}
              value={shownIn(run.lengthCm / CM_PER_IN)}
              min={0}
              step={RUN_STEP_IN}
              onChange={(v) => onRuns(withRunEdited(runs, i, { lengthCm: v * CM_PER_IN }))}
            />
          )}
          <NumberField
            label={<Tooltip tip={SPEAKER_TEXT.foldAngleTip}>{SPEAKER_TEXT.foldAngle}</Tooltip>}
            value={shownTenth(run.angleDeg)}
            step={ANGLE_STEP_DEG}
            onChange={(v) => onRuns(withRunEdited(runs, i, { angleDeg: v }))}
          />
          {runs.length > 1 && (
            <Button size="xs" onClick={() => onRuns(withRunRemoved(runs, i), i)}>
              {SPEAKER_TEXT.removeRun}
            </Button>
          )}
        </div>
      ))}
      <div className={FIELD_ROW}>
        <Button variant="primary" size="xs" onClick={() => onRuns(withRunAdded(runs))}>
          {SPEAKER_TEXT.addRun}
        </Button>
        {own && (
          <Button size="xs" onClick={() => onRuns(undefined)}>
            {SPEAKER_TEXT.resetFolds}
          </Button>
        )}
      </div>
      <p className="text-xs text-stone-500">
        {SPEAKER_TEXT.foldRunsTotal(String(shownTenth(totalIn)), String(shownTenth(pathIn)))}
      </p>
      {fold?.outside != null && <Notice>{SPEAKER_TEXT.foldOutside(fold.outside + 1)}</Notice>}
      {fold?.crossing && (
        <Notice>{SPEAKER_TEXT.foldCrossing(fold.crossing[0] + 1, fold.crossing[1] + 1)}</Notice>
      )}
      {fold?.sharpTurn != null && <Notice>{SPEAKER_TEXT.foldSharp(fold.sharpTurn + 1)}</Notice>}
    </div>
  );
}

interface MountProps {
  fold: HornFold;
  /** a tapped horn's cone backs open into a run; an offset horn's into the rear chamber */
  tapped: boolean;
  onMount: (mount: HornMount) => void;
}

/**
 * Where a folded offset or tapped horn's drivers sit (`HornMount`): the run, its wall, the distance along it and the way
 * the cone fronts face; the taps that spot gives, read-only, and the run (or the rear chamber) across the board. A spot
 * that does not fit the drive says so.
 */
export function FoldMountFields({ fold, tapped, onMount }: MountProps) {
  const spot = fold.mount;
  if (!spot)
    return (
      <div className={GAP_Y_TIGHT}>
        <Notice>{SPEAKER_TEXT.foldNoSpot}</Notice>
        <ToggleGroup
          label={SPEAKER_TEXT.foldDriversRun}
          value={-1}
          onChange={(run) => onMount({ ...NEW_MOUNT, run })}
          options={fold.runs.map((_, i) => [i, String(i + 1)] as const)}
        />
      </div>
    );
  const { mount } = spot;
  const set = (change: Partial<HornMount>) => {
    const { alongIn, ...rest } = mount;
    onMount({ ...rest, alongCm: alongIn * CM_PER_IN, ...change });
  };
  const run = fold.runs[mount.run];
  return (
    <div className={GAP_Y_TIGHT}>
      <CardHeading sub>
        <Tooltip tip={SPEAKER_TEXT.foldDriversTip}>{SPEAKER_TEXT.foldDrivers}</Tooltip>
      </CardHeading>
      <ToggleGroup
        label={SPEAKER_TEXT.foldDriversRun}
        value={mount.run}
        onChange={(i) => set({ run: i, alongCm: 0 })}
        options={fold.runs.map((_, i) => [i, String(i + 1)] as const)}
      />
      <ToggleGroup
        label={SPEAKER_TEXT.foldWall}
        value={mount.side}
        onChange={(side) => set({ side })}
        options={[
          [1, wallName(run.angle, 1)],
          [-1, wallName(run.angle, -1)],
        ]}
      />
      <div className={FIELD_ROW}>
        <NumberField
          label={SPEAKER_TEXT.foldAlong}
          value={shownIn(mount.alongIn)}
          min={0}
          max={shownIn(run.s1 - run.s0)}
          step={RUN_STEP_IN}
          onChange={(v) => set({ alongCm: v * CM_PER_IN })}
        />
      </div>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.foldFrontTip}>{SPEAKER_TEXT.foldFront}</Tooltip>}
        value={mount.frontInRun}
        onChange={(frontInRun) => set({ frontInRun })}
        options={[
          [true, SPEAKER_TEXT.foldFrontRun],
          [false, SPEAKER_TEXT.foldFrontAcross],
        ]}
      />
      <div className={FIELD_ROW}>
        {spot.taps.front !== null && (
          <ReadOnlyField
            label={<Tooltip tip={SPEAKER_TEXT.foldTapTip}>{SPEAKER_TEXT.foldFrontTap}</Tooltip>}
            value={shownTenth(spot.taps.front)}
            unit="in"
          />
        )}
        {spot.taps.rear !== null && (
          <ReadOnlyField
            label={<Tooltip tip={SPEAKER_TEXT.foldTapTip}>{SPEAKER_TEXT.foldBackTap}</Tooltip>}
            value={shownTenth(spot.taps.rear)}
            unit="in"
          />
        )}
      </div>
      <p className="text-xs text-stone-500">
        {spot.across === null
          ? SPEAKER_TEXT.foldAcrossChamber
          : SPEAKER_TEXT.foldAcrossRun(spot.across + 1)}
      </p>
      {tapped && (spot.taps.front === null || spot.taps.rear === null) && (
        <Notice>{SPEAKER_TEXT.foldTappedNeedsRun}</Notice>
      )}
      {!tapped && (spot.taps.front === null || spot.taps.rear !== null) && (
        <Notice>{SPEAKER_TEXT.foldOffsetNeedsChamber}</Notice>
      )}
    </div>
  );
}
