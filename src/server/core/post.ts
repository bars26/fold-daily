import { context, reddit } from '@devvit/web/server';
import { dateForPuzzle, puzzleNumberFor } from '../../shared/daily.ts';
import type { FoldPostData } from '../../shared/api.ts';
import { getPuzzle, linkPost, postForPuzzle } from './store.ts';

const prettyDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** Creates the post for puzzle `n` unless one already exists. */
export const createPuzzlePost = async (n: number = puzzleNumberFor(Date.now())) => {
  const existing = await postForPuzzle(n);
  if (existing) return { id: existing, created: false };

  const p = await getPuzzle(n);
  const date = dateForPuzzle(n);
  const postData: FoldPostData = { n, date, tier: p.tier, target: p.target, par: p.par };
  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Fold #${n} · ${prettyDate(date)} · ${p.tier} (par ${p.par})`,
    entry: 'default',
    postData,
    textFallback: {
      text: `Fold #${n}: fold the sheet to match today's pattern in ${p.par} folds. Open this post on Reddit to play.`,
    },
  });
  await linkPost(n, post.id);
  return { id: post.id, created: true };
};
