import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  CreateRequest,
  CreateResponse,
  ErrorResponse,
  InitResponse,
  LeaderboardResponse,
  ShareResponse,
  SolveRequest,
  SolveResponse,
} from '../../shared/api.ts';
import { checkCustom } from '../../shared/custom.ts';
import { BACK, dateForPuzzle, puzzleNumberFor } from '../../shared/daily.ts';
import { solves } from '../../shared/fold.ts';
import { shareText } from '../../shared/share.ts';
import { createCustomPost } from '../core/post.ts';
import {
  countMade,
  customScope,
  dailyScope,
  getBoard,
  getCustom,
  getPuzzle,
  getResult,
  getStats,
  getStreak,
  madeToday,
  MAX_MADE_PER_DAY,
  puzzleForPost,
  recordSolve,
  type FullPuzzle,
  type Scope,
} from '../core/store.ts';

export const api = new Hono();

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

type Current = { scope: Scope; puzzle: FullPuzzle; author: string | null; date: string };

/** The puzzle behind the current post: a community puzzle, a linked daily,
 *  or today's daily as a fallback for posts made without a link. */
const current = async (): Promise<Current> => {
  const { postId } = context;
  if (postId) {
    const custom = await getCustom(postId);
    if (custom) {
      const { author, ...puzzle } = custom;
      return { scope: customScope(postId), puzzle, author, date: '' };
    }
  }
  const n = (postId ? await puzzleForPost(postId) : null) ?? puzzleNumberFor(Date.now());
  return { scope: dailyScope(n), puzzle: await getPuzzle(n), author: null, date: dateForPuzzle(n) };
};

api.get('/init', async (c) => {
  try {
    const cur = await current();
    const { userId, username } = context;
    const [stats, mine, streak] = await Promise.all([
      getStats(cur.scope),
      userId ? getResult(cur.scope, userId) : null,
      userId ? getStreak(userId) : null,
    ]);
    const { tier, ...puzzle } = cur.puzzle;
    return c.json<InitResponse>({
      type: 'init',
      kind: cur.scope.daily === null ? 'custom' : 'daily',
      author: cur.author,
      puzzle,
      tier,
      date: cur.date,
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

  const cur = await current();
  // Never trust the client: replay the folds and compare against the target.
  if (!solves(cur.puzzle, body.folds)) return c.json(fail('That does not match the target'), 400);

  const { mine, improved } = await recordSolve(
    cur.scope,
    userId,
    username,
    body.folds.length,
    ms,
    hints
  );
  const [streak, stats, board] = await Promise.all([
    getStreak(userId),
    getStats(cur.scope),
    getBoard(cur.scope, username),
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
  const cur = await current();
  const board = await getBoard(cur.scope, context.username ?? null);
  return c.json<LeaderboardResponse>({ type: 'leaderboard', ...board });
});

/** Posts the player's spoiler-free result as a comment, only when they press
 *  the share button. */
api.post('/share', async (c) => {
  const { userId, postId } = context;
  if (!userId || !postId) return c.json(fail('Log in to share'), 401);
  const cur = await current();
  const [mine, streak] = await Promise.all([getResult(cur.scope, userId), getStreak(userId)]);
  if (!mine) return c.json(fail('Solve the puzzle first'), 400);
  const label = cur.author ? `by u/${cur.author}` : `#${cur.puzzle.number}`;
  try {
    await reddit.submitComment({
      id: postId,
      text: shareText(label, cur.puzzle.tier, cur.puzzle.par, mine, cur.author ? null : streak),
      runAs: 'USER',
    });
    return c.json<ShareResponse>({ type: 'share', ok: true });
  } catch (e) {
    console.error('share failed', e);
    return c.json(fail('Could not post the comment'), 500);
  }
});

/** Publishes a community puzzle made in the in-game editor. */
api.post('/create', async (c) => {
  const { userId, username } = context;
  if (!userId || !username) return c.json(fail('Log in to post a puzzle'), 401);
  let body: CreateRequest;
  try {
    body = await c.req.json<CreateRequest>();
  } catch {
    return c.json(fail('Bad request'), 400);
  }
  if ((await madeToday(userId)) >= MAX_MADE_PER_DAY) {
    return c.json(fail(`You can post ${MAX_MADE_PER_DAY} puzzles a day. Come back tomorrow!`), 429);
  }
  const check = checkCustom(Number(body.w), Number(body.h), body.front, body.folds);
  if (!check.ok) return c.json(fail(check.reason), 400);
  try {
    const post = await createCustomPost(username, {
      number: 0,
      w: body.w,
      h: body.h,
      front: body.front,
      back: BACK,
      target: check.target,
      par: check.par,
    });
    await countMade(userId);
    return c.json<CreateResponse>({
      type: 'create',
      url: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      par: check.par,
    });
  } catch (e) {
    console.error('create failed', e);
    return c.json(fail('Could not post your puzzle'), 500);
  }
});
