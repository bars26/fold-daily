import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ArchiveEntry,
  ArchiveResponse,
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
  postForPuzzle,
  recentCustoms,
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
  // Daily solvers wear their streak as user flair in the community.
  if (improved && cur.scope.daily !== null && streak && streak.current > 0) {
    reddit
      .setUserFlair({
        subredditName: context.subredditName,
        username,
        text: `🔥 ${streak.current}-day Fold streak`,
        backgroundColor: '#e4572e',
        textColor: 'light',
      })
      .catch((e: unknown) => console.warn('flair failed', e));
  }
  return c.json<SolveResponse>({
    type: 'solve',
    mine,
    improved,
    streak,
    stats,
    rank: board.me?.rank ?? null,
  });
});

/** Past dailies (up to 30 days) and the newest community puzzles, with the
 *  viewer's result on each. Missing days (no post) are skipped. */
api.get('/archive', async (c) => {
  const { userId } = context;
  const today = puzzleNumberFor(Date.now());
  const days = Array.from({ length: Math.min(30, today) }, (_, i) => today - i);
  const daily = (
    await Promise.all(
      days.map(async (n): Promise<ArchiveEntry | null> => {
        const postId = await postForPuzzle(n);
        if (!postId) return null;
        const scope = dailyScope(n);
        const [p, stats, mine] = await Promise.all([
          getPuzzle(n),
          getStats(scope),
          userId ? getResult(scope, userId) : null,
        ]);
        return {
          postId,
          title: `Fold #${n}`,
          detail: `${dateForPuzzle(n)} · ${p.tier}`,
          target: p.target,
          par: p.par,
          players: stats.players,
          mine,
          today: n === today,
        };
      })
    )
  ).filter((e): e is ArchiveEntry => e !== null);

  const community = (
    await Promise.all(
      (await recentCustoms(20)).map(async (postId): Promise<ArchiveEntry | null> => {
        const p = await getCustom(postId);
        if (!p) return null;
        const scope = customScope(postId);
        const [stats, mine] = await Promise.all([
          getStats(scope),
          userId ? getResult(scope, userId) : null,
        ]);
        return {
          postId,
          title: `by u/${p.author}`,
          detail: 'Community puzzle',
          target: p.target,
          par: p.par,
          players: stats.players,
          mine,
          today: false,
        };
      })
    )
  ).filter((e): e is ArchiveEntry => e !== null);

  return c.json<ArchiveResponse>({ type: 'archive', daily, community });
});

/** Tiny endpoint for the feed card: how many people solved this post. */
api.get('/stats', async (c) => {
  try {
    const cur = await current();
    const stats = await getStats(cur.scope);
    return c.json({ type: 'stats', players: stats.players });
  } catch {
    return c.json({ type: 'stats', players: 0 });
  }
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
