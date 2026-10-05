// A worker for the slot inner-end table's writer (tests/update-slot-inner-end.ts): it solves the points it is sent, one
// at a time, with the potential-flow solver (Node loads the TypeScript itself).
import { parentPort } from "node:worker_threads";
import { straightSlotInnerEnd } from "./slot-flow.ts";

parentPort.on("message", ({ i, point }) => {
  parentPort.postMessage({ i, ec: straightSlotInnerEnd(point) });
});
