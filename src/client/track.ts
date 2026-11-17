// Thin, fail-safe wrapper over Devvit Journeys. Events fire only on committed
// player actions (never on page views), per the Journeys guidelines.
import { telemetry } from '@devvit/analytics/client/reddit';

const quiet = (p: Promise<unknown>) => {
  p.catch(() => {
    /* analytics must never affect play */
  });
};

let started = false;

export const track = {
  ready: () => quiet(telemetry.appReady()),
  /** First fold of a puzzle = the player explicitly began. */
  start: (mode: 'daily' | 'practice') => {
    started = true;
    quiet(
      telemetry
        .startJourney()
        .then(() => telemetry.interaction({ action: 'puzzle_start', actionDetails: mode }))
    );
  },
  fold: (count: number, par: number) =>
    quiet(
      telemetry.progress({
        progress: Math.min(0.95, count / Math.max(1, par)),
        action: 'fold',
        actionDetails: String(count),
      })
    ),
  action: (action: 'hint' | 'undo' | 'unfold_all' | 'share' | 'practice' | 'leaderboard' | 'how_to') =>
    quiet(telemetry.interaction({ action })),
  /** Score = folds used (lower is better); win when at or under par. */
  end: (folds: number, par: number) => {
    if (!started) return;
    started = false;
    quiet(telemetry.endJourney({ complete: true, game: { win: folds <= par, score: folds } }));
  },
  abandon: () => {
    if (!started) return;
    started = false;
    quiet(telemetry.endJourney({ complete: false }));
  },
};
