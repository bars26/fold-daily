import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ErrorResponse,
  InitResponse,
  LeaderboardResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
} from '../../shared/api.ts';
import { dateForPuzzle, puzzleNumberFor } from '../../shared/daily.ts';
import { solves } from '../../shared/fold.ts';
import { shareText } from '../../shared/share.ts';
import {
  getBoard,
  getPuzzle,
  getResult,
  getStats,
  getStreak,
  puzzleForPost,
  recordSolve,
} from '../core/store.ts';

export const api = new Hono();

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

/** Puzzle number for the current post: linked at creation, or today's as a
 *  fallback for posts made without a link. */
const currentNumber = async (): Promise<number> => {
  const { postId } = context;
  const linked = postId ? await puzzleForPost(postId) : null;
  return linked ?? puzzleNumberFor(Date.now());
};

api.get('/init', async (c) => {
  try {
    const n = await currentNumber();
    const { userId, username } = context;
    const [p, stats, mine, streak] = await Promise.all([
      getPuzzle(n),
      getStats(n),
      userId ? getResult(n, userId) : null,
      userId ? getStreak(userId) : null,
    ]);
    const { tier, ...puzzle } = p;
    return c.json<InitResponse>({
      type: 'init',
      puzzle,
      tier,
      date: dateForPuzzle(n),
      today: puzzleNumberFor(Date.now()),
      username: username ?? null,
      mine,
      streak,
      stats,
    });
  } catch (e) {
    console.error('init failed', e);
    return c.json(fail('Could not load the puzzle'), 500);
  }
});

api.post('/solve', async (c) => {
  const { userId, username } = context;
  if (!userId || !username) return c.json(fail('Log in to save your result'), 401);
  let body: SolveRequest;
  try {
    body = await c.req.json<SolveRequest>();
  } catch {
    return c.json(fail('Bad request'), 400);
  }
  if (!Array.isArray(body.folds) || body.folds.length > 40) return c.json(fail('Bad folds'), 400);
  const ms = Number(body.ms);
  if (!Number.isFinite(ms) || ms < 0) return c.json(fail('Bad time'), 400);
  const hints = Math.min(99, Math.max(0, Math.floor(Number(body.hints) || 0)));

  const n = await currentNumber();
  const p = await getPuzzle(n);
  // Never trust the client: replay the folds and compare against the target.
  if (!solves(p, body.folds)) return c.json(fail('That does not match the target'), 400);

  const { mine, improved } = await recordSolve(n, userId, username, body.folds.length, ms, hints);
  const [streak, stats, board] = await Promise.all([
    getStreak(userId),
    getStats(n),
    getBoard(n, username),
  ]);
  return c.json<SolveResponse>({
    type: 'solve',
    mine,
    improved,
    streak,
    stats,
    rank: board.me?.rank ?? null,
  });
});

api.get('/leaderboard', async (c) => {
  const n = await currentNumber();
  const board = await getBoard(n, context.username ?? null);
  return c.json<LeaderboardResponse>({ type: 'leaderboard', ...board });
});

/** Posts the player's spoiler-free result as a comment, only when they press
 *  the share button. */
api.post('/share', async (c) => {
  const { userId, postId } = context;
  if (!userId || !postId) return c.json(fail('Log in to share'), 401);
  const n = await currentNumber();
  const [mine, streak, p] = await Promise.all([
    getResult(n, userId),
    getStreak(userId),
    getPuzzle(n),
  ]);
  if (!mine) return c.json(fail('Solve the puzzle first'), 400);
  try {
    await reddit.submitComment({
      id: postId,
      text: shareText(n, p.tier, p.par, mine, streak),
      runAs: 'USER',
    });
    return c.json<ShareResponse>({ type: 'share', ok: true });
  } catch (e) {
    console.error('share failed', e);
    return c.json(fail('Could not post the comment'), 500);
  }
});
