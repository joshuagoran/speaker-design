import type {
  Dims2,
  DriverLayout,
  HifiPort,
  HifiTweeter,
  HifiWoofer,
  PassiveRadiatorChoice,
} from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { RADIATOR_PANEL } from "../../lib/hifi/hifi";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { radiatorSpots, roundPortSpots, slotOpening } from "../../lib/hifi/boxLayout";

interface Props {
  /** the box's outside size, inches */
  dim: Dims2;
  /** the panels' thickness, inches */
  wall: number;
  w: HifiWoofer;
  t: HifiTweeter;
  lay: DriverLayout;
  vented: boolean;
  port: HifiPort;
  pr: Pick<PassiveRadiatorChoice, "drv" | "n"> | null;
  /** the waveguide's mouth, inches; null for a bare tweeter */
  guide: Dims2 | null;
  small?: boolean;
  /** the baffle edges' roundover radius, inches (drawn as the line where the curve starts); 0 or absent: sharp */
  roundoverIn?: number;
  /** the tweeter's offset from the center line, inches, + toward the inside (drawn as the left speaker: inside is to the right) */
  tweeterOffsetIn?: number;
}

/** Front view of the box and drivers, to scale. */
export function HifiFront({
  dim,
  wall,
  w,
  t,
  lay,
  vented,
  port,
  pr,
  guide,
  small,
  roundoverIn = 0,
  tweeterOffsetIn = 0,
}: Props) {
  const pal = usePalette();
  const face = guide ? { w: guide.w, h: guide.h } : t.faceplate;
  const top = lay.onTop ? face.h : 0,
    k = 120 / Math.max(dim.h + top, dim.w * 1.2, face.w * 1.2),
    W = Math.max(dim.w, face.w) * k,
    H = (dim.h + top) * k;
  const bx = (W - dim.w * k) / 2,
    y = (inch: number) => (dim.h + top - inch) * k,
    tx = W / 2 + (lay.onTop ? 0 : tweeterOffsetIn) * k,
    // the line where the roundover starts, kept inside the box when the radius is most of it
    ro = Math.max(0, Math.min(roundoverIn, dim.w / 2 - 0.1, dim.h / 2 - 0.1));
  const slot = vented && port.shape === "slot" ? slotOpening(dim, wall, port) : null;
  return (
    <svg
      viewBox={`-4 -4 ${W + 8} ${H + 8}`}
      className={small ? "w-full h-auto max-h-40" : "h-40 w-auto"}
      role="img"
      aria-label={`Front view, ${dim.w} × ${dim.h}″${lay.onTop ? ", waveguide on top" : ""}${roundoverIn ? `, ${roundoverIn}″ roundover` : ""}${tweeterOffsetIn && !lay.onTop ? `, tweeter ${Math.abs(tweeterOffsetIn)}″ ${tweeterOffsetIn > 0 ? "inward" : "outward"}` : ""}`}
    >
      <rect
        x={bx}
        y={top * k}
        width={dim.w * k}
        height={dim.h * k}
        rx="2"
        fill={pal.edge}
        stroke={pal.ink}
        strokeWidth="1.2"
      />
      {ro > 0 && (
        <rect
          x={bx + ro * k}
          y={(top + ro) * k}
          width={(dim.w - 2 * ro) * k}
          height={(dim.h - 2 * ro) * k}
          rx="2"
          fill="none"
          stroke={pal.muted}
          strokeWidth="0.8"
          strokeDasharray="2 2"
        />
      )}
      {lay.onTop ? (
        <g>
          <rect
            x={W / 2 - (face.w * k) / 8}
            y={top * k - 3}
            width={(face.w * k) / 4}
            height={3}
            fill={pal.ink}
          />
          <rect
            x={W / 2 - (face.w * k) / 2}
            y={0}
            width={face.w * k}
            height={top * k - 3}
            rx={(face.h * k) / 3}
            fill={pal.muted}
            stroke={pal.ink}
            strokeWidth="1"
          />
        </g>
      ) : (
        <rect
          x={tx - (face.w * k) / 2}
          y={y(lay.tweeterIn) - (face.h * k) / 2}
          width={face.w * k}
          height={face.h * k}
          rx={guide ? 3 : (face.w * k) / 2}
          fill={pal.muted}
        />
      )}
      <circle cx={tx} cy={y(lay.tweeterIn)} r={0.5 * k} fill={pal.edge} />
      <circle
        cx={W / 2}
        cy={y(lay.wooferIn)}
        r={(w.size * HIFI_FRONT_PARTS.wooferFramePerSize * k) / 2}
        fill={pal.edge}
        stroke={pal.muted}
      />
      {pr &&
        radiatorSpots(pr, RADIATOR_PANEL, wall).map(({ y: cy, shape: s }, i) => (
          <rect
            key={`r${i}`}
            x={W / 2 - (s.w * k) / 2}
            y={y(cy) - (s.h * k) / 2}
            width={s.w * k}
            height={s.h * k}
            rx={(s.w * k) / 2}
            fill="none"
            stroke={pal.muted}
            strokeDasharray="3 2"
          />
        ))}
      {slot && (
        <rect
          x={W / 2 - (slot.w * k) / 2}
          y={y(slot.y + slot.h)}
          width={slot.w * k}
          height={slot.h * k}
          fill={pal.ink}
        />
      )}
      {vented &&
        port.shape !== "slot" &&
        roundPortSpots(port).map((p, i) => (
          <circle key={i} cx={W / 2 + p.x * k} cy={y(p.y)} r={p.r * k} fill={pal.ink} />
        ))}
    </svg>
  );
}
