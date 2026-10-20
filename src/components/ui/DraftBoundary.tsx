import { Component, Fragment, type ReactNode } from "react";
import { clearPageDrafts, clearSharedViews } from "../../lib/savedDraft";

interface Props {
  /** the app; told whether a draft broke it and was dropped, so it can say so */
  children: (draftFailed: boolean) => ReactNode;
}

/** What the boundary holds. */
export interface BoundaryState {
  /** what the app threw and has not rendered again after; null while it renders */
  failed: { error: unknown } | null;
  /** how many times it was started again: each start is a new tree, so every page's state starts from its default */
  round: number;
}

/**
 * The state after the app threw and the drafts were cleared: the first throw starts again; a throw after that is not a
 * draft's (the default design broke), so the state stays and it goes on.
 */
export const boundaryAfterCatch = (s: BoundaryState): BoundaryState =>
  s.round === 0 ? { failed: null, round: s.round + 1 } : s;

/**
 * What the boundary shows for a state: nothing between the throw and the new start (the broken tree is not rendered
 * again), the error again when the start itself threw, or the app (told whether a draft broke it).
 */
export function boundaryView(
  s: BoundaryState,
): { show: "nothing" } | { show: "throw"; error: unknown } | { show: "app"; draftFailed: boolean } {
  if (s.failed) return s.round > 0 ? { show: "throw", error: s.failed.error } : { show: "nothing" };
  return { show: "app", draftFailed: s.round > 0 };
}

/**
 * Keeps a design the browser restored from breaking the app for good. When the app throws while it renders, the shared
 * views are cleared if there are any (a link's design is the likelier cause, and the drafts are the user's own work),
 * else every page's draft, and the app renders again from the default designs. It sits above the whole app because the pages'
 * design state is held there, so the throw can come from a page's state as well as from its view.
 */
export class DraftBoundary extends Component<Props, BoundaryState> {
  override state: BoundaryState = { failed: null, round: 0 };

  static getDerivedStateFromError(error: unknown): Pick<BoundaryState, "failed"> {
    return { failed: { error } };
  }

  override componentDidCatch() {
    // a shared view is the likelier cause, and the drafts are the user's own work: drop the shared view first
    if (!clearSharedViews()) clearPageDrafts();
    this.setState(boundaryAfterCatch);
  }

  override render() {
    const view = boundaryView(this.state);
    if (view.show === "throw") throw view.error;
    if (view.show === "nothing") return null;
    return <Fragment key={this.state.round}>{this.props.children(view.draftFailed)}</Fragment>;
  }
}
