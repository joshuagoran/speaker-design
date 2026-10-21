import { MarkedText } from "./MarkedText";

interface Props {
  /** a string's control names (`**name**`) show in semibold */
  children: React.ReactNode;
}

/** Small boxed message. */
export function Notice({ children }: Props) {
  return (
    <div className="text-xs text-amber-800 bg-amber-50 rounded border-l-4 border-amber-300 px-2 py-1">
      {typeof children === "string" ? <MarkedText text={children} /> : children}
    </div>
  );
}
