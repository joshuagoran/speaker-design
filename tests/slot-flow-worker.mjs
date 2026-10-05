// A worker for the slot inner-end table's writer (tests/update-slot-inner-end.ts): it solves the groups of points it is
// sent with the potential-flow solver (Node loads the TypeScript itself), each point from the one before's potential
// where their grids match (a group shares its box and differs in the shelf's thickness, which the grid leaves alone).
import { parentPort } from "node:worker_threads";
import { solveStraightSlot } from "./slot-flow.ts";

parentPort.on("message", ({ i, points, warm = true }) => {
  let prev;
  const out = points.map((point) => {
    const flow = solveStraightSlot(point, { warm: warm ? prev : undefined });
    prev = flow;
    return { ec: flow.ec, iterations: flow.iterations, cells: flow.phi.length };
  });
  parentPort.postMessage({ i, out });
});
