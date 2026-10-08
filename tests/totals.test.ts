import { describe, expect, test } from "vite-plus/test";
import { priceTotal } from "../src/lib/pa/totals";
import { UI_TEXT } from "../src/constants/uiText";
import { DIY_OS90X50 } from "../src/data/catalog/horns";
import { PORT_ELBOWS } from "../src/data/catalog/port-tubes";
import { DEFAULT_PA } from "../src/lib/defaults";

describe("the PA totals' price mark", () => {
  // the parts row by row, as the totals list them: sub, mid, compression driver, horn, then the rest
  const known = [DEFAULT_PA.sub.price, DEFAULT_PA.mid.price, DEFAULT_PA.cd.price];

  test("every price known: the plain sum, no mark", () => {
    const prices = [...known, DIY_OS90X50.price, 25];
    expect(prices.every((p) => p !== null)).toBe(true);
    const total = priceTotal(prices);
    expect(total.mark).toBe("");
    expect(total.sum).toBeCloseTo(
      prices.reduce<number>((a, p) => a + (p ?? 0), 0),
      9,
    );
  });

  test("a horn with no price marks the total, and the sum leaves it out", () => {
    const unpriced = { ...DIY_OS90X50, price: null };
    const total = priceTotal([...known, unpriced.price, 25]);
    expect(total.mark).toBe(UI_TEXT.partialPriceMark);
    expect(total.sum).toBeCloseTo(priceTotal([...known, 25]).sum, 9);
  });

  test("a tube part with no US vendor marks the total", () => {
    const elbow = PORT_ELBOWS.find((e) => e.price === null);
    if (!elbow) throw new Error("no unpriced elbow in the catalog");
    expect(priceTotal([...known, DIY_OS90X50.price, elbow.price]).mark).toBe(
      UI_TEXT.partialPriceMark,
    );
  });
});
