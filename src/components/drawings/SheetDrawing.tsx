import type {
  CutBoxId,
  CutPart,
  Offcut,
  PackedSheet,
  PanelMaterial,
  PlywoodSheet,
} from "../../types";
import { formatInches, formatThickness } from "../../lib/pa/calc";
import { cutRowKey } from "../../lib/pa/cutlist";
import { usePalette } from "../../hooks/useTheme";
import {
  CUT_BOX_NAMES,
  CUT_BOX_TINTS,
  CUT_PART_NAMES,
  PANEL_MATERIAL_NAMES,
} from "../../constants/cutParts";
import { SHEET_LABEL_PX, SHEET_PX_PER_IN } from "../../constants/chartScales";
import { SVG_FONT } from "../../styles/fonts";

interface Props {
  sheet: PackedSheet;
  /** the sheet's size, inches */
  S: PlywoodSheet;
  /** which sheet this is, from 0, and how many sheets of this thickness there are */
  idx: number;
  count: number;
  /** the panel thickness, inches, and its material (ply when absent; MDF has no grain to show) */
  t: number;
  material?: PanelMaterial;
  /** the offcut this sheet keeps, if any */
  offcut?: Offcut | null;
  /** a part's tag, shared with its row in the cutlist (S1, M2 …) */
  tagOf: (p: CutPart) => string;
  /** the row key (`cutRowKey`) highlighted on the page, if any of its pieces are drawn */
  hot: string | null;
  /** highlights a row's pieces and its cutlist row (null clears it) */
  onHot: (key: string | null) => void;
}

/** A monospace character's width, in font sizes (Inconsolata). */
const CHAR_EM = 0.5;
/** The kept offcut's label (its width decides whether it fits). */
const OFFCUT_LABEL = "offcut";

/**
 * One plywood sheet with its cut pieces laid out at the fixed sheet scale; grain runs down the sheet. Each piece carries
 * its cutlist row's tag, and hovering or focusing a piece highlights it with its row.
 */
export function SheetDrawing({
  sheet,
  S,
  idx,
  count,
  t,
  material = "ply",
  offcut,
  tagOf,
  hot,
  onHot,
}: Props) {
  const pal = usePalette();
  const sc = SHEET_PX_PER_IN,
    W = S.w * sc,
    H = S.h * sc,
    fs = SHEET_LABEL_PX;

  // what the sheet is for: each box's parts on it, in the order they first appear
  const uses = new Map<CutBoxId, Set<string>>();
  for (const it of sheet.items) {
    const names = uses.get(it.box) ?? new Set<string>();
    names.add(CUT_PART_NAMES[it.part].toLowerCase());
    uses.set(it.box, names);
  }
  const use = [...uses]
    .map(([box, names]) => `${CUT_BOX_NAMES[box]} ${[...names].join(", ")}`)
    .join("; ");
  const textWidth = (s: string) => fs * CHAR_EM * s.length;
  // a grain arrow down a piece, from y0 to y1 (sheet units)
  const arrow = (x: number, y0: number, y1: number, color: string) => {
    const head = fs * 0.35;
    return (
      <g stroke={color} strokeWidth={1} fill="none">
        <line x1={x} y1={y0} x2={x} y2={y1} />
        <polyline points={`${x - head},${y0 + head} ${x},${y0} ${x + head},${y0 + head}`} />
        <polyline points={`${x - head},${y1 - head} ${x},${y1} ${x + head},${y1 - head}`} />
      </g>
    );
  };
  return (
    <figure className="flex flex-col gap-1.5 m-0" style={{ width: W + 4, maxWidth: "100%" }}>
      <figcaption className="text-sm leading-snug">
        <span className="font-bold">
          Sheet {idx + 1} of {count}
        </span>
        <span className="block text-xs text-stone-500">
          {formatThickness(t)} {PANEL_MATERIAL_NAMES[material].short}, {S.name}
          {material === "ply" && (
            <>
              {" · "}
              <span title="Face grain runs top to bottom on this drawing: load the sheet that way">
                grain ↕
              </span>
            </>
          )}
        </span>
      </figcaption>
      <svg
        viewBox={`-2 -2 ${W + 4} ${H + 4}`}
        width={W + 4}
        style={{ maxWidth: "100%", height: "auto" }}
        role="group"
        aria-label={`Sheet ${idx + 1} of ${count} layout`}
      >
        <rect x="0" y="0" width={W} height={H} fill={pal.white} stroke={pal.muted} />
        {offcut && (
          <g>
            <rect
              x={offcut.x * sc}
              y={offcut.y * sc}
              width={offcut.w * sc}
              height={offcut.h * sc}
              fill="none"
              stroke={pal.muted}
              strokeWidth="1"
              strokeDasharray="5 4"
            />
            {offcut.w * sc > textWidth(OFFCUT_LABEL) + 4 && offcut.h * sc > fs * 3 && (
              <text
                x={(offcut.x + offcut.w / 2) * sc}
                y={(offcut.y + offcut.h / 2) * sc}
                textAnchor="middle"
                fontSize={fs}
                fill={pal.muted}
                fontFamily={SVG_FONT}
              >
                <tspan x={(offcut.x + offcut.w / 2) * sc}>{OFFCUT_LABEL}</tspan>
                <tspan x={(offcut.x + offcut.w / 2) * sc} dy={fs * 1.15}>
                  {formatInches(offcut.w)}×{formatInches(offcut.h)}
                </tspan>
              </text>
            )}
          </g>
        )}
        {sheet.items.map((it, i) => {
          const key = cutRowKey(it);
          const x = it.x * sc,
            y = it.y * sc,
            w = it.w * sc,
            h = it.h * sc;
          const tag = tagOf(it);
          const name = it.pieces ? "strip" : CUT_PART_NAMES[it.part];
          const isHot = hot === key;
          const dim = hot != null && !isHot;
          // a panel's grain arrow sits at its right edge, from the top down to `arrowEnd`: the label keeps clear of it
          const reserve = it.grain && !it.pieces && h > fs * 1.6 && w > fs * 1.2 ? fs * 1.2 : 0;
          const arrowEnd = reserve ? 4 + Math.min(h - 8, fs * 2) : 0;
          // the label: tag and name, or the tag alone; across the piece left of the arrow, or along it below the arrow
          // when it is tall and narrow (and always along a waterfall strip, whose arrow runs beside it)
          const along = !!it.pieces || (w - reserve < textWidth(tag) + 4 && h > w);
          const top = along ? arrowEnd : 0;
          const [run, across] = along ? [h - top, w] : [w - reserve, h];
          const label = [`${tag} ${name}`, tag].find(
            (s) => run > textWidth(s) + 6 && across > fs * (along ? 0.95 : 1.2),
          );
          const cx = x + (along ? w : w - reserve) / 2,
            cy = y + top + (h - top) / 2;
          // waterfall strips: a tick at each cut and the panels numbered in cut order
          const cuts: number[] = [];
          if (it.pieces && !it.crossed) {
            const gap = (it.h - it.pieces.reduce((a, p) => a + p, 0)) / (it.pieces.length - 1);
            let at = it.y;
            for (const p of it.pieces.slice(0, -1)) {
              at += p + gap / 2;
              cuts.push(at * sc);
              at += gap / 2;
            }
          }
          const edge = isHot ? pal.ink : it.crossed ? pal.status.orange.text : pal.muted;
          return (
            <g
              key={i}
              tabIndex={0}
              aria-label={`${tag}: ${CUT_BOX_NAMES[it.box]} ${CUT_PART_NAMES[it.part]}, ${formatInches(it.w)} × ${formatInches(it.h)}″`}
              onMouseEnter={() => onHot(key)}
              onMouseLeave={() => onHot(null)}
              onFocus={() => onHot(key)}
              onBlur={() => onHot(null)}
              opacity={dim ? 0.35 : 1}
              className="cursor-default outline-none"
            >
              <title>{`${tag}: ${CUT_BOX_NAMES[it.box]} ${CUT_PART_NAMES[it.part]}`}</title>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={pal[CUT_BOX_TINTS[it.box]]}
                stroke={edge}
                strokeWidth={isHot ? 3 : it.crossed ? 2 : 0.8}
              />
              {cuts.map((cy, k) => (
                <line
                  key={k}
                  x1={x}
                  y1={cy}
                  x2={x + w}
                  y2={cy}
                  stroke={pal.ink}
                  strokeWidth="1.2"
                />
              ))}
              {it.pieces &&
                [it.y, ...cuts.map((c) => c / sc)].map((top, k) => (
                  <text
                    key={`n${k}`}
                    x={x + 3}
                    y={top * sc + fs}
                    fontSize={fs}
                    fill={pal.ink}
                    fontFamily={SVG_FONT}
                  >
                    {k + 1}
                  </text>
                ))}
              {/* grain: one arrow the length of a strip, a short one at a panel's right edge */}
              {it.grain &&
                (it.pieces || reserve > 0) &&
                arrow(
                  x + w - fs * 0.6,
                  y + 4,
                  it.pieces ? y + h - 4 : y + arrowEnd,
                  it.crossed ? pal.status.orange.text : pal.muted,
                )}
              {label && (
                <text
                  x={cx}
                  y={cy + fs * 0.35}
                  textAnchor="middle"
                  fontSize={fs}
                  fill={pal.ink}
                  fontFamily={SVG_FONT}
                  transform={along ? `rotate(-90 ${cx} ${cy})` : undefined}
                >
                  <tspan fontWeight={700}>{tag}</tspan>
                  {label !== tag && ` ${name}`}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {use && <div className="text-xs text-stone-500 leading-snug">{use}</div>}
    </figure>
  );
}
