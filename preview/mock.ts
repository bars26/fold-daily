// Local preview only: fakes the Devvit server API in the browser.
import { generate, publicPuzzle, dateForPuzzle } from '../src/shared/daily.ts';
import { solves, type Fold } from '../src/shared/fold.ts';

const n = Number(new URLSearchParams(location.search).get('n') ?? '1');
const g = generate(n);
const hist: Record<string, number> = { [String(g.par)]: 12, [String(g.par + 1)]: 7, [String(g.par + 2)]: 3 };
(window as unknown as { __postData: unknown }).__postData = {
  n,
  date: dateForPuzzle(n),
  tier: g.tier.name,
  target: g.target,
  par: g.par,
};
(window as unknown as { __solution: unknown }).__solution = g.solution;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.startsWith('/api/init'))
    return reply({
      type: 'init',
      puzzle: publicPuzzle(g),
      tier: g.tier.name,
      date: dateForPuzzle(n),
      today: n,
      username: 'preview',
      mine: null,
      streak: { current: 3, best: 5 },
      stats: { players: 22, histogram: hist },
    });
  if (url.startsWith('/api/solve')) {
    const body = JSON.parse(String(init?.body)) as { folds: Fold[]; ms: number; hints: number };
    if (!solves(g, body.folds)) return reply({ status: 'error', message: 'mismatch' }, 400);
    const k = String(body.folds.length);
    hist[k] = (hist[k] ?? 0) + 1;
    return reply({
      type: 'solve',
      mine: { folds: body.folds.length, ms: body.ms, hints: body.hints, onTime: true },
      improved: true,
      streak: { current: 4, best: 5 },
      stats: { players: 23, histogram: hist },
      rank: 9,
    });
  }
  if (url.startsWith('/api/leaderboard'))
    return reply({
      type: 'leaderboard',
      top: [
        { username: 'origami_otter', folds: g.par, ms: 21000 },
        { username: 'preview', folds: g.par, ms: 34000 },
      ],
      me: null,
    });
  if (url.startsWith('/api/share')) return reply({ type: 'share', ok: true });
  return realFetch(input, init);
};
