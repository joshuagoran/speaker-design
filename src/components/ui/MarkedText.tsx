/** A control's name in UI text: `**name**`. */
const MARK = /\*\*(.+?)\*\*/g;

/** UI text without its marks, for a plain-text attribute (an `aria-label`, a `title`). */
export const plainText = (text: string) => text.replace(MARK, "$1");

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
