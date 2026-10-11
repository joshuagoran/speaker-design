import type {
  Dims2,
  DriverLayout,
  HifiPort,
  HifiTweeter,
  HifiWoofer,
  PassiveRadiatorChoice,
} from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { RADIATOR_PANEL, isAmt, isRibbon } from "../../lib/hifi/hifi";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { amtOpening, radiatorSpots, roundPortSpots, slotOpening } from "../../lib/hifi/boxLayout";

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

/**
 * A ribbon's own waveguide from the front, centered on (cx, cy), `w` by `h` px: the square plate, its flared
 * rectangular throat (the mouth's outline and the creases from its corners) and the tall, narrow slot over the ribbon,
 * sized from `HIFI_FRONT_PARTS.ribbon` as the 3D view draws it.
 */
export function RibbonPlate({
  cx,
  cy,
  w,
  h,
  corner,
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** the plate's corner radius, px */
  corner: number;
}) {
  const pal = usePalette();
  const R = HIFI_FRONT_PARTS.ribbon;
  const mw = w * R.mouth.w,
    mh = h * R.mouth.h,
    mr = Math.min(mw, mh) * HIFI_FRONT_PARTS.guideCornerPerSize,
    sw = w * R.slot.w,
    sh = h * R.slot.h;
  // each crease runs from the mouth's rounded corner (its arc's middle) to the slot's corner
  const inset = mr * (1 - Math.SQRT1_2);
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sy) => [sx, sy] as const));
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={corner} fill={pal.muted} />
      {corners.map(([sx, sy]) => (
        <line
          key={`${sx}${sy}`}
          x1={cx + sx * (mw / 2 - inset)}
          y1={cy + sy * (mh / 2 - inset)}
          x2={cx + (sx * sw) / 2}
          y2={cy + (sy * sh) / 2}
          stroke={pal.edge}
          strokeWidth="0.6"
        />
      ))}
      <rect
        x={cx - mw / 2}
        y={cy - mh / 2}
        width={mw}
        height={mh}
        rx={mr}
        fill="none"
        stroke={pal.edge}
        strokeWidth="0.8"
      />
      <rect x={cx - sw / 2} y={cy - sh / 2} width={sw} height={sh} fill={pal.edge} />
    </g>
  );
}

/**
 * An AMT's flat plate from the front, centered on (cx, cy), `plate` inches at `k` px per inch: the plate, its opening
 * onto the folded diaphragm and the folds across the opening's short side (`amtOpening`), as the 3D view draws it.
 */
export function AmtPlate({
  cx,
  cy,
  plate,
  k,
}: {
  cx: number;
  cy: number;
  plate: Dims2;
  k: number;
}) {
  const pal = usePalette();
  const open = amtOpening(plate);
  const ow = open.w * k,
    oh = open.h * k;
  return (
    <g>
      <rect
        x={cx - (plate.w * k) / 2}
        y={cy - (plate.h * k) / 2}
        width={plate.w * k}
        height={plate.h * k}
        rx={HIFI_FRONT_PARTS.plateCornerIn * k}
        fill={pal.muted}
      />
      <rect
        x={cx - ow / 2}
        y={cy - oh / 2}
        width={ow}
        height={oh}
        rx={HIFI_FRONT_PARTS.amt.openingCornerIn * k}
        fill={pal.edge}
      />
      {open.folds.map((off) =>
        open.tall ? (
          <line
            key={off}
            x1={cx - ow / 2}
            x2={cx + ow / 2}
            y1={cy + off * k}
            y2={cy + off * k}
            stroke={pal.muted}
            strokeWidth="0.5"
          />
        ) : (
          <line
            key={off}
            x1={cx + off * k}
            x2={cx + off * k}
            y1={cy - oh / 2}
            y2={cy + oh / 2}
            stroke={pal.muted}
            strokeWidth="0.5"
          />
        ),
      )}
    </g>
  );
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
    ro = Math.max(0, Math.min(roundoverIn, dim.w / 2 - 0.1, dim.h / 2 - 0.1)),
    wooferR = (w.size * HIFI_FRONT_PARTS.wooferFramePerSize * k) / 2;
  const slot = vented && port.shape === "slot" ? slotOpening(dim, wall, port) : null;
  // a ribbon on its own waveguide, set into the baffle: drawn as the square plate with its slot, not a round faceplate
  const ribbon = !lay.coax && !lay.onTop && isRibbon(t);
  // an AMT on its own plate, set into the baffle: the flat plate with its opening onto the folds
  const amt = !lay.coax && !lay.onTop && isAmt(t);
  return (
    <svg
      viewBox={`-4 -4 ${W + 8} ${H + 8}`}
      className={small ? "w-full h-auto max-h-40" : "h-40 w-auto"}
      role="img"
      aria-label={`Front view, ${dim.w} × ${dim.h}″${lay.onTop ? ", waveguide on top" : ""}${lay.coax ? ", coaxial" : ""}${roundoverIn ? `, ${roundoverIn}″ roundover` : ""}${tweeterOffsetIn && !lay.onTop && !lay.coax ? `, tweeter ${Math.abs(tweeterOffsetIn)}″ ${tweeterOffsetIn > 0 ? "inward" : "outward"}` : ""}`}
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
      {lay.coax ? null : lay.onTop ? (
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
      ) : ribbon ? (
        <RibbonPlate
          cx={tx}
          cy={y(lay.tweeterIn)}
          w={face.w * k}
          h={face.h * k}
          corner={HIFI_FRONT_PARTS.plateCornerIn * k}
        />
      ) : amt ? (
        <AmtPlate cx={tx} cy={y(lay.tweeterIn)} plate={face} k={k} />
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
      {!lay.coax && !ribbon && !amt && (
        <circle cx={tx} cy={y(lay.tweeterIn)} r={0.5 * k} fill={pal.edge} />
      )}
      <circle cx={W / 2} cy={y(lay.wooferIn)} r={wooferR} fill={pal.edge} stroke={pal.muted} />
      {lay.coax && (
        // the coaxial's HF in the woofer's center: its horn's mouth and the phase plug
        <g>
          <circle
            cx={W / 2}
            cy={y(lay.tweeterIn)}
            r={wooferR * HIFI_FRONT_PARTS.coax.hornMouthPerCone}
            fill={pal.muted}
          />
          <circle
            cx={W / 2}
            cy={y(lay.tweeterIn)}
            r={
              wooferR *
              HIFI_FRONT_PARTS.coax.hornThroatPerCone *
              HIFI_FRONT_PARTS.coax.plugPerThroat
            }
            fill={pal.edge}
          />
        </g>
      )}
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
