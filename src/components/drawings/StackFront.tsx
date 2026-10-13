import type { SpeakerSpec, StackSpec } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { stackLayout } from "../../lib/speaker/stackLayout";
import { SpeakerFront, speakerFrontFrame } from "./SpeakerFront";

interface Props {
  stack: Pick<StackSpec, "members">;
  speakers: readonly SpeakerSpec[];
  /** the listening point's height above the stack's base, in: drawn as a dashed line */
  listenHeightIn: number;
}

/** The margin round the drawing, in. */
const MARGIN_IN = 2;

/**
 * Front view of a stack, to scale: each member's front drawing (`SpeakerFront`) where the stack places it, flipped for
 * a mirrored member, on the base line, with the listening axis dashed across.
 */
export function StackFront({ stack, speakers, listenHeightIn }: Props) {
  const pal = usePalette();
  /** each member's drawing box, in the stack: across (unflipped, and as drawn) and up, its margin included */
  const boxes = stackLayout(stack, speakers).flatMap(({ speaker, at }, k) => {
    if (!speaker) return [];
    const frame = speakerFrontFrame(speaker.cabinet);
    if (!frame.layout.chambers.length) return [];
    const mirror = stack.members[k]?.mirror ?? false;
    const x0 = at.x + frame.minX - frame.padIn,
      x1 = at.x + frame.maxX + frame.padIn;
    return [
      {
        speaker,
        mirror,
        cx: at.x,
        x0,
        // a mirror image spans the other side of its center line
        drawn: mirror ? [2 * at.x - x1, 2 * at.x - x0] : [x0, x1],
        w: x1 - x0,
        y0: at.y - frame.padIn,
        y1: at.y + frame.maxY + frame.padIn,
      },
    ];
  });
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.drawn[0])) - MARGIN_IN,
    maxX = Math.max(...boxes.map((b) => b.drawn[1])) + MARGIN_IN,
    maxY = Math.max(listenHeightIn, ...boxes.map((b) => b.y1)) + MARGIN_IN,
    minY = Math.min(0, ...boxes.map((b) => b.y0)) - MARGIN_IN;
  const X = (x: number) => x - minX,
    Y = (y: number) => maxY - y;
  /** a line's width: a fixed share of the drawing's height */
  const line = (maxY - minY) / 300;
  return (
    <svg
      viewBox={`0 0 ${maxX - minX} ${maxY - minY}`}
      className="w-full h-full"
      role="img"
      aria-label={`Front view of the stack, ${boxes.length} box${boxes.length === 1 ? "" : "es"}`}
    >
      <line x1={0} x2={maxX - minX} y1={Y(0)} y2={Y(0)} stroke={pal.ink} strokeWidth={line * 2} />
      <line
        x1={0}
        x2={maxX - minX}
        y1={Y(listenHeightIn)}
        y2={Y(listenHeightIn)}
        stroke={pal.muted}
        strokeWidth={line * 1.5}
        strokeDasharray={`${line * 8} ${line * 6}`}
      />
      {boxes.map((b, k) => (
        // the member's own drawing in its box, flipped about its center line for a mirror image
        <g key={k} transform={b.mirror ? `translate(${2 * X(b.cx)} 0) scale(-1 1)` : undefined}>
          <svg x={X(b.x0)} y={Y(b.y1)} width={b.w} height={b.y1 - b.y0}>
            <SpeakerFront spec={b.speaker} />
          </svg>
        </g>
      ))}
    </svg>
  );
}
