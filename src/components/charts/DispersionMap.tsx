import type { HifiDispersionMap } from "../../types";
import { formatHz } from "../../lib/format";
import {
  DISPERSION_SCALE,
  dispersionColour,
  dispersionRgb,
  alpha,
  ON_DATA,
} from "../../styles/palette";
import { usePalette } from "../../hooks/useTheme";
import {
  CONTOUR_STEP_DB,
  DISPERSION_ANGLE_MAX_DEG,
  DISPERSION_GRID_DEG,
  DISPERSION_LABEL_DEG,
  DISPERSION_FREQ_MAX_HZ,
  DISPERSION_FREQ_MIN_HZ,
} from "../../constants/chartScales";
import { useElementWidth } from "../../hooks/useElementWidth";
import { SVG_FONT } from "../../styles/fonts";
import { useMemo, useState } from "react";

interface Props {
  map: HifiDispersionMap;
  title: string;
}

const { topDb, botDb, contourShade, keyStepDb, stops } = DISPERSION_SCALE;
const A = DISPERSION_ANGLE_MAX_DEG;
const LOG_SPAN = Math.log(DISPERSION_FREQ_MAX_HZ / DISPERSION_FREQ_MIN_HZ);

/** A signed number with a true minus sign: "+30", "−30", "0". */
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0");
const kHz = (f: number) => (f >= 1000 ? `${+(f / 1000).toFixed(1)}k` : f.toFixed(0));

/** Where `x` falls in the ascending `xs`: the index below it and the fraction toward the next, clamped to the ends. */
function bracket(xs: readonly number[], x: number): [number, number] {
  const n = xs.length;
  if (x <= xs[0]) return [0, 0];
  if (x >= xs[n - 1]) return [n - 2, 1];
  let lo = 0,
    hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return [lo, (x - xs[lo]) / (xs[hi] - xs[lo])];
}

/**
 * The map as an image `pw` × `ph` px on the fixed axes (+90° at the top, 50 Hz-20 kHz across): each pixel's level
 * interpolated from the grid, coloured on the dispersion scale, darker where it crosses a contour. Null without a canvas.
 */
function mapImage(map: HifiDispersionMap, pw: number, ph: number): string | null {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = pw;
  cv.height = ph;
  const g = cv.getContext("2d");
  if (!g) return null;
  const logF = map.freqs.map((f) => Math.log(f));
  const cols = Array.from({ length: pw }, (_, i) =>
    bracket(logF, Math.log(DISPERSION_FREQ_MIN_HZ) + (LOG_SPAN * (i + 0.5)) / pw),
  );
  const lev = new Float32Array(pw * ph);
  for (let j = 0; j < ph; j++) {
    const [a, u] = bracket(map.angles, A - (2 * A * (j + 0.5)) / ph);
    const r0 = map.rows[a],
      r1 = map.rows[a + 1];
    for (let i = 0; i < pw; i++) {
      const [f, t] = cols[i];
      const lo = r0[f] + (r0[f + 1] - r0[f]) * t,
        hi = r1[f] + (r1[f + 1] - r1[f]) * t;
      lev[j * pw + i] = lo + (hi - lo) * u;
    }
  }
  // contours sit a quarter dB below each step, so the 0° row (exactly 0) and hundredths-of-a-dB noise beside it draw none
  const band = (v: number) =>
    Math.floor((Math.max(botDb, Math.min(topDb, v)) + 0.25) / CONTOUR_STEP_DB);
  const img = g.createImageData(pw, ph);
  for (let j = 0; j < ph; j++)
    for (let i = 0; i < pw; i++) {
      const k = j * pw + i,
        b = band(lev[k]);
      const edge =
        (i + 1 < pw && band(lev[k + 1]) !== b) || (j + 1 < ph && band(lev[k + pw]) !== b);
      const c = dispersionRgb(lev[k]),
        s = edge ? contourShade : 1;
      img.data.set([c[0] * s, c[1] * s, c[2] * s, 255], k * 4);
    }
  g.putImageData(img, 0, 0);
  return cv.toDataURL();
}

/** The colour key every dispersion map shares: the scale as a bar, ticked every 6 dB. */
export function DispersionKey() {
  const span = topDb - botDb;
  const gradient = stops
    .map(([db, hex]) => `${hex} ${(((topDb - db) / span) * 100).toFixed(1)}%`)
    .join(", ");
  const ticks = Array.from({ length: span / keyStepDb + 1 }, (_, i) => topDb - i * keyStepDb);
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 mt-1"
      aria-label={`Colour key: ${signed(topDb)} to ${signed(botDb)} dB relative to on-axis`}
    >
      <span>dB re on-axis</span>
      <div className="flex flex-col gap-0.5 w-full max-w-[420px]">
        <span
          className="h-3 rounded"
          style={{ background: `linear-gradient(to right, ${gradient})` }}
        />
        <div className="flex justify-between tabular-nums">
          {ticks.map((d) => (
            <span key={d}>{signed(d)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Level vs angle and frequency, relative to on-axis, on the axes every dispersion map shares (−90° to +90°,
 * 50 Hz-20 kHz) and the one colour scale (+6 to −36 dB, a contour every 3 dB). Hover or drag to read a point.
 */
export function DispersionMap({ map, title }: Props) {
  const pal = usePalette();
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  // drawn in real pixels so text stays 11 px at any width
  const [box, cw] = useElementWidth(560);
  const narrow = cw < 500;
  const W = Math.max(280, cw),
    H = narrow ? 260 : 320,
    L = 40,
    R = 10,
    T = 8,
    B = 26;
  const pw = Math.round(W - L - R),
    ph = H - T - B;
  const href = useMemo(() => mapImage(map, pw, ph), [map, pw, ph]);
  const fx = (f: number) => L + (Math.log(f / DISPERSION_FREQ_MIN_HZ) / LOG_SPAN) * pw;
  const ay = (deg: number) => T + ((A - deg) / (2 * A)) * ph;
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    if (x < L || x > L + pw || y < T || y > T + ph) return setHover(null);
    const f = DISPERSION_FREQ_MIN_HZ * Math.exp(((x - L) / pw) * LOG_SPAN),
      deg = A - ((y - T) / ph) * 2 * A;
    const nearest = (xs: readonly number[], d: (v: number) => number) =>
      xs.reduce((b, v, k) => (d(v) < d(xs[b]) ? k : b), 0);
    setHover({
      i: nearest(map.freqs, (v) => Math.abs(Math.log(v / f))),
      j: nearest(map.angles, (v) => Math.abs(v - deg)),
    });
  };
  const gridA = Array.from(
    { length: (2 * A) / DISPERSION_GRID_DEG + 1 },
    (_, k) => -A + k * DISPERSION_GRID_DEG,
  );
  const ticksF = (
    narrow ? [50, 100, 200, 1000, 5000, 20000] : [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
  ).filter((f) => f >= DISPERSION_FREQ_MIN_HZ && f <= DISPERSION_FREQ_MAX_HZ);
  const crossovers = map.crossovers.filter(
    (f) => f >= DISPERSION_FREQ_MIN_HZ && f <= DISPERSION_FREQ_MAX_HZ,
  );
  const gridStroke = alpha(ON_DATA.ink, 0.18);
  return (
    <div ref={box}>
      <div className="flex justify-between items-baseline gap-2 text-xs text-stone-500 mb-1">
        <span>{title}</span>
        <span className="tabular-nums text-stone-900 shrink-0">
          {hover
            ? `${signed(map.angles[hover.j])}° · ${formatHz(map.freqs[hover.i])} ·${map.rows[hover.j][hover.i].toFixed(1)} dB`
            : "dB vs on-axis"}
        </span>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block max-w-full h-auto select-none"
        style={{ touchAction: "pan-y" }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${title}: level against angle and frequency`}
        fontFamily={SVG_FONT}
        fontSize="11"
      >
        {href ? (
          <image href={href} x={L} y={T} width={pw} height={ph} preserveAspectRatio="none" />
        ) : (
          <rect x={L} y={T} width={pw} height={ph} fill={dispersionColour(0)} />
        )}
        {gridA.map((deg) => (
          <g key={deg}>
            <line x1={L} x2={L + pw} y1={ay(deg)} y2={ay(deg)} stroke={gridStroke} />
            {deg % DISPERSION_LABEL_DEG === 0 && (
              <text x={L - 5} y={ay(deg) + 4} textAnchor="end" fill={pal.muted}>
                {signed(deg)}°
              </text>
            )}
          </g>
        ))}
        {ticksF.map((f) => (
          <g key={f}>
            <line x1={fx(f)} x2={fx(f)} y1={T} y2={T + ph} stroke={gridStroke} />
            <text
              x={fx(f)}
              y={T + ph + 15}
              textAnchor={
                f === DISPERSION_FREQ_MAX_HZ
                  ? "end"
                  : f === DISPERSION_FREQ_MIN_HZ
                    ? "start"
                    : "middle"
              }
              fill={pal.muted}
            >
              {kHz(f)}
            </text>
          </g>
        ))}
        <rect
          x={L + 0.5}
          y={T + 0.5}
          width={pw - 1}
          height={ph - 1}
          fill="none"
          stroke={ON_DATA.ink}
        />
        {/* the frame, grid and marks sit on the map, so they keep its fixed colours (ON_DATA) in both themes */}
        {/* crossovers: a white line with a dark outline and an outlined label, legible on any colour of the scale */}
        {crossovers.map((f, k) => {
          const x = fx(f),
            right = x > L + pw - 60;
          return (
            <g key={f}>
              <line x1={x} x2={x} y1={T} y2={T + ph} stroke={ON_DATA.ink} strokeWidth="3" />
              <line x1={x} x2={x} y1={T} y2={T + ph} stroke={ON_DATA.white} strokeWidth="1" />
              <text
                x={right ? x - 4 : x + 4}
                y={T + 13 + k * 14}
                textAnchor={right ? "end" : "start"}
                fill={ON_DATA.white}
                stroke={ON_DATA.ink}
                strokeWidth="3"
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {formatHz(f)}
              </text>
            </g>
          );
        })}
        {hover && (
          <circle
            cx={fx(map.freqs[hover.i])}
            cy={ay(map.angles[hover.j])}
            r="4"
            fill="none"
            stroke={ON_DATA.white}
            strokeWidth="1.5"
          />
        )}
      </svg>
      <DispersionKey />
    </div>
  );
}
