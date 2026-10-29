import { useState } from "react";
import type { SpeakerCabinet, SpeakerChamber } from "../../types";
import { Card } from "../../components/ui/Card";
import { StraightHornEditor } from "../../components/drawings/StraightHornEditor";
import type { StraightHornEdit } from "./straightHorn";

interface Props {
  cabinet: SpeakerCabinet;
  index: number;
  /** the chamber's name, at the start of the editor's tool row, when the speaker has more than one chamber */
  name: string | null;
  onEdit: (edit: StraightHornEdit) => void;
  /** a wall dragged: what to add to the chamber's depth and width, in */
  onResize: (grow: { depthIn: number; widthIn: number }) => void;
  /** Undo: the chamber as it was before the last drag */
  onRestore: (chamber: SpeakerChamber) => void;
}

/** A straight front-loaded horn chamber's editor (#255, the draw-first mock), with Undo back through its drags. */
export function StraightHornCard({ cabinet, index, name, onEdit, onResize, onRestore }: Props) {
  const [history, setHistory] = useState<readonly SpeakerChamber[]>([]);
  return (
    <Card className="sm:col-span-2">
      <StraightHornEditor
        cabinet={cabinet}
        index={index}
        name={name}
        onEdit={onEdit}
        onResize={onResize}
        onDragStart={() => {
          const now = cabinet.chambers[index];
          if (now) setHistory((h) => [...h, now]);
        }}
        onUndo={() => {
          const last = history[history.length - 1];
          if (!last) return;
          setHistory((h) => h.slice(0, -1));
          onRestore(last);
        }}
      />
    </Card>
  );
}
