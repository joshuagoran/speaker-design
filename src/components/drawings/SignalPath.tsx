import { usePalette } from "../../hooks/useTheme";
import { GXD4, GXD8, QSC_GXD } from "../../data/catalog/amps";
import { HORN_AMP_SAFETY_HPF_HZ, mainsDsp } from "../../lib/data";
import { DEFAULT_CROSSOVERS } from "../../lib/defaultParts";
import type { AmpModel } from "../../types";
import { SVG_FONT } from "../../styles/fonts";

/** What each top box's Speakon carries. */
const TOP_PINS = "1± mid · 2± horn";
const ampName = (m: Pick<AmpModel, "model">) => `${QSC_GXD.brand} ${m.model}`;
/** Block diagram of the PA signal path. */
export function SignalPath() {
  const pal = usePalette();
  const ink = pal.ink,
    mute = pal.muted,
    line = pal.muted;
  const col = { pa2: pal.muted, sub: pal.cyan, mid: pal.magenta, hf: pal.magenta, gray: pal.muted };
  const Box = ({
    x,
    y,
    w,
    h,
    c,
    children,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    c: string;
    children: React.ReactNode;
  }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={pal.white} stroke={c} strokeWidth="1.5" />
      {children}
    </g>
  );
  const T = ({
    x,
    y,
    s = 11,
    c = ink,
    a = "middle",
    b,
  }: {
    x: number;
    y: number;
    s?: number;
    c?: string;
    a?: "start" | "middle" | "end";
    b: string;
  }) => (
    <text
      x={x}
      y={y}
      fontSize={s}
      fill={c}
      textAnchor={a}
      fontFamily={SVG_FONT}
      fontWeight={b ? 600 : 400}
    >
      {b}
    </text>
  );
  const A = ({ d, c = line }: { d: string; c?: string }) => (
    <path d={d} fill="none" stroke={c} strokeWidth="1.3" markerEnd="url(#sp-ar)" />
  );
  return (
    <svg viewBox="0 0 860 400" width="100%" role="img" aria-label="Mains rack signal path">
      <defs>
        <marker
          id="sp-ar"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M2 1L8 5L2 9"
            fill="none"
            stroke={line}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>

      <T x={60} y={22} c={mute} b="Source" />
      <T x={215} y={22} c={mute} b="Processor" />
      <T x={415} y={22} c={mute} b="Amps" />
      <T x={600} y={22} c={mute} b="Rear panel" />
      <T x={770} y={22} c={mute} b="Stacks" />

      <Box x={15} y={190} w={90} h={52} c={col.gray}>
        <T x={60} y={212} b="DJ mixer" />
        <T x={60} y={230} s={10} c={mute} b="master L/R" />
      </Box>
      <A d="M105 216 L150 216" />
      <T x={127} y={208} s={10} c={mute} b="XLR" />

      <Box x={150} y={110} w={130} h={220} c={col.pa2}>
        <T x={215} y={132} b={mainsDsp().row.unit} />
        <T x={215} y={148} s={10} c={mute} b="2 in / 6 out" />
        <T x={215} y={176} s={10} c={mute} b="inputs: venue EQ" />
        <T x={215} y={190} s={10} c={mute} b="outputs: XO, EQ, delay, limit" />
        <T x={272} y={230} s={10} a="end" c={col.sub} b="Sub L / R" />
        <T x={272} y={270} s={10} a="end" c={col.mid} b="Mid L / R" />
        <T x={272} y={310} s={10} a="end" c={col.hf} b="Horn L / R" />
      </Box>

      <Box x={350} y={205} w={130} h={44} c={col.sub}>
        <T x={415} y={223} b={ampName(GXD8)} />
        <T x={415} y={239} s={10} c={mute} b={`${GXD8.w8} W/ch @ 8 Ω`} />
      </Box>
      <Box x={350} y={262} w={130} h={44} c={col.mid}>
        <T x={415} y={280} b={ampName(GXD4)} />
        <T x={415} y={296} s={10} c={mute} b={`${GXD4.w8} W/ch @ 8 Ω`} />
      </Box>
      <Box x={350} y={319} w={130} h={44} c={col.hf}>
        <T x={415} y={337} b={ampName(GXD4)} />
        <T x={415} y={353} s={10} c={mute} b={`gain trimmed · HPF ${HORN_AMP_SAFETY_HPF_HZ} Hz`} />
      </Box>
      <A d="M280 226 L350 226" c={col.sub} />
      <A d="M280 266 L350 283" c={col.mid} />
      <A d="M280 306 L350 340" c={col.hf} />

      <Box x={555} y={150} w={90} h={230} c={col.gray}>
        <T x={600} y={170} b="Speakon" />
        <T x={600} y={184} s={10} c={mute} b="4× NL4MP" />
      </Box>
      <rect x={565} y={200} width={70} height={22} rx="4" fill="none" stroke={col.sub} />
      <T x={600} y={215} s={10} c={col.sub} b="SUB L · 1±" />
      <rect x={565} y={228} width={70} height={22} rx="4" fill="none" stroke={col.sub} />
      <T x={600} y={243} s={10} c={col.sub} b="SUB R · 1±" />
      <rect x={565} y={290} width={70} height={36} rx="4" fill="none" stroke={col.mid} />
      <T x={600} y={304} s={10} c={col.mid} b="TOP L" />
      <T x={600} y={318} s={9} c={mute} b={TOP_PINS} />
      <rect x={565} y={332} width={70} height={36} rx="4" fill="none" stroke={col.mid} />
      <T x={600} y={346} s={10} c={col.mid} b="TOP R" />
      <T x={600} y={360} s={9} c={mute} b={TOP_PINS} />
      <A d="M480 222 L565 211" c={col.sub} />
      <A d="M480 232 L565 239" c={col.sub} />
      <A d="M480 278 L565 300" c={col.mid} />
      <A d="M480 290 L565 342" c={col.mid} />
      <A d="M480 335 L565 318" c={col.hf} />
      <A d="M480 347 L565 360" c={col.hf} />
      <T x={518} y={196} s={9} c={mute} b="binding posts, 12 AWG" />

      <Box x={690} y={196} w={110} h={26} c={col.sub}>
        <T x={745} y={213} s={10} b="Sub L" />
      </Box>
      <Box x={690} y={226} w={110} h={26} c={col.sub}>
        <T x={745} y={243} s={10} b="Sub R" />
      </Box>
      <Box x={690} y={288} w={110} h={40} c={col.mid}>
        <T x={745} y={304} s={10} b="Mid box L" />
        <T x={745} y={319} s={9} c={mute} b="posts → horn L" />
      </Box>
      <Box x={690} y={332} w={110} h={40} c={col.mid}>
        <T x={745} y={348} s={10} b="Mid box R" />
        <T x={745} y={363} s={9} c={mute} b="posts → horn R" />
      </Box>
      <A d="M645 211 L690 209" />
      <A d="M645 239 L690 239" />
      <T x={667} y={202} s={9} c={mute} b="NL2" />
      <A d="M645 308 L690 308" />
      <A d="M645 352 L690 352" />
      <T x={667} y={300} s={9} c={mute} b="NL4" />

      <T
        x={15}
        y={394}
        s={10}
        a="start"
        c={mute}
        b={`Crossovers in the PA2: ${DEFAULT_CROSSOVERS}. Amps are full-range. Each amp has limiters set for its driver.`}
      />
    </svg>
  );
}
