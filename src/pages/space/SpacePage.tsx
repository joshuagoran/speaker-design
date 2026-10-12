import { useEffect, useState } from "react";
import type { SpeakerSpec } from "../../types";
import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TextField } from "../../components/ui/TextField";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { Slider } from "../../components/ui/Slider";
import { Notice } from "../../components/ui/Notice";
import { CoverageBandPicker } from "../../components/ui/CoverageBandPicker";
import { RoomFields } from "../../components/ui/RoomFields";
import { CoverageMap, type MapBox } from "../../components/charts/CoverageMap";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { SpaceSide } from "../../components/drawings/SpaceSide";
import { COVERAGE_BANDS, SINGLE_FREQ_RANGE } from "../../lib/pa/coverage";
import { driverPattern } from "../../lib/speaker/spaceCoverage";
import { speakerLayout } from "../../lib/speaker/speakerLayout";
import { keysOf } from "../../lib/records";
import { formatHz, formatSigned } from "../../lib/format";
import { RESULT_MAX_WIDTH, READING_WIDTH } from "../../styles/layout";
import { FREQ_AXIS_MAX_HZ } from "../../constants/chartScales";
import { COVERAGE_EDGE_DB, COVERAGE_TARGET_DB } from "../../constants/coverageLevel";
import {
  SPACE_SETTINGS_SECTIONS,
  type SpaceSettingsSection,
} from "../../constants/settingsSections";
import { SPACE_TEXT } from "../../constants/space";
import { FRONT_END_KIND } from "../../constants/speakerSpec";
import { isSavedSpeaker, type Designer } from "../designer/useDesigner";
import { paPlannerDesign } from "../designer/DesignerPage";
import { stackFromSaved } from "../stack/stackSaves";
import type { StackPlanner } from "../stack/useStack";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import { PlacementSettings } from "./PlacementSettings";
import { HardwareSettings } from "./HardwareSettings";
import { emptySpace, itemName } from "./spaceSaves";
import { spaceFromPa, type SpacePlanner } from "./useSpace";

interface Props {
  space: SpacePlanner;
  /** the stack library: the Stack page's store */
  stack: Pick<StackPlanner, "store">;
  /** the speaker library: the Designer's store */
  designer: Pick<Designer, "store">;
  planner: PaPlanner;
}

/** The height the map may take: on phones, half the screen; from md up, most of it. */
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

/** A share as a whole percentage. */
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** How a level compares with the target: the status color's text class. */
const relClass = (rel: number) =>
  rel >= -3 ? "text-green-700" : rel >= COVERAGE_EDGE_DB ? "text-orange-700" : "text-red-700";

/**
 * The Space page (docs/speaker-designer-plan.md, L4b): stacks and speakers placed in a room, each at its spot, lift and
 * aim, a mirror pair following its partner; the hardware that drives them; the coverage across the floor on the fixed
 * scale, the levels at the listening area, a side view of the heights and tilts, and the response at the listener.
 */
export function SpacePage({ space, stack, designer, planner }: Props) {
  const pal = usePalette();
  const { design, model, view, stats } = space;
  const { venue, placements, name } = design.space;
  const folds = useFolds("space.settingsFolds", keysOf(SPACE_SETTINGS_SECTIONS));
  const maxHeight = useMapMaxHeight();
  /** the libraries, as the pickers list them */
  const stacks = (stack.store.saved ?? []).flatMap((c) => {
    const saved = stackFromSaved(c);
    return saved ? [{ id: c.id, name: c.name, saved }] : [];
  });
  const speakers = (designer.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    return isSavedSpeaker(saved) ? [{ id: c.id, name: c.name, spec: saved }] : [];
  });
  const [stackPick, setStackPick] = useState("");
  const [speakerPick, setSpeakerPick] = useState("");
  const pickedStack = stacks.find((o) => o.id === stackPick) ?? stacks[0];
  const pickedSpeaker = speakers.find((o) => o.id === speakerPick) ?? speakers[0];
  /** each placement's name: its number and what it places */
  const names = placements.map((p, k) => `${k + 1}. ${itemName(design, p.item)}`);
  const boxes: MapBox[] = model.placements.map(({ item }, k) => {
    const sizes = item.boxes.map((b) => speakerLayout(b.speaker.cabinet).size);
    const horn = item.drivers.map(driverPattern).find((p) => p.horn)?.horn;
    return {
      x: item.placement.x,
      y: item.placement.y,
      aim: item.placement.aim.yawDeg,
      label: String(k + 1),
      footprint: {
        w: Math.max(0, ...sizes.map((s) => s.w)),
        d: Math.max(0, ...sizes.map((s) => s.d)),
      },
      covH: horn ? horn.covH : null,
      turnable: true,
    };
  });
  const bandName =
    space.band === "one"
      ? `${formatHz(space.freqHz)}, one frequency`
      : `${COVERAGE_BANDS[space.band].name} band, ${formatHz(COVERAGE_BANDS[space.band].lo)}–${formatHz(COVERAGE_BANDS[space.band].hi)}`;
  const listenerRel =
    space.listenerDb !== null && view ? space.listenerDb - view.target - view.gain : null;
  const areaDb = view && view.atLimit !== null ? view.atLimit + view.gain : null;
  const tiles: StatTileItem[] = [
    ...(areaDb !== null
      ? [[SPACE_TEXT.areaAverage, areaDb.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(view && view.atLimit !== null
      ? [[SPACE_TEXT.areaMax, view.atLimit.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(space.listenerDb !== null
      ? [[SPACE_TEXT.listener, space.listenerDb.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(stats
      ? ([
          [SPACE_TEXT.within3, pct(stats.within3)],
          [SPACE_TEXT.within6, pct(stats.within6)],
          [SPACE_TEXT.spread, stats.spread.toFixed(1), "dB"],
        ] satisfies StatTileItem[])
      : []),
  ];
  const summaries: Record<SpaceSettingsSection, string> = {
    space: `${name} · ${placements.length} placement${placements.length === 1 ? "" : "s"}`,
    room: `${venue.room.outdoors ? SPACE_TEXT.outdoors : `${venue.room.widthFt} × ${venue.room.lengthFt} × ${venue.room.ceilingFt} ft`} · ${venue.targetDb} dB target`,
    placements: names.join(" · ") || SPACE_TEXT.noPlacements,
    hardware:
      `${design.space.amps.length} amp${design.space.amps.length === 1 ? "" : "s"} · ` +
      `${placements.reduce((n, p) => n + p.channels.length, 0)} channels · ` +
      `${design.space.frontEnd ? (design.space.frontEnd.kind === FRONT_END_KIND.digital ? "DSP" : "analog") : "no front end"}`,
  };
  const section = (id: SpaceSettingsSection, children: React.ReactNode) => (
    <SettingsSection
      id={id}
      title={SPACE_SETTINGS_SECTIONS[id]}
      folds={folds}
      summary={summaries[id]}
    >
      {children}
    </SettingsSection>
  );
  const { area } = venue;
  return (
    <SettingsLayout
      results={
        <>
          <SavedConfigs
            bare
            store={space.store}
            snapshot={space.snapshot}
            restore={space.restore}
            saveName={name}
            manage
          />
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-1">{SPACE_TEXT.coverage}</SectionHeading>
            <p className="text-sm text-stone-500 mb-3">
              {bandName}, {venue.targetDb} dB target at the listening area (dashed).{" "}
              {SPACE_TEXT.mapHint}
            </p>
            {placements.length === 0 ? (
              <Notice>{SPACE_TEXT.noPlacements}</Notice>
            ) : (
              <CoverageMap
                view={view}
                room={venue.room}
                listener={venue.listener}
                area={area}
                boxes={boxes}
                actions={{
                  moveBox: space.movePlacement,
                  aimBox: space.aimPlacement,
                  moveListener: space.moveListener,
                }}
                busy={space.isPending}
                maxHeight={maxHeight}
              />
            )}
            {space.error && <Notice>Map failed: {space.error}</Notice>}
            {model.missing && <Notice>{SPACE_TEXT.missing}</Notice>}
            {model.unassigned && <Notice>{SPACE_TEXT.noChannel}</Notice>}
            <div className="mt-3">
              <CoverageBandPicker
                band={space.band}
                freqHz={space.freqHz}
                onBand={space.setBand}
                onFreqHz={space.setFreqHz}
                oneNote={SPACE_TEXT.oneNote(SINGLE_FREQ_RANGE[1])}
              />
            </div>
          </section>
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">{SPACE_TEXT.levels}</SectionHeading>
            {tiles.length > 0 && <StatTileGrid tiles={tiles} className="mb-2" />}
            {view && (
              <p className="text-sm text-stone-500 tabular-nums">
                {view.atLimit !== null && view.atLimit < venue.targetDb - 0.05
                  ? SPACE_TEXT.cannotReach(venue.targetDb, view.atLimit)
                  : SPACE_TEXT.turnedDown(-view.gain, venue.targetDb)}
                {listenerRel !== null && (
                  <>
                    {" "}
                    {SPACE_TEXT.listenerVs}{" "}
                    <span className={relClass(listenerRel)}>{formatSigned(listenerRel)} dB</span>.
                  </>
                )}
              </p>
            )}
          </section>
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">{SPACE_TEXT.side}</SectionHeading>
            <Card>
              <SpaceSide
                items={model.placements.map((p) => p.item)}
                room={venue.room}
                listener={venue.listener}
                earFt={venue.earFt}
                area={area}
              />
              <p className="text-xs text-stone-500 mt-2">{SPACE_TEXT.sideNote}</p>
            </Card>
          </section>
          {space.response.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
              <SectionHeading className="mb-3">{SPACE_TEXT.response}</SectionHeading>
              <ResponseChart
                fmax={FREQ_AXIS_MAX_HZ}
                H={240}
                yLabel={SPACE_TEXT.responseY}
                series={[
                  {
                    curve: space.response,
                    label: SPACE_TEXT.listener,
                    stroke: pal.ink,
                    tint: alpha(pal.ink, 0.05),
                  },
                ]}
                span={
                  space.band === "one"
                    ? undefined
                    : { lo: COVERAGE_BANDS[space.band].lo, hi: COVERAGE_BANDS[space.band].hi }
                }
                marks={
                  space.band === "one" ? [{ f: space.freqHz, label: formatHz(space.freqHz) }] : []
                }
              />
            </section>
          )}
          <p className={`${READING_WIDTH} text-sm text-stone-500 mt-5`}>{SPACE_TEXT.modelNote}</p>
        </>
      }
      settings={
        <SettingsColumn folds={folds}>
          {section(
            "space",
            <>
              <TextField label="Name" value={name} maxLength={60} onChange={space.setName} />
              <div className="flex flex-wrap gap-2 mb-2">
                <Button onClick={() => space.setDesign(spaceFromPa(paPlannerDesign(planner)))}>
                  {SPACE_TEXT.fromPa}
                </Button>
                <Button onClick={() => space.setDesign(emptySpace())}>{SPACE_TEXT.clear}</Button>
              </div>
              <p className="text-xs text-stone-500 mb-2">{SPACE_TEXT.fromPaHint}</p>
            </>,
          )}
          {section(
            "room",
            <>
              <RoomFields room={venue.room} actions={space.room} />
              <Slider
                label={SPACE_TEXT.target}
                value={venue.targetDb}
                min={COVERAGE_TARGET_DB[0]}
                max={COVERAGE_TARGET_DB[1]}
                step={1}
                unit=" dB SPL"
                onChange={(targetDb) => space.editVenue((v) => ({ ...v, targetDb }))}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-3 mb-3">
                <NumberField
                  label={SPACE_TEXT.areaCenter}
                  value={area.y}
                  min={0}
                  max={venue.room.lengthFt}
                  step={0.5}
                  onChange={(y) => space.editVenue((v) => ({ ...v, area: { ...v.area, y } }))}
                />
                <NumberField
                  label={SPACE_TEXT.areaWidth}
                  value={area.widthFt}
                  min={1}
                  max={venue.room.widthFt}
                  step={1}
                  onChange={(widthFt) =>
                    space.editVenue((v) => ({ ...v, area: { ...v.area, widthFt } }))
                  }
                />
                <NumberField
                  label={SPACE_TEXT.areaLength}
                  value={area.lengthFt}
                  min={1}
                  max={venue.room.lengthFt}
                  step={1}
                  onChange={(lengthFt) =>
                    space.editVenue((v) => ({ ...v, area: { ...v.area, lengthFt } }))
                  }
                />
                <NumberField
                  label={SPACE_TEXT.ear}
                  value={venue.earFt}
                  min={1}
                  max={8}
                  step={0.1}
                  onChange={(earFt) => space.editVenue((v) => ({ ...v, earFt }))}
                />
              </div>
              <p className="text-xs text-stone-500 mb-2">{SPACE_TEXT.listenerHint}</p>
            </>,
          )}
          {section(
            "placements",
            <>
              {placements.map((p, k) => (
                <PlacementSettings
                  key={k}
                  index={k}
                  placement={p}
                  names={names}
                  onEdit={(edit) => space.editPlacement(k, edit)}
                  onRemove={() => space.removePlacement(k)}
                  onMirrorPair={() => space.addMirrorPair(k)}
                />
              ))}
              {pickedStack && (
                <>
                  <SelectField
                    label={SPACE_TEXT.savedStack}
                    options={stacks}
                    value={pickedStack}
                    onChange={(o) => setStackPick(o.id)}
                  />
                  <Button
                    className="mb-3"
                    onClick={() =>
                      space.addStack({
                        ...pickedStack.saved,
                        stack: { ...pickedStack.saved.stack, id: pickedStack.id },
                      })
                    }
                  >
                    {SPACE_TEXT.addStack}
                  </Button>
                </>
              )}
              {pickedSpeaker && (
                <>
                  <SelectField
                    label={SPACE_TEXT.savedSpeaker}
                    options={speakers}
                    value={pickedSpeaker}
                    onChange={(o) => setSpeakerPick(o.id)}
                  />
                  <Button
                    className="mb-3"
                    onClick={() => {
                      const speaker: SpeakerSpec = {
                        ...pickedSpeaker.spec,
                        id: pickedSpeaker.id,
                        name: pickedSpeaker.name,
                      };
                      space.addSpeaker(speaker);
                    }}
                  >
                    {SPACE_TEXT.addSpeaker}
                  </Button>
                </>
              )}
              {!pickedStack && !pickedSpeaker && (
                <p className="text-xs text-stone-500 mb-2">{SPACE_TEXT.noLibrary}</p>
              )}
            </>,
          )}
          {section("hardware", <HardwareSettings design={design} names={names} space={space} />)}
        </SettingsColumn>
      }
    />
  );
}
