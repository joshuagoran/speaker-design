import { useState } from "react";
import { oneAtATime } from "../../components/saved-configs/saveActions";
import type { ConfigStore } from "../../components/saved-configs/useConfigStore";
import type { AppPage } from "../../constants/pages";
import type { StackEditNoticeProps } from "../speaker/StackEditNotice";
import type { SpeakerPageState } from "../speaker/useSpeakerPage";
import type { StackPlanner } from "./useStack";
import { saveStackSpeaker, withStackSpeaker } from "./stackSpeakerEdit";
import type { StackMember } from "../../types";

interface Pages {
  speakerPage: Pick<SpeakerPageState, "spec" | "stackEditView"> & {
    store: Pick<ConfigStore, "db" | "cfgMsg" | "saved" | "create" | "overwrite" | "exists">;
  };
  stack: Pick<StackPlanner, "design" | "editDesign">;
  /** shows a page */
  goTo: (page: AppPage) => void;
}

/**
 * A Stack's speaker edited on the Speaker page: `edit` opens a member's speaker there (in place of the page's own
 * design), and `notice` is what the Speaker page shows meanwhile: save it and give it to the Stack, or go back.
 */
export function useStackSpeakerEdit({ speakerPage, stack, goTo }: Pages) {
  const { spec, store, stackEditView } = speakerPage;
  /** whether the save runs: the notice's buttons wait for it */
  const [busy, setBusy] = useState(false);
  const [run] = useState(() => oneAtATime(setBusy));
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
    // signed out, only the Stack's copy changes
    onSave: () =>
      void run(async () => {
        const saved = canSave ? await saveStackSpeaker(store, spec) : spec;
        if (!saved) return;
        stack.editDesign((d) => withStackSpeaker(d, edit.speakerId, saved));
        back();
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
