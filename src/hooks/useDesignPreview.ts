import { useState } from "react";
import type { DesignPreview } from "../types";

interface Options<Card, Config> {
  /** the design as it is now */
  snapshot: () => Config;
  /** sets the design from a card; a card sets only the fields the search changes */
  applyCard: (card: Card) => void;
  /** puts a snapshot back */
  restore: (config: Config) => void;
}

/**
 * Previewing, loading and undoing an optimizer card on the design. The design to go back to is the one from before
 * the first preview, however many cards are previewed in a row.
 */
export function useDesignPreview<Card extends { label: string }, Config>({
  snapshot,
  applyCard,
  restore,
}: Options<Card, Config>) {
  const [designPreview, setDesignPreview] = useState<DesignPreview<Card, Config> | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Config | null>(null);
  /** the design a search starts from: the one before the preview, if one is showing */
  const baseDesign = () => (designPreview ? designPreview.before : snapshot());
  const previewOptimizerResult = (card: Card) => {
    const before = baseDesign();
    applyCard(card);
    setDesignPreview({ label: card.label, before, card });
  };
  const exitPreview = () => {
    if (designPreview) restore(designPreview.before);
    setDesignPreview(null);
  };
  /** loads the card and returns the design it replaced */
  const loadOptimizerResult = (card: Card) => {
    const before = baseDesign();
    applyCard(card);
    setDesignPreview(null);
    setUndoSnapshot(before);
    return before;
  };
  const undoOptimizerLoad = () => {
    if (undoSnapshot) restore(undoSnapshot);
    setUndoSnapshot(null);
  };
  /** drops the preview and the undo (a restored saved design makes them stale) */
  const clearDesignPreview = () => {
    setDesignPreview(null);
    setUndoSnapshot(null);
  };
  return {
    designPreview,
    undoSnapshot,
    baseDesign,
    previewOptimizerResult,
    exitPreview,
    loadOptimizerResult,
    undoOptimizerLoad,
    clearDesignPreview,
  };
}
