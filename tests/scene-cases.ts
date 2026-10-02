// Props for the 3D scene tests: every golden config, the default PA and the other layouts.
import { SUB_OPTIONS, MID_OPTIONS, MID_BOXES, HORN_OPTIONS } from "../src/lib/data";
import { DEFAULT_PA } from "../src/lib/defaults";
import type { Props } from "../src/components/stack-view/buildStackScene";
import type { PaDesignConfig } from "../src/types";
import { configs } from "./golden-configs";

const PLINTH_IN = 3; // the planner's fixed plinth

/** The scene props the planner would pass for a saved design, which can lack the fields an older save didn't have. */
export function scenePropsOf(
  c: Pick<PaDesignConfig, "sub" | "mid" | "horn" | "portStyle" | "cDim" | "cVent"> &
    Partial<PaDesignConfig>,
): Props {
  const sub = SUB_OPTIONS.find((o) => o.id === c.sub) ?? SUB_OPTIONS[0];
  const mid = MID_OPTIONS.find((o) => o.id === c.mid) ?? MID_OPTIONS[0];
  const horn = HORN_OPTIONS.find((o) => o.id === c.horn) ?? HORN_OPTIONS[0];
  const midBox = c.mDim ?? (MID_BOXES.find((b) => b.id === c.midBox) ?? MID_BOXES[0]).box;
  return {
    sub: { ...sub, box: c.cDim },
    mid: { ...mid, box: midBox },
    horn,
    plinth: PLINTH_IN,
    cutaway: c.cutaway ?? false,
    portStyle: c.portStyle,
    layout: c.layout ?? "stack",
    baffleColor: c.baffleColor ?? DEFAULT_PA.baffleColor,
    portGeom: {
      ductH: c.cVent.slotH,
      nPorts: c.cVent.nt,
      portR: c.cVent.dia / 2,
      tubeLen: c.cVent.len,
      throat: c.cVent.throat,
    },
    wall: c.wall,
    inset: c.inset,
    cabFinish: c.cabFinish,
    spacerH: c.spacerH,
  };
}

const defaultConfig = {
  sub: DEFAULT_PA.sub.id,
  mid: DEFAULT_PA.mid.id,
  horn: DEFAULT_PA.horn.id,
  midBox: DEFAULT_PA.midBox.id,
  portStyle: DEFAULT_PA.portStyle,
  cDim: DEFAULT_PA.cDim,
  cVent: DEFAULT_PA.cVent,
  mDim: DEFAULT_PA.mDim,
  wall: DEFAULT_PA.wall,
  inset: DEFAULT_PA.inset,
  layout: DEFAULT_PA.layout,
  baffleColor: DEFAULT_PA.baffleColor,
  cabFinish: DEFAULT_PA.cabFinish,
  spacerH: DEFAULT_PA.spacerH,
} satisfies Parameters<typeof scenePropsOf>[0];

/** A horn drawn as a lathe profile and narrow enough for the tower's arched top. */
const archedHorn = HORN_OPTIONS.find((h) => h.profile && !h.scaleX && h.size.w < 20);

export const sceneCases: { name: string; props: Props }[] = [
  ...configs.map((c) => ({ name: c.name, props: scenePropsOf(c) })),
  { name: "default PA", props: scenePropsOf(defaultConfig) },
  { name: "default PA, cutaway", props: scenePropsOf({ ...defaultConfig, cutaway: true }) },
  { name: "tower", props: scenePropsOf({ ...defaultConfig, layout: "tower" }) },
  ...(archedHorn
    ? [
        {
          name: "tower, arched top",
          props: scenePropsOf({ ...defaultConfig, layout: "tower", horn: archedHorn.id }),
        },
      ]
    : []),
  { name: "satellite", props: scenePropsOf({ ...defaultConfig, layout: "satellite" }) },
  { name: "pole", props: scenePropsOf({ ...defaultConfig, layout: "pole" }) },
];
