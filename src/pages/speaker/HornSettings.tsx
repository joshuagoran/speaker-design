import { CardHeading } from "../../components/ui/CardHeading";
import { useRef, useState } from "react";
import type { HornGoalFit, HornGoals, HornSegment, SpeakerDriver, SpeakerHorn } from "../../types";
import { SettingsFold } from "../../components/ui/SettingsFold";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { ReadOnlyField } from "../../components/ui/ReadOnlyField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf } from "../../lib/records";
import { HORN_PROFILE_NAMES } from "../../constants/hornEngine";
import { SPEAKER_TEXT, HORN_DRIVE_NAMES, HORN_PATH_NAMES } from "../../constants/speakerPage";
import { HORN_DRIVE } from "../../constants/speakerSpec";
import { COMPRESSION_RATIO } from "../../constants/hornThroat";
import {
  compressionRatio,
  conesAreaCm2,
  frontChamber,
  throatCones,
} from "../../lib/speaker/hornThroat";
import { driverSetbackIn } from "../../lib/speaker/driverBoard";
import { shownIn } from "./speakerFields";
import { FIELD_ROW, HEADING_GROUP, GAP_Y, GAP_Y_TIGHT } from "../../styles/layout";
import { hornText } from "./speakerText";
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

/** The drives the engines don't take yet: shown, not picked. */
const DRIVES_NOT_MODELED = [HORN_DRIVE.back];

/** An offset drive's one tap, by its key in the drive. */
const OFFSET_TAP = "tap" satisfies keyof Extract<SpeakerHorn["drive"], { kind: "offset" }>;

/** Each tap setting of a drive: where it is in the drive, its label and its tooltip. */
const TAP_FIELDS = {
  offset: [{ key: OFFSET_TAP, label: SPEAKER_TEXT.hornTap, tip: SPEAKER_TEXT.hornTapTip }],
  tapped: [
    { key: "frontTap", label: SPEAKER_TEXT.hornFrontTap, tip: SPEAKER_TEXT.hornFrontTapTip },
    { key: "rearTap", label: SPEAKER_TEXT.hornRearTap, tip: SPEAKER_TEXT.hornRearTapTip },
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
  onEdit: (edit: (horn: SpeakerHorn) => SpeakerHorn) => void;
  /** sets the drive, with the chamber changes it needs (a tapped horn's chamber has no vent) */
  onDrive: (kind: SpeakerHorn["drive"]["kind"]) => void;
  /** sizes the horn and the chamber's air for the goals; false when no horn can be calculated */
  onDesign: (goals: HornGoals) => boolean;
  /** reads a pasted Hornresp record onto the horn and the chamber */
  onImport: (text: string) => HornImport;
}

/**
 * A horn-loaded chamber's horn: its compression ratio (the throat: the first section's start area, the one figure both
 * fields edit), its flare sections (profile, start and end area, length), its front chamber (from the drivers and the
 * driver board, shown only), the driver board's thickness (a wall, or double), path and drive. The chamber's own net air and vent are the horn's rear chamber. The sections are smooth: each
 * starts at the previous section's end area, and only the first shows its start area. With Steps on (in the Advanced
 * fold, and always while the horn has a step) every section shows its start area, so a step can be made; Steps off
 * smooths them.
 */
export function HornSettings({
  horn,
  drivers,
  wallIn,
  fit,
  overAir,
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
  if (stepsLatched(stepsOn, segments) !== stepsOn) setStepsOn(true);
  const editSegments = (edit: (list: readonly HornSegment[]) => HornSegment[] | null) =>
    onEdit((h) => {
      const next = edit(h.segments);
      return next ? { ...h, segments: next } : h;
    });
  return (
    <section className={`border-t border-stone-300 pt-3 ${GAP_Y}`}>
      <div className={HEADING_GROUP}>
        <CardHeading sub>{SPEAKER_TEXT.horn}</CardHeading>
        <p className="text-xs text-stone-500">{hornText(horn)}</p>
      </div>
      <HornGoalsFields
        goals={horn.goals ?? HORN_GOALS_DEFAULT}
        fit={fit}
        overAir={overAir}
        onGoals={(goals) => onEdit((h) => ({ ...h, goals }))}
        onDesign={drive.kind === HORN_DRIVE.back ? undefined : onDesign}
      />
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.hornDriveTip}>{SPEAKER_TEXT.hornDrive}</Tooltip>}
        value={drive.kind}
        onChange={(kind) => {
          if (kind !== drive.kind && kind !== HORN_DRIVE.back) onDrive(kind);
        }}
        options={entriesOf(HORN_DRIVE_NAMES)}
        disabled={{ values: DRIVES_NOT_MODELED, why: SPEAKER_TEXT.hornDriveNote }}
      />
      {(drive.kind === HORN_DRIVE.offset || drive.kind === HORN_DRIVE.tapped) &&
        TAP_FIELDS[drive.kind].map(({ key, label, tip }) => (
          <ToggleGroup
            key={key}
            label={<Tooltip tip={tip}>{label}</Tooltip>}
            value={tapOf(drive, key)}
            onChange={(tap) => onEdit((h) => ({ ...h, drive: withTap(h.drive, key, tap) }))}
            options={segments.slice(0, -1).map((_, i) => [i + 1, String(i + 1)] as const)}
          />
        ))}
      {drive.kind === HORN_DRIVE.tapped && (
        <p className="text-xs text-stone-500">{SPEAKER_TEXT.hornTappedAir}</p>
      )}
      <div className={FIELD_ROW}>
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
              label={
                <Tooltip tip={SPEAKER_TEXT.hornProfileTip}>{SPEAKER_TEXT.hornProfile}</Tooltip>
              }
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
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.hornBoardTip}>{SPEAKER_TEXT.hornBoard}</Tooltip>}
        value={horn.doubleBoard === true}
        onChange={(doubleBoard) => onEdit((h) => ({ ...h, doubleBoard }))}
        options={BOARD_OPTIONS}
      />
      <ToggleGroup
        label={<Tooltip tip={SPEAKER_TEXT.hornPathTip}>{SPEAKER_TEXT.hornPath}</Tooltip>}
        value={horn.path}
        onChange={(path) => onEdit((h) => ({ ...h, path }))}
        options={entriesOf(HORN_PATH_NAMES)}
      />
      <HornImportFold onImport={onImport} />
    </section>
  );
}
