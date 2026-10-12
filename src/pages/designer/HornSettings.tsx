import { useRef, useState } from "react";
import type { HornSegment, SpeakerHorn } from "../../types";
import { AnimatedDetails } from "../../components/ui/AnimatedDetails";
import { Button } from "../../components/ui/Button";
import { NumberField } from "../../components/ui/NumberField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { Tooltip } from "../../components/ui/Tooltip";
import { entriesOf, keysOf } from "../../lib/records";
import { HORN_PROFILE_NAMES } from "../../constants/hornEngine";
import { DESIGNER_TEXT, HORN_DRIVE_NAMES, HORN_PATH_NAMES } from "../../constants/designer";
import { HORN_DRIVE } from "../../constants/speakerSpec";
import { FIELD_ROW, shownIn } from "./designerFields";
import { hornText } from "./designerText";
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
  withStepsSmoothed,
  type HornSectionSize,
} from "./hornSections";

/** The drives the horn engine doesn't take yet: shown, not picked. */
const DRIVES_NOT_MODELED = keysOf(HORN_DRIVE_NAMES).filter((k) => k !== HORN_DRIVE.front);

/** Each size field of a section: its spec field, its label and its step. */
const SECTION_FIELDS: readonly { size: HornSectionSize; label: string; step: number }[] = [
  { size: "s1", label: DESIGNER_TEXT.hornStart, step: 1 },
  { size: "s2", label: DESIGNER_TEXT.hornEnd, step: 1 },
  { size: "length", label: DESIGNER_TEXT.portLength, step: 0.25 },
];

/** The Steps setting's choices: off (smooth) or on. */
const STEPS_OPTIONS = [
  [false, DESIGNER_TEXT.hornStepsOff],
  [true, DESIGNER_TEXT.hornStepsOn],
] as const;

/** A section's size as its field shows it: an area in in², a length in in. */
const shownSize = (s: HornSegment, size: HornSectionSize) =>
  size === "length" ? shownInOfCm(s.length) : shownIn2(s[size]);

interface Props {
  horn: SpeakerHorn;
  onEdit: (edit: (horn: SpeakerHorn) => SpeakerHorn) => void;
}

/**
 * A horn-loaded chamber's horn: its flare sections (profile, start and end area, length), throat chamber, path and
 * drive. The chamber's own net air and vent are the horn's rear chamber. The sections are smooth: each starts at the
 * previous section's end area, and only the first shows its start area. With Steps on (in the Advanced fold, and
 * always while the horn has a step) every section shows its start area, so a step can be made; Steps off smooths them.
 */
export function HornSettings({ horn, onEdit }: Props) {
  const { segments } = horn;
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
      <h5 className="text-sm font-semibold">{DESIGNER_TEXT.horn}</h5>
      <p className="text-xs text-stone-500 mb-2">{hornText(horn)}</p>
      <div className="text-sm text-stone-500 mb-1">{DESIGNER_TEXT.hornSections}</div>
      {segments.map((s, i) => (
        <div key={i} className="rounded border border-stone-300 px-3 pt-2 mb-2">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold">{DESIGNER_TEXT.hornSection(i + 1)}</span>
            {segments.length > 1 && (
              <Button size="xs" onClick={() => editSegments((list) => withSectionRemoved(list, i))}>
                {DESIGNER_TEXT.removeSection}
              </Button>
            )}
          </div>
          <ToggleGroup
            label={DESIGNER_TEXT.hornProfile}
            className="mb-2"
            value={s.profile}
            onChange={(profile) => editSegments((list) => withSectionProfile(list, i, profile))}
            options={entriesOf(HORN_PROFILE_NAMES)}
          />
          <div className={FIELD_ROW}>
            {/* a smooth horn's starts follow the previous ends: only the throat's shows */}
            {SECTION_FIELDS.filter(({ size }) => stepsOn || i === 0 || size !== "s1").map(
              ({ size, label, step }) => (
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
                    label={label}
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
            <p className="text-xs text-stone-500 mb-2">{DESIGNER_TEXT.hornStep(i + 1)}</p>
          )}
        </div>
      ))}
      <Button size="xs" className="mb-3" onClick={() => editSegments(withSectionAdded)}>
        {DESIGNER_TEXT.addSection}
      </Button>
      <AnimatedDetails
        summary={`${DESIGNER_TEXT.hornAdvanced} · ${DESIGNER_TEXT.hornSteps(steps)}`}
        className="mb-3 text-sm rounded border border-stone-300 px-3 py-2"
        summaryClassName="cursor-pointer py-1"
      >
        <ToggleGroup
          label={
            <Tooltip tip={DESIGNER_TEXT.hornStepsTip}>{DESIGNER_TEXT.hornStepsSetting}</Tooltip>
          }
          className="mt-2 mb-1"
          value={stepsOn}
          onChange={(on) => {
            setStepsOn(on);
            // off: every start back to the previous end
            if (!on) editSegments(withStepsSmoothed);
          }}
          options={STEPS_OPTIONS}
        />
      </AnimatedDetails>
      <NumberField
        label={<Tooltip tip={DESIGNER_TEXT.hornThroatTip}>{DESIGNER_TEXT.hornThroat}</Tooltip>}
        value={shownIn(horn.throatChamber)}
        min={0}
        step={0.1}
        unit="L"
        onChange={(throatChamber) => onEdit((h) => ({ ...h, throatChamber }))}
        className="mb-3"
      />
      <ToggleGroup
        label={<Tooltip tip={DESIGNER_TEXT.hornPathTip}>{DESIGNER_TEXT.hornPath}</Tooltip>}
        className="mb-3"
        value={horn.path}
        onChange={(path) => onEdit((h) => ({ ...h, path }))}
        options={entriesOf(HORN_PATH_NAMES)}
      />
      <ToggleGroup
        label={DESIGNER_TEXT.hornDrive}
        className="mb-1"
        value={horn.drive.kind}
        // only a front-loaded horn can be picked: the engine takes no other drive yet
        onChange={(kind) => {
          if (kind === HORN_DRIVE.front) onEdit((h) => ({ ...h, drive: { kind } }));
        }}
        options={entriesOf(HORN_DRIVE_NAMES)}
        disabled={{ values: DRIVES_NOT_MODELED, why: DESIGNER_TEXT.hornDriveNote }}
      />
      <p className="text-xs text-stone-500 mb-3">{DESIGNER_TEXT.hornDriveNote}</p>
    </section>
  );
}
