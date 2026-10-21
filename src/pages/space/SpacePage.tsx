import { useEffect, useMemo, useState } from "react";
import { useWidthAtLeast } from "../../hooks/useElementWidth";
import { Viewer3DCard } from "../../components/stack-view/Viewer3DCard";
import { SpaceView3D } from "../../components/stack-view/SpaceView3D";
import { spaceBeams } from "../../lib/speaker/spaceBeams";
import { alpha, TARGET_DASH } from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import { useMapMaxHeight } from "../../hooks/useMapMaxHeight";
import { useFolds } from "../../hooks/useFolds";
import { SettingsLayout } from "../../components/ui/SettingsLayout";
import { SettingsColumn, SettingsSection } from "../../components/ui/SettingsColumn";
import {
  SETTINGS_SHEET_CLASS,
  SettingsSheetTabs,
  settingsSheetBodyClass,
  useSettingsSheet,
} from "../../components/ui/SettingsSheetTabs";
import { SectionHeading } from "../../components/ui/SectionHeading";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField } from "../../components/ui/SelectField";
import { Slider } from "../../components/ui/Slider";
import { Notice } from "../../components/ui/Notice";
import { SharedNotice, type SharedNoticeProps } from "../../components/ui/SharedNotice";
import { CoverageBandPicker } from "../../components/ui/CoverageBandPicker";
import { RoomFields } from "../../components/ui/RoomFields";
import { CoverageMap, type MapBox } from "../../components/charts/CoverageMap";
import { ResponseChart } from "../../components/charts/ResponseChart";
import { StatTileGrid, type StatTileItem } from "../../components/stats/StatTileGrid";
import { SaveRow } from "../../components/saved-configs/SaveRow";
import { COHERENT_BELOW_HZ, COVERAGE_BANDS } from "../../lib/acoustics/coverage";
import { driverPattern } from "../../lib/speaker/spaceCoverage";
import { speakerLayout } from "../../lib/speaker/speakerLayout";
import { entriesOf, keysOf } from "../../lib/records";
import { formatHz, formatSigned } from "../../lib/format";
import {
  FIELD_ROW,
  HEADING_GROUP,
  MD_UP,
  READING_WIDTH,
  RESULT_MAX_WIDTH,
  RESULTS_TWO_COLUMN_PX,
  GAP_Y,
  resultsCellClass,
  resultsGridClass,
} from "../../styles/layout";
import { FREQ_AXIS_MAX_HZ } from "../../constants/chartScales";
import { COVERAGE_EDGE_DB, COVERAGE_TARGET_DB } from "../../constants/coverageLevel";
import { AUTO_BALANCE_MODE_LABEL, AUTO_BALANCE_TEXT } from "../../constants/autoBalance";
import { BAND_BALANCE_TIP } from "../../lib/speaker/autoBalance";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  SPACE_SETTINGS_SECTIONS,
  SPACE_SETTINGS_TABS,
  type SpaceSettingsSection,
} from "../../constants/settingsSections";
import {
  COUPLED_FLOOR,
  COUPLED_NAMES,
  NO_DELAY_MS,
  placementDomId,
  STAGE_FACE,
  stageDomId,
  SPACE_LEVEL_REF_PLACE,
  SPACE_LEFT_WALL_TIP,
  SPACE_LEVEL_REFS,
  SPACE_SAVE_WORDS,
  SPACE_SURFACE_NAMES,
  SPACE_TEXT,
  STAGE_SHAPE,
} from "../../constants/space";
import { shownIn } from "../speaker/speakerFields";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import { readSavedSpeaker } from "../../lib/speaker/speakerSaves";
import { stackFromSaved } from "../stack/stackSaves";
import type { StackPlanner } from "../stack/useStack";
import { PlacementSettings } from "./PlacementSettings";
import { StageSettings } from "./StageSettings";
import { listedStages, stageNames, stageSolids, stageTopFt } from "../../lib/speaker/spaceStages";
import type { SpaceStage, StageContact } from "../../types";
import { ArrivalList } from "./ArrivalList";
import { HardwareSettings } from "./HardwareSettings";
import { SpaceAssumptions } from "./SpaceAssumptions";
import { itemName } from "./spaceSaves";
import { spaceFromStart, type SpacePlanner } from "./useSpace";
import { placeOptions } from "./placeOptions";
import { designStartOptions } from "../stack/stackPresets";
import { byId } from "../../lib/tables";
import { spaceAlignment } from "../../lib/speaker/spaceAlignment";
import { ampPowerGroups } from "../../lib/speaker/spaceHardware";

interface Props {
  space: SpacePlanner;
  /** the stack library: the Stack page's store */
  stack: Pick<StackPlanner, "store" | "design">;
  /** the speaker library: the Speaker page's store */
  speakerPage: Pick<SpeakerPageState, "store" | "spec">;
  /** the shared view's notice, while a link's space shows in place of the page's own */
  sharedNotice: SharedNoticeProps | null;
}

/** The starts "New from…" lists: the empty space, then the presets. */
const START_OPTIONS = designStartOptions(SPACE_TEXT.empty);

/** The 3D view's height under the map: on a phone, and in a narrow results pane. */
const VIEW_HEIGHT = "h-[320px] md:h-[clamp(340px,55vh,620px)]";
/**
 * Beside the map: its cell stretches to the map's row (never shorter than this) and the view fills it, out of the flow
 * so its canvas never makes the row taller than the map.
 */
const VIEW_CELL_BESIDE = "relative self-stretch min-h-[340px]";

/** A share as a whole percentage. */
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** How a level compares with the target: the status color's text class. */
const relClass = (rel: number) =>
  rel >= -3 ? "text-green-700" : rel >= COVERAGE_EDGE_DB ? "text-orange-700" : "text-red-700";

/**
 * The Space page: stacks and speakers placed in a room, each at its spot, lift and
 * aim, a mirrored pair as one placement; their amp power and alignment; the coverage across the floor on the fixed
 * scale beside a 3D view of the room, the levels at the reference, and the response at the listener.
 */
export function SpacePage({ space, stack, speakerPage, sharedNotice }: Props) {
  const pal = usePalette();
  const { design, model, view, stats } = space;
  const { venue, placements, name } = design.space;
  const folds = useFolds("space.settingsFolds", keysOf(SPACE_SETTINGS_SECTIONS));
  const sheet = useSettingsSheet<SpaceSettingsSection>("space", "room");
  const maxHeight = useMapMaxHeight();
  // a wide results pane shows the map and the 3D view side by side; a narrow one, the 3D view under the map
  const [coverageGrid, wide] = useWidthAtLeast(RESULTS_TWO_COLUMN_PX);
  /** each driver's beam in the band on show, each as far as its level falls BEAM_FALL_DB from 1 m (none without a map) */
  const hasMap = view !== null;
  const beams = useMemo(
    () => (hasMap ? spaceBeams(model, space.band, space.freqHz) : []),
    [model, space.band, space.freqHz, hasMap],
  );
  /** the libraries, as the Place list reads them (empty when signed out) */
  const stacks = (stack.store.saved ?? []).flatMap((c) => {
    const saved = stackFromSaved(c);
    return saved ? [{ id: c.id, name: c.name, design: saved }] : [];
  });
  const speakers = (speakerPage.store.saved ?? []).flatMap((c) => {
    const saved: unknown = Reflect.get(c, "speaker");
    const spec = readSavedSpeaker(saved);
    return spec ? [{ id: c.id, name: c.name, spec }] : [];
  });
  /** signed in: the libraries are the person's (the stores hold a database) */
  const signedIn = Boolean(stack.store.db || speakerPage.store.db);
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
  // the design replaced whole (a start or an opened save): the numbers no longer mean the same placements, so none is
  // picked or open (reset while rendering, so no render holds a stale number). A save keeps them.
  const designKey = space.replaced;
  /** the stage picked on the map (its handles show), and which stages show their controls */
  const [pickedStage, setPickedStage] = useState<SpaceStage["id"] | null>(null);
  const [openStages, setOpenStages] = useState<readonly SpaceStage["id"][]>([]);
  const [seenKey, setSeenKey] = useState(designKey);
  if (seenKey !== designKey) {
    setSeenKey(designKey);
    setSelected(null);
    setOpenItems([]);
    setPickedStage(null);
    setOpenStages([]);
  }
  /** the placement to bring into view after the next render, and whether to scroll (a count tells repeats apart) */
  const [reveal, setReveal] = useState<{ k: number; scroll: boolean; n: number } | null>(null);
  /**
   * picks placement `k`: opens its item (and the Placements section; on a phone with the sheet open, its tab), and
   * scrolls it into view when `scroll`
   */
  const pick = (k: number, scroll: boolean) => {
    setSelected(k);
    setOpenItems((o) => (o.includes(k) ? o : [...o, k]));
    if (!folds.open.placements) folds.toggle("placements");
    if (sheet.open) sheet.show("placements");
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
  const stageNameOf = useMemo(() => stageNames(venue.stages), [venue.stages]);
  /** the stage picked, while it is still there */
  const selectedStage = pickedStage !== null && stageNameOf.has(pickedStage) ? pickedStage : null;
  /** the stage to bring into view after the next render (a count tells repeats apart) */
  const [stageReveal, setStageReveal] = useState<{ id: SpaceStage["id"]; n: number } | null>(null);
  /** picks stage `id`: opens its item (and the Stages section; on a phone with the sheet open, its tab) */
  const pickStage = (id: SpaceStage["id"], scroll: boolean) => {
    setPickedStage(id);
    setOpenStages((o) => (o.includes(id) ? o : [...o, id]));
    if (!folds.open.stages) folds.toggle("stages");
    if (sheet.open) sheet.show("stages");
    if (scroll) setStageReveal((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  };
  useEffect(() => {
    if (stageReveal)
      document.getElementById(stageDomId(stageReveal.id))?.scrollIntoView({ block: "nearest" });
  }, [stageReveal]);
  /** a stage's face, by name ("Stage 1 front") */
  const contactName = (c: StageContact) =>
    SPACE_TEXT.stageFace(stageNameOf.get(c.stage) ?? "", c.face);
  /** after placement `k` goes, the numbers above it move down one */
  const afterRemoved = (k: number) => {
    const shift = (i: number) => (i > k ? i - 1 : i);
    setOpenItems((o) => o.filter((i) => i !== k).map(shift));
    setSelected((s) => (s === null || s === k ? null : shift(s)));
  };
  const picked = byId(placeList, placePick) ?? placeList[0];
  /** each placement's name: its number and what it places */
  const names = placements.map((p, k) => `${k + 1}. ${itemName(design, p.item)}`);
  /**
   * what placement `k`'s boxes stand right against, by name: the floor and the walls in the order `COUPLED_NAMES` lists
   * them, then the other placements in the space's order
   */
  const coupledWith = (k: number): string[] => {
    const own = model.placements.flatMap((p, i) => (p.item.placement.source === k ? [i] : []));
    const couplings = own.flatMap((i) => space.coupling.boxes[i] ?? []);
    const surfaces = new Set(couplings.flatMap((c) => c.surfaces));
    const sources = new Set(
      couplings.flatMap((c) => c.boxes.map((j) => model.placements[j]?.item.placement.source)),
    );
    const contacts = couplings.flatMap((c) => c.stages);
    /** the stage tops it stands on (in place of the floor), and the stages' faces beside it */
    const tops = new Set(contacts.filter((c) => c.face === STAGE_FACE.top).map(contactName));
    const faces = new Set(contacts.filter((c) => c.face !== STAGE_FACE.top).map(contactName));
    return [
      ...(surfaces.has(COUPLED_FLOOR) ? [COUPLED_NAMES.floor] : []),
      ...tops,
      ...keysOf(COUPLED_NAMES)
        .filter((s) => s !== COUPLED_FLOOR && surfaces.has(s))
        .map((s) => COUPLED_NAMES[s]),
      ...faces,
      ...names.filter((_, source) => sources.has(source)),
    ];
  };
  /** the stages placement `k`'s boxes stand on, by name (none: the floor) */
  const standsOn = (k: number): string[] => [
    ...new Set(
      model.placements.flatMap(({ item }) =>
        item.placement.source === k && item.standsOn !== null
          ? [stageNameOf.get(item.standsOn) ?? ""]
          : [],
      ),
    ),
  ];
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
  const listenerRel = space.listenerDb !== null ? space.listenerDb - space.turn.target : null;
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
    stages:
      listedStages(venue.stages)
        .map((st) => stageNameOf.get(st.id))
        .join(" · ") || SPACE_TEXT.noStages,
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
      foldsAt="desktop"
      summary={summaries[id]}
      className={sheet.tabClass(id)}
    >
      {children}
    </SettingsSection>
  );
  /** where the target is measured, in a sentence */
  const refPlace = SPACE_LEVEL_REF_PLACE[space.levelRef];
  return (
    <SettingsLayout
      sheet={sheet}
      results={
        <>
          {sharedNotice ? (
            <SharedNotice {...sharedNotice} />
          ) : (
            <SaveRow
              store={space.store}
              snapshot={space.snapshot}
              restore={space.restore}
              name={name}
              onName={space.setName}
              openId={design.space.id}
              onOpenId={space.setOpenId}
              words={SPACE_SAVE_WORDS}
              starts={START_OPTIONS}
              group={(o) => o.group}
              onStart={(o) => space.replaceDesign(spaceFromStart(o.id))}
            />
          )}
          <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
            <div className={HEADING_GROUP}>
              <SectionHeading>{SPACE_TEXT.coverage}</SectionHeading>
              <p className="text-sm text-stone-500">
                {SPACE_TEXT.mapCaption(bandName, space.target.toFixed(0), refPlace)}
              </p>
            </div>
            <div ref={coverageGrid} className={resultsGridClass(wide)}>
              {/* two columns: the map's cell sets the first row's height, and the 3D view fills it */}
              <div className={wide ? "contents" : `min-w-0 ${GAP_Y}`}>
                <div className={resultsCellClass(wide, "col-start-1 row-start-1")}>
                  <CoverageMap
                    view={view}
                    room={venue.room}
                    listener={venue.listener}
                    alignAt={venue.alignAt}
                    boxes={boxes}
                    coupling={space.coupling.marks}
                    stages={listedStages(venue.stages).map((st) => ({
                      id: st.id,
                      corners: st.corners,
                      polygon: st.shape === STAGE_SHAPE.polygon,
                      riser: st.on !== null,
                      label: SPACE_TEXT.stageLabel(
                        stageNameOf.get(st.id) ?? "",
                        `${shownIn(stageTopFt(venue.stages, st))}`,
                      ),
                    }))}
                    selectedStage={selectedStage}
                    onSelectStage={(id) => pickStage(id, window.matchMedia(MD_UP).matches)}
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
                      moveAlignAt: space.moveAlignAt,
                      beginStageDrag: space.stages.beginDrag,
                      dragStage: space.stages.drag,
                    }}
                    busy={space.isPending}
                    maxHeight={maxHeight}
                    quiet={placements.length === 0 ? SPACE_TEXT.quietRoom : undefined}
                  />
                </div>
                <div className={`${resultsCellClass(wide, "col-start-1 row-start-2")} ${GAP_Y}`}>
                  {space.error && <Notice>Map failed: {space.error}</Notice>}
                  {model.missing && <Notice>{SPACE_TEXT.missing}</Notice>}
                  <CoverageBandPicker
                    band={space.band}
                    freqHz={space.freqHz}
                    onBand={space.setBand}
                    onFreqHz={space.setFreqHz}
                    oneNote={SPACE_TEXT.oneNote(COHERENT_BELOW_HZ)}
                  />
                </div>
              </div>
              <div
                className={resultsCellClass(wide, `col-start-2 row-start-1 ${VIEW_CELL_BESIDE}`)}
              >
                <Viewer3DCard
                  boxClassName={wide ? "absolute inset-0" : `relative ${VIEW_HEIGHT}`}
                  beamsButton
                >
                  {(cutaway, look) => (
                    <SpaceView3D
                      room={venue.room}
                      stages={stageSolids(venue.stages)}
                      items={model.placements.map((p) => p.item)}
                      listener={venue.listener}
                      alignAt={venue.alignAt}
                      earFt={venue.earFt}
                      view={placements.length > 0 ? view : null}
                      beams={look.beams ? beams : []}
                      cutaway={cutaway}
                    />
                  )}
                </Viewer3DCard>
              </div>
            </div>
          </section>
          {placements.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
              <SectionHeading>{SPACE_TEXT.levels}</SectionHeading>
              {tiles.length > 0 && <StatTileGrid tiles={tiles} />}
              {view && (
                <p className="text-sm text-stone-500 tabular-nums">
                  {space.turn.atLimit !== null && space.turn.atLimit < space.turn.target - 0.05
                    ? SPACE_TEXT.cannotReach(space.turn.target, space.turn.atLimit)
                    : SPACE_TEXT.turnedDown(-space.turn.gain, space.turn.target)}
                </p>
              )}
              {view && listenerRel !== null && (
                <p className="text-sm text-stone-500 tabular-nums">
                  {SPACE_TEXT.listenerVs}{" "}
                  <span className={relClass(listenerRel)}>{formatSigned(listenerRel)} dB</span>.
                </p>
              )}
              {space.bandLevels.length > 0 && (
                <p className="text-sm text-stone-500 tabular-nums">
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
          {space.arrivals.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
              <SectionHeading>
                <Tooltip tip={SPACE_TEXT.arrivalsTip}>{SPACE_TEXT.arrivals}</Tooltip>
              </SectionHeading>
              <ArrivalList arrivals={space.arrivals} names={names} />
            </section>
          )}
          {space.response.length > 0 && (
            <section className={`${RESULT_MAX_WIDTH} min-w-0 mt-5 ${GAP_Y}`}>
              <SectionHeading>{SPACE_TEXT.response}</SectionHeading>
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
          <div className={`${READING_WIDTH} mt-5`}>
            <SpaceAssumptions
              venue={venue}
              levelRef={space.levelRef}
              balance={space.balance}
              target={space.target}
            />
          </div>
        </>
      }
      settings={
        <SettingsColumn
          folds={folds}
          foldsAt="desktop"
          className={SETTINGS_SHEET_CLASS}
          bodyClassName={settingsSheetBodyClass(sheet.open)}
          top={
            <SettingsSheetTabs
              sections={SPACE_SETTINGS_SECTIONS}
              labels={SPACE_SETTINGS_TABS}
              sheet={sheet}
            />
          }
        >
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
                value={space.levelRef}
                onChange={(levelRef) => space.editVenue((v) => ({ ...v, levelRef }))}
                options={SPACE_LEVEL_REFS}
              />
              <ToggleGroup
                label={<Tooltip tip={BAND_BALANCE_TIP}>{AUTO_BALANCE_TEXT.label}</Tooltip>}
                value={space.balance}
                onChange={(balance) => space.editVenue((v) => ({ ...v, balance }))}
                options={entriesOf(AUTO_BALANCE_MODE_LABEL)}
              />
              <div className={FIELD_ROW}>
                <NumberField
                  label={SPACE_TEXT.ear}
                  value={venue.earFt}
                  min={1}
                  max={8}
                  step={0.1}
                  onChange={(earFt) => space.editVenue((v) => ({ ...v, earFt }))}
                />
              </div>
            </>,
          )}
          {section(
            "stages",
            <StageSettings
              stages={venue.stages}
              names={stageNameOf}
              room={venue.room}
              open={openStages}
              onOpenChange={(id, open) =>
                setOpenStages((o) => (open ? [...o, id] : o.filter((i) => i !== id)))
              }
              actions={space.stages}
              onAdded={(id) => pickStage(id, true)}
            />,
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
                onClick={() => {
                  space.place(picked.item());
                  pickNew();
                }}
              >
                {SPACE_TEXT.addPlacement}
              </Button>
              {stacks.length === 0 && speakers.length === 0 && (
                <p className="text-xs text-stone-500">
                  {signedIn ? SPACE_TEXT.noLibrarySaved : SPACE_TEXT.noLibrary}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <ToggleButton
                  on={space.snapsFlush}
                  onClick={() => space.setSnapsFlush(!space.snapsFlush)}
                >
                  {SPACE_TEXT.snapFlush}
                </ToggleButton>
              </div>
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
                  solved={model.solved[k]}
                  coupledWith={coupledWith(k)}
                  standsOn={standsOn(k)}
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
