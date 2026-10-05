import type { PaBoxGeometry } from "../../types";
import { usePalette } from "../../hooks/useTheme";
import { isRoundPort } from "../../lib/pa/calc";
import { tubeLayout, type BafflePoint } from "../../lib/pa/tubes";
import { TUBE_FLARE_RADIUS_IN } from "../../data/acoustics/tube-ends";

interface Props {
  g: PaBoxGeometry;
  /** your current design, drawn dashed behind */
  cur?: PaBoxGeometry | null;
}

/** A box's outline in the drawing's units. */
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Front view of a design, to scale, with your current design's outline dashed behind it. */
export function BoxFront({ g, cur }: Props) {
  const pal = usePalette();
  const W = 150,
    H = 150,
    pad = 4;
  // tower: the mid sits in the top of the sub column (drawn as a section of it), the horn on top
  const tall = (x: PaBoxGeometry) => x.sub.h + (x.tower ? 0 : x.mid.h) + (x.horn ? x.horn.h : 0);
  const wide = (x: PaBoxGeometry) => Math.max(x.sub.w, x.mid.w, x.horn ? x.horn.w : 0);
  const k = Math.min(
    (H - 2 * pad) / Math.max(tall(g), cur ? tall(cur) : 0),
    (W - 2 * pad) / Math.max(wide(g), cur ? wide(cur) : 0),
  );
  const cx = W / 2,
    y0 = H - pad;
  const stackRects = (x: PaBoxGeometry) => {
    const r: Rect[] = [],
      put = (w: number, h: number, y: number): Rect => ({
        x: cx - (w * k) / 2,
        y: y - h * k,
        w: w * k,
        h: h * k,
      });
    const sb = put(x.sub.w, x.sub.h, y0),
      mb = x.tower ? { ...sb, h: x.mid.h * k } : put(x.mid.w, x.mid.h, sb.y),
      hb = x.horn ? put(x.horn.w, x.horn.h, mb.y) : null;
    r.push(sb);
    if (!x.tower) r.push(mb);
    if (hb) r.push(hb);
    return { sb, mb, hb, r };
  };
  const a = stackRects(g),
    b = cur ? stackRects(cur) : null,
    t = g.wall * k,
    v = g.cVent;
  const vent: React.ReactElement[] = [];
  if (g.portStyle === "slots")
    vent.push(
      <rect
        key="v"
        x={a.sb.x + t}
        y={a.sb.y + a.sb.h - t - v.slotH * k}
        width={a.sb.w - 2 * t}
        height={v.slotH * k}
        fill={pal.ink}
      />,
    );
  else if (g.portStyle === "vslots" || g.portStyle === "vslot1") {
    vent.push(
      <rect
        key="l"
        x={a.sb.x + t}
        y={a.sb.y + t}
        width={v.throat * k}
        height={a.sb.h - 2 * t}
        fill={pal.ink}
      />,
    );
    if (g.portStyle === "vslots")
      vent.push(
        <rect
          key="r"
          x={a.sb.x + a.sb.w - t - v.throat * k}
          y={a.sb.y + t}
          width={v.throat * k}
          height={a.sb.h - 2 * t}
          fill={pal.ink}
        />,
      );
  }
  // round tubes and their driver where the planner lays them out (lib/pa/tubes)
  const tubes = isRoundPort(g.portStyle)
    ? tubeLayout(g.sub, g.portStyle, v, g.wall, g.subSize)
    : null;
  const onBaffle = (p: BafflePoint) => ({
    cx: a.sb.x + a.sb.w / 2 + p.x * k,
    cy: a.sb.y + a.sb.h - t - p.y * k,
  });
  tubes?.tubes.forEach((p, i) =>
    vent.push(<circle key={i} {...onBaffle(p)} r={(v.dia * k) / 2} fill={pal.ink} />),
  );
  // what the driver clears below it: the slot and its shelf, or the tube row's flares (the tower's sub section draws its
  // driver centred above them; the stacks place it where the layout does)
  const rowTop = tubes?.tubes.length
    ? Math.max(...tubes.tubes.map((p) => p.y)) + v.dia / 2 + TUBE_FLARE_RADIUS_IN
    : 0;
  const ventH = g.portStyle === "slots" ? v.slotH * k + t : tubes ? rowTop * k + t : 0;
  const driver = (box: Rect, size: number, below = 0) => (
    <circle
      cx={box.x + box.w / 2}
      cy={box.y + (box.h - below) / 2}
      r={Math.min(size * 0.9 * k, box.w - 2 * t - 2, box.h - below - 2 * t - 2) / 2}
      fill={pal.edge}
      stroke={pal.muted}
      strokeWidth="1"
    />
  );
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Front view: sub ${g.sub.w} × ${g.sub.h}″, mid ${g.mid.w} × ${g.mid.h}″${cur ? "; your design dashed" : ""}`}
    >
      {b &&
        b.r.map((q, i) => (
          <rect
            key={i}
            x={q.x}
            y={q.y}
            width={q.w}
            height={q.h}
            fill="none"
            stroke={pal.muted}
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        ))}
      {a.r.map((q, i) => (
        <rect
          key={i}
          x={q.x}
          y={q.y}
          width={q.w}
          height={q.h}
          rx="1"
          fill={q === a.hb ? pal.muted : pal.edge}
          fillOpacity={q === a.hb ? 1 : 0.85}
          stroke={pal.ink}
          strokeWidth="1.2"
        />
      ))}
      {vent}
      {g.tower && (
        <line
          x1={a.sb.x}
          x2={a.sb.x + a.sb.w}
          y1={a.mb.y + a.mb.h}
          y2={a.mb.y + a.mb.h}
          stroke={pal.ink}
          strokeWidth="1.2"
        />
      )}
      {tubes && !g.tower ? (
        <circle
          {...onBaffle(tubes.driver)}
          r={(Math.min(g.subSize * 0.9, g.sub.w - 2 * g.wall) * k) / 2}
          fill={pal.edge}
          stroke={pal.muted}
          strokeWidth="1"
        />
      ) : (
        driver(
          g.tower ? { ...a.sb, y: a.mb.y + a.mb.h, h: a.sb.h - a.mb.h } : a.sb,
          g.subSize,
          ventH,
        )
      )}
      {driver(a.mb, g.midSize)}
    </svg>
  );
}
