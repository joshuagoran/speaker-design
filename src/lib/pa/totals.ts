import { UI_TEXT } from "../../constants/uiText";

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
