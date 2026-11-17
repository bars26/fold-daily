import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import type { TaskResponse } from '@devvit/web/server';
import { createPuzzlePost } from '../core/post.ts';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    const post = await createPuzzlePost();
    return c.json<TriggerResponse>(
      { status: 'success', message: `Puzzle post ${post.id} (trigger: ${input.type})` },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to create post' }, 400);
  }
});

export const scheduler = new Hono();

/** Runs just after 00:00 UTC: posts the new day's puzzle. */
scheduler.post('/daily-post', async (c) => {
  try {
    const post = await createPuzzlePost();
    console.log(`daily post ${post.id} created=${post.created}`);
  } catch (error) {
    console.error(`daily post failed: ${error}`);
  }
  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
