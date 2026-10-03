import { useEffect, useId, useState } from "react";
import { crossoverSlopeName } from "../../constants/crossovers";
import { CoverageMap } from "../../components/charts/CoverageMap";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Slider } from "../../components/ui/Slider";
import { SelectField } from "../../components/ui/SelectField";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { formatSigned as signed } from "../../lib/format";
import { COVERAGE_BANDS, SINGLE_FREQ_RANGE } from "../../lib/pa/coverage";
import { LISTENER_TARGET_DB } from "../../lib/pa/optimize";
import { MODAL_HZ, ROOM_MATERIAL_OPTIONS } from "../../lib/pa/roomAcoustics";
import { PAL } from "../../styles/palette";
import type { RoomSurface, SubPlacement } from "../../types";
import {
  ROOM_CEILING_FT,
  ROOM_LENGTH_FT,
  ROOM_WIDTH_FT,
  useCoverageLayout,
} from "./useCoverageLayout";
import { CoverageAssumptions } from "./CoverageAssumptions";
import { useCoverageMap, type CoverageInputs } from "./useCoverageMap";

/** The tabs of the phone settings sheet. */
type CoverageTab = "listener" | "band" | "room" | "stacks";
const TABS: [CoverageTab, string][] = [
  ["listener", "Listener"],
  ["band", "Band"],
  ["room", "Room"],
  ["stacks", "Stacks"],
];
const NAMED_BANDS = ["sub", "kick", "mid", "high"] as const;
const SURFACES: [RoomSurface, string][] = [
  ["front", "Behind the stacks"],
  ["back", "Far end"],
  ["left", "Left side"],
  ["right", "Right side"],
  ["ceiling", "Ceiling"],
];
const SUB_PLACEMENTS: [SubPlacement, string][] = [
  ["stacks", "Subs in the stacks"],
  ["center", "Center pair"],
  ["single", "One center sub"],
];

interface Props {
  planner: CoverageInputs;
}

const hz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} kHz` : `${Math.round(f)} Hz`;

/** The height the map may take: on phones, half the screen, so it stays in view above the open settings sheet. */
function useMapMaxHeight() {
  const read = () =>
    typeof window === "undefined"
      ? 640
      : window.innerWidth < 768
        ? Math.max(260, window.innerHeight * 0.5 - 40)
        : Math.max(420, Math.min(760, window.innerHeight * 0.8));
  const [h, setH] = useState(read);
  useEffect(() => {
    const on = () => setH(read());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return h;
}

/** Audience coverage: both stacks on a floor plan, level against the target across the room, and the listener's response. */
export function CoveragePage({ planner }: Props) {
  const state = useCoverageLayout();
  const { layout } = state;
  const { room } = layout;
  const [dragging, setDragging] = useState(false);
  const map = useCoverageMap(planner, layout, dragging);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<CoverageTab>("band");
  const tabClass = (t: CoverageTab) => (tab === t ? "" : "max-md:hidden");
  const maxHeight = useMapMaxHeight();
  const freqId = useId();

  const rel = map.listenerDb != null ? map.listenerDb - map.target : null;
  const relClass =
    rel == null
      ? ""
      : rel >= -3
        ? "text-green-700"
        : rel >= -6
          ? "text-orange-700"
          : "text-red-700";
  const bandName =
    layout.band === "one"
      ? `${hz(layout.freqHz)}, one frequency`
      : `${COVERAGE_BANDS[layout.band].name} band, ${hz(COVERAGE_BANDS[layout.band].lo)}–${hz(COVERAGE_BANDS[layout.band].hi)}`;
  const [left, right] = layout.stacks;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const logPos = (f: number) =>
    Math.round(
      (Math.log(f / SINGLE_FREQ_RANGE[0]) / Math.log(SINGLE_FREQ_RANGE[1] / SINGLE_FREQ_RANGE[0])) *
        1000,
    );
  const fromPos = (p: number) =>
    Math.round(
      SINGLE_FREQ_RANGE[0] * Math.pow(SINGLE_FREQ_RANGE[1] / SINGLE_FREQ_RANGE[0], p / 1000),
    );
  const label = "text-sm text-stone-500 mb-1";

  return (
    <main
      className={`max-w-6xl mx-auto px-4 md:px-8 pb-16 grid ${sheetOpen ? "max-md:pb-[52dvh]" : "max-md:pb-24"} grid-cols-1 md:grid-cols-5 gap-8`}
      style={{ fontFamily: "var(--font)" }}
    >
      <div className="min-w-0 md:col-span-3 flex flex-col gap-5">
        <section>
          <SectionHeading className="mb-1">Audience coverage</SectionHeading>
          <p className="text-sm text-stone-500 mb-3">
            {bandName},{" "}
            {layout.levelMode === "listener" ? "target at the listener" : "at full output"}
            {map.isRefining ? " · updating…" : ""}. Drag a stack to move it, its dot to toe it in,
            or the listener (tap the floor to put them there).
          </p>
          {map.stack && map.levels ? (
            <CoverageMap
              view={map.view}
              layout={layout}
              actions={state}
              boxes={map.boxes}
              stack={map.stack}
              onDragChange={setDragging}
              maxHeight={maxHeight}
            />
          ) : (
            <Notice>
              The map needs the mid-bass driver's T/S parameters and the horn's coverage angles.
              Pick a mid and horn that have them on the Design page.
            </Notice>
          )}
          {map.error && <Notice>The map couldn't be computed: {map.error}</Notice>}
          {map.stack && !planner.hornModel && (
            <Notice>
              The compression driver has no sensitivity or power rating, so the horn is left out of
              the map.
            </Notice>
          )}
          {map.stack && !planner.subModelled && (
            <Notice>
              The sub can't be modelled for this design, so it is left out of the map.
            </Notice>
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
                <b className="text-stone-900">{pct(map.stats.within6)}</b> ≥ −6 dB
              </span>
            </div>
          )}
        </section>
        <section className="text-sm text-stone-500 max-w-prose">
          <h3 className="text-stone-900 font-semibold mb-1">How it's modelled</h3>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>
              Each stack is this design: sub, mid and horn at their heights, through the crossovers
              ({crossoverSlopeName(planner.stackGeometry?.orderLo)} and{" "}
              {crossoverSlopeName(planner.stackGeometry?.orderHi)}), time-aligned on the horn axis.
            </li>
            <li>
              The system plays at its limit with the Design page's music balance: the mid band{" "}
              {planner.midBandTiltDb} dB under the sub, the horn {planner.hornBandTiltDb} dB under
              the mid. The band with the least to spare sets the level and the others are turned
              down to match. The target follows the same balance.
            </li>
            <li>
              Sub and mid radiate as pistons; the horn holds its coverage above its control
              frequency and widens below it.
            </li>
            <li>
              The planner's sub and mid levels are measured on the floor, so the map takes the floor
              out of them (below the baffle step) and adds it back as a reflection from each box's
              real height. A full dance floor soaks up the floor bounce above about 200 Hz. The air
              absorbs the highs along every path (20 °C, 50 % humidity).
            </li>
            <li>
              Indoors the room is a box with flat sides, each side and the ceiling of its own
              material. Below {MODAL_HZ[0]}–{MODAL_HZ[1]} Hz (lower in big, dead rooms) the map sums
              the room's modes, so it shows the peaks and nulls of the room's resonances; the walls'
              and ceiling's first and second reflections are as their materials reflect.
            </li>
            <li>
              Above that, each wall and the ceiling adds one reflection of every box, less what its
              material absorbs at that frequency, and the rest of the room's sound comes back as an
              even reverberant field, from the materials, the crowd and the room's size. The two
              methods blend over half an octave.
            </li>
            <li>
              Below 500 Hz the direct sound and reflections add with phase, so the stacks interfere.
              Above it, a band average adds them by power, since their comb filtering averages out
              across a band.
            </li>
            <li>
              Left out: rooms that aren't rectangular, balconies and pillars, sound bending around
              the people in front of you, and each driver's measured directivity. The modes take
              every side as solid: with an open side they are only a rough guide.
            </li>
            <li>
              The target is the planner's {LISTENER_TARGET_DB} dB at the listener in the sub band (
              {map.target} dB in this band).
            </li>
          </ul>
          <div className="mt-3">
            <CoverageAssumptions room={room} />
          </div>
        </section>
      </div>

      <aside
        className="min-w-0 md:col-span-2 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:bg-stone-50 max-md:border-t max-md:border-stone-300 max-md:rounded-t-lg max-md:shadow-sheet"
        aria-label="Coverage settings"
      >
        <div className="md:hidden flex gap-1 px-3 pt-2 pb-2" role="tablist">
          {TABS.map(([t, name]) => (
            <button
              key={t}
              role="tab"
              aria-selected={sheetOpen && tab === t}
              onClick={() => {
                if (sheetOpen && tab === t) setSheetOpen(false);
                else {
                  setTab(t);
                  setSheetOpen(true);
                }
              }}
              className={`flex-1 px-2 py-2 rounded border text-sm ${sheetOpen && tab === t ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-300 bg-stone-50"}`}
            >
              {name}
            </button>
          ))}
          {sheetOpen && (
            <button
              onClick={() => setSheetOpen(false)}
              aria-label="Close settings"
              className="px-3 rounded border border-stone-300 bg-stone-50 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <div
          className={`flex flex-col gap-6 max-md:gap-0 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pt-1 max-md:pb-4 max-md:max-h-[45dvh] ${sheetOpen ? "" : "max-md:hidden"}`}
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
                    [pct(map.stats.within6), "of the floor ≥ −6 dB"],
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
                  fmax={20000}
                  H={240}
                  yLabel="dB SPL at the listener"
                  series={[
                    {
                      curve: map.response,
                      label: "Listener",
                      stroke: PAL.ink,
                      tint: PAL.alpha(PAL.ink, 0.05),
                    },
                    {
                      curve: map.targetCurve,
                      label: "Target, music balance",
                      stroke: PAL.magenta,
                      tint: PAL.alpha(PAL.magenta, 0),
                    },
                  ]}
                  span={
                    layout.band === "one"
                      ? undefined
                      : { lo: COVERAGE_BANDS[layout.band].lo, hi: COVERAGE_BANDS[layout.band].hi }
                  }
                  marks={
                    layout.band === "one" ? [{ f: layout.freqHz, label: hz(layout.freqHz) }] : []
                  }
                />
              </div>
            )}
          </div>

          <div className={tabClass("band")}>
            <div className={label}>System level</div>
            <div className="flex flex-wrap gap-1 mb-1">
              <ToggleButton
                on={layout.levelMode === "listener"}
                onClick={() => state.setLevelMode("listener")}
              >
                Target at the listener
              </ToggleButton>
              <ToggleButton
                on={layout.levelMode === "limit"}
                onClick={() => state.setLevelMode("limit")}
              >
                At its limit
              </ToggleButton>
            </div>
            <p className="text-xs text-stone-500 mb-4">
              {layout.levelMode === "listener"
                ? map.gain < 0
                  ? `Turned down ${Math.abs(map.gain).toFixed(1)} dB so the listener gets the target: the map shows how even the coverage is.`
                  : "It can't reach the target at the listener, so it plays at its limit."
                : "Full output: the map shows how far the target reaches."}
            </p>
            <div className={label}>Band</div>
            <div className="flex flex-wrap gap-1">
              {NAMED_BANDS.map((b) => (
                <ToggleButton key={b} on={layout.band === b} onClick={() => state.setBand(b)}>
                  {COVERAGE_BANDS[b].name}{" "}
                  <span className="text-xs opacity-70">
                    {hz(COVERAGE_BANDS[b].lo)}–{hz(COVERAGE_BANDS[b].hi)}
                  </span>
                </ToggleButton>
              ))}
              <ToggleButton on={layout.band === "one"} onClick={() => state.setBand("one")}>
                One frequency
              </ToggleButton>
            </div>
            {layout.band === "one" && (
              <div className="mt-3">
                <div className="flex justify-between items-center gap-3 mb-1">
                  <label htmlFor={freqId} className="text-sm text-stone-500">
                    Frequency
                  </label>
                  <span className="text-sm tabular-nums font-medium">{hz(layout.freqHz)}</span>
                </div>
                <input
                  id={freqId}
                  type="range"
                  min={0}
                  max={1000}
                  step={1}
                  value={logPos(layout.freqHz)}
                  aria-valuetext={hz(layout.freqHz)}
                  onChange={(e) => state.setFreqHz(fromPos(parseFloat(e.target.value)))}
                  className="w-full accent-stone-900"
                />
                <p className="text-xs text-stone-500 mt-1">
                  One frequency adds everything with phase: the interference between the stacks
                  shows plainly. Up to {SINGLE_FREQ_RANGE[1]} Hz; above that it's finer than the
                  map.
                </p>
              </div>
            )}
          </div>

          <div className={tabClass("room")}>
            <div className={label}>Room</div>
            <div className="flex gap-1 mb-3">
              <ToggleButton on={!room.outdoors} onClick={() => state.setOutdoors(false)}>
                Indoors
              </ToggleButton>
              <ToggleButton on={room.outdoors} onClick={() => state.setOutdoors(true)}>
                Outdoors
              </ToggleButton>
            </div>
            <Slider
              label={room.outdoors ? "Area width" : "Width"}
              value={room.widthFt}
              min={ROOM_WIDTH_FT[0]}
              max={ROOM_WIDTH_FT[1]}
              step={1}
              unit=" ft"
              onChange={(widthFt) => state.setRoomSize({ widthFt, lengthFt: room.lengthFt })}
            />
            <Slider
              label={room.outdoors ? "Area length" : "Length"}
              value={room.lengthFt}
              min={ROOM_LENGTH_FT[0]}
              max={ROOM_LENGTH_FT[1]}
              step={1}
              unit=" ft"
              onChange={(lengthFt) => state.setRoomSize({ widthFt: room.widthFt, lengthFt })}
            />
            {!room.outdoors && (
              <>
                <Slider
                  label="Ceiling height"
                  value={room.ceilingFt}
                  min={ROOM_CEILING_FT[0]}
                  max={ROOM_CEILING_FT[1]}
                  step={1}
                  unit=" ft"
                  onChange={state.setCeilingFt}
                />
                <div className="grid grid-cols-2 gap-x-3">
                  {SURFACES.map(([surface, name]) => (
                    <SelectField
                      key={surface}
                      label={name}
                      options={ROOM_MATERIAL_OPTIONS}
                      value={ROOM_MATERIAL_OPTIONS.find((o) => o.id === room.materials[surface])}
                      onChange={(o) => state.setMaterial(surface, o.id)}
                    />
                  ))}
                </div>
              </>
            )}
            <div className={label}>Dance floor</div>
            <div className="flex gap-1">
              <ToggleButton on={room.crowd === "empty"} onClick={() => state.setCrowd("empty")}>
                Empty
              </ToggleButton>
              <ToggleButton on={room.crowd === "full"} onClick={() => state.setCrowd("full")}>
                Full
              </ToggleButton>
            </div>
          </div>

          <div className={tabClass("stacks")}>
            <div className={label}>Stacks</div>
            <div className="flex flex-wrap gap-1 mb-3">
              {SUB_PLACEMENTS.map(([subs, name]) => (
                <ToggleButton
                  key={subs}
                  on={map.subs === subs}
                  onClick={() => state.setSubs(subs)}
                  disabled={subs !== "stacks" && !map.levels?.sub}
                >
                  {name}
                </ToggleButton>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              <ToggleButton on={layout.mirror} onClick={() => state.setMirror(!layout.mirror)}>
                Move the pair as a mirror image
              </ToggleButton>
            </div>
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
        </div>
      </aside>
    </main>
  );
}
