// Fold puzzle engine — shared by client (play) and server (verification).
//
// The paper is a grid of square cells. Each cell has a front colour; the back
// of the sheet is one solid colour. A fold picks a crease line and flips every
// stack on one side of it over onto the other side: the moved stacks land on
// top, their layer order is reversed and every moved layer turns over.
// The player wins when the view from above matches the target.

export type Axis = 'x' | 'y';

/** A crease at `at` lies between column/row `at - 1` and `at`.
 *  `from: 'low'` folds the cells with coordinate < at over onto the high side;
 *  `from: 'high'` folds the cells with coordinate >= at over onto the low side. */
export type Fold = { axis: Axis; at: number; from: 'low' | 'high' };

export type Layer = { cell: number; up: boolean };

/** Stacks keyed by "x,y"; each stack is bottom → top. */
export type PaperState = Map<string, Layer[]>;

export type Puzzle = {
  number: number;
  w: number;
  h: number;
  /** Front colour index per cell, row-major. */
  front: number[];
  /** Colour index of the back of the sheet. */
  back: number;
  /** Serialized top view to reach (see topView). */
  target: string;
  /** Fewest folds that reach the target. */
  par: number;
};

const key = (x: number, y: number) => `${x},${y}`;

export const parseKey = (k: string): [number, number] => {
  const [x, y] = k.split(',').map(Number);
  return [x!, y!];
};

export const initialState = (w: number, h: number): PaperState => {
  const s: PaperState = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) s.set(key(x, y), [{ cell: y * w + x, up: true }]);
  }
  return s;
};

export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

export const bounds = (s: PaperState): Bounds => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const k of s.keys()) {
    const [x, y] = parseKey(k);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
};

const coord = (k: string, axis: Axis) => parseKey(k)[axis === 'x' ? 0 : 1];

const moves = (f: Fold, c: number) => (f.from === 'low' ? c < f.at : c >= f.at);

/** True when the fold has paper on both sides of the crease. */
export const canFold = (s: PaperState, f: Fold): boolean => {
  let moving = 0;
  let staying = 0;
  for (const k of s.keys()) {
    if (moves(f, coord(k, f.axis))) moving++;
    else staying++;
    if (moving && staying) return true;
  }
  return false;
};

export const applyFold = (s: PaperState, f: Fold): PaperState => {
  if (!canFold(s, f)) throw new Error(`illegal fold ${JSON.stringify(f)}`);
  const next: PaperState = new Map();
  const moved: [string, Layer[]][] = [];
  for (const [k, stack] of s) {
    if (moves(f, coord(k, f.axis))) moved.push([k, stack]);
    else next.set(k, stack.slice());
  }
  for (const [k, stack] of moved) {
    const [x, y] = parseKey(k);
    const nx = f.axis === 'x' ? 2 * f.at - 1 - x : x;
    const ny = f.axis === 'y' ? 2 * f.at - 1 - y : y;
    const flipped = stack
      .slice()
      .reverse()
      .map((l) => ({ cell: l.cell, up: !l.up }));
    const nk = key(nx, ny);
    next.set(nk, [...(next.get(nk) ?? []), ...flipped]);
  }
  return next;
};

/** Every legal fold from this state. */
export const legalFolds = (s: PaperState): Fold[] => {
  const b = bounds(s);
  const out: Fold[] = [];
  for (const axis of ['x', 'y'] as const) {
    const lo = axis === 'x' ? b.minX : b.minY;
    const hi = axis === 'x' ? b.maxX : b.maxY;
    for (let at = lo + 1; at <= hi; at++) {
      for (const from of ['low', 'high'] as const) {
        const f: Fold = { axis, at, from };
        if (canFold(s, f)) out.push(f);
      }
    }
  }
  return out;
};

export const topColor = (layers: Layer[], front: number[], back: number) => {
  const top = layers[layers.length - 1]!;
  return top.up ? front[top.cell]! : back;
};

/** Visible pattern, translated to the origin: "w×h:" then rows joined by "/",
 *  one char per cell (colour index, or "." for no paper). */
export const topView = (s: PaperState, front: number[], back: number): string => {
  const b = bounds(s);
  const rows: string[] = [];
  for (let y = b.minY; y <= b.maxY; y++) {
    let row = '';
    for (let x = b.minX; x <= b.maxX; x++) {
      const st = s.get(key(x, y));
      row += st ? String(topColor(st, front, back)) : '.';
    }
    rows.push(row);
  }
  return `${b.maxX - b.minX + 1}x${b.maxY - b.minY + 1}:${rows.join('/')}`;
};

export const parseView = (v: string): { w: number; h: number; rows: string[] } => {
  const [dims, body] = v.split(':');
  const [w, h] = dims!.split('x').map(Number);
  return { w: w!, h: h!, rows: body!.split('/') };
};

const stateKey = (s: PaperState): string =>
  [...s.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, st]) => `${k}=${st.map((l) => (l.up ? l.cell : ~l.cell)).join('.')}`)
    .join(';');

/** Fewest folds from the flat sheet to the target view, searching up to
 *  maxDepth folds. Returns null when the target is not reachable in that many. */
export const minFolds = (
  w: number,
  h: number,
  front: number[],
  back: number,
  target: string,
  maxDepth: number
): number | null => {
  let frontier: PaperState[] = [initialState(w, h)];
  const seen = new Set([stateKey(frontier[0]!)]);
  if (topView(frontier[0]!, front, back) === target) return 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: PaperState[] = [];
    for (const s of frontier) {
      for (const f of legalFolds(s)) {
        const n = applyFold(s, f);
        const k = stateKey(n);
        if (seen.has(k)) continue;
        seen.add(k);
        if (topView(n, front, back) === target) return depth;
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
};

/** Shortest fold sequence from `start` to the target view, up to maxDepth
 *  folds. [] when already there, null when out of reach. */
export const solveFrom = (
  start: PaperState,
  front: number[],
  back: number,
  target: string,
  maxDepth: number
): Fold[] | null => {
  if (topView(start, front, back) === target) return [];
  type Node = { s: PaperState; path: Fold[] };
  let frontier: Node[] = [{ s: start, path: [] }];
  const seen = new Set([stateKey(start)]);
  const targetCells = target.split(':')[1]!.replace(/[/.]/g, '').length;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: Node[] = [];
    for (const { s, path } of frontier) {
      for (const f of legalFolds(s)) {
        const n = applyFold(s, f);
        if (n.size < targetCells) continue; // paper only shrinks: dead branch
        const k = stateKey(n);
        if (seen.has(k)) continue;
        seen.add(k);
        const p = [...path, f];
        if (topView(n, front, back) === target) return p;
        next.push({ s: n, path: p });
      }
    }
    frontier = next;
  }
  return null;
};

/** Number of tiles in a serialized view. */
export const viewCells = (view: string) => view.split(':')[1]!.replace(/[/.]/g, '').length;

/** Replays a fold list from the flat sheet; null if any fold is illegal. */
export const replay = (w: number, h: number, folds: Fold[]): PaperState | null => {
  let s = initialState(w, h);
  for (const f of folds) {
    if (!isFold(f) || !canFold(s, f)) return null;
    s = applyFold(s, f);
  }
  return s;
};

export const isFold = (f: unknown): f is Fold => {
  if (typeof f !== 'object' || f === null) return false;
  const o = f as Record<string, unknown>;
  return (
    (o.axis === 'x' || o.axis === 'y') &&
    typeof o.at === 'number' &&
    Number.isInteger(o.at) &&
    Math.abs(o.at) < 64 &&
    (o.from === 'low' || o.from === 'high')
  );
};

export const solves = (p: Puzzle, folds: Fold[]): boolean => {
  const s = replay(p.w, p.h, folds);
  return s !== null && topView(s, p.front, p.back) === p.target;
};
