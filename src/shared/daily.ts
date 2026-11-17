// Deterministic daily puzzles: the same number always yields the same puzzle,
// so the server can regenerate any day's puzzle without storing it.

import {
  applyFold,
  initialState,
  legalFolds,
  minFolds,
  topView,
  type Fold,
  type Puzzle,
} from './fold.ts';

/** Day 1 of Fold (UTC). */
export const EPOCH_MS = Date.UTC(2026, 10, 17);
const DAY_MS = 86_400_000;

export const puzzleNumberFor = (now: number): number =>
  Math.floor((now - EPOCH_MS) / DAY_MS) + 1;

export const dateForPuzzle = (n: number): string =>
  new Date(EPOCH_MS + (n - 1) * DAY_MS).toISOString().slice(0, 10);

/** Difficulty climbs across the week (Mon easiest, Sun hardest). */
export type Tier = { w: number; h: number; folds: number; colors: number; name: string };

export const tierFor = (n: number): Tier => {
  const dow = new Date(EPOCH_MS + (n - 1) * DAY_MS).getUTCDay(); // 0 = Sun
  switch (dow) {
    case 1:
      return { w: 4, h: 4, folds: 2, colors: 2, name: 'Gentle' };
    case 2:
      return { w: 4, h: 4, folds: 2, colors: 3, name: 'Easy' };
    case 3:
      return { w: 5, h: 4, folds: 3, colors: 3, name: 'Medium' };
    case 4:
      return { w: 5, h: 5, folds: 3, colors: 3, name: 'Medium' };
    case 5:
      return { w: 5, h: 5, folds: 3, colors: 4, name: 'Tricky' };
    case 6:
      return { w: 6, h: 5, folds: 4, colors: 3, name: 'Hard' };
    default:
      return { w: 6, h: 6, folds: 4, colors: 4, name: 'Fiendish' };
  }
};

/** mulberry32 */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Colour index 0 is always the back of the sheet; fronts use 1..colors. */
export const BACK = 0;

export const makeFront = (w: number, h: number, colors: number, r: () => number) => {
  // Blobby regions rather than noise: seed a few points and grow, so the
  // target reads as shapes a person can reason about.
  const front = new Array<number>(w * h).fill(0);
  const seeds = Math.max(colors + 1, Math.round((w * h) / 5));
  const queue: number[] = [];
  for (let i = 0; i < seeds; i++) {
    const c = Math.floor(r() * w * h);
    if (front[c] === 0) {
      front[c] = 1 + (i % colors);
      queue.push(c);
    }
  }
  while (queue.length) {
    const i = Math.floor(r() * queue.length);
    const c = queue.splice(i, 1)[0]!;
    const x = c % w;
    const y = Math.floor(c / w);
    const nbrs = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].filter(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < w && ny! < h);
    for (const [nx, ny] of nbrs) {
      const n = ny! * w + nx!;
      if (front[n] === 0) {
        front[n] = front[c]!;
        queue.push(n);
      }
    }
  }
  return front;
};

/** Builds puzzle `n`. Tries seeds until the scramble needs exactly the tier's
 *  fold count (no shortcut) and shows some of the back colour. */
export const generate = (n: number): Puzzle & { solution: Fold[]; tier: Tier } => {
  return generateWith(n, n, tierFor(n));
};

/** Practice levels: unranked, any number of them. */
export const PRACTICE_TIERS: Record<'easy' | 'medium' | 'hard', Tier> = {
  easy: { w: 4, h: 4, folds: 2, colors: 2, name: 'Easy' },
  medium: { w: 5, h: 4, folds: 3, colors: 3, name: 'Medium' },
  hard: { w: 5, h: 5, folds: 4, colors: 3, name: 'Hard' },
};

/** Builds a puzzle for any seed and tier (used by daily and practice). */
export const generateWith = (
  n: number,
  seed: number,
  tier: Tier
): Puzzle & { solution: Fold[]; tier: Tier } => {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rng(seed * 7919 + attempt * 104729 + 17);
    const front = makeFront(tier.w, tier.h, tier.colors, r);
    if (new Set(front).size < Math.min(tier.colors, 2)) continue;
    let s = initialState(tier.w, tier.h);
    const solution: Fold[] = [];
    for (let i = 0; i < tier.folds; i++) {
      const options = legalFolds(s);
      if (!options.length) break;
      const f = options[Math.floor(r() * options.length)]!;
      s = applyFold(s, f);
      solution.push(f);
    }
    if (solution.length !== tier.folds) continue;
    const target = topView(s, front, BACK);
    const cells = target.split(':')[1]!.replace(/[/.]/g, '');
    const [tw, th] = target.split(':')[0]!.split('x').map(Number);
    // Keep the target big enough to read as a picture, not a sliver.
    if (Math.min(tw!, th!) < 2) continue;
    if (cells.length < Math.max(4, Math.ceil((tier.w * tier.h) / 4))) continue;
    // Must show a flipped flap, but not be mostly bare kraft.
    const backShare = [...cells].filter((c) => c === String(BACK)).length / cells.length;
    if (backShare === 0 || backShare > 0.55) continue;
    const printed = new Set([...cells].filter((c) => c !== String(BACK))).size;
    if (printed < Math.min(2, tier.colors)) continue;
    const par = minFolds(tier.w, tier.h, front, BACK, target, tier.folds);
    if (par !== tier.folds) continue;
    return { number: n, w: tier.w, h: tier.h, front, back: BACK, target, par, solution, tier };
  }
  throw new Error(`could not generate puzzle ${n} (seed ${seed})`);
};

/** What the client receives: no solution. */
export const publicPuzzle = (p: Puzzle): Puzzle => ({
  number: p.number,
  w: p.w,
  h: p.h,
  front: p.front,
  back: p.back,
  target: p.target,
  par: p.par,
});
