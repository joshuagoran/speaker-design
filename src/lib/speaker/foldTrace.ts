// The trace of a folded horn: from the boards, the drivers and the mouth the user draws in the side section, find the air
// the mouth reaches (the passage), its length and width along the path, the air it does not reach (sealed pockets), where
// each side of the cones opens, the horn type that makes, and the checks. Pure; no DOM.
import { clamp } from "../clamp";
import {
  FOLD_BASKET_FLARE,
  FOLD_BASKET_SHARE,
  FOLD_CELL_IN,
  FOLD_CHECK,
  FOLD_CHOKE_LOOKBACK_IN,
  FOLD_CHOKE_MIN_SECTIONS,
  FOLD_CHOKE_SHARE,
  FOLD_CUTOUT_SPARE_IN,
  FOLD_DEAD_END_SHARE,
  FOLD_DRIVER_GAP_IN,
  FOLD_DRIVERS_REASON,
  FOLD_ENDS_IN,
  FOLD_FRONT_LOADED_EXTRA_IN,
  FOLD_MAGNET_CLEAR_IN,
  FOLD_SECTION_STEP_IN,
  FOLD_SMOOTH_SECTIONS,
  FOLD_THIN_IN,
  FOLD_VENT_END_RATIO,
} from "../../constants/foldHorn";
import { FOLD_WALL, HORN_DRIVE } from "../../constants/speakerSpec";
import { LITERS_PER_CUBIC_IN } from "../../constants/units";
import type {
  FoldCheck,
  FoldDriverPart,
  FoldDrivers,
  FoldGrid,
  FoldMouth,
  FoldSealedPocket,
  FoldTrace,
  FoldVentedChamber,
  HornFold,
  SidePoint,
} from "../../types";
import { add, drawnSeg, left, segDist, sub, unit } from "./foldGeometry";

/** One driver's body, and how many: its cutout's diameter, its depth behind the board, its motor's diameter (all in). */
export interface FoldDriverShape {
  cutoutIn: number;
  depthIn: number;
  motorIn: number;
  count: number;
}

/** What `foldTrace` reads. The depth, height and width are the chamber's inside; `depthIn` and `heightIn` are the side section. */
export interface FoldTraceInput {
  depthIn: number;
  heightIn: number;
  widthIn: number;
  /** the boards' thickness */
  boardIn: number;
  fold: HornFold;
  /** the drivers' body; null: none chosen */
  driver: FoldDriverShape | null;
}

/** A point is inside a polygon (even-odd rule). */
function inPolygon(p: SidePoint, poly: readonly SidePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.yIn > p.yIn !== b.yIn > p.yIn &&
      p.zIn < ((b.zIn - a.zIn) * (p.yIn - a.yIn)) / (b.yIn - a.yIn) + a.zIn
    )
      inside = !inside;
  }
  return inside;
}

/** How many drivers of cutout diameter `cutoutIn` fit side by side across `widthIn`, with room between them and the walls. */
export const foldAcross = (widthIn: number, cutoutIn: number) =>
  Math.max(1, Math.floor((widthIn - FOLD_DRIVER_GAP_IN) / (cutoutIn + FOLD_DRIVER_GAP_IN)));

/**
 * The drivers' rows along the board they mount on, each with its cone line and body outline. The rows run across the
 * chamber's width as many as fit side by side (`across`), the rest in more rows (`rows`) along the board, `pitch` apart,
 * centered on the spot `drivers.along` sets. Empty when there are no drivers or the board is missing.
 */
export function foldDriverParts(
  fold: Pick<HornFold, "boards">,
  drivers: FoldDrivers | null,
  driver: FoldDriverShape | null,
  widthIn: number,
  boardIn: number,
): FoldDriverPart[] {
  if (!drivers || !driver) return [];
  const board = fold.boards[drivers.board];
  if (!board) return [];
  const along = unit(sub(board.b, board.a));
  const normal = left(along); // the cones face `normal` times `drivers.face`
  const boardLengthIn = Math.hypot(board.b.zIn - board.a.zIn, board.b.yIn - board.a.yIn);
  const across = foldAcross(widthIn, driver.cutoutIn);
  const rows = Math.ceil(driver.count / across);
  /** the distance between two rows' centers along the board */
  const pitch = driver.cutoutIn + FOLD_DRIVER_GAP_IN;
  const centerIn = drivers.along * boardLengthIn;
  const radius = driver.cutoutIn / 2;
  const motorRadius = driver.motorIn / 2;
  const out = { zIn: normal.zIn * drivers.face, yIn: normal.yIn * drivers.face };
  const back = { zIn: -out.zIn, yIn: -out.yIn };
  return Array.from({ length: rows }, (_, row) => {
    const alongIn = centerIn + (row - (rows - 1) / 2) * pitch;
    const mid = add(board.a, along, alongIn);
    const coneFace = add(mid, normal, (drivers.face * boardIn) / 2);
    const backFace = add(mid, normal, (-drivers.face * boardIn) / 2);
    const midway = add(backFace, back, driver.depthIn * FOLD_BASKET_SHARE);
    const bottom = add(backFace, back, driver.depthIn);
    // the basket flares from the cutout to the motor, then the motor
    const body = [
      add(backFace, along, -radius),
      add(backFace, along, radius),
      add(midway, along, motorRadius * FOLD_BASKET_FLARE),
      add(bottom, along, motorRadius),
      add(bottom, along, -motorRadius),
      add(midway, along, -motorRadius * FOLD_BASKET_FLARE),
    ];
    return {
      alongIn,
      mid,
      coneFace,
      backFace,
      out,
      back,
      body,
      coneLine: { from: add(coneFace, along, -radius), to: add(coneFace, along, radius) },
      cutoutRadiusIn: radius,
      boardLengthIn,
    };
  });
}

/**
 * A driver row's motor in the side section (a solid cylinder, the rest of the body is the open basket): from where the
 * basket meets it, `FOLD_BASKET_SHARE` of the depth behind the board, to its bottom, the motor's diameter wide.
 */
function motorOutline(
  part: Pick<FoldDriverPart, "body" | "backFace" | "back">,
  driver: Pick<FoldDriverShape, "depthIn" | "motorIn">,
): SidePoint[] {
  const along = unit(sub(part.body[1], part.body[0]));
  const top = add(part.backFace, part.back, driver.depthIn * FOLD_BASKET_SHARE);
  const bottom = add(part.backFace, part.back, driver.depthIn);
  const radius = driver.motorIn / 2;
  return [
    add(top, along, radius),
    add(bottom, along, radius),
    add(bottom, along, -radius),
    add(top, along, -radius),
  ];
}

/** The eight neighbors of a cell: the step across (`NEIGHBOR_DI`) and up (`NEIGHBOR_DJ`), and its length in cells. */
const NEIGHBOR_DI = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const NEIGHBOR_DJ = [0, 0, 1, -1, 1, -1, 1, -1] as const;
const NEIGHBOR_STEP = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2] as const;
/** The four neighbors that share an edge, for the pockets. */
const EDGE_NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** The grid a search runs on: `nz` cells across, `ny` up, `cellIn` each, the solid ones marked. */
type SearchGrid = Pick<FoldGrid, "nz" | "ny" | "cellIn" | "solid">;

/**
 * The cheapest ways through a grid's air from `sources` (Dijkstra's search, on a binary heap of typed arrays): each
 * step to one of the eight neighbors costs its length (in) times the `weight` of the cell it enters (none: 1, the
 * distance through the air), with no squeezing diagonally between two solid cells. It gives each cell's cost (Infinity
 * where it never reaches), the source its way starts from (`root`) and the cell before it (`from`), -1 where there is
 * none. With `stopAt` it stops once that cell's cost is settled.
 */
function cheapestWays(
  grid: SearchGrid,
  sources: readonly number[],
  weight: Float64Array | null = null,
  stopAt = -1,
) {
  const { nz, ny, cellIn, solid } = grid;
  const count = nz * ny;
  const cost = new Float64Array(count).fill(Infinity);
  const root = new Int32Array(count).fill(-1);
  const from = new Int32Array(count).fill(-1);
  /** the heap: each entry's cost and cell, the least cost first */
  let keys = new Float64Array(2 * count + sources.length);
  let cells = new Int32Array(keys.length);
  let size = 0;
  const push = (key: number, cell: number) => {
    if (size === keys.length) {
      const grownKeys = new Float64Array(2 * size);
      const grownCells = new Int32Array(2 * size);
      grownKeys.set(keys);
      grownCells.set(cells);
      keys = grownKeys;
      cells = grownCells;
    }
    let child = size++;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[child] = keys[parent];
      cells[child] = cells[parent];
      child = parent;
    }
    keys[child] = key;
    cells[child] = cell;
  };
  for (const cell of sources) {
    cost[cell] = 0;
    root[cell] = cell;
    push(0, cell);
  }
  while (size > 0) {
    const key = keys[0];
    const cell = cells[0];
    // take the top off: the last entry sinks from the root
    size--;
    if (size > 0) {
      const lastKey = keys[size];
      const lastCell = cells[size];
      let hole = 0;
      for (;;) {
        const l = 2 * hole + 1;
        if (l >= size) break;
        const least = l + 1 < size && keys[l + 1] < keys[l] ? l + 1 : l;
        if (keys[least] >= lastKey) break;
        keys[hole] = keys[least];
        cells[hole] = cells[least];
        hole = least;
      }
      keys[hole] = lastKey;
      cells[hole] = lastCell;
    }
    if (key > cost[cell]) continue;
    if (cell === stopAt) break;
    const i = cell % nz;
    const j = (cell - i) / nz;
    for (let n = 0; n < NEIGHBOR_STEP.length; n++) {
      const di = NEIGHBOR_DI[n];
      const dj = NEIGHBOR_DJ[n];
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= nz || b >= ny) continue;
      const next = b * nz + a;
      if (solid[next]) continue;
      if (di !== 0 && dj !== 0 && (solid[j * nz + a] || solid[b * nz + i])) continue;
      const through = key + NEIGHBOR_STEP[n] * cellIn * (weight === null ? 1 : weight[next]);
      if (through < cost[next]) {
        cost[next] = through;
        root[next] = root[cell];
        from[next] = cell;
        push(through, next);
      }
    }
  }
  return { cost, root, from };
}

/**
 * The least fall of the clearance per inch of path, toward the closed end, that marks the path's tail running into a
 * corner (a square corner's is 1/√2) rather than along a narrowing horn.
 */
const CORNER_FALL = 0.5;

/** The `Sample` pocket index of the vented chamber (a sealed pocket's is its index in `FoldTrace.sealed`). */
const VENTED = -1;

/**
 * What the air just off a side of the cones is: the passage (`horn`, `sIn` in from the closed end), a sealed pocket
 * (`pocket`: its index) or the vented chamber (`pocket` is `VENTED`).
 */
type Sample = { horn: true; sIn: number } | { horn: false; pocket: number };

/** Whether `cell` of the grid is on the mouth's opening: on its wall, between `fromIn` and `toIn`. */
function onMouth(
  mouth: FoldMouth,
  i: number,
  j: number,
  nz: number,
  ny: number,
  cellIn: number,
): boolean {
  const z = (i + 0.5) * cellIn;
  const y = (j + 0.5) * cellIn;
  if (mouth.wall === FOLD_WALL.baffle) return i === 0 && y >= mouth.fromIn && y <= mouth.toIn;
  if (mouth.wall === FOLD_WALL.back) return i === nz - 1 && y >= mouth.fromIn && y <= mouth.toIn;
  if (mouth.wall === FOLD_WALL.bottom) return j === 0 && z >= mouth.fromIn && z <= mouth.toIn;
  return j === ny - 1 && z >= mouth.fromIn && z <= mouth.toIn;
}

/**
 * Trace a folded horn. A 0.25 in grid over the side section marks the boards and the outside of the walls solid (the
 * mouth's opening is not a wall). A driver's basket is open: its cone, in the board's cutout, parts the air in front
 * from the air behind. Its motor is a solid cylinder across part of the width: its cells stay air, and the area there
 * loses the motor's own cross-section (its diameter times its extent across the passage).
 *
 * The air the mouth reaches is the passage (eight neighbors, √2 on the diagonal); air it does not reach is sealed. The
 * closed end is the passage's air farthest from the mouth through the air. The path runs along the passage's middle,
 * from the mouth to the closed end: the way whose steps cost their length over the square of the clearance (the distance
 * to the nearest board or wall), so it keeps to the middle of each leg and round each bend, as a horn's center line.
 * Its length is the path's. Each air cell's distance from the mouth is that of the nearest point on it, through the air.
 *
 * The width at each distance is twice the largest clearance in its 0.5 in band, smoothed over 2.5 in; the area is that
 * times the inside width, less the motors' cross-section in the band. The taps are where the first row of cones' air
 * meets the passage: the middle of the cones' face, and the middle of the basket behind it.
 *
 * The vent (`fold.vent`) is traced from its own opening, through the air: the air it reaches that the mouth does not is
 * the vented chamber, not a sealed pocket. Its duct runs from the opening inward until the width first passes
 * `FOLD_VENT_END_RATIO` times the opening's: its height is the mean width over the run, its length the run and the
 * wall's thickness (`boardIn`). A vent whose opening the mouth reaches leaks (no vented chamber).
 */
export function foldTrace(input: FoldTraceInput): FoldTrace {
  const { depthIn, heightIn, widthIn, boardIn, fold, driver } = input;
  const cellIn = FOLD_CELL_IN;
  // at least one cell each way: a room too small to hold a fold still traces (to nothing) rather than fail
  const nz = Math.max(1, Math.round(depthIn / cellIn));
  const ny = Math.max(1, Math.round(heightIn / cellIn));
  const count = nz * ny;
  const solid = new Uint8Array(count);
  /** by cell: how many motors stand side by side across the width there (0: none) */
  const motors = new Uint8Array(count);
  const at = (i: number, j: number) => j * nz + i;
  const cellPoint = (i: number, j: number): SidePoint => ({
    zIn: (i + 0.5) * cellIn,
    yIn: (j + 0.5) * cellIn,
  });
  /** set `value` in `cells` for the cells of the box `[z0, z1] × [y0, y1]` (in) that `inside` takes */
  const mark = (
    cells: Uint8Array,
    value: number,
    inside: (p: SidePoint) => boolean,
    z0: number,
    z1: number,
    y0: number,
    y1: number,
  ) => {
    const i0 = clamp(Math.floor(z0 / cellIn), 0, nz - 1);
    const i1 = clamp(Math.ceil(z1 / cellIn), 0, nz - 1);
    const j0 = clamp(Math.floor(y0 / cellIn), 0, ny - 1);
    const j1 = clamp(Math.ceil(y1 / cellIn), 0, ny - 1);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) if (inside(cellPoint(i, j))) cells[at(i, j)] = value;
  };

  fold.boards.forEach((_, index) => {
    const seg = drawnSeg(fold.boards, index, boardIn);
    const pad = boardIn / 2 + cellIn;
    mark(
      solid,
      1,
      (p) => segDist(p, seg.a, seg.b).d <= boardIn / 2 + 0.01,
      Math.min(seg.a.zIn, seg.b.zIn) - pad,
      Math.max(seg.a.zIn, seg.b.zIn) + pad,
      Math.min(seg.a.yIn, seg.b.yIn) - pad,
      Math.max(seg.a.yIn, seg.b.yIn) + pad,
    );
  });
  const parts = foldDriverParts(fold, fold.drivers, driver, widthIn, boardIn);
  if (driver) {
    /** the drivers side by side in a full row */
    const across = foldAcross(widthIn, driver.cutoutIn);
    parts.forEach((part, row) => {
      const inRow = Math.min(across, driver.count - row * across);
      const motor = motorOutline(part, driver);
      const zs = motor.map((p) => p.zIn);
      const ys = motor.map((p) => p.yIn);
      mark(
        motors,
        inRow,
        (p) => inPolygon(p, motor),
        Math.min(...zs),
        Math.max(...zs),
        Math.min(...ys),
        Math.max(...ys),
      );
    });
  }

  /** whether a cell is on the mouth's or the vent's opening: no wall there */
  const onOpening = (i: number, j: number) =>
    onMouth(fold.mouth, i, j, nz, ny, cellIn) ||
    (fold.vent !== undefined && onMouth(fold.vent, i, j, nz, ny, cellIn));

  /** the cheapest ways through this grid's air (`cheapestWays`) */
  const search = (sources: readonly number[], weight: Float64Array | null = null, stopAt = -1) =>
    cheapestWays({ nz, ny, cellIn, solid }, sources, weight, stopAt);
  /** the air cells along an opening */
  const openingCells = (opening: FoldMouth) => {
    const cells: number[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nz; i++)
        if (!solid[at(i, j)] && onMouth(opening, i, j, nz, ny, cellIn)) cells.push(at(i, j));
    return cells;
  };

  // the mouth: the air cells along the opening, and the distance from them through the air (the passage)
  const mouthCells = openingCells(fold.mouth);
  const reach = search(mouthCells).cost;

  // the vent: the distance from its opening through the air the mouth did not reach; an opening the mouth reaches leaks
  const ventCells = fold.vent ? openingCells(fold.vent) : [];
  const ventLeaks = ventCells.some((cell) => reach[cell] < Infinity);
  const ventDist = ventCells.length && !ventLeaks ? search(ventCells).cost : null;
  const vented = new Uint8Array(count);
  let ventedCells = 0;
  if (ventDist)
    for (let k = 0; k < count; k++)
      if (ventDist[k] < Infinity) {
        vented[k] = 1;
        ventedCells++;
      }

  // sealed pockets: air neither the mouth nor the vent reaches
  const pocket = new Int32Array(count).fill(-1);
  const sealed: FoldSealedPocket[] = [];
  const isSealedAir = (k: number) => !solid[k] && reach[k] === Infinity && !vented[k];
  for (let k = 0; k < count; k++) {
    if (!isSealedAir(k) || pocket[k] >= 0) continue;
    const id = sealed.length;
    const stack = [k];
    let cells = 0;
    pocket[k] = id;
    while (stack.length) {
      const cell = stack.pop() ?? 0;
      cells++;
      const i = cell % nz;
      const j = Math.floor(cell / nz);
      for (const [di, dj] of EDGE_NEIGHBORS) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= nz || b >= ny) continue;
        const next = at(a, b);
        if (isSealedAir(next) && pocket[next] < 0) {
          pocket[next] = id;
          stack.push(next);
        }
      }
    }
    sealed.push({
      cells,
      liters: cells * cellIn * cellIn * widthIn * LITERS_PER_CUBIC_IN,
      opensToBack: false,
      opensToFront: false,
    });
  }

  // the closed end: the passage's air farthest from the mouth through the air
  let endCell = -1;
  for (let k = 0, farIn = 0; k < count; k++)
    if (reach[k] < Infinity && reach[k] > farIn) {
      farIn = reach[k];
      endCell = k;
    }
  const closedEnd = endCell >= 0 ? cellPoint(endCell % nz, Math.floor(endCell / nz)) : null;

  // the clearance: each air cell's distance to the nearest board or wall (the mouth's and the vent's openings are no
  // wall); two sweeps of the chamfer distance (forward and back, eight neighbors) settle it on this grid
  const clearance = new Float64Array(count).fill(Infinity);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nz; i++) {
      const k = at(i, j);
      if (solid[k]) clearance[k] = 0;
      else if ((i === 0 || i === nz - 1 || j === 0 || j === ny - 1) && !onOpening(i, j))
        clearance[k] = cellIn / 2;
    }
  const diagonalIn = Math.SQRT2 * cellIn;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nz; i++) {
        const k = j * nz + i;
        let v = clearance[k];
        if (i > 0) v = Math.min(v, clearance[k - 1] + cellIn);
        if (j > 0) {
          v = Math.min(v, clearance[k - nz] + cellIn);
          if (i > 0) v = Math.min(v, clearance[k - nz - 1] + diagonalIn);
          if (i < nz - 1) v = Math.min(v, clearance[k - nz + 1] + diagonalIn);
        }
        clearance[k] = v;
      }
    for (let j = ny - 1; j >= 0; j--)
      for (let i = nz - 1; i >= 0; i--) {
        const k = j * nz + i;
        let v = clearance[k];
        if (i < nz - 1) v = Math.min(v, clearance[k + 1] + cellIn);
        if (j < ny - 1) {
          v = Math.min(v, clearance[k + nz] + cellIn);
          if (i < nz - 1) v = Math.min(v, clearance[k + nz + 1] + diagonalIn);
          if (i > 0) v = Math.min(v, clearance[k + nz - 1] + diagonalIn);
        }
        clearance[k] = v;
      }
  }

  // the path along the passage's middle, from the mouth to the closed end: each step costs its length over the square
  // of the clearance (at least half a cell's); its length is the path's, and each air cell's distance from the mouth is
  // that of its nearest cell on the path, through the air
  const dist = new Float64Array(count).fill(Infinity);
  let pathIn = 0;
  if (endCell >= 0) {
    const weight = new Float64Array(count);
    const leastIn = cellIn / 2;
    for (let k = 0; k < count; k++) weight[k] = 1 / Math.max(clearance[k], leastIn) ** 2;
    const { from } = search(mouthCells, weight, endCell);
    /** the path's cells, from the closed end back to the mouth */
    const line: number[] = [];
    for (let k = endCell; k >= 0; k = from[k]) line.push(k);
    /** by cell on the path: its distance from the closed end along the path, in */
    const fromEnd = new Float64Array(count);
    for (let n = 1; n < line.length; n++) {
      const [p, q] = [line[n - 1], line[n]];
      const straight = p % nz === q % nz || Math.floor(p / nz) === Math.floor(q / nz);
      fromEnd[q] = fromEnd[p] + (straight ? 1 : Math.SQRT2) * cellIn;
    }
    // the closed end's corner: the path leaves the middle into the corner, its clearance falling at least half as fast
    // as it runs (a horn's narrowing end falls slower); that tail counts only its depth to the end wall (the clearance
    // where it leaves the middle), as a center line ends on the end wall's middle
    let corner = 0;
    while (
      corner + 1 < line.length &&
      clearance[line[corner + 1]] - clearance[line[corner]] >=
        CORNER_FALL * (fromEnd[line[corner + 1]] - fromEnd[line[corner]])
    )
      corner++;
    if (corner > 0) {
      const tailIn = fromEnd[line[corner]];
      const depthIn = Math.min(tailIn, clearance[line[corner]]);
      for (let n = 1; n < line.length; n++)
        fromEnd[line[n]] =
          n <= corner ? (fromEnd[line[n]] * depthIn) / tailIn : fromEnd[line[n]] - tailIn + depthIn;
    }
    pathIn = fromEnd[line[line.length - 1]];
    const { root } = search(line);
    for (let k = 0; k < count; k++) if (root[k] >= 0) dist[k] = pathIn - fromEnd[root[k]];
  }

  // the width along the path: in each band of distance from the mouth, the widest circle that fits (twice the most
  // clearance there): a leg's height in a straight leg, steady through a turn; and the motors' cells in the band
  const step = FOLD_SECTION_STEP_IN;
  const bands = Math.max(1, Math.ceil(pathIn / step));
  const widest = new Float64Array(bands);
  /** each band's motor cells, each counted once for every motor across the width there */
  const motorCells = new Float64Array(bands);
  for (let k = 0; k < count; k++)
    if (dist[k] < Infinity) {
      const band = Math.min(bands - 1, Math.floor(dist[k] / step));
      widest[band] = Math.max(widest[band], 2 * clearance[k]);
      motorCells[band] += motors[k];
    }
  /** each band's value averaged over `FOLD_SMOOTH_SECTIONS` bands each side */
  const smoothed = (values: Float64Array) =>
    Array.from(values, (_, band) => {
      let sum = 0;
      let n = 0;
      for (
        let k = Math.max(0, band - FOLD_SMOOTH_SECTIONS);
        k <= Math.min(bands - 1, band + FOLD_SMOOTH_SECTIONS);
        k++
      ) {
        sum += values[k];
        n++;
      }
      return sum / n;
    });
  const smoothWidths = smoothed(widest);
  const smoothMotors = smoothed(motorCells);
  /**
   * a motor cell's share of a band's area, in²: its side-section area over the band's length (its extent across the
   * passage) times the motor's diameter (its extent across the width)
   */
  const motorCellIn2 = driver ? ((cellIn * cellIn) / step) * driver.motorIn : 0;
  const sections = closedEnd
    ? smoothWidths
        .map((widthAt, band) => ({
          sIn: pathIn - (band + 0.5) * step,
          widthIn: widthAt,
          areaIn2: Math.max(0, widthAt * widthIn - smoothMotors[band] * motorCellIn2),
        }))
        .reverse()
    : [];

  // the vented chamber and its duct: the width at each distance from the vent's opening, as the path's, unsmoothed (a
  // smoothed width would blur where the duct opens into the chamber); the duct runs until the width first passes
  // `FOLD_VENT_END_RATIO` times the opening's
  const litersOf = (cells: number) => cells * cellIn * cellIn * widthIn * LITERS_PER_CUBIC_IN;
  let ventedChamber: FoldVentedChamber | null = null;
  if (ventDist) {
    let reach = 0;
    for (let k = 0; k < count; k++) if (vented[k] && ventDist[k] > reach) reach = ventDist[k];
    const ventBands = Math.floor(reach / step) + 1;
    const ventWidest = new Float64Array(ventBands);
    /** the opening's width: its open cells' sides */
    const openingIn = ventCells.length * cellIn;
    const limitIn = FOLD_VENT_END_RATIO * openingIn;
    let runIn = Infinity;
    for (let k = 0; k < count; k++)
      if (vented[k]) {
        const band = Math.floor(ventDist[k] / step);
        ventWidest[band] = Math.max(ventWidest[band], 2 * clearance[k]);
        if (2 * clearance[k] > limitIn && ventDist[k] < runIn) runIn = ventDist[k];
      }
    // a duct with no wide air past it is the whole vented air: the chamber has none left
    const run = Math.min(runIn, reach + cellIn);
    /** the sections that lie wholly inside the run: none when the opening is wide open to the chamber */
    const inRun = Math.min(ventBands, Math.floor(run / step));
    const heightIn =
      inRun > 0 ? ventWidest.slice(0, inRun).reduce((sum, w) => sum + w, 0) / inRun : openingIn;
    let ductCells = 0;
    for (let k = 0; k < count; k++) if (vented[k] && ventDist[k] < run) ductCells++;
    ventedChamber = {
      cells: ventedCells,
      liters: litersOf(ventedCells - ductCells),
      opensToBack: false,
      opensToFront: false,
      duct: { lengthIn: run + boardIn, heightIn, areaIn2: heightIn * widthIn },
    };
  }

  // the taps: where the air on each side of the first row of cones meets the passage
  const sample = (p: SidePoint): Sample | null => {
    const i = Math.floor(p.zIn / cellIn);
    const j = Math.floor(p.yIn / cellIn);
    if (i < 0 || j < 0 || i >= nz || j >= ny) return null;
    const k = at(i, j);
    if (solid[k]) return null;
    if (vented[k]) return { horn: false, pocket: VENTED };
    return dist[k] < Infinity
      ? { horn: true, sIn: pathIn - dist[k] }
      : { horn: false, pocket: pocket[k] };
  };
  /** the air a side of the cones opens into, a sealed pocket or the vented chamber: it opens to that side */
  const opensInto = (air: Sample | null, side: "opensToFront" | "opensToBack") => {
    if (!air || air.horn) return;
    const target = air.pocket === VENTED ? ventedChamber : sealed[air.pocket];
    if (target) target[side] = true;
  };
  const first = parts.length ? parts[0] : null;
  let front: Sample | null = null;
  let rear: Sample | null = null;
  if (first && driver && mouthCells.length) {
    /** two samples are the same air: both the passage, or the same pocket or chamber */
    const sameAir = (p: Sample, q: Sample) => (p.horn ? q.horn : !q.horn && p.pocket === q.pocket);
    // the fronts: the air just off the middle of the cones' face
    front = sample(add(first.coneFace, first.out, cellIn * 1.5));
    // the backs: the air behind the cones opens through the basket's windows, between the board and the motor; read it
    // at the basket's middle, or just behind the cones' middle where a board cuts through the basket
    const behind = sample(add(first.backFace, first.back, cellIn * 1.5));
    const basket = sample(
      add(first.backFace, first.back, (driver.depthIn * FOLD_BASKET_SHARE) / 2),
    );
    rear = behind && basket && sameAir(behind, basket) ? basket : behind;
    opensInto(front, "opensToFront");
    opensInto(rear, "opensToBack");
  }
  const taps = {
    front: front?.horn ? front.sIn : null,
    back: rear?.horn ? rear.sIn : null,
  };

  // the checks, and the horn type the taps make
  const checks: FoldCheck[] = [];
  let hornType: FoldTrace["hornType"] = null;
  if (!mouthCells.length) checks.push({ id: FOLD_CHECK.mouth });
  else if (!driver || !first) {
    checks.push({ id: FOLD_CHECK.drivers, reason: FOLD_DRIVERS_REASON.none });
  } else {
    if (!front && !rear) {
      checks.push({ id: FOLD_CHECK.drivers, reason: FOLD_DRIVERS_REASON.blocked });
    } else if (front?.horn && rear?.horn) {
      hornType = HORN_DRIVE.tapped;
      const opens = Math.min(front.sIn, rear.sIn);
      if (opens > FOLD_DEAD_END_SHARE * pathIn)
        checks.push({
          id: FOLD_CHECK.deadEnd,
          fromClosedEndIn: opens,
          share: opens / pathIn,
        });
    } else if (front?.horn || rear?.horn) {
      const open = front?.horn ? front : rear;
      const shut = front?.horn ? rear : front;
      // one side of the cones is in the passage: `open` is that side, `shut` the other (a pocket, a board or nothing)
      const opens = open?.horn ? open.sIn : 0;
      hornType =
        opens <= driver.cutoutIn / 2 + FOLD_FRONT_LOADED_EXTRA_IN
          ? HORN_DRIVE.front
          : HORN_DRIVE.offset;
      if (!shut || shut.horn) checks.push({ id: FOLD_CHECK.rearChamber });
      if (hornType === HORN_DRIVE.offset && opens > FOLD_DEAD_END_SHARE * pathIn)
        checks.push({
          id: FOLD_CHECK.deadEnd,
          fromClosedEndIn: opens,
          share: opens / pathIn,
        });
    } else {
      checks.push({ id: FOLD_CHECK.drivers, reason: FOLD_DRIVERS_REASON.outside });
    }
    // the cutout on its board
    parts.forEach((part, row) => {
      if (
        part.alongIn - part.cutoutRadiusIn < FOLD_CUTOUT_SPARE_IN ||
        part.alongIn + part.cutoutRadiusIn > part.boardLengthIn - FOLD_CUTOUT_SPARE_IN
      )
        checks.push({ id: FOLD_CHECK.cutout, row });
    });
    // the motor clear: probe round each body's edge for a wall or another board within the clearance
    const probes = [
      { zIn: FOLD_MAGNET_CLEAR_IN, yIn: 0 },
      { zIn: -FOLD_MAGNET_CLEAR_IN, yIn: 0 },
      { zIn: 0, yIn: FOLD_MAGNET_CLEAR_IN },
      { zIn: 0, yIn: -FOLD_MAGNET_CLEAR_IN },
    ];
    /** whether a point past a wall is in that wall's mouth or vent opening: open air, not a wall */
    const throughOpening = (q: SidePoint) =>
      [fold.mouth, fold.vent].some((o) => {
        if (!o) return false;
        const along = o.wall === FOLD_WALL.baffle || o.wall === FOLD_WALL.back ? q.yIn : q.zIn;
        const past =
          o.wall === FOLD_WALL.baffle
            ? q.zIn < 0
            : o.wall === FOLD_WALL.back
              ? q.zIn > depthIn
              : o.wall === FOLD_WALL.bottom
                ? q.yIn < 0
                : q.yIn > heightIn;
        return past && along >= Math.min(o.fromIn, o.toIn) && along <= Math.max(o.fromIn, o.toIn);
      });
    const mountBoard = fold.drivers?.board;
    const nearBoard = (q: SidePoint) =>
      fold.boards.some(
        (bd, index) => index !== mountBoard && segDist(q, bd.a, bd.b).d < boardIn / 2,
      );
    const motorHit = parts.some((part) =>
      part.body.some((a, k) => {
        const c = part.body[(k + 1) % part.body.length];
        for (let u = 0; u <= 1; u += 0.1) {
          const p = add(a, sub(c, a), u);
          for (const o of probes) {
            const q = add(p, o);
            if (
              (q.zIn < 0 || q.yIn < 0 || q.zIn > depthIn || q.yIn > heightIn) &&
              !throughOpening(q)
            )
              return true;
            if (nearBoard(q)) return true;
          }
        }
        return false;
      }),
    );
    if (motorHit) checks.push({ id: FOLD_CHECK.magnet });
  }
  const strayAir = sealed.filter((s) => !s.opensToBack && !s.opensToFront).length;
  if (strayAir) checks.push({ id: FOLD_CHECK.strayAir, count: strayAir });
  // the vent: an opening on a board, an opening into the passage, or a chamber no driver uses
  if (fold.vent && !ventCells.length) checks.push({ id: FOLD_CHECK.ventBlocked });
  if (ventLeaks) checks.push({ id: FOLD_CHECK.ventLeak });
  if (ventedChamber && !ventedChamber.opensToBack && !ventedChamber.opensToFront)
    checks.push({ id: FOLD_CHECK.ventStray });
  else if (ventedChamber && !(ventedChamber.liters > 0)) checks.push({ id: FOLD_CHECK.ventNoAir });

  // chokes: the area falls under 3/4 of its usual size over the 15 in before (the median, so a turn's bulge does not
  // count; the ends left out)
  const choke = sections.find((section) => {
    if (section.sIn < FOLD_ENDS_IN || section.sIn > pathIn - FOLD_ENDS_IN) return false;
    const before = sections
      .filter(
        (o) =>
          o.sIn < section.sIn &&
          o.sIn >= section.sIn - FOLD_CHOKE_LOOKBACK_IN &&
          o.sIn >= FOLD_ENDS_IN,
      )
      .map((o) => o.areaIn2)
      .sort((x, y) => x - y);
    return (
      before.length > FOLD_CHOKE_MIN_SECTIONS &&
      section.areaIn2 < FOLD_CHOKE_SHARE * before[before.length >> 1]
    );
  });
  if (choke) checks.push({ id: FOLD_CHECK.choke, fromClosedEndIn: choke.sIn });
  // thin: the width falls under the least a passage takes (the ends left out, as the choke)
  const thin = sections.find(
    (section) =>
      section.sIn >= FOLD_ENDS_IN &&
      section.sIn <= pathIn - FOLD_ENDS_IN &&
      section.widthIn < FOLD_THIN_IN,
  );
  if (thin) checks.push({ id: FOLD_CHECK.thin, fromClosedEndIn: thin.sIn, widthIn: thin.widthIn });

  return {
    grid: { cellIn, nz, ny, solid, dist, pocket, vented },
    pathIn,
    closedEnd,
    sections,
    taps,
    sealed,
    vented: ventedChamber,
    hornType,
    parts,
    checks,
  };
}
