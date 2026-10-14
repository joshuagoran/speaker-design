import { HOVER_TRANSITION } from "./buttonStyles";
import { GAP_Y } from "../../styles/layout";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  pad?: "none" | "md" | "lg";
  tone?: "white" | "tint";
  /** whether the card spaces its children with the `GAP_Y` gap (default); false for a card that lays its content out itself */
  gapY?: boolean;
}

/** Panel: one outline, one radius; the outline darkens while a control inside has focus. pad: "md" (default), "lg", or "none" (a card whose content pads itself); tone: "white" or "tint"; the card spaces its children (`GAP_Y`), so a field in it carries no margin */
export function Card({ pad = "md", tone = "white", gapY = true, className = "", ...p }: Props) {
  return (
    <div
      {...p}
      className={`rounded border border-stone-300 focus-within:border-stone-500 ${HOVER_TRANSITION} ${tone === "tint" ? "bg-stone-50" : "bg-panel"} ${pad === "lg" ? "px-4 py-4" : pad === "none" ? "" : "px-3 py-3"} ${gapY ? GAP_Y : ""} ${className}`}
    />
  );
}
