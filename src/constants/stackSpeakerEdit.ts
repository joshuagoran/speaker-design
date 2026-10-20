// The words of a Stack's speaker edited on the Speaker page: the Edit button on the Stack page, and the notice on the
// Speaker page. It imports nothing, so the Node checks (tests/stack-edit-check.mjs) can read it.

export const STACK_EDIT_TEXT = {
  /** the button on a box's card on the Stack page */
  edit: "Edit Speaker",
  /** the same button, as screen readers hear it: the box's name */
  editLabel: (box: string) => `Edit ${box}`,
  /** the notice on the Speaker page while it shows the speaker */
  editing: (speaker: string, stack: string) => `Editing “${speaker}” for the Stack “${stack}”.`,
  saveAndReturn: "Save & return to Stack",
  /** the same button when the speaker cannot be saved (signed out, or saving is unavailable) */
  returnOnly: "Return to Stack",
  cancel: "Cancel",
  /** what the Stack page says when the box was removed during the edit: saved, or (signed out) not */
  boxRemoved: (speaker: string, saved: boolean) =>
    saved
      ? `Saved “${speaker}”. Its box was removed from this Stack.`
      : `Its box was removed from this Stack.`,
} as const;
