/** A control's name in UI text: `**name**`. */
const MARK = /\*\*(.+?)\*\*/g;

/** Stands in for a typed `*` (a private-use character): it never makes a mark, and shows as `*`. */
const LITERAL_STAR = "";
const LITERAL_STARS = new RegExp(LITERAL_STAR, "g");

/** A name the user typed, for UI text: its asterisks show as typed and never make a mark. */
export const literal = (name: string) => name.replaceAll("*", LITERAL_STAR);

const shown = (text: string) => text.replace(LITERAL_STARS, "*");

/** UI text without its marks, for a plain-text attribute (an `aria-label`, a `title`). */
export const plainText = (text: string) => shown(text.replace(MARK, "$1"));

/** UI text with each control's name (`**name**`) in semibold. */
export function MarkedText({ text }: { text: string }) {
  // split with a capture group: every odd part is a marked name
  return (
    <>
      {text.split(MARK).map((part, k) =>
        k % 2 ? (
          <span key={k} className="font-semibold">
            {shown(part)}
          </span>
        ) : (
          shown(part)
        ),
      )}
    </>
  );
}
