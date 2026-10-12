import { useState } from "react";
import type { SpeakerSpec } from "../../types";
import { alpha } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useMapMaxHeight } from "../../hooks/useMapMaxHeight";
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
import { entriesOf, keysOf } from "../../lib/records";
import { formatHz, formatSigned } from "../../lib/format";
import { RESULT_MAX_WIDTH, READING_WIDTH } from "../../styles/layout";
import { FREQ_AXIS_MAX_HZ } from "../../constants/chartScales";
import {
  COVERAGE_EDGE_DB,
  COVERAGE_LEVEL_REF_PLACE,
  COVERAGE_LEVEL_REFS,
  COVERAGE_TARGET_DB,
} from "../../constants/coverageLevel";
import { AUTO_BALANCE_MODE_LABEL } from "../../constants/autoBalance";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  SPACE_SETTINGS_SECTIONS,
  type SpaceSettingsSection,
} from "../../constants/settingsSections";
import { FRONT_END_NAMES, NO_FRONT_END, SPACE_TEXT } from "../../constants/space";
import { isSavedSpeaker, type SpeakerPageState } from "../speaker/useSpeakerPage";
import { paPlannerDesign } from "../speaker/SpeakerPage";
import { stackFromSaved } from "../stack/stackSaves";
import type { StackPlanner } from "../stack/useStack";
import type { PaPlanner } from "../pa-stack/hooks/usePaPlanner";
import { PlacementSettings } from "./PlacementSettings";
import { HardwareSettings } from "./HardwareSettings";
import { emptySpace, itemName } from "./spaceSaves";
import { spaceFromStart, type SpacePlanner } from "./useSpace";
import { STACK_STARTS, startGroup } from "../stack/stackPresets";
import { STACK_START, STACK_START_NAMES, type StackStart } from "../../constants/stackPresets";
import { SPEAKER_START_TEXT } from "../../constants/speakerStarts";
import { byId } from "../../lib/tables";

interface Props {
  space: SpacePlanner;
  /** the stack library: the Stack page's store */
  stack: Pick<StackPlanner, "store">;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store">;
  planner: PaPlanner;
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
export function SpacePage({ space, stack, speakerPage, planner }: Props) {
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
  const speakers = (speakerPage.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    return isSavedSpeaker(saved) ? [{ id: c.id, name: c.name, spec: saved }] : [];
  });
  const startOptions = STACK_STARTS.map((id) => ({
    id,
    name: STACK_START_NAMES[id],
    group: startGroup(id),
  }));
  const [start, setStart] = useState<StackStart>(STACK_START.paStack);
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
  const listenerRel = space.listenerDb !== null ? space.listenerDb - space.target : null;
  const { areaDb, areaAtLimit } = space;
  const tiles: StatTileItem[] = [
    ...(areaDb !== null
      ? [[SPACE_TEXT.areaAverage, areaDb.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(areaAtLimit !== null
      ? [[SPACE_TEXT.areaMax, areaAtLimit.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(space.listenerDb !== null
      ? [[SPACE_TEXT.listener, space.listenerDb.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(stats
      ? ([
          [SPACE_TEXT.areaAtLeast(formatSigned(-3, 0)), pct(stats.within3)],
          [SPACE_TEXT.areaAtLeast(formatSigned(COVERAGE_EDGE_DB, 0)), pct(stats.within6)],
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
      `${SPACE_TEXT.frontEnd}: ${FRONT_END_NAMES[design.space.frontEnd?.kind ?? NO_FRONT_END]}`,
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
  /** where the target is measured, in a sentence */
  const refPlace = COVERAGE_LEVEL_REF_PLACE[space.levelRef];
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
              {SPACE_TEXT.mapCaption(bandName, space.target.toFixed(0), refPlace)}{" "}
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
          {placements.length > 0 && (
            <>
              <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
                <SectionHeading className="mb-3">{SPACE_TEXT.levels}</SectionHeading>
                {tiles.length > 0 && <StatTileGrid tiles={tiles} className="mb-2" />}
                {view && (
                  <p className="text-sm text-stone-500 tabular-nums">
                    {view.atLimit !== null && view.atLimit < space.target - 0.05
                      ? SPACE_TEXT.cannotReach(refPlace, space.target, view.atLimit)
                      : SPACE_TEXT.turnedDown(-view.gain, refPlace, space.target)}
                    {listenerRel !== null && (
                      <>
                        {" "}
                        {SPACE_TEXT.listenerVs}{" "}
                        <span className={relClass(listenerRel)}>
                          {formatSigned(listenerRel)} dB
                        </span>
                        .
                      </>
                    )}
                  </p>
                )}
                {space.bandLevels.length > 0 && (
                  <p className="text-sm text-stone-500 tabular-nums mt-2">
                    {SPACE_TEXT.bandLevels}{" "}
                    {space.bandLevels.map((b, k) => (
                      <span key={b.band} className={relClass(b.db - b.target)}>
                        {SPACE_TEXT.bandLevel(
                          COVERAGE_BANDS[b.band].name,
                          b.db.toFixed(1),
                          b.target.toFixed(0),
                        )}
                        {k < space.bandLevels.length - 1 ? ", " : "."}
                      </span>
                    ))}
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
            </>
          )}
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
                  {
                    curve: space.targetCurve,
                    label: SPACE_TEXT.targetCurve,
                    stroke: pal.magenta,
                    tint: alpha(pal.magenta, 0),
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
              <SelectField
                label={SPEAKER_START_TEXT.startFrom}
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(o.id)}
                group={(o) => o.group}
              />
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  onClick={() => space.setDesign(spaceFromStart(start, paPlannerDesign(planner)))}
                >
                  {SPEAKER_START_TEXT.startOver}
                </Button>
                <Button onClick={() => space.setDesign(emptySpace())}>{SPACE_TEXT.clear}</Button>
              </div>
              <p className="text-xs text-stone-500 mb-2">{SPACE_TEXT.startHint}</p>
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
              <ToggleGroup
                label={SPACE_TEXT.measuredAt}
                className="mb-3"
                value={space.levelRef}
                onChange={(levelRef) => space.editVenue((v) => ({ ...v, levelRef }))}
                options={COVERAGE_LEVEL_REFS}
              />
              <ToggleGroup
                label={<Tooltip tip={SPACE_TEXT.balanceTip}>{SPACE_TEXT.balance}</Tooltip>}
                className="mb-3"
                value={space.balance}
                onChange={(balance) => space.editVenue((v) => ({ ...v, balance }))}
                options={entriesOf(AUTO_BALANCE_MODE_LABEL)}
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
                  room={venue.room}
                  onEdit={(edit) => space.editPlacement(k, edit)}
                  onFollows={(follows) => space.setFollows(k, follows)}
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
