import { useMemo } from "react";
import type { HornFold, SpeakerCabinet, SpeakerChamber, SpeakerHorn } from "../../types";
import { FoldEditor } from "../../components/drawings/FoldEditor";
import { Card } from "../../components/ui/Card";
import { Notice } from "../../components/ui/Notice";
import { CardHeading } from "../../components/ui/CardHeading";
import { Tooltip } from "../../components/ui/Tooltip";
import { foldRoom, isDrawn, startFold } from "../../lib/speaker/foldHorn";
import { FOLD_EDITOR_TEXT } from "../../constants/speakerPage";

interface Props {
  cabinet: Pick<SpeakerCabinet, "chambers" | "panel" | "construction" | "insetIn">;
  chamber: SpeakerChamber;
  horn: SpeakerHorn;
  /** the heading's chamber name, when the speaker has more than one chamber */
  name: string | null;
  onFold: (fold: HornFold) => void;
}

/**
 * A folded horn chamber's side view as its editor (`FoldEditor`), in the chamber's clear room. Before the user draws,
 * it starts from an empty box and says that the response shows the straight horn.
 */
export function FoldHornCard({ cabinet, chamber, horn, name, onFold }: Props) {
  const key = JSON.stringify(foldRoom(cabinet, chamber));
  // one room object per size, so the editor keeps its trace while nothing about the room changes
  const room = useMemo(
    () => JSON.parse(key) as ReturnType<typeof foldRoom>, // boundary cast: the key is that room, stringified
    [key],
  );
  const fold = useMemo(() => horn.fold ?? startFold(room.heightIn), [horn.fold, room.heightIn]);
  return (
    <Card className="sm:col-span-2">
      <CardHeading>
        <Tooltip tip={FOLD_EDITOR_TEXT.key}>
          {name ? `${FOLD_EDITOR_TEXT.heading}: ${name}` : FOLD_EDITOR_TEXT.heading}
        </Tooltip>
      </CardHeading>
      {!isDrawn(horn.fold) && <Notice>{FOLD_EDITOR_TEXT.notDrawn}</Notice>}
      <FoldEditor
        room={room}
        fold={fold}
        target={horn.segments}
        setType={horn.drive.kind}
        onChange={onFold}
      />
    </Card>
  );
}
