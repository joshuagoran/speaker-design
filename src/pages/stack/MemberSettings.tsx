import type { StackMember } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { AutoNumberField } from "../../components/ui/AutoNumberField";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import { AUTO_DELAY } from "../../constants/speakerSpec";
import { STACK_STEPS } from "../../constants/speakerSteps";
import { STACK_TEXT } from "../../constants/stack";
import { UI_TEXT } from "../../constants/uiText";
import { STACK_EDIT_TEXT } from "../../constants/stackSpeakerEdit";
import { SPACE_PITCH_DEG } from "../../constants/space";
import { shownIn } from "../speaker/speakerFields";
import { FIELD_ROW } from "../../styles/layout";

interface Props {
  index: number;
  member: StackMember;
  /** each member's name, in the stack's order */
  names: readonly string[];
  /** the delay it plays with, ms (an auto delay worked out); null when its speaker isn't modeled */
  delayMs: number | null;
  onEdit: (edit: (member: StackMember) => StackMember) => void;
  onRemove: () => void;
  /** opens its speaker on the Speaker page for an edit; absent when the stack holds no copy of it */
  onEditSpeaker?: () => void;
}

/** The picker's id for the stack's base (a member's index for one under it). */
const BASE_ID = "base";

/** One member's settings: what it stands on and where, a mirror image, its level, its delay, and its polarity. */
export function MemberSettings({
  index,
  member,
  names,
  delayMs,
  onEdit,
  onRemove,
  onEditSpeaker,
}: Props) {
  const { pose } = member;
  const base: SelectOption = { id: BASE_ID, name: STACK_TEXT.base };
  // it can stand on an earlier member only
  const under = [base, ...names.slice(0, index).map((name, i) => ({ id: String(i), name }))];
  const auto = member.delayMs === AUTO_DELAY;
  const setPose = (edit: Partial<StackMember["pose"]>) =>
    onEdit((m) => ({ ...m, pose: { ...m.pose, ...edit } }));
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold min-w-0 truncate">{names[index]}</h4>
        <div className="flex flex-none gap-2">
          <Button
            size="xs"
            aria-label={STACK_EDIT_TEXT.editLabel(names[index])}
            onClick={onEditSpeaker}
            disabled={!onEditSpeaker}
          >
            {STACK_EDIT_TEXT.edit}
          </Button>
          <Button size="xs" onClick={onRemove}>
            {STACK_TEXT.remove}
          </Button>
        </div>
      </div>
      <SelectField
        label={STACK_TEXT.standsOn}
        options={under}
        value={pose.on === null ? base : byId(under, String(pose.on))}
        onChange={(o) => setPose({ on: o.id === BASE_ID ? null : Number(o.id) })}
      />
      <div className={FIELD_ROW}>
        <NumberField
          label={<Tooltip tip={STACK_TEXT.acrossTip}>{STACK_TEXT.across}</Tooltip>}
          value={shownIn(pose.xIn)}
          step={0.5}
          onChange={(xIn) => setPose({ xIn })}
        />
        <NumberField
          label={<Tooltip tip={STACK_TEXT.upTip}>{STACK_TEXT.up}</Tooltip>}
          value={shownIn(pose.yIn)}
          step={0.5}
          onChange={(yIn) => setPose({ yIn })}
        />
        <NumberField
          label={<Tooltip tip={STACK_TEXT.backTip}>{STACK_TEXT.back}</Tooltip>}
          value={shownIn(pose.zIn)}
          step={0.5}
          onChange={(zIn) => setPose({ zIn })}
        />
        <NumberField
          label={<Tooltip tip={STACK_TEXT.tiltTip}>{STACK_TEXT.tilt}</Tooltip>}
          value={pose.pitchDeg}
          min={-SPACE_PITCH_DEG}
          max={SPACE_PITCH_DEG}
          step={1}
          onChange={(pitchDeg) => setPose({ pitchDeg })}
        />
      </div>
      <ToggleButton on={member.mirror} onClick={() => onEdit((m) => ({ ...m, mirror: !m.mirror }))}>
        {STACK_TEXT.mirror}
      </ToggleButton>
      <NumberField
        label={STACK_TEXT.gain}
        value={Math.round(member.levelDb * 10) / 10}
        step={STACK_STEPS.levelDb}
        unit="dB"
        onChange={(levelDb) => onEdit((m) => ({ ...m, levelDb }))}
      />
      <AutoNumberField
        label={STACK_TEXT.delay}
        auto={auto}
        autoText={delayMs === null ? "—" : `${delayMs.toFixed(2)} ms`}
        value={member.delayMs === AUTO_DELAY ? 0 : member.delayMs}
        fieldLabel={STACK_TEXT.delay}
        min={0}
        step={STACK_STEPS.delayMs}
        unit="ms"
        onAuto={(on) =>
          onEdit((m) => ({
            ...m,
            // a set delay starts from the one auto works out
            delayMs: on ? AUTO_DELAY : Math.round((delayMs ?? 0) * 100) / 100,
          }))
        }
        onChange={(ms) => onEdit((m) => ({ ...m, delayMs: ms }))}
      />
      <ToggleButton
        on={member.invertPolarity}
        onClick={() => onEdit((m) => ({ ...m, invertPolarity: !m.invertPolarity }))}
      >
        {UI_TEXT.invertPolarity}
      </ToggleButton>
    </Card>
  );
}
