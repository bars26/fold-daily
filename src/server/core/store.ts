import { redis } from '@devvit/web/server';
import { generate, publicPuzzle, puzzleNumberFor } from '../../shared/daily.ts';
import type { Puzzle } from '../../shared/fold.ts';
import type { LeaderEntry, MyResult, Stats, Streak } from '../../shared/api.ts';

const k = {
  // Bump the version whenever generation rules change, so cached puzzles regenerate.
  puzzle: (n: number) => `puzzle:v2:${n}`,
  postOf: (n: number) => `puzzle:${n}:post`,
  numberOf: (postId: string) => `post:${postId}`,
  result: (n: number, user: string) => `result:${n}:${user}`,
  hist: (n: number) => `hist:${n}`,
  board: (n: number) => `board:${n}`,
  streak: (user: string) => `streak:${user}`,
};

export type FullPuzzle = Puzzle & { tier: string };

/** Generation is deterministic but can take ~0.5 s on hard days, so cache it. */
export const getPuzzle = async (n: number): Promise<FullPuzzle> => {
  const cached = await redis.get(k.puzzle(n));
  if (cached) return JSON.parse(cached) as FullPuzzle;
  const g = generate(n);
  const p: FullPuzzle = { ...publicPuzzle(g), tier: g.tier.name };
  await redis.set(k.puzzle(n), JSON.stringify(p));
  return p;
};

export const linkPost = async (n: number, postId: string) => {
  await redis.set(k.postOf(n), postId);
  await redis.set(k.numberOf(postId), String(n));
};

export const postForPuzzle = (n: number) => redis.get(k.postOf(n));

export const puzzleForPost = async (postId: string): Promise<number | null> => {
  const v = await redis.get(k.numberOf(postId));
  return v ? Number(v) : null;
};

export const getStats = async (n: number): Promise<Stats> => {
  const hist = (await redis.hGetAll(k.hist(n))) ?? {};
  const histogram: Record<string, number> = {};
  let players = 0;
  for (const [folds, count] of Object.entries(hist)) {
    histogram[folds] = Number(count);
    players += Number(count);
  }
  return { players, histogram };
};

export const getResult = async (n: number, user: string): Promise<MyResult | null> => {
  const v = await redis.get(k.result(n, user));
  return v ? (JSON.parse(v) as MyResult) : null;
};

export const getStreak = async (user: string): Promise<Streak | null> => {
  const h = await redis.hGetAll(k.streak(user));
  if (!h || !h.last) return null;
  const last = Number(h.last);
  const today = puzzleNumberFor(Date.now());
  // A streak survives until the day after the last solved puzzle ends.
  const current = last >= today - 1 ? Number(h.current ?? 0) : 0;
  return { current, best: Number(h.best ?? 0) };
};

const boardScore = (folds: number, ms: number) => folds * 1e7 + Math.min(Math.round(ms / 100), 9_999_999);

/** Records a verified solve. Keeps the player's best (fewest folds, then
 *  fastest) and updates histogram, leaderboard and streak. */
export const recordSolve = async (
  n: number,
  user: string,
  username: string,
  folds: number,
  ms: number,
  hints: number
): Promise<{ mine: MyResult; improved: boolean }> => {
  const today = puzzleNumberFor(Date.now());
  const prev = await getResult(n, user);
  const onTime = n === today;
  const better = !prev || folds < prev.folds || (folds === prev.folds && ms < prev.ms);
  if (!better) return { mine: prev, improved: false };

  const mine: MyResult = { folds, ms, hints, onTime: prev?.onTime ?? onTime };
  await redis.set(k.result(n, user), JSON.stringify(mine));
  if (prev) await redis.hIncrBy(k.hist(n), String(prev.folds), -1);
  await redis.hIncrBy(k.hist(n), String(folds), 1);
  await redis.zAdd(k.board(n), { member: username, score: boardScore(folds, ms) });

  if (!prev && onTime) {
    const h = await redis.hGetAll(k.streak(user));
    const last = Number(h?.last ?? 0);
    const current = last === n - 1 ? Number(h?.current ?? 0) + 1 : 1;
    const best = Math.max(current, Number(h?.best ?? 0));
    await redis.hSet(k.streak(user), {
      last: String(n),
      current: String(current),
      best: String(best),
    });
  }
  return { mine, improved: true };
};

const fromScore = (username: string, score: number): LeaderEntry => ({
  username,
  folds: Math.floor(score / 1e7),
  ms: (score % 1e7) * 100,
});

export const getBoard = async (n: number, username: string | null) => {
  const top = (await redis.zRange(k.board(n), 0, 9, { by: 'rank' })).map((e) =>
    fromScore(e.member, e.score)
  );
  let me: (LeaderEntry & { rank: number }) | null = null;
  if (username) {
    const [rank, score] = await Promise.all([
      redis.zRank(k.board(n), username),
      redis.zScore(k.board(n), username),
    ]);
    if (rank !== undefined && rank !== null && score !== undefined && score !== null) {
      me = { ...fromScore(username, score), rank: rank + 1 };
    }
  }
  return { top, me };
};
