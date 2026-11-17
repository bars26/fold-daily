import type { MyResult, Streak } from './api.ts';

export const formatMs = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

/** Spoiler-free result: one square per fold, orange up to par, grey beyond. */
export const shareText = (
  label: string,
  tier: string,
  par: number,
  r: MyResult,
  streak: Streak | null
): string => {
  const squares = Array.from({ length: r.folds }, (_, i) => (i < par ? '🟧' : '⬜')).join('');
  const verdict = r.folds <= par ? '⭐ par' : `+${r.folds - par} over par`;
  const hinted = r.hints ? `, 💡${r.hints}` : '';
  const lines = [
    `Fold ${label} (${tier}) — ${r.folds} folds, ${verdict}, ${formatMs(r.ms)}${hinted}`,
    squares,
  ];
  if (streak && streak.current > 1) lines.push(`🔥 ${streak.current}-day streak`);
  return lines.join('\n\n');
};
