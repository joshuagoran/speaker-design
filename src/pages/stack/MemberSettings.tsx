import type { StackMember } from "../../types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { NumberField } from "../../components/ui/NumberField";
import { SelectField, type SelectOption } from "../../components/ui/SelectField";
import { ToggleGroup } from "../../components/ui/ToggleGroup";
import { ToggleButton } from "../../components/ui/ToggleButton";
import { Tooltip } from "../../components/ui/Tooltip";
import { byId } from "../../lib/tables";
import { entriesOf } from "../../lib/records";
import { SET_BY, SET_BY_NAMES } from "../../constants/designer";
import { AUTO_DELAY } from "../../constants/speakerSpec";
import { STACK_TEXT } from "../../constants/stack";
import { FIELD_ROW, shownIn } from "../designer/designerFields";

interface Props {
  index: number;
  member: StackMember;
  /** each member's name, in the stack's order */
  names: readonly string[];
  /** the delay it plays with, ms (an auto delay worked out); null when its speaker isn't modeled */
  delayMs: number | null;
  onEdit: (edit: (member: StackMember) => StackMember) => void;
  onRemove: () => void;
}

/** The picker's id for the stack's base (a member's index for one under it). */
const BASE_ID = "base";

/** One member's settings: what it stands on and where, a mirror image, its level and its delay. */
export function MemberSettings({ index, member, names, delayMs, onEdit, onRemove }: Props) {
  const { pose } = member;
  const base: SelectOption = { id: BASE_ID, name: STACK_TEXT.base };
  // it can stand on an earlier member only
  const under = [base, ...names.slice(0, index).map((name, i) => ({ id: String(i), name }))];
  const auto = member.delayMs === AUTO_DELAY;
  const setPose = (edit: Partial<StackMember["pose"]>) =>
    onEdit((m) => ({ ...m, pose: { ...m.pose, ...edit } }));
  return (
    <Card className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold min-w-0 truncate">{names[index]}</h4>
        <Button size="xs" onClick={onRemove}>
          {STACK_TEXT.remove}
        </Button>
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
      </div>
      <ToggleButton
        className="mb-3"
        on={member.mirror}
        onClick={() => onEdit((m) => ({ ...m, mirror: !m.mirror }))}
      >
        {STACK_TEXT.mirror}
      </ToggleButton>
      <NumberField
        label={STACK_TEXT.level}
        value={Math.round(member.levelDb * 10) / 10}
        step={0.5}
        unit="dB"
        onChange={(levelDb) => onEdit((m) => ({ ...m, levelDb }))}
      />
      <ToggleGroup
        label={STACK_TEXT.delay}
        className="mb-2"
        value={auto ? SET_BY.auto : SET_BY.custom}
        onChange={(v) =>
          onEdit((m) => ({
            ...m,
            // a set delay starts from the one auto works out
            delayMs: v === SET_BY.auto ? AUTO_DELAY : Math.round((delayMs ?? 0) * 100) / 100,
          }))
        }
        options={entriesOf(SET_BY_NAMES)}
      />
      {auto ? (
        <p className="text-xs text-stone-500 mb-2">
          {delayMs === null ? "—" : `${delayMs.toFixed(2)} ms`}
        </p>
      ) : (
        <NumberField
          label={STACK_TEXT.delay}
          value={member.delayMs === AUTO_DELAY ? 0 : member.delayMs}
          min={0}
          step={0.1}
          unit="ms"
          onChange={(ms) => onEdit((m) => ({ ...m, delayMs: ms }))}
        />
      )}
    </Card>
  );
}
