import type { FinishId } from "../types";

/** The named wood finishes, by id (data/catalog/finishes holds their colors). */
export const FINISH_ID = { birch: "birch", walnut: "walnut" } as const satisfies {
  [K in FinishId]: K;
};
