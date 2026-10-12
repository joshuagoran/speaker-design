import { FREQ_AXIS_MAX_HZ } from "../../constants/chartScales";
import { useState } from "react";
import { CoverageMap, type MapBox } from "../../components/charts/CoverageMap";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Ellipsis } from "../../components/ui/Ellipsis";
import { Slider } from "../../components/ui/Slider";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { formatSigned as signed } from "../../lib/format";
import { COVERAGE_BANDS, SINGLE_FREQ_RANGE } from "../../lib/pa/coverage";
import { CoverageBandPicker } from "../../components/ui/CoverageBandPicker";
import { RoomFields } from "../../components/ui/RoomFields";
import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useMapMaxHeight } from "../../hooks/useMapMaxHeight";
import type { SubPlacement } from "../../types";
import { useCoverageLayout } from "./useCoverageLayout";
import { CoverageAssumptions } from "./CoverageAssumptions";
import { AmpPowerTable } from "./AmpPowerTable";
import { COVERAGE_TEST_IDS } from "../../constants/coverageTestIds";
import { RESULT_MAX_WIDTH } from "../../styles/layout";
import { useCoverageMap, type CoverageInputs } from "./useCoverageMap";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { formatHz } from "../../lib/format";
import { SettingsColumn } from "../../components/ui/SettingsColumn";
import {
  SETTINGS_SHEET_CLASS,
  SettingsSheetTabs,
  settingsSheetBodyClass,
  settingsSheetRoomClass,
} from "../../components/ui/SettingsSheetTabs";
import {
  COVERAGE_EDGE_DB,
  COVERAGE_LEVEL_REF_PLACE,
  COVERAGE_LEVEL_REFS,
  COVERAGE_TARGET_DB,
} from "../../constants/coverageLevel";

/** The tabs of the phone settings sheet. */
type CoverageTab = "listener" | "band" | "room" | "stacks";
const TABS: [CoverageTab, string][] = [
  ["listener", "Listener"],
  ["band", "Band"],
  ["room", "Room"],
  ["stacks", "Stacks"],
];
const SUB_PLACEMENTS: [SubPlacement, string][] = [
  ["stacks", "Subs in the stacks"],
  ["center", "Center pair"],
  ["single", "One center sub"],
];

interface Props {
  planner: CoverageInputs;
}

/** Audience coverage: both stacks on a floor plan, level against the target across the room, and the listener's response. */
export function CoveragePage({ planner }: Props) {
  const pal = usePalette();
  const state = useCoverageLayout(planner.subBox);
  const { layout } = state;
  const { room } = layout;
  const map = useCoverageMap(planner, layout);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<CoverageTab>("band");
  const tabClass = (t: CoverageTab) => (tab === t ? "" : "max-md:hidden");
  const maxHeight = useMapMaxHeight();

  const mapStack = map.stack;
  // every box at the sub's footprint; the stacks draw their horn's coverage and turn
  const mapBoxes: MapBox[] = mapStack
    ? map.boxes.map((b) => ({
        ...b,
        footprint: mapStack.footprint,
        covH: b.kind === "stack" ? mapStack.horn.covH : null,
        turnable: b.kind === "stack",
      }))
    : [];
  const rel = map.listenerDb != null ? map.listenerDb - map.target : null;
  const relClass =
    rel == null
      ? ""
      : rel >= -3
        ? "text-green-700"
        : rel >= COVERAGE_EDGE_DB
          ? "text-orange-700"
          : "text-red-700";
  const bandName =
    layout.band === "one"
      ? `${formatHz(layout.freqHz)}, one frequency`
      : `${COVERAGE_BANDS[layout.band].name} band, ${formatHz(COVERAGE_BANDS[layout.band].lo)}–${formatHz(COVERAGE_BANDS[layout.band].hi)}`;
  const [left, right] = layout.stacks;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const label = "text-sm text-stone-500 mb-1";
  const delay = (ms: number) =>
    ms < 0 ? `the tops wait ${(-ms).toFixed(1)} ms` : `${ms.toFixed(1)} ms on the sub`;

  return (
    <SettingsLayout
      className={settingsSheetRoomClass(sheetOpen)}
      results={
        <div className="min-w-0 flex flex-col gap-5">
          <section>
            <SectionHeading className="mb-1">Audience coverage</SectionHeading>
            <p className="text-sm text-stone-500 mb-3">
              {bandName}, {map.target.toFixed(0)} dB target at{" "}
              {COVERAGE_LEVEL_REF_PLACE[layout.levelRef]}. Drag a stack to move it, its dot to toe
              it in, or the listener (tap the floor to put them there).
            </p>
            {map.stack && map.levels ? (
              <CoverageMap
                view={map.view}
                room={room}
                listener={layout.listener}
                actions={{
                  // the stacks (L, R) first; then the center subs, which move their cluster
                  moveBox: (i, p) => {
                    const b = map.boxes[i];
                    if (i === 0 || i === 1) state.moveStack(i, p);
                    else if (b)
                      state.moveCluster({
                        x: p.x + layout.cluster.x - b.x,
                        y: p.y + layout.cluster.y - b.y,
                      });
                  },
                  aimBox: (i, p) => {
                    if (i === 0 || i === 1) state.aimStack(i, p);
                  },
                  moveListener: state.moveListener,
                }}
                boxes={mapBoxes}
                busy={map.isPending}
                maxHeight={maxHeight}
              />
            ) : (
              <Notice>Needs a mid with T/S parameters and a horn with coverage angles.</Notice>
            )}
            {map.error && <Notice>Map failed: {map.error}</Notice>}
            {map.stack && !planner.hornModel && (
              <Notice>No horn in the map: its driver has no sensitivity or power rating.</Notice>
            )}
            {map.stack && !planner.subModeled && (
              <Notice>No sub in the map: the planner cannot model it.</Notice>
            )}
            {rel != null && map.stats && (
              <div className="md:hidden flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-stone-500 tabular-nums">
                <span>
                  Listener <b className="text-stone-900">{map.listenerDb?.toFixed(1)} dB</b>{" "}
                  <span className={relClass}>({signed(rel)})</span>
                </span>
                <span>
                  <b className="text-stone-900">{pct(map.stats.within3)}</b> ≥ −3 dB
                </span>
                <span>
                  <b className="text-stone-900">{pct(map.stats.within6)}</b> ≥{" "}
                  {signed(COVERAGE_EDGE_DB, 0)} dB
                </span>
              </div>
            )}
          </section>
          {map.pads && (
            <section className={RESULT_MAX_WIDTH} data-testid={COVERAGE_TEST_IDS.ampPower}>
              <AmpPowerTable planner={planner} pads={map.pads} gain={map.gain} />
            </section>
          )}
          <section className="max-w-prose">
            <CoverageAssumptions room={room} planner={planner} target={map.target} level={layout} />
          </section>
        </div>
      }
      settings={
        <SettingsColumn
          label="Coverage settings"
          className={SETTINGS_SHEET_CLASS}
          bodyClassName={`flex flex-col gap-6 md:pb-4 max-md:gap-0 ${settingsSheetBodyClass(sheetOpen)}`}
          top={
            <SettingsSheetTabs
              tabs={TABS}
              open={sheetOpen}
              active={tab}
              onOpen={(t) => {
                setTab(t);
                setSheetOpen(true);
              }}
              onClose={() => setSheetOpen(false)}
            />
          }
        >
          <div className={tabClass("listener")}>
            <div className={label}>Listener</div>
            {rel != null ? (
              <div className="flex items-baseline flex-wrap gap-x-3 tabular-nums">
                <span className="text-3xl font-bold">{map.listenerDb?.toFixed(1)} dB</span>
                <span className={`text-lg font-semibold ${relClass}`}>
                  {signed(rel)} against the target
                </span>
              </div>
            ) : (
              <div className="text-stone-500">—</div>
            )}
            <div className="text-sm text-stone-500 mt-1">
              {layout.listener.y.toFixed(1)} ft from the front wall,{" "}
              {Math.abs(layout.listener.x).toFixed(1)} ft{" "}
              {layout.listener.x < 0 ? "left of" : layout.listener.x > 0 ? "right of" : "on"} center
            </div>
            {map.stats && (
              <div className="grid grid-cols-3 gap-3 mt-3 tabular-nums">
                {(
                  [
                    [pct(map.stats.within3), "of the floor ≥ −3 dB"],
                    [pct(map.stats.within6), `of the floor ≥ ${signed(COVERAGE_EDGE_DB, 0)} dB`],
                    [`${map.stats.spread.toFixed(1)} dB`, "spread, 10th–90th %"],
                  ] as const
                ).map(([v, k]) => (
                  <div key={k} className="border-t border-stone-300 pt-1">
                    <div className="text-lg font-semibold">{v}</div>
                    <div className="text-xs text-stone-500">{k}</div>
                  </div>
                ))}
              </div>
            )}
            {map.pads && (
              <p className="text-xs text-stone-500 mt-3 tabular-nums">
                Turned down to balance: sub {signed(map.pads.sub)} dB, mid {signed(map.pads.mid)}{" "}
                dB, horn {signed(map.pads.horn)} dB.
              </p>
            )}
            {map.response.length > 0 && (
              <div className="mt-4">
                <ResponseChart
                  fmax={FREQ_AXIS_MAX_HZ}
                  H={240}
                  yLabel="dB SPL at the listener"
                  series={[
                    {
                      curve: map.response,
                      label: "Listener",
                      stroke: pal.ink,
                      tint: alpha(pal.ink, 0.05),
                    },
                    {
                      curve: map.targetCurve,
                      label: "Target, music balance",
                      stroke: pal.magenta,
                      tint: alpha(pal.magenta, 0),
                    },
                  ]}
                  span={
                    layout.band === "one"
                      ? undefined
                      : { lo: COVERAGE_BANDS[layout.band].lo, hi: COVERAGE_BANDS[layout.band].hi }
                  }
                  marks={
                    layout.band === "one"
                      ? [{ f: layout.freqHz, label: formatHz(layout.freqHz) }]
                      : []
                  }
                />
              </div>
            )}
          </div>

          <div className={tabClass("band")}>
            <Slider
              label="Target level, sub band"
              value={layout.targetDb}
              min={COVERAGE_TARGET_DB[0]}
              max={COVERAGE_TARGET_DB[1]}
              step={1}
              unit=" dB SPL"
              onChange={state.setTargetDb}
            />
            <ToggleGroup
              label="Measured at"
              value={layout.levelRef}
              onChange={state.setLevelRef}
              options={COVERAGE_LEVEL_REFS}
              className="mb-1"
            />
            <p className="text-xs text-stone-500 mb-4 tabular-nums">
              {map.refDb == null ? (
                <>
                  Calculating the level
                  <Ellipsis />
                </>
              ) : map.refDb < map.refTarget - 0.05 ? (
                `It cannot reach ${map.refTarget.toFixed(0)} dB at ${COVERAGE_LEVEL_REF_PLACE[layout.levelRef]}: ${map.refDb.toFixed(1)} dB at its limit.`
              ) : (
                `Turned down ${Math.abs(map.gain).toFixed(1)} dB so ${COVERAGE_LEVEL_REF_PLACE[layout.levelRef]} gets ${map.refTarget.toFixed(0)} dB in this band.`
              )}
            </p>
            <CoverageBandPicker
              band={layout.band}
              freqHz={layout.freqHz}
              onBand={state.setBand}
              onFreqHz={state.setFreqHz}
              oneNote={`One frequency adds everything with phase, so the interference between the stacks is easy to see. The limit is ${SINGLE_FREQ_RANGE[1]} Hz. Above it, the pattern is finer than the map.`}
            />
          </div>

          <div className={tabClass("room")}>
            <RoomFields room={room} actions={state} />
          </div>

          <div className={tabClass("stacks")}>
            <ToggleGroup
              label="Stacks"
              value={map.subs}
              onChange={state.setSubs}
              options={SUB_PLACEMENTS}
              disabled={
                map.levels?.sub
                  ? undefined
                  : { values: SUB_PLACEMENTS.map(([s]) => s).filter((s) => s !== "stacks") }
              }
              className="mb-3"
            />
            <div className="flex flex-wrap gap-1 mb-3">
              <ToggleButton on={layout.mirror} onClick={() => state.setMirror(!layout.mirror)}>
                Move the pair as a mirror image
              </ToggleButton>
            </div>
            {map.subDelayMs != null && (
              <p className="text-sm text-stone-500 tabular-nums mb-3">
                Sub delay: {delay(map.subDelayMs)}, in phase with the mid at{" "}
                {formatHz(planner.subMidCrossoverHz)} on the stack's axis, as a DSP setup would set
                it.
              </p>
            )}
            <Slider
              label="Ear height"
              value={layout.earFt}
              min={3}
              max={6.5}
              step={0.1}
              unit=" ft"
              onChange={state.setEarFt}
            />
            <p className="text-sm text-stone-500 tabular-nums mb-3">
              {Math.hypot(left.x - right.x, left.y - right.y).toFixed(1)} ft apart · toe-in L{" "}
              {left.aim}°, R {-right.aim}°
            </p>
            <Button onClick={state.reset}>Reset the layout</Button>
          </div>
        </SettingsColumn>
      }
    />
  );
}
