import { useState } from "react";
import { SettingsFold } from "../../components/ui/SettingsFold";
import { TextAreaField } from "../../components/ui/TextAreaField";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { Tooltip } from "../../components/ui/Tooltip";
import { SPEAKER_TEXT } from "../../constants/speakerPage";
import type { HornImport } from "./hornrespImport";

interface Props {
  /** reads a pasted record onto the chamber's horn, and gives how it went */
  onImport: (text: string) => HornImport;
}

/** A closed fold to paste a Hornresp record onto the horn, and what came of the last import. */
export function HornImportFold({ onImport }: Props) {
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<HornImport | null>(null);
  return (
    <SettingsFold title={SPEAKER_TEXT.hornImport}>
      <TextAreaField
        label={<Tooltip tip={SPEAKER_TEXT.hornImportTip}>{SPEAKER_TEXT.hornImportField}</Tooltip>}
        value={text}
        onChange={(v) => {
          setText(v);
          setOutcome(null);
        }}
      />
      <div>
        <Button
          variant="primary"
          size="xs"
          disabled={text.trim() === ""}
          onClick={() => setOutcome(onImport(text))}
        >
          {SPEAKER_TEXT.hornImportAction}
        </Button>
      </div>
      {outcome &&
        (outcome.ok ? (
          <>
            <p className="text-xs text-stone-500">{SPEAKER_TEXT.hornImportDone}</p>
            {outcome.frontChamberDropped && (
              <p className="text-xs text-stone-500">{SPEAKER_TEXT.hornImportFrontChamber}</p>
            )}
          </>
        ) : (
          <Notice>{SPEAKER_TEXT.hornImportFailed(outcome.reason)}</Notice>
        ))}
    </SettingsFold>
  );
}
