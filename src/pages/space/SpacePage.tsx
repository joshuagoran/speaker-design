import { useEffect, useState } from "react";
import { alpha, TARGET_DASH } from "../../styles/palette";
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
import { StartPicker } from "../../components/ui/StartPicker";
import { Slider } from "../../components/ui/Slider";
import { Notice } from "../../components/ui/Notice";
import { CoverageBandPicker } from "../../components/ui/CoverageBandPicker";
import { RoomFields } from "../../components/ui/RoomFields";
import { CoverageMap, type MapBox } from "../../components/charts/CoverageMap";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { SavedConfigs } from "../../components/saved-configs/SavedConfigs";
import { SpaceSide } from "../../components/drawings/SpaceSide";
import { COVERAGE_BANDS } from "../../lib/pa/coverage";
import { driverPattern } from "../../lib/speaker/spaceCoverage";
import { speakerLayout } from "../../lib/speaker/speakerLayout";
import { entriesOf, keysOf } from "../../lib/records";
import { formatHz, formatSigned } from "../../lib/format";
import { MD_UP, RESULT_MAX_WIDTH, READING_WIDTH } from "../../styles/layout";
import { FREQ_AXIS_MAX_HZ } from "../../constants/chartScales";
import { COVERAGE_EDGE_DB, COVERAGE_TARGET_DB } from "../../constants/coverageLevel";
import { AUTO_BALANCE_MODE_LABEL, AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import { BAND_BALANCE_TIP } from "../../lib/speaker/autoBalance";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  SPACE_SETTINGS_SECTIONS,
  type SpaceSettingsSection,
} from "../../constants/settingsSections";
import {
  NO_DELAY_MS,
  placementDomId,
  SPACE_LEVEL_REF_PLACE,
  SPACE_LEFT_WALL_TIP,
  SPACE_LEVEL_REFS,
  SPACE_SURFACE_NAMES,
  SPACE_TEXT,
} from "../../constants/space";
import { isSavedSpeaker, type SpeakerPageState } from "../speaker/useSpeakerPage";
import { stackFromSaved } from "../stack/stackSaves";
import type { StackPlanner } from "../stack/useStack";
import { PlacementSettings } from "./PlacementSettings";
import { HardwareSettings } from "./HardwareSettings";
import { SpaceAssumptions } from "./SpaceAssumptions";
import { emptySpace, itemName } from "./spaceSaves";
import { spaceFromStart, type SpacePlanner } from "./useSpace";
import { placeOptions } from "./placeOptions";
import { STACK_PRESETS } from "../stack/stackPresets";
import {
  STACK_PRESET,
  STACK_START_GROUPS,
  STACK_START_NAMES,
  type StackPreset,
} from "../../constants/stackPresets";
import { byId } from "../../lib/tables";
import { spaceAlignment } from "../../lib/speaker/spaceAlignment";
import { ampPowerGroups } from "../../lib/speaker/spaceHardware";

interface Props {
  space: SpacePlanner;
  /** the stack library: the Stack page's store */
  stack: Pick<StackPlanner, "store" | "design">;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store" | "spec">;
}

/** A share as a whole percentage. */
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** How a level compares with the target: the status color's text class. */
const relClass = (rel: number) =>
  rel >= -3 ? "text-green-700" : rel >= COVERAGE_EDGE_DB ? "text-orange-700" : "text-red-700";

/**
 * The Space page (docs/speaker-designer-plan.md, L4b): stacks and speakers placed in a room, each at its spot, lift and
 * aim, a mirrored pair as one placement; their amp power and alignment; the coverage across the floor on the fixed
 * scale, the levels at the reference, a side view of the heights and tilts, and the response at the listener.
 */
export function SpacePage({ space, stack, speakerPage }: Props) {
  const pal = usePalette();
  const { design, model, view, stats } = space;
  const { venue, placements, name } = design.space;
  const folds = useFolds("space.settingsFolds", keysOf(SPACE_SETTINGS_SECTIONS));
  const maxHeight = useMapMaxHeight();
  /** the libraries, as the Place list reads them (empty when signed out) */
  const stacks = (stack.store.saved ?? []).flatMap((c) => {
    const saved = stackFromSaved(c);
    return saved ? [{ id: c.id, name: c.name, design: saved }] : [];
  });
  const speakers = (speakerPage.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    return isSavedSpeaker(saved) ? [{ id: c.id, name: c.name, spec: saved }] : [];
  });
  /** signed in: the libraries are the person's (the stores hold a database) */
  const signedIn = Boolean(stack.store.db || speakerPage.store.db);
  const startOptions = STACK_PRESETS.map((id) => ({ id, name: STACK_START_NAMES[id] }));
  const [start, setStart] = useState<StackPreset>(STACK_PRESET.paStack);
  const placeList = placeOptions({
    openStack: stack.design,
    openSpeaker: speakerPage.spec,
    savedStacks: stacks,
    savedSpeakers: speakers,
  });
  const [placePick, setPlacePick] = useState("");
  /** the placement picked on the map (an index), and which placements show their controls: none at first */
  const [selected, setSelected] = useState<number | null>(null);
  const [openItems, setOpenItems] = useState<readonly number[]>([]);
  // the design replaced whole (a start, a clear, an opened save, another space): the numbers no longer mean the same
  // placements, so none is picked or open (reset while rendering, so no render holds a stale number)
  const designKey = `${space.replaced}:${design.space.id}`;
  const [seenKey, setSeenKey] = useState(designKey);
  if (seenKey !== designKey) {
    setSeenKey(designKey);
    setSelected(null);
    setOpenItems([]);
  }
  /** the placement to bring into view after the next render, and whether to scroll (a count tells repeats apart) */
  const [reveal, setReveal] = useState<{ k: number; scroll: boolean; n: number } | null>(null);
  /** picks placement `k`: opens its item (and the Placements section), and scrolls it into view when `scroll` */
  const pick = (k: number, scroll: boolean) => {
    setSelected(k);
    setOpenItems((o) => (o.includes(k) ? o : [...o, k]));
    if (!folds.open.placements) folds.toggle("placements");
    setReveal((r) => ({ k, scroll, n: (r?.n ?? 0) + 1 }));
  };
  // a pick on the map scrolls only where the settings are their own pane (md up): on a phone the page would jump away
  // from the map mid-drag
  const pickOnMap = (k: number) => pick(k, window.matchMedia(MD_UP).matches);
  /** a placement is new at the end of the list: opens it and brings it into view */
  const pickNew = () => pick(placements.length, true);
  useEffect(() => {
    if (reveal?.scroll)
      document.getElementById(placementDomId(reveal.k))?.scrollIntoView({ block: "start" });
  }, [reveal]);
  /** after placement `k` goes, the numbers above it move down one */
  const afterRemoved = (k: number) => {
    const shift = (i: number) => (i > k ? i - 1 : i);
    setOpenItems((o) => o.filter((i) => i !== k).map(shift));
    setSelected((s) => (s === null || s === k ? null : shift(s)));
  };
  const picked = byId(placeList, placePick) ?? placeList[0];
  /** each placement's name: its number and what it places */
  const names = placements.map((p, k) => `${k + 1}. ${itemName(design, p.item)}`);
  /** the boxes the map draws: a mirrored placement is two, labeled with its number and its side ("1L", "1R") */
  const boxes: MapBox[] = model.placements.map(({ item }) => {
    const sizes = item.boxes.map((b) => speakerLayout(b.speaker.cabinet).size);
    const horn = item.drivers.map(driverPattern).find((p) => p.horn)?.horn;
    return {
      x: item.placement.x,
      y: item.placement.y,
      aim: item.placement.aim.yawDeg,
      label: `${item.placement.source + 1}${item.placement.side ?? ""}`,
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
  const listenerRel = space.listenerDb !== null ? space.listenerDb - space.refTarget : null;
  const { audienceDb, audienceAtLimit } = space;
  const tiles: StatTileItem[] = [
    ...(audienceDb !== null
      ? [[SPACE_TEXT.audienceAverage, audienceDb.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(audienceAtLimit !== null
      ? [[SPACE_TEXT.audienceMax, audienceAtLimit.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(space.listenerDb !== null
      ? [[SPACE_TEXT.listener, space.listenerDb.toFixed(1), "dB"] satisfies StatTileItem]
      : []),
    ...(stats
      ? ([
          [SPACE_TEXT.floorAtLeast(formatSigned(-3, 0)), pct(stats.within3)],
          [SPACE_TEXT.floorAtLeast(formatSigned(COVERAGE_EDGE_DB, 0)), pct(stats.within6)],
          [SPACE_TEXT.spread, stats.spread.toFixed(1), "dB"],
        ] satisfies StatTileItem[])
      : []),
  ];
  const alignment = spaceAlignment(model);
  const powers = ampPowerGroups(design).reduce((n, s) => n + s.groups.length, 0);
  const delays = alignment.filter((r) => r.delayMs >= NO_DELAY_MS).length;
  const summaries: Record<SpaceSettingsSection, string> = {
    space: `${name} · ${placements.length} placement${placements.length === 1 ? "" : "s"}`,
    room: `${venue.room.outdoors ? SPACE_TEXT.outdoors : `${venue.room.widthFt} × ${venue.room.lengthFt} × ${venue.room.ceilingFt} ft`} · ${venue.targetDb} dB target`,
    placements: names.join(" · ") || SPACE_TEXT.noPlacements,
    hardware:
      `${powers} amp power${powers === 1 ? "" : "s"} · ` +
      `${delays} delay${delays === 1 ? "" : "s"}`,
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
  /** where the target is measured, in a sentence */
  const refPlace = SPACE_LEVEL_REF_PLACE[space.levelRef];
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
              {SPACE_TEXT.mapCaption(bandName, space.target.toFixed(0), refPlace)}
            </p>
            <CoverageMap
              view={view}
              room={venue.room}
              listener={venue.listener}
              boxes={boxes}
              selected={model.placements.flatMap((p, i) =>
                p.item.placement.source === selected ? [i] : [],
              )}
              onSelect={(i) => {
                const box = model.placements[i];
                if (box) pickOnMap(box.item.placement.source);
              }}
              actions={{
                moveBox: space.moveBox,
                aimBox: space.aimBox,
                moveListener: space.moveListener,
              }}
              busy={space.isPending}
              maxHeight={maxHeight}
              quiet={placements.length === 0 ? SPACE_TEXT.quietRoom : undefined}
            />
            {space.error && <Notice>Map failed: {space.error}</Notice>}
            {model.missing && <Notice>{SPACE_TEXT.missing}</Notice>}
            <div className="mt-3">
              <CoverageBandPicker
                band={space.band}
                freqHz={space.freqHz}
                onBand={space.setBand}
                onFreqHz={space.setFreqHz}
                oneNote={SPACE_TEXT.oneNote}
              />
            </div>
            <div className={`${READING_WIDTH} mt-3`}>
              <SpaceAssumptions
                venue={venue}
                levelRef={space.levelRef}
                balance={space.balance}
                target={space.target}
              />
            </div>
          </section>
          {placements.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
              <SectionHeading className="mb-3">{SPACE_TEXT.levels}</SectionHeading>
              {tiles.length > 0 && <StatTileGrid tiles={tiles} className="mb-2" />}
              {view && (
                <p className="text-sm text-stone-500 tabular-nums">
                  {view.atLimit !== null && view.atLimit < view.target + view.gain - 0.05
                    ? SPACE_TEXT.cannotReach(view.target + view.gain, view.atLimit)
                    : SPACE_TEXT.turnedDown(-view.gain, view.target + view.gain)}
                </p>
              )}
              {view && listenerRel !== null && (
                <p className="text-sm text-stone-500 tabular-nums mt-1">
                  {SPACE_TEXT.listenerVs}{" "}
                  <span className={relClass(listenerRel)}>{formatSigned(listenerRel)} dB</span>.
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
          )}
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5`}>
            <SectionHeading className="mb-3">
              <Tooltip tip={SPACE_TEXT.sideTip}>{SPACE_TEXT.side}</Tooltip>
            </SectionHeading>
            <Card>
              <SpaceSide
                items={model.placements.map((p) => p.item)}
                room={venue.room}
                listener={venue.listener}
                earFt={venue.earFt}
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
                  {
                    curve: space.targetCurve,
                    label: SPACE_TEXT.targetCurve,
                    stroke: pal.ink,
                    tint: alpha(pal.ink, 0),
                    dash: TARGET_DASH,
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
        </>
      }
      settings={
        <SettingsColumn folds={folds}>
          {section(
            "space",
            <>
              <TextField label="Name" value={name} maxLength={60} onChange={space.setName} />
              <StartPicker
                options={startOptions}
                value={byId(startOptions, start)}
                onChange={(o) => setStart(o.id)}
                group={() => STACK_START_GROUPS.presets}
                onStart={() => space.replaceDesign(spaceFromStart(start))}
                secondary={{
                  label: SPACE_TEXT.clear,
                  onClick: () => space.replaceDesign(emptySpace()),
                }}
                hint={<Tooltip tip={SPACE_TEXT.startTip}>{SPACE_TEXT.startHint}</Tooltip>}
              />
            </>,
          )}
          {section(
            "room",
            <>
              <RoomFields
                room={venue.room}
                actions={space.room}
                surfaces={SPACE_SURFACE_NAMES}
                surfaceTips={{ left: SPACE_LEFT_WALL_TIP }}
              />
              <Slider
                label={<Tooltip tip={SPACE_TEXT.targetTip}>{SPACE_TEXT.target}</Tooltip>}
                value={venue.targetDb}
                min={COVERAGE_TARGET_DB[0]}
                max={COVERAGE_TARGET_DB[1]}
                step={1}
                unit=" dB SPL"
                note={
                  space.bandLevels.length > 0
                    ? AUTO_BALANCE_TEXT.levels(
                        space.bandLevels.map((b) => ({
                          name: COVERAGE_BANDS[b.band].name,
                          levelDb: b.target,
                        })),
                      )
                    : undefined
                }
                onChange={(targetDb) => space.editVenue((v) => ({ ...v, targetDb }))}
              />
              <ToggleGroup
                label={SPACE_TEXT.measuredAt}
                className="mb-3"
                value={space.levelRef}
                onChange={(levelRef) => space.editVenue((v) => ({ ...v, levelRef }))}
                options={SPACE_LEVEL_REFS}
              />
              <ToggleGroup
                label={<Tooltip tip={BAND_BALANCE_TIP}>{AUTO_BALANCE_TEXT.label}</Tooltip>}
                className="mb-3"
                value={space.balance}
                onChange={(balance) => space.editVenue((v) => ({ ...v, balance }))}
                options={entriesOf(AUTO_BALANCE_MODE_LABEL)}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-3 mb-3">
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
              <SelectField
                label={SPACE_TEXT.addPlacement}
                options={placeList}
                value={picked}
                onChange={(o) => setPlacePick(o.id)}
                group={(o) => o.group}
              />
              <Button
                variant="primary"
                className="mb-3"
                onClick={() => {
                  space.place(picked.item());
                  pickNew();
                }}
              >
                {SPACE_TEXT.addPlacement}
              </Button>
              {stacks.length === 0 && speakers.length === 0 && (
                <p className="text-xs text-stone-500 mb-2">
                  {signedIn ? SPACE_TEXT.noLibrarySaved : SPACE_TEXT.noLibrary}
                </p>
              )}
              {placements.map((p, k) => (
                <PlacementSettings
                  key={k}
                  index={k}
                  placement={p}
                  open={openItems.includes(k)}
                  onOpenChange={(open) =>
                    setOpenItems((o) => (open ? [...o, k] : o.filter((i) => i !== k)))
                  }
                  names={names}
                  room={venue.room}
                  onEdit={(edit) => space.editPlacement(k, edit)}
                  onRemove={() => {
                    space.removePlacement(k);
                    afterRemoved(k);
                  }}
                  onAlign={(to) => space.alignTo(k, to)}
                />
              ))}
            </>,
          )}
          {section(
            "hardware",
            <HardwareSettings design={design} alignment={alignment} names={names} space={space} />,
          )}
        </SettingsColumn>
      }
    />
  );
}
