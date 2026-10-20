import { useEffect, useRef, useState } from "react";
import { oneAtATime } from "../../components/saved-configs/saveActions";
import type { ConfigStore } from "../../components/saved-configs/useConfigStore";
import type { AppPage } from "../../constants/pages";
import { STACK_EDIT_TEXT } from "../../constants/stackSpeakerEdit";
import type { StackEditNoticeProps } from "../speaker/StackEditNotice";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import type { StackPlanner } from "./useStack";
import { saveStackSpeaker, withStackSpeaker } from "./stackSpeakerEdit";
import type { StackMember } from "../../types";

interface Pages {
  speakerPage: Pick<SpeakerPageState, "spec" | "stackEditView"> & {
    store: Pick<ConfigStore, "db" | "cfgMsg" | "saved" | "create" | "overwrite" | "exists">;
  };
  stack: Pick<StackPlanner, "design" | "setDesign" | "round"> & {
    store: Pick<ConfigStore, "flash">;
  };
  /** shows a page */
  goTo: (page: AppPage) => void;
}

/**
 * A Stack's speaker edited on the Speaker page: `edit` opens a member's speaker there (in place of the page's design),
 * and `notice` is what the Speaker page shows meanwhile: save it and give it to the Stack, or go back. The edit ends
 * when the Stack page replaces its whole stack.
 */
export function useStackSpeakerEdit({ speakerPage, stack, goTo }: Pages) {
  const { spec, store, stackEditView } = speakerPage;
  /** whether the save runs: the notice's buttons wait for it */
  const [busy, setBusy] = useState(false);
  const [run] = useState(() => oneAtATime(setBusy));
  // another stack on the Stack page (opened, started, a link's): the edit was for the one before, so it ends
  const [round, setRound] = useState(stack.round);
  if (round !== stack.round) {
    setRound(stack.round);
    stackEditView.close();
  }
  /** the Stack as it is now, read after the save resolves */
  const design = useRef(stack.design);
  useEffect(() => {
    design.current = stack.design;
  });
  const back = () => {
    stackEditView.close();
    goTo("stack");
  };
  const edit = stackEditView.edit;
  const canSave = Boolean(store.db);
  const notice: StackEditNoticeProps | null = edit && {
    speakerName: spec.name,
    stackName: edit.stackName,
    canSave,
    busy,
    status: store.cfgMsg,
    onSave: () =>
      void run(async () => {
        // signed out, only the Stack's copy changes
        const saved = canSave ? await saveStackSpeaker(store, spec) : spec;
        // a failed save stays on the edit; a cancelled or ended one goes nowhere
        if (!saved || !stackEditView.isOpen(edit)) return;
        if (design.current.speakers.some((s) => s.id === edit.speakerId)) {
          // a whole replace: the optimizer's cards, locks and Undo name the old speaker id
          stack.setDesign((d) => withStackSpeaker(d, edit.speakerId, saved));
        } else stack.store.flash(STACK_EDIT_TEXT.boxRemoved(saved.name, canSave));
        back();
        // the save the edit wrote over is no longer the own design's
        if (canSave) stackEditView.detachOwn(saved.id);
      }),
    onCancel: back,
  };
  return {
    /** opens the speaker the Stack's members name `speakerId` by on the Speaker page */
    edit: (speakerId: StackMember["speakerId"]) => {
      const speaker = stack.design.speakers.find((s) => s.id === speakerId);
      if (!speaker) return;
      stackEditView.open(speaker, { stackName: stack.design.stack.name, speakerId });
      goTo("speaker");
    },
    notice,
  };
}
