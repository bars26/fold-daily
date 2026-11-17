import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPuzzlePost } from '../core/post.ts';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPuzzlePost();
    return c.json<UiResponse>(
      {
        showToast: post.created ? "Posted today's Fold" : "Today's Fold is already posted",
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});
