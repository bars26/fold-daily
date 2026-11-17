// Devvit Journeys endpoints for Hono. The package ships an Express router;
// these mirror its paths (/api/telemetry/journey/*) so the stock client works.
import { Hono } from 'hono';
import { telemetry as journeys } from '@devvit/analytics/server/reddit';

export const telemetry = new Hono();

type Body = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);

const body = async (c: { req: { json: () => Promise<unknown> } }): Promise<Body> => {
  try {
    const b = await c.req.json();
    return typeof b === 'object' && b !== null ? (b as Body) : {};
  } catch {
    return {};
  }
};

// Analytics must never break the game: log and answer 200 with no receipt.
const safe = async <T,>(label: string, fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (e) {
    console.warn(`telemetry ${label} failed`, e);
    return { journeyId: '' };
  }
};

telemetry.post('/journey/start', async (c) => c.json(await safe('start', () => journeys.startJourney())));

telemetry.post('/journey/app-ready', async (c) => c.json(await safe('ready', () => journeys.appReady())));

telemetry.post('/journey/progress', async (c) => {
  const b = await body(c);
  const journeyId = str(b.journeyId);
  const progress = typeof b.progress === 'number' ? Math.min(1, Math.max(0, b.progress)) : null;
  if (!journeyId || progress === null) return c.json({ error: 'bad progress' }, 400);
  const action = str(b.action);
  const actionDetails = str(b.actionDetails);
  return c.json(
    await safe('progress', () =>
      journeys.journeyProgress({
        journeyId,
        progress,
        ...(action ? { action } : {}),
        ...(actionDetails ? { actionDetails } : {}),
      })
    )
  );
});

telemetry.post('/journey/interaction', async (c) => {
  const b = await body(c);
  const action = str(b.action);
  if (!action) return c.json({ error: 'action required' }, 400);
  return c.json(
    await safe('interaction', () =>
      journeys.journeyInteraction({
        journeyId: str(b.journeyId) ?? '',
        action,
        actionDetails: str(b.actionDetails) ?? '',
      })
    )
  );
});

telemetry.post('/journey/end', async (c) => {
  const b = await body(c);
  const journeyId = str(b.journeyId);
  if (!journeyId) return c.json({ error: 'journeyId required' }, 400);
  const game = typeof b.game === 'object' && b.game !== null ? (b.game as Body) : null;
  return c.json(
    await safe('end', () =>
      journeys.endJourney({
        journeyId,
        complete: b.complete === true,
        ...(game
          ? {
              game: {
                win: game.win === true,
                score: typeof game.score === 'number' ? game.score : 0,
              },
            }
          : {}),
      })
    )
  );
});
