import { Component, Fragment, type ReactNode } from "react";
import { clearPageDrafts } from "../../lib/savedDraft";

interface Props {
  /** the app; told whether a draft broke it and was dropped, so it can say so */
  children: (draftFailed: boolean) => ReactNode;
}

interface State {
  /** what the app threw and has not rendered again after; null while it renders */
  failed: { error: unknown } | null;
  /** how many times it was started again: each start is a new tree, so every page's state starts from its default */
  round: number;
}

/**
 * Keeps a design the browser restored from breaking the app for good. When the app throws while it renders, every page's
 * draft is cleared and the app renders again from the default designs. It sits above the whole app because the pages'
 * design state is held there, so the throw can come from a page's state as well as from its view.
 */
export class DraftBoundary extends Component<Props, State> {
  override state: State = { failed: null, round: 0 };

  static getDerivedStateFromError(error: unknown): Pick<State, "failed"> {
    return { failed: { error } };
  }

  override componentDidCatch() {
    clearPageDrafts();
    // the first throw starts again; a throw after that is not a draft's (the default design broke), so it goes on
    if (this.state.round === 0) this.setState((s) => ({ failed: null, round: s.round + 1 }));
  }

  override render() {
    const { failed, round } = this.state;
    // nothing renders between the throw and the new start, so the broken tree is not rendered again
    if (failed) {
      if (round > 0) throw failed.error;
      return null;
    }
    return <Fragment key={round}>{this.props.children(round > 0)}</Fragment>;
  }
}
