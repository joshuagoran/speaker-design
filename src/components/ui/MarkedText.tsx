/** A control's name in UI text: `**name**`. */
const MARK = /\*\*(.+?)\*\*/g;

/** UI text with each control's name (`**name**`) in semibold. */
export function MarkedText({ text }: { text: string }) {
  // split with a capture group: every odd part is a marked name
  return (
    <>
      {text.split(MARK).map((part, k) =>
        k % 2 ? (
          <span key={k} className="font-semibold">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
