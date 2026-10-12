import { UI_TEXT } from "../../constants/uiText";
import type { PaDerivedDesign, PaDesignInputs } from "./paDesign";
import { isRoundPort } from "./calc";
import { subTubeKit } from "./tubes";
import { towerSpec } from "./tower";

/**
 * A parts total: the sum of the prices it knows, and the mark it carries when a part has no price (null), so the real
 * total is higher (`UI_TEXT.partialPriceMark`, as the optimizer's driver prices show it); no mark when every price is
 * known.
 */
export function priceTotal(prices: readonly (number | null)[]): { sum: number; mark: string } {
  return {
    sum: prices.reduce<number>((a, p) => a + (p ?? 0), 0),
    mark: prices.some((p) => p === null) ? UI_TEXT.partialPriceMark : "",
  };
}

/** The totals row for the boxes' hardware. */
const HARDWARE_ROW = "Handles, input dishes, jacks and horn posts (weight in the boxes)";

/** The plinth's weight in the totals, lb, when the stack stands on one. */
const PLINTH_LB = 6;

/** The horn's fixings in the totals, lb and in, over the catalog horn's weight and height. */
const HORN_FIXINGS = { lb: 1, in: 1 };

/** One totals row: its name, parts price ($, null where a part has no price), driver lb, cabinet lb and height, in. */
export type PaTotalsRow = [
  name: string,
  price: number | null,
  driverLb: number,
  cabinetLb: number,
  h: number,
];

/** What the PA totals read: the design's parts and sizes, and the weights and height the PA model works out. */
export type PaTotalsInputs = Pick<
  PaDesignInputs,
  | "subDriver"
  | "midDriver"
  | "hornOption"
  | "compressionDriver"
  | "plinthHeightIn"
  | "portStyle"
  | "subVentSpec"
  | "wallThicknessIn"
  | "baffleInsetIn"
> &
  Pick<
    PaDerivedDesign,
    | "effectiveMidBoxDims"
    | "midCabinetLb"
    | "subWeightLoadedLb"
    | "stackHeightIn"
    | "subHardware"
    | "midHardware"
    | "isTower"
  > & {
    /** the sub box as built */
    subBox: PaDesignInputs["subBoxDims"];
  };

/**
 * The PA page's totals for one stack: each row (the sub column, the mid-bass box or the tower's mid and horn sections,
 * the compression driver, the horn, the round port's pipe and elbows, the hardware), the parts price with its mark,
 * the drivers' and the cabinets' weight (the plinth's in the cabinets'), the whole stack's weight and its height. Pure.
 */
export function paTotals(d: PaTotalsInputs) {
  const subBoxLb = d.subWeightLoadedLb - (d.subDriver.lb || 0); // same estimate as the stats row
  const rows: PaTotalsRow[] = [
    ["Sub column", d.subDriver.price, d.subDriver.lb, subBoxLb, d.subBox.h],
    // the tower: its cabinet over the sub box, the mid chamber and the horn section
    d.isTower
      ? [
          "Mid and horn sections",
          d.midDriver.price,
          d.midDriver.lb,
          d.midCabinetLb,
          towerSpec(d.subBox, d.wallThicknessIn, d.hornOption).extH,
        ]
      : [
          "Mid-bass box",
          d.midDriver.price,
          d.midDriver.lb,
          d.midCabinetLb,
          d.effectiveMidBoxDims.h,
        ],
    ["Compression driver", d.compressionDriver.price, d.compressionDriver.lb || 0, 0, 0],
    [
      "Horn",
      d.hornOption.price,
      (d.hornOption.lb || 0) + HORN_FIXINGS.lb,
      0,
      d.hornOption.size.h + HORN_FIXINGS.in,
    ],
  ];
  // round tubes: the pipe and elbows from the catalog (no price where a part has no US vendor)
  if (isRoundPort(d.portStyle))
    rows.push([
      "Port tubes and elbows",
      subTubeKit(
        d.subBox,
        d.portStyle,
        d.subVentSpec,
        d.wallThicknessIn,
        d.baffleInsetIn,
        d.subDriver,
      ).price,
      0,
      0,
      0,
    ]);
  // the handles, input dishes, jacks and horn posts (their weight is in the boxes' rows)
  rows.push([HARDWARE_ROW, d.subHardware.price + (d.midHardware?.price ?? 0), 0, 0, 0]);
  const sum = (i: 2 | 3) => rows.reduce((a, r) => a + (r[i] || 0), 0);
  const driverLb = sum(2);
  const cabinetLb = sum(3) + (d.plinthHeightIn ? PLINTH_LB : 0);
  return {
    rows,
    // a part with no price (null) leaves the totals short, and they carry the mark
    price: priceTotal(rows.map((r) => r[1])),
    driverLb,
    cabinetLb,
    stackLb: driverLb + cabinetLb,
    stackHeightIn: d.stackHeightIn,
  };
}
