import { Button } from "./Button";
import { TextAreaField } from "./TextAreaField";
import { SHARE_MAX_NOTE_CHARS, SHARE_TEXT } from "../../constants/share";

interface Props {
  /** the sender's note, plain text */
  note: string;
  onNote: (note: string) => void;
  /** copies the link (on a phone, opens the share sheet) */
  onCopy: () => void;
}

/** The small panel under the Share button: an optional note for the one who opens the link, and Copy link. */
export function SharePanel({ note, onNote, onCopy }: Props) {
  return (
    <div className="flex flex-col gap-2 w-full sm:w-80 rounded border border-stone-300 bg-panel p-3">
      <TextAreaField
        label={SHARE_TEXT.noteLabel}
        value={note}
        onChange={onNote}
        rows={3}
        maxLength={SHARE_MAX_NOTE_CHARS}
      />
      <div>
        <Button variant="primary" size="xs" onClick={onCopy}>
          {SHARE_TEXT.copyLink}
        </Button>
      </div>
    </div>
  );
}
