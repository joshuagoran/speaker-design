import { CardHeading } from "../../components/ui/CardHeading";
import { useRef, useState } from "react";
import type { HornSegment, SpeakerDriver, SpeakerHorn } from "../../types";
import { SettingsFold } from "../../components/ui/SettingsFold";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf, keysOf } from "../../lib/records";
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
import { FIELD_ROW, shownIn } from "./speakerFields";
import { hornText } from "./speakerText";
import {
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

/** The drives the horn engine doesn't take yet: shown, not picked. */
const DRIVES_NOT_MODELED = keysOf(HORN_DRIVE_NAMES).filter((k) => k !== HORN_DRIVE.front);

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

/** A section's size as its field shows it: an area in in², a length in in. */
const shownSize = (s: HornSegment, size: HornSectionSize) =>
  size === "length" ? shownInOfCm(s.length) : shownIn2(s[size]);

interface Props {
  horn: SpeakerHorn;
  /** the chamber's drivers: their cones set the compression ratio's area and the front chamber */
  drivers: readonly SpeakerDriver[];
  onEdit: (edit: (horn: SpeakerHorn) => SpeakerHorn) => void;
}

/**
 * A horn-loaded chamber's horn: its compression ratio (the throat: the first section's start area, the one figure both
 * fields edit), its flare sections (profile, start and end area, length), its front chamber (from the drivers, shown
 * only), path and drive. The chamber's own net air and vent are the horn's rear chamber. The sections are smooth: each
 * starts at the previous section's end area, and only the first shows its start area. With Steps on (in the Advanced
 * fold, and always while the horn has a step) every section shows its start area, so a step can be made; Steps off
 * smooths them.
 */
export function HornSettings({ horn, drivers, onEdit }: Props) {
  const { segments } = horn;
  const conesCm2 = conesAreaCm2(drivers);
  const ratio = compressionRatio(conesCm2, segments);
  const cones = throatCones(drivers);
  const front = cones && frontChamber(cones.cone, cones.count);
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
    <section className="border-t border-stone-300 pt-3 mb-3">
      <CardHeading sub>{SPEAKER_TEXT.horn}</CardHeading>
      <p className="text-xs text-stone-500 mb-2">{hornText(horn)}</p>
      <div className={FIELD_ROW}>
        {ratio !== null && (
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
          <NumberField
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
            // read-only: the drivers and the walls set it
            disabled
            onChange={() => {}}
          />
        )}
      </div>
      <div className="text-sm font-label text-stone-500 mb-1">
        <Tooltip tip={SPEAKER_TEXT.hornPathSectionsTip}>{SPEAKER_TEXT.hornSections}</Tooltip>
      </div>
      {segments.map((s, i) => (
        <div key={i} className="rounded border border-stone-300 px-3 pt-2 mb-2">
          <CardHeading
            sub
            className="mb-2"
            action={
              segments.length > 1 && (
                <Button
                  size="xs"
                  onClick={() => editSegments((list) => withSectionRemoved(list, i))}
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
            className="mb-2"
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
            <p className="text-xs text-stone-500 mb-2">{SPEAKER_TEXT.hornStep(i + 1)}</p>
          )}
        </div>
      ))}
      <Button
        variant="primary"
        size="xs"
        className="mb-3"
        onClick={() => editSegments(withSectionAdded)}
      >
        {SPEAKER_TEXT.addSection}
      </Button>
      <SettingsFold title={SPEAKER_TEXT.advanced} summary={SPEAKER_TEXT.hornSteps(steps)}>
        <ToggleGroup
          label={<Tooltip tip={SPEAKER_TEXT.hornStepsTip}>{SPEAKER_TEXT.hornStepsSetting}</Tooltip>}
          className="mb-1"
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
        label={<Tooltip tip={SPEAKER_TEXT.hornPathTip}>{SPEAKER_TEXT.hornPath}</Tooltip>}
        className="mb-3"
        value={horn.path}
        onChange={(path) => onEdit((h) => ({ ...h, path }))}
        options={entriesOf(HORN_PATH_NAMES)}
      />
      <ToggleGroup
        label={SPEAKER_TEXT.hornDrive}
        className="mb-1"
        value={horn.drive.kind}
        // only a front-loaded horn can be picked: the engine takes no other drive yet
        onChange={(kind) => {
          if (kind === HORN_DRIVE.front) onEdit((h) => ({ ...h, drive: { kind } }));
        }}
        options={entriesOf(HORN_DRIVE_NAMES)}
        disabled={{ values: DRIVES_NOT_MODELED, why: SPEAKER_TEXT.hornDriveNote }}
      />
      <p className="text-xs text-stone-500 mb-3">{SPEAKER_TEXT.hornDriveNote}</p>
    </section>
  );
}
