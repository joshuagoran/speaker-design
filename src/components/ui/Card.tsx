import { HOVER_TRANSITION } from "./buttonStyles";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  pad?: "none" | "md" | "lg";
  tone?: "white" | "tint";
}

/** Panel: one outline, one radius; the outline darkens while a control inside has focus. pad: "md" (default), "lg", or "none" (a card whose content pads itself); tone: "white" or "tint" */
export function Card({ pad = "md", tone = "white", className = "", ...p }: Props) {
  return (
    <div
      {...p}
      className={`rounded border border-stone-300 focus-within:border-stone-500 ${HOVER_TRANSITION} ${tone === "tint" ? "bg-stone-50" : "bg-panel"} ${pad === "lg" ? "px-4 py-4" : pad === "none" ? "" : "px-3 py-3"} ${className}`}
    />
  );
}
