interface Props extends React.HTMLAttributes<HTMLDivElement> {
  pad?: "md" | "lg";
  tone?: "white" | "tint";
}

/** Panel: one outline, one radius. pad: "md" (default) or "lg"; tone: "white" or "tint" */
export function Card({ pad = "md", tone = "white", className = "", ...p }: Props) {
  return (
    <div
      {...p}
      className={`rounded border border-stone-300 ${tone === "tint" ? "bg-stone-50" : "bg-white"} ${pad === "lg" ? "px-4 py-4" : "px-3 py-3"} ${className}`}
    />
  );
}
