// Validation for community-made puzzles: the server replays the creator's
// folds, so a posted puzzle is always solvable, and computes its true par.
import { minFolds, replay, topView, viewCells, type Fold } from './fold.ts';
import { BACK } from './daily.ts';

export const CUSTOM_SIZES = [
  { w: 4, h: 4 },
  { w: 5, h: 4 },
  { w: 5, h: 5 },
] as const;
export const MAX_CUSTOM_FOLDS = 4;
export const CUSTOM_COLORS = 4;

export type CustomCheck =
  | { ok: true; target: string; par: number }
  | { ok: false; reason: string };

export const checkCustom = (w: number, h: number, front: unknown, folds: unknown): CustomCheck => {
  if (!CUSTOM_SIZES.some((s) => s.w === w && s.h === h)) return { ok: false, reason: 'Unsupported size' };
  if (
    !Array.isArray(front) ||
    front.length !== w * h ||
    !front.every((c) => Number.isInteger(c) && c >= 1 && c <= CUSTOM_COLORS)
  ) {
    return { ok: false, reason: 'Bad colours' };
  }
  if (!Array.isArray(folds) || folds.length < 1 || folds.length > MAX_CUSTOM_FOLDS) {
    return { ok: false, reason: `Use 1–${MAX_CUSTOM_FOLDS} folds` };
  }
  const s = replay(w, h, folds as Fold[]);
  if (!s) return { ok: false, reason: 'Illegal fold' };
  const target = topView(s, front as number[], BACK);
  if (viewCells(target) < 2) return { ok: false, reason: 'Leave at least two tiles showing' };
  const shown = target.split(':')[1]!.replace(/[/.]/g, '');
  if (![...shown].some((c) => c !== String(BACK))) {
    return { ok: false, reason: 'Make some colour show — all kraft is too easy' };
  }
  const par = minFolds(w, h, front as number[], BACK, target, folds.length);
  if (par === null || par < 1) return { ok: false, reason: 'That pattern is too easy' };
  return { ok: true, target, par };
};
