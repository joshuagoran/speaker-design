import { useState } from "react";
import { Button } from "./Button";
import { Notice } from "./Notice";
import { SHARE_TEXT } from "../../constants/share";
import { RESULT_MAX_WIDTH } from "../../styles/layout";

/** What the shared view's notice shows and does. */
export interface SharedNoticeProps {
  /** what the design is, with a capital: "Speaker", "Stack" or "Space" */
  item: string;
  name: string;
  /** the sender's note, plain text; empty for none */
  note: string;
  /** signed in: the design can be saved as a copy */
  canSave: boolean;
  /** what saving a copy says now; empty before any */
  status: string;
  onSave: () => void;
  /** sends the design, changed or not, to someone (opens the Share panel) */
  onShare: () => void;
  /** whether the design changed since it opened or was last saved as a copy */
  changed: () => boolean;
  /** back to the page's own design */
  onClose: () => void;
}

/**
 * The notice at the top of the results while a link's design shows in place of the page's own: what it is, the sender's
 * note, and what to do with it: save a copy (signed in), share it on, or close it. Close asks first when the design
 * changed and no copy was saved.
 */
export function SharedNotice({
  item,
  name,
  note,
  canSave,
  status,
  onSave,
  onShare,
  changed,
  onClose,
}: SharedNoticeProps) {
  const [asking, setAsking] = useState(false);
  return (
    <div className={RESULT_MAX_WIDTH}>
      <Notice>
        <div className="flex flex-col gap-1">
          <p className="font-semibold break-words">{SHARE_TEXT.shared(item, name)}</p>
          {note && <p className="whitespace-pre-wrap break-words">{note}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {canSave ? (
              <Button
                variant="primary"
                size="xs"
                onClick={() => {
                  setAsking(false);
                  onSave();
                }}
              >
                {SHARE_TEXT.saveCopy}
              </Button>
            ) : (
              <span>{SHARE_TEXT.signInToSave}</span>
            )}
            <Button size="xs" onClick={onShare}>
              {SHARE_TEXT.button}
            </Button>
            {asking ? (
              <>
                <span>{SHARE_TEXT.closeAsk}</span>
                <Button size="xs" onClick={onClose}>
                  {SHARE_TEXT.close}
                </Button>
                <Button size="xs" onClick={() => setAsking(false)}>
                  {SHARE_TEXT.closeKeep}
                </Button>
              </>
            ) : (
              <Button size="xs" onClick={() => (changed() ? setAsking(true) : onClose())}>
                {SHARE_TEXT.close}
              </Button>
            )}
            {status && <span>{status}</span>}
          </div>
        </div>
      </Notice>
    </div>
  );
}
