import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { STACK_EDIT_TEXT } from "../../constants/stackSpeakerEdit";
import { RESULT_MAX_WIDTH } from "../../styles/layout";
import type { SpeakerSpec, StackSpeakerEdit } from "../../types";

/** What the notice shows and does while the Speaker page shows a Stack's speaker. */
export interface StackEditNoticeProps {
  speakerName: SpeakerSpec["name"];
  stackName: StackSpeakerEdit["stackName"];
  /** signed in: the speaker is saved before the Stack takes it */
  canSave: boolean;
  /** whether the save runs: the buttons wait for it */
  busy: boolean;
  /** what the save says now (the library's message); empty before any */
  status: string;
  /** saves the speaker where it can, gives it to the Stack, and goes back to the Stack page */
  onSave: () => void;
  /** goes back to the Stack page with no change */
  onCancel: () => void;
}

/** The notice at the top of the Speaker page's results, in place of the save row, while it shows a Stack's speaker. */
export function StackEditNotice({
  speakerName,
  stackName,
  canSave,
  busy,
  status,
  onSave,
  onCancel,
}: StackEditNoticeProps) {
  return (
    <div className={RESULT_MAX_WIDTH}>
      <Notice>
        <div className="flex flex-col gap-1">
          <p className="font-semibold break-words">
            {STACK_EDIT_TEXT.editing(speakerName, stackName)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="xs" onClick={onSave} disabled={busy}>
              {canSave ? STACK_EDIT_TEXT.saveAndReturn : STACK_EDIT_TEXT.returnOnly}
            </Button>
            <Button size="xs" onClick={onCancel} disabled={busy}>
              {STACK_EDIT_TEXT.cancel}
            </Button>
            {status && <span>{status}</span>}
          </div>
        </div>
      </Notice>
    </div>
  );
}
