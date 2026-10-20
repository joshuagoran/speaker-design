// The words of a Stack's speaker edited on the Speaker page: the Edit button on the Stack page, and the notice on the
// Speaker page. It imports nothing, so the Node checks (tests/stack-edit-check.mjs) can read it.

export const STACK_EDIT_TEXT = {
  /** the button on a box's card on the Stack page */
  edit: "Edit",
  /** the same button, as screen readers hear it: the box's name */
  editLabel: (box: string) => `Edit ${box}`,
  editTip: "Opens this box's speaker on the Speaker page. Your own design there stays as it is.",
  /** the notice on the Speaker page while it shows the speaker */
  editing: (speaker: string, stack: string) => `Editing “${speaker}” for the Stack “${stack}”.`,
  saveAndReturn: "Save & return to Stack",
  saveAndReturnTip:
    "Saves this speaker to your saved speakers. Then every box of the Stack with this speaker uses it.",
  /** the same button when the speaker cannot be saved (signed out, or saving is unavailable) */
  returnOnly: "Return to Stack",
  returnOnlyTip: "Every box of the Stack with this speaker uses it. Nothing is saved.",
  cancel: "Cancel",
  cancelTip: "Goes back to the Stack. The Stack does not change.",
} as const;
