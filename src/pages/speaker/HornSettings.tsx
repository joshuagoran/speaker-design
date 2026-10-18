import { CardHeading } from "../../components/ui/CardHeading";
import { useRef, useState } from "react";
import { FoldBox } from "../../components/ui/FoldBox";
import { InsetGroup } from "../../components/ui/InsetGroup";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { SETTINGS_TEXT } from "../../constants/speakerSettings";
import { SPEAKER_STEPS } from "../../constants/speakerSteps";
import { MIN_NET_L } from "../../lib/speaker/speakerBuild";
import { byId } from "../../lib/tables";
import { keysOf } from "../../lib/records";
import { hornSettingsSummary } from "./settingsSummaries";
import type { HornGoalFit, HornGoals, HornSegment, SpeakerDriver, SpeakerHorn } from "../../types";
import { SettingsFold } from "../../components/ui/SettingsFold";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { ReadOnlyField } from "../../components/ui/ReadOnlyField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf } from "../../lib/records";
import { HORN_PROFILE_NAMES } from "../../constants/hornEngine";
import { SPEAKER_TEXT, HORN_DRIVE_NAMES } from "../../constants/speakerPage";
import { HORN_DRIVE, HORN_PATH } from "../../constants/speakerSpec";
import { COMPRESSION_RATIO } from "../../constants/hornThroat";
import {
  compressionRatio,
  conesAreaCm2,
  frontChamber,
  throatCones,
} from "../../lib/speaker/hornThroat";
import { driverSetbackIn } from "../../lib/speaker/driverBoard";
import { shownIn, shownTenth } from "./speakerFields";
import { FIELD_ROW, GAP_Y, GAP_Y_TIGHT, PAIR_ROW } from "../../styles/layout";
import { straightHornText } from "./speakerText";
import { HornGoalsFields } from "./HornGoalsFields";
import { HornImportFold } from "./HornImportFold";
import type { HornImport } from "./hornrespImport";
import { HORN_GOALS_DEFAULT } from "../../constants/hornGoals";
import {
  SECTIONS_NEEDED,
  driveAfterRemoval,
  joinsNext,
  shownIn2,
  shownInOfCm,
  stepCount,
  stepsIn,
  stepsLatched,
  withSectionAdded,
  withSectionProfile,
  withSectionRemoved,
  withSectionSize,
  withCompressionRatio,
  withStepsSmoothed,
  type HornSectionSize,
} from "./hornSections";

/** The horn types to pick: a back-loaded horn is not calculated, so it is not offered. */
const DRIVE_OPTIONS: readonly SelectOption[] = entriesOf(HORN_DRIVE_NAMES)
  .filter(([kind]) => kind !== HORN_DRIVE.back)
  .map(([id, name]) => ({ id, name }));

/** The least rear chamber a straight horn takes, L (as Design from goals and an import set it). */
const MIN_REAR_L = MIN_NET_L;

/** An offset drive's one tap, by its key in the drive. */
const OFFSET_TAP = "tap" satisfies keyof Extract<SpeakerHorn["drive"], { kind: "offset" }>;

/** Each tap setting of a drive: where it is in the drive, its label and its tooltip. */
const TAP_FIELDS = {
  offset: [{ key: OFFSET_TAP, label: SETTINGS_TEXT.tap, tip: SETTINGS_TEXT.tapTip }],
  tapped: [
    { key: "frontTap", label: SETTINGS_TEXT.frontTap, tip: SETTINGS_TEXT.tapsTip },
    { key: "rearTap", label: SETTINGS_TEXT.backTap, tip: SETTINGS_TEXT.tapsTip },
  ],
} as const;

/** Each size field of a section: its spec field, its label and its step. */
const SECTION_FIELDS: readonly {
  size: HornSectionSize;
  label: string;
  tip: string;
  step: number;
}[] = [
  { size: "s1", label: SPEAKER_TEXT.hornStart, tip: SPEAKER_TEXT.hornStartTip, step: 1 },
  { size: "s2", label: SPEAKER_TEXT.hornEnd, tip: SPEAKER_TEXT.hornEndTip, step: 1 },
  { size: "length", label: SPEAKER_TEXT.portLength, tip: SPEAKER_TEXT.hornLengthTip, step: 0.25 },
];

/** The Steps setting's choices: off (smooth) or on. */
const STEPS_OPTIONS = [
  [false, SPEAKER_TEXT.hornStepsOff],
  [true, SPEAKER_TEXT.hornStepsOn],
] as const;

/** The Driver board thickness setting's choices: one wall thick, or doubled. */
const BOARD_OPTIONS = [
  [false, SPEAKER_TEXT.hornBoardWall],
  [true, SPEAKER_TEXT.hornBoardDouble],
] as const;

/** A section's size as its field shows it: an area in in², a length in in. */
const shownSize = (s: HornSegment, size: HornSectionSize) =>
  size === "length" ? shownInOfCm(s.length) : shownIn2(s[size]);

/** A tap setting's key in its drive. */
type TapKey = (typeof TAP_FIELDS)[keyof typeof TAP_FIELDS][number]["key"];

/** The section a tap opens after (a section boundary from 1); null when the drive has no such tap. */
function tapOf(drive: SpeakerHorn["drive"], key: TapKey): number | null {
  if (drive.kind === HORN_DRIVE.offset && key === OFFSET_TAP) return drive.tap;
  if (drive.kind === HORN_DRIVE.tapped && key !== OFFSET_TAP) return drive[key];
  return null;
}

/** The drive with tap `key` set to open after section `tap`; unchanged when it has no such tap. */
function withTap(drive: SpeakerHorn["drive"], key: TapKey, tap: number): SpeakerHorn["drive"] {
  if (drive.kind === HORN_DRIVE.offset && key === OFFSET_TAP) return { ...drive, tap };
  if (drive.kind === HORN_DRIVE.tapped && key !== OFFSET_TAP) return { ...drive, [key]: tap };
  return drive;
}

interface Props {
  horn: SpeakerHorn;
  /** the chamber's drivers: their cones set the compression ratio's area and the front chamber */
  drivers: readonly SpeakerDriver[];
  /** the walls' thickness, in: the driver board is a piece or two of it */
  wallIn: number;
  /** how the horn meets its goals now; null when it cannot be calculated */
  fit: HornGoalFit | null;
  /** the horn's air and the chamber's, L, when the horn holds more than the chamber has; else null */
  overAir: { hornL: number; chamberL: number } | null;
  /** a straight horn's rear chamber: the chamber's net air, L (`SpeakerChamber.netLiters`); null while not set */
  rearLiters: number | null;
  onRearLiters: (liters: number) => void;
  /** more settings at the end of the Horn settings fold, before the straight horn (the fill, the mouth's place) */
  children?: React.ReactNode;
  onEdit: (edit: (horn: SpeakerHorn) => SpeakerHorn) => void;
  /** sets the drive, with the chamber changes it needs (a tapped horn's chamber has no vent) */
  onDrive: (kind: SpeakerHorn["drive"]["kind"]) => void;
  /** sizes the horn and the chamber's air for the goals; false when no horn can be calculated */
  onDesign: (goals: HornGoals) => boolean;
  /** reads a pasted Hornresp record onto the horn and the chamber */
  onImport: (text: string) => HornImport;
}

/**
 * A horn-loaded chamber's horn, in two parts: the Horn group (its goals, with Design from goals) and the Horn settings
 * fold: its type and taps, its compression ratio (the throat: the first section's start area) and front chamber (from
 * the drivers and the driver board, shown only), the driver board's thickness, the chamber's extra settings
 * (`children`), the straight horn and the Hornresp import. Design from goals or an import set the straight horn and a
 * straight horn's rear chamber (the chamber's net air): both show read-only until Edit manually is on. The sections are
 * smooth: each starts at the previous section's end area, and only the first shows its start area. With Steps on (in
 * the Advanced fold, and always while the horn has a step) every section shows its start area, so a step can be made;
 * Steps off smooths them.
 */
export function HornSettings({
  horn,
  drivers,
  wallIn,
  fit,
  overAir,
  rearLiters,
  onRearLiters,
  children,
  onEdit,
  onDrive,
  onDesign,
  onImport,
}: Props) {
  const { segments, drive } = horn;
  const conesCm2 = conesAreaCm2(drivers);
  const ratio = compressionRatio(conesCm2, segments);
  const cones = throatCones(drivers);
  const front = cones && frontChamber(cones.cone, cones.count, driverSetbackIn(wallIn, horn));
  /**
   * whether the section whose end area is being typed met the next one when its field took focus: the chain follows
   * that, not each keystroke's value (null: no end area field has focus)
   */
  const joinedAtFocus = useRef<boolean | null>(null);
  const steps = stepCount(segments);
  /** Steps on: latched while the horn has a step, so a field typed back to smooth stays; only Off turns it off */
  const [stepsOn, setStepsOn] = useState(() => stepsLatched(false, segments));
  /** Edit manually: the straight horn's sections and the rear chamber unlocked (Design from goals or an import sets them) */
  const [manual, setManual] = useState(false);
  if (stepsLatched(stepsOn, segments) !== stepsOn) setStepsOn(true);
  /** a folded horn: its drawing sets the taps, the throat and the shape; the sections are only its target */
  const folded = horn.path === HORN_PATH.folded;
  const editSegments = (edit: (list: readonly HornSegment[]) => HornSegment[] | null) =>
    onEdit((h) => {
      const next = edit(h.segments);
      return next ? { ...h, segments: next } : h;
    });
  const sectionsBlock = (
    <div className={GAP_Y_TIGHT}>
      <div className="text-sm font-label text-stone-500">
        <Tooltip tip={SPEAKER_TEXT.hornPathSectionsTip}>{SPEAKER_TEXT.hornSections}</Tooltip>
      </div>
      {segments.map((s, i) => (
        <div key={i} className={`rounded border border-stone-300 px-3 pt-2 pb-3 ${GAP_Y}`}>
          <CardHeading
            sub
            action={
              // a drive's taps need their sections: no Remove at the fewest
              segments.length > SECTIONS_NEEDED[drive.kind] && (
                <Button
                  size="xs"
                  onClick={() =>
                    onEdit((h) => ({
                      ...h,
                      segments: withSectionRemoved(h.segments, i),
                      drive: driveAfterRemoval(h.drive, i, h.segments.length - 1),
                    }))
                  }
                >
                  {SPEAKER_TEXT.removeSection}
                </Button>
              )
            }
          >
            {SPEAKER_TEXT.hornSection(i + 1)}
          </CardHeading>
          <ToggleGroup
            label={<Tooltip tip={SPEAKER_TEXT.hornProfileTip}>{SPEAKER_TEXT.hornProfile}</Tooltip>}
            value={s.profile}
            onChange={(profile) => editSegments((list) => withSectionProfile(list, i, profile))}
            options={entriesOf(HORN_PROFILE_NAMES)}
          />
          <div className={FIELD_ROW}>
            {/* a smooth horn's starts follow the previous ends: only the throat's shows */}
            {SECTION_FIELDS.filter(({ size }) => stepsOn || i === 0 || size !== "s1").map(
              ({ size, label, tip, step }) => (
                // `contents`: the wrapper only hears the field's focus, the row lays out the field
                <div
                  key={size}
                  className="contents"
                  onFocus={() => {
                    joinedAtFocus.current = size === "s2" ? joinsNext(segments, i) : null;
                  }}
                  onBlur={() => {
                    joinedAtFocus.current = null;
                  }}
                >
                  <NumberField
                    label={<Tooltip tip={tip}>{label}</Tooltip>}
                    value={shownSize(s, size)}
                    min={0}
                    step={step}
                    onChange={(v) =>
                      editSegments((list) =>
                        withSectionSize(
                          list,
                          i,
                          size,
                          v,
                          // smooth: the next start always follows
                          !stepsOn || (joinedAtFocus.current ?? joinsNext(list, i)),
                        ),
                      )
                    }
                  />
                </div>
              ),
            )}
          </div>
          {stepsIn(segments, i) && (
            <p className="text-xs text-stone-500">{SPEAKER_TEXT.hornStep(i + 1)}</p>
          )}
        </div>
      ))}
      <Button variant="primary" size="xs" onClick={() => editSegments(withSectionAdded)}>
        {SPEAKER_TEXT.addSection}
      </Button>
    </div>
  );
  const stepsFold = (
    <SettingsFold title={SPEAKER_TEXT.advanced} summary={SPEAKER_TEXT.hornSteps(steps)}>
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.hornStepsTip}>{SPEAKER_TEXT.hornStepsSetting}</Tooltip>}
        value={stepsOn}
        onChange={(on) => {
          setStepsOn(on);
          // off: every start back to the previous end
          if (!on) editSegments(withStepsSmoothed);
        }}
        options={STEPS_OPTIONS}
      />
    </SettingsFold>
  );
  /** the sections a tap can open after: every boundary between two sections */
  const tapOptions: readonly SelectOption[] = segments
    .slice(0, -1)
    .map((_, i) => ({ id: String(i + 1), name: SPEAKER_TEXT.hornSection(i + 1) }));
  /** the line that says what sets the straight horn, and the one switch that unlocks it (and the rear chamber) */
  const manualRow = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-stone-500">{SETTINGS_TEXT.setByDesign}</p>
      <ToggleButton size="xs" on={manual} className="shrink-0" onClick={() => setManual((m) => !m)}>
        {SETTINGS_TEXT.editManually}
      </ToggleButton>
    </div>
  );
  /** the straight horn's sections, read-only: each one's profile, start and end area, and length */
  const sectionsTable = (
    <div className="grid grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] gap-1.5 text-sm">
      <span className="text-xs text-stone-500">{SPEAKER_TEXT.hornProfile}</span>
      {SECTION_FIELDS.map(({ size, label, tip }) => (
        <span key={size} className="text-xs text-stone-500">
          <Tooltip tip={tip}>{label}</Tooltip>
        </span>
      ))}
      {segments.map((s, i) => (
        <div key={i} className="contents font-value text-stone-500">
          <span className="truncate">{HORN_PROFILE_NAMES[s.profile]}</span>
          {SECTION_FIELDS.map(({ size }) => (
            <span key={size}>{shownSize(s, size)}</span>
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <>
      <InsetGroup title={SETTINGS_TEXT.horn}>
        <HornGoalsFields
          goals={horn.goals ?? HORN_GOALS_DEFAULT}
          fit={fit}
          overAir={overAir}
          onGoals={(goals) => onEdit((h) => ({ ...h, goals }))}
          onDesign={drive.kind === HORN_DRIVE.back ? undefined : onDesign}
        />
      </InsetGroup>
      <FoldBox title={SETTINGS_TEXT.hornSettings} summary={hornSettingsSummary(horn)}>
        <SelectField
          label={<Tooltip tip={SPEAKER_TEXT.hornDriveTip}>{SPEAKER_TEXT.hornDrive}</Tooltip>}
          options={DRIVE_OPTIONS}
          value={byId(DRIVE_OPTIONS, drive.kind)}
          onChange={(o) => {
            // the picker lists exactly the drives it offers (DRIVE_OPTIONS)
            const kind = keysOf(HORN_DRIVE_NAMES).find((k) => k === o.id);
            if (kind && kind !== drive.kind && kind !== HORN_DRIVE.back) onDrive(kind);
          }}
        />
        {!folded && (drive.kind === HORN_DRIVE.offset || drive.kind === HORN_DRIVE.tapped) && (
          <div className={drive.kind === HORN_DRIVE.tapped ? PAIR_ROW : ""}>
            {TAP_FIELDS[drive.kind].map(({ key, label, tip }) => {
              const tap = tapOf(drive, key);
              return (
                <SelectField
                  key={key}
                  label={<Tooltip tip={tip}>{label}</Tooltip>}
                  options={tapOptions}
                  value={tap === null ? undefined : byId(tapOptions, String(tap))}
                  onChange={(o) =>
                    onEdit((h) => ({ ...h, drive: withTap(h.drive, key, Number(o.id)) }))
                  }
                />
              );
            })}
          </div>
        )}
        {!folded && drive.kind === HORN_DRIVE.tapped && (
          <p className="text-xs text-stone-500">{SPEAKER_TEXT.hornTappedAir}</p>
        )}
        {!folded && (ratio !== null || front) && (
          <div className={PAIR_ROW}>
            {/* the ratio is the cones' area over the path's start: a front-loaded horn's throat only */}
            {ratio !== null && drive.kind === HORN_DRIVE.front && (
              <NumberField
                label={
                  <Tooltip tip={SPEAKER_TEXT.hornCompressionTip}>
                    {SPEAKER_TEXT.hornCompression}
                  </Tooltip>
                }
                value={shownIn(ratio)}
                min={COMPRESSION_RATIO.min}
                max={COMPRESSION_RATIO.max}
                step={COMPRESSION_RATIO.step}
                unit=": 1"
                fill
                onChange={(r) => {
                  if (r > 0) editSegments((list) => withCompressionRatio(list, conesCm2, r));
                }}
              />
            )}
            {front && (
              <ReadOnlyField
                label={
                  <Tooltip
                    tip={
                      front.estimated
                        ? `${SPEAKER_TEXT.hornFrontChamberTip} ${SPEAKER_TEXT.hornFrontChamberEstimate}`
                        : SPEAKER_TEXT.hornFrontChamberTip
                    }
                  >
                    {SPEAKER_TEXT.hornFrontChamber}
                  </Tooltip>
                }
                value={shownIn(front.liters)}
                unit="L"
              />
            )}
          </div>
        )}
        {!folded && (
          <ToggleGroup
            label={<Tooltip tip={SPEAKER_TEXT.hornBoardTip}>{SPEAKER_TEXT.hornBoard}</Tooltip>}
            value={horn.doubleBoard === true}
            onChange={(doubleBoard) => onEdit((h) => ({ ...h, doubleBoard }))}
            options={BOARD_OPTIONS}
          />
        )}
        {children}
        {folded ? (
          <SettingsFold title={SPEAKER_TEXT.straightHorn} summary={straightHornText(horn)}>
            {manualRow}
            <p className="text-xs text-stone-500">{SPEAKER_TEXT.straightHornNote}</p>
            {manual ? sectionsBlock : sectionsTable}
          </SettingsFold>
        ) : (
          <>
            {manualRow}
            {/* a straight horn's rear chamber: the chamber's net air, set with the horn */}
            <NumberField
              label={
                <Tooltip tip={SETTINGS_TEXT.rearChamberTip}>{SETTINGS_TEXT.rearChamber}</Tooltip>
              }
              value={shownTenth(rearLiters ?? 0)}
              min={MIN_REAR_L}
              step={SPEAKER_STEPS.netL}
              unit="L"
              disabled={!manual}
              onChange={(liters) => onRearLiters(Math.max(MIN_REAR_L, liters))}
            />
            {manual ? (
              <>
                {sectionsBlock}
                {stepsFold}
              </>
            ) : (
              sectionsTable
            )}
          </>
        )}
        <HornImportFold onImport={onImport} />
      </FoldBox>
    </>
  );
}
