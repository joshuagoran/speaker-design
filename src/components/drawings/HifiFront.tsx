import type { Dims2 } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { HIFI_FRONT_PARTS } from "../../constants/hifiScene";
import { amtOpening } from "../../lib/hifi/boxLayout";

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
