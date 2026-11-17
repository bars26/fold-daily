import './index.css';

import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { showToast } from '@devvit/web/client';
import type {
  ErrorResponse,
  InitResponse,
  LeaderboardResponse,
  MyResult,
  SolveResponse,
  Stats,
  Streak,
} from '../shared/api.ts';
import {
  replay,
  solveFrom,
  topView,
  viewCells,
  type Fold,
  type PaperState,
  type Puzzle,
} from '../shared/fold.ts';
import { generateWith, PRACTICE_TIERS } from '../shared/daily.ts';
import { formatMs } from '../shared/share.ts';
import { Board } from './Board.tsx';
import { Pattern } from './Pattern.tsx';
import { HowTo } from './HowTo.tsx';
import { track } from './track.ts';
import { Creator } from './Creator.tsx';
import { isMuted, playFold, playWin, setMuted } from './sound.ts';

const TUTORIAL_KEY = 'fold.tutorial.done';

const readFlag = (k: string) => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (k: string) => {
  try {
    localStorage.setItem(k, '1');
  } catch {
    /* storage unavailable: the hint just shows again */
  }
};

const json = async <T,>(res: Response): Promise<T> => {
  const body = (await res.json()) as T | ErrorResponse;
  if (!res.ok) throw new Error((body as ErrorResponse).message ?? `HTTP ${res.status}`);
  return body as T;
};

const useBoxSize = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 320, h: 320 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
};

const Histogram = ({ stats, mine, par }: { stats: Stats; mine: number | null; par: number }) => {
  const entries = Object.entries(stats.histogram)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([, v]) => v > 0)
    .sort((a, b) => a[0] - b[0]);
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div className="w-full">
      <p className="mb-2 text-xs uppercase tracking-widest text-paper/50">
        {stats.players} {stats.players === 1 ? 'folder' : 'folders'} today
      </p>
      <div className="flex flex-col gap-1">
        {entries.map(([folds, count]) => (
          <div key={folds} className="flex items-center gap-2 text-xs">
            <span className="w-14 text-right text-paper/70">
              {folds} {folds <= par ? '⭐' : ''}
            </span>
            <div className="h-4 flex-1 rounded bg-ink-3">
              <div
                className={`h-4 rounded ${folds === mine ? 'bg-ember' : 'bg-kraft/60'}`}
                style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-paper/60">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

type ResultProps = {
  data: InitResponse;
  mine: MyResult;
  streak: Streak | null;
  stats: Stats;
  rank: number | null;
  loggedIn: boolean;
  onAgain: () => void;
  onPractice: () => void;
  onCreate: () => void;
  onClose: () => void;
};

const ResultSheet = ({
  data,
  mine,
  streak,
  stats,
  rank,
  loggedIn,
  onAgain,
  onPractice,
  onCreate,
  onClose,
}: ResultProps) => {
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [sharing, setSharing] = useState<'idle' | 'busy' | 'done'>('idle');
  const atPar = mine.folds <= data.puzzle.par;

  const share = async () => {
    setSharing('busy');
    try {
      await json(await fetch('/api/share', { method: 'POST' }));
      setSharing('done');
      track.action('share');
      showToast('Result posted as a comment');
    } catch (e) {
      setSharing('idle');
      showToast(e instanceof Error ? e.message : 'Could not post');
    }
  };

  const loadBoard = async () => {
    try {
      setBoard(await json<LeaderboardResponse>(await fetch('/api/leaderboard')));
      track.action('leaderboard');
    } catch {
      showToast('Could not load the leaderboard');
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center">
      <div className="pop m-3 flex max-h-[92vh] w-full max-w-sm flex-col items-center gap-4 overflow-y-auto rounded-3xl bg-ink-2 p-5 shadow-2xl ring-1 ring-white/10">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-kraft/70">
            {data.kind === 'custom' ? `Fold by u/${data.author}` : `Fold #${data.puzzle.number}`}
          </p>
          <h2 className="font-display mt-1 text-3xl">{atPar ? 'Perfect fold' : 'Folded!'}</h2>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-ink-3 p-2">
            <p className="text-2xl font-semibold">{mine.folds}</p>
            <p className="text-[11px] text-paper/60">folds · par {data.puzzle.par}</p>
          </div>
          <div className="rounded-xl bg-ink-3 p-2">
            <p className="text-2xl font-semibold">{formatMs(mine.ms)}</p>
            <p className="text-[11px] text-paper/60">time</p>
          </div>
          <div className="rounded-xl bg-ink-3 p-2">
            <p className="text-2xl font-semibold">{streak ? `🔥${streak.current}` : '—'}</p>
            <p className="text-[11px] text-paper/60">
              {streak ? `streak · best ${streak.best}` : 'streak'}
            </p>
          </div>
        </div>
        {rank !== null && <p className="text-sm text-paper/70">You are #{rank} on today's board.</p>}
        {!mine.onTime && loggedIn && data.kind === 'daily' && (
          <p className="text-xs text-paper/50">Solved after its day, so it does not count toward your streak.</p>
        )}
        {!loggedIn && <p className="text-xs text-paper/60">Log in to Reddit to keep streaks and join the board.</p>}

        <Histogram stats={stats} mine={mine.folds} par={data.puzzle.par} />

        {board && (
          <ol className="w-full space-y-1 text-sm">
            {board.top.map((e, i) => (
              <li
                key={e.username}
                className={`flex justify-between rounded-lg px-3 py-1.5 ${e.username === data.username ? 'bg-ember/25' : 'bg-ink-3'}`}
              >
                <span>
                  {i + 1}. u/{e.username}
                </span>
                <span className="text-paper/70">
                  {e.folds} · {formatMs(e.ms)}
                </span>
              </li>
            ))}
            {board.me && board.me.rank > board.top.length && (
              <li className="flex justify-between rounded-lg bg-ember/25 px-3 py-1.5">
                <span>
                  {board.me.rank}. u/{board.me.username}
                </span>
                <span className="text-paper/70">
                  {board.me.folds} · {formatMs(board.me.ms)}
                </span>
              </li>
            )}
          </ol>
        )}

        <div className="flex w-full flex-col gap-2">
          {loggedIn && (
            <button
              disabled={sharing !== 'idle'}
              onClick={share}
              className="rounded-full bg-ember py-2.5 font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
            >
              {sharing === 'done' ? 'Shared ✓' : sharing === 'busy' ? 'Posting…' : 'Comment my result (no spoilers)'}
            </button>
          )}
          <button
            onClick={onPractice}
            className="rounded-full bg-paper py-2.5 font-semibold text-ink active:scale-[0.98]"
          >
            Keep folding: practice puzzles →
          </button>
          <button
            onClick={onCreate}
            className="rounded-full bg-ink-3 py-2.5 text-sm font-semibold ring-1 ring-kraft/40 active:scale-[0.98]"
          >
            🎨 Make your own Fold for others
          </button>
          <p className="-mt-1 text-center text-[11px] text-paper/50">
            A new daily Fold drops every day at 00:00 UTC.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {!board && (
              <button onClick={loadBoard} className="rounded-full bg-ink-3 py-2 text-sm">
                Leaderboard
              </button>
            )}
            {!atPar && (
              <button onClick={onAgain} className="rounded-full bg-ink-3 py-2 text-sm">
                Chase par
              </button>
            )}
            <button onClick={onClose} className="rounded-full bg-ink-3 py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

type Level = keyof typeof PRACTICE_TIERS;

const PracticeSheet = ({
  done,
  par,
  level,
  onNext,
  onBack,
  onCreate,
}: {
  done: MyResult;
  par: number;
  level: Level;
  onNext: (l: Level) => void;
  onBack: () => void;
  onCreate: () => void;
}) => (
  <div className="absolute inset-0 z-40 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center">
    <div className="pop m-3 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-ink-2 p-5 shadow-2xl ring-1 ring-white/10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-kraft/70">Practice · {PRACTICE_TIERS[level].name}</p>
        <h2 className="font-display mt-1 text-3xl">{done.folds <= par ? 'Perfect fold' : 'Folded!'}</h2>
        <p className="mt-1 text-sm text-paper/70">
          {done.folds} folds (par {par}) · {formatMs(done.ms)}
          {done.hints ? ` · 💡${done.hints}` : ''}
        </p>
      </div>
      <button
        onClick={() => onNext(level)}
        className="w-full rounded-full bg-ember py-2.5 font-semibold text-white active:scale-[0.98]"
      >
        Next puzzle →
      </button>
      <div className="grid w-full grid-cols-3 gap-2">
        {(Object.keys(PRACTICE_TIERS) as Level[]).map((l) => (
          <button
            key={l}
            onClick={() => onNext(l)}
            className={`rounded-full py-2 text-sm ${l === level ? 'bg-paper text-ink' : 'bg-ink-3'}`}
          >
            {PRACTICE_TIERS[l].name}
          </button>
        ))}
      </div>
      <button
        onClick={onCreate}
        className="w-full rounded-full bg-ink-3 py-2 text-sm font-semibold ring-1 ring-kraft/40"
      >
        🎨 Make your own Fold
      </button>
      <button onClick={onBack} className="text-sm text-paper/60 underline underline-offset-2">
        Back to today's Fold
      </button>
    </div>
  </div>
);

export const App = () => {
  const [data, setData] = useState<InitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folds, setFolds] = useState<Fold[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{
    mine: MyResult;
    streak: Streak | null;
    stats: Stats;
    rank: number | null;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [solved, setSolved] = useState(false);
  const [tutorial, setTutorial] = useState(!readFlag(TUTORIAL_KEY));
  const [howTo, setHowTo] = useState(!readFlag(TUTORIAL_KEY));
  const [hint, setHint] = useState<{ fold: Fold; paper: PaperState } | null>(null);
  const [hints, setHints] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [practice, setPractice] = useState<{ level: Level; puzzle: Puzzle; done: MyResult | null } | null>(
    null
  );
  const [creating, setCreating] = useState(false);
  const [mute, setMute] = useState(isMuted());
  const [boxRef, box] = useBoxSize();

  useEffect(() => {
    fetch('/api/init')
      .then((r) => json<InitResponse>(r))
      .then((d) => {
        setData(d);
        track.ready();
        if (d.mine) {
          setResult({ mine: d.mine, streak: d.streak, stats: d.stats, rank: null });
          setShowResult(true);
          setSolved(true);
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, []);

  const active: Puzzle | null = practice?.puzzle ?? data?.puzzle ?? null;
  const paper = useMemo(
    () => (active ? replay(active.w, active.h, folds) : null),
    [active, folds]
  );

  const clearBoard = () => {
    setHints(0);
    setHint(null);
    setFolds([]);
    setStartedAt(null);
  };

  const startPractice = (level: Level) => {
    // Practice puzzles are unranked; the seed only needs to differ each time.
    const seed = 1_000_000 + Math.floor(Math.random() * 1_000_000_000);
    const g = generateWith(seed, seed, PRACTICE_TIERS[level]);
    track.abandon();
    track.action('practice');
    clearBoard();
    setSolved(false);
    setShowResult(false);
    setPractice({ level, puzzle: g, done: null });
  };

  const backToDaily = () => {
    clearBoard();
    setPractice(null);
    setSolved(!!result);
    setShowResult(!!result);
  };

  const onFold = useCallback(
    (f: Fold) => {
      if (!data || !active) return;
      if (tutorial) {
        setTutorial(false);
        writeFlag(TUTORIAL_KEY);
      }
      const start = startedAt ?? Date.now();
      if (startedAt === null) {
        setStartedAt(start);
        track.start(practice ? 'practice' : 'daily');
      }
      const next = [...folds, f];
      setFolds(next);
      playFold();
      track.fold(next.length, active.par);
      const s = replay(active.w, active.h, next);
      if (!s || topView(s, active.front, active.back) !== active.target) return;

      const ms = Date.now() - start;
      setSolved(true);
      setTimeout(playWin, 250);
      track.end(next.length, active.par);
      if (practice) {
        const done: MyResult = { folds: next.length, ms, hints, onTime: false };
        setTimeout(() => setPractice((p) => (p ? { ...p, done } : p)), 500);
        return;
      }
      const local: MyResult = {
        folds: next.length,
        ms,
        hints,
        onTime: data.puzzle.number === data.today,
      };
      if (!data.username) {
        setResult({ mine: local, streak: null, stats: data.stats, rank: null });
        setTimeout(() => setShowResult(true), 500);
        return;
      }
      fetch('/api/solve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ folds: next, ms, hints }),
      })
        .then((r) => json<SolveResponse>(r))
        .then((r) => setResult({ mine: r.mine, streak: r.streak, stats: r.stats, rank: r.rank }))
        .catch((e: unknown) => {
          showToast(e instanceof Error ? e.message : 'Could not save your result');
          setResult({ mine: local, streak: data.streak, stats: data.stats, rank: null });
        })
        .finally(() => setTimeout(() => setShowResult(true), 500));
    },
    [data, active, practice, folds, startedAt, tutorial, hints]
  );

  const askHint = () => {
    if (!active || !paper || thinking) return;
    setThinking(true);
    // Let the button repaint before the (sub-second) search runs.
    setTimeout(() => {
      const path = solveFrom(paper, active.front, active.back, active.target, active.par + 1);
      setThinking(false);
      if (!path || !path.length) {
        showToast(folds.length ? 'No way to the picture from here. Try Undo.' : 'No hint found');
        return;
      }
      setHint({ fold: path[0]!, paper });
      track.action('hint');
      setHints((h) => h + 1);
    }, 30);
  };

  const restart = () => {
    clearBoard();
    setSolved(false);
    setShowResult(false);
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-paper/80">{error}</div>
    );
  }
  if (!data || !paper || !active) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="font-display animate-pulse text-2xl text-kraft">Fold</span>
      </div>
    );
  }

  const puzzle = active;
  const maxDim = Math.max(puzzle.w, puzzle.h);
  const cell = Math.max(28, Math.floor(Math.min(box.w - 24, box.h - 24, 460) / maxDim));
  const over = folds.length > puzzle.par;
  const deadEnd = !solved && paper.size < viewCells(puzzle.target);
  const nowView = topView(paper, puzzle.front, puzzle.back);
  // Same outline as the target (ignoring colours): a strong "you're close" signal.
  const sameShape =
    !solved && folds.length > 0 && nowView.replace(/[0-9]/g, '#') === puzzle.target.replace(/[0-9]/g, '#');
  const suggest = hint && hint.paper === paper ? hint.fold : null;
  const closeHowTo = () => {
    setHowTo(false);
    writeFlag(TUTORIAL_KEY);
  };

  return (
    <div className="paper-texture relative flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 pt-3">
        <div>
          <p className="font-display text-2xl leading-none">
            Fold{' '}
            <span className="text-kraft/80">
              {practice ? 'practice' : data.kind === 'custom' ? `by u/${data.author}` : `#${puzzle.number}`}
            </span>
          </p>
          <p className="mt-1 text-xs text-paper/50">
            {practice ? (
              <button onClick={backToDaily} className="underline underline-offset-2">
                ← back to today's Fold
              </button>
            ) : data.kind === 'custom' ? (
              'Community puzzle'
            ) : (
              `${data.date} · ${data.tier}`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.streak && data.streak.current > 0 && (
            <span className="rounded-full bg-ink-2 px-3 py-1 text-sm" title="Daily streak">
              🔥 {data.streak.current}
            </span>
          )}
          <button
            onClick={() => {
              setMuted(!mute);
              setMute(!mute);
            }}
            aria-label={mute ? 'Turn sound on' : 'Turn sound off'}
            className="h-8 w-8 rounded-full bg-ink-2 text-sm ring-1 ring-white/10"
          >
            {mute ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => {
              setHowTo(true);
              track.action('how_to');
            }}
            aria-label="How to play"
            className="h-8 w-8 rounded-full bg-ink-2 text-sm font-semibold ring-1 ring-white/10"
          >
            ?
          </button>
        </div>
      </header>

      <section className="mx-4 mt-3 flex items-center gap-4 rounded-2xl bg-ink-2 p-3 ring-1 ring-white/5">
        <Pattern view={puzzle.target} size={76} />
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-widest text-paper/50">Make this</p>
          <p className="mt-0.5 text-sm text-paper/80">
            Folded tiles flip over and show the kraft back.
          </p>
          <p className={`mt-1 text-sm font-semibold ${over ? 'text-ember' : 'text-paper'}`}>
            Folds {folds.length} <span className="font-normal text-paper/50">/ par {puzzle.par}</span>
            {sameShape && (
              <span className="pop ml-2 rounded-full bg-emerald-600/30 px-2 py-0.5 text-xs font-normal text-emerald-200">
                shape ✓ now the colours
              </span>
            )}
          </p>
        </div>
      </section>

      <div ref={boxRef} className="relative flex min-h-0 flex-1 items-center justify-center">
        <Board
          paper={paper}
          front={puzzle.front}
          back={puzzle.back}
          cell={cell}
          disabled={solved}
          hint={tutorial && folds.length === 0}
          target={puzzle.target}
          suggest={suggest}
          onFold={onFold}
        />
        {deadEnd && (
          <div className="pop absolute bottom-2 flex items-center gap-3 rounded-full bg-ember/90 px-4 py-1.5 text-sm text-white shadow-lg">
            Not enough paper left for the picture
            <button
              onClick={() => setFolds((f) => f.slice(0, -1))}
              className="rounded-full bg-white/25 px-3 py-0.5 font-semibold"
            >
              Undo
            </button>
          </div>
        )}
        {!deadEnd && tutorial && !howTo && folds.length === 0 && (
          <p className="nudge pointer-events-none absolute bottom-2 rounded-full bg-ink-2/90 px-4 py-1.5 text-sm text-paper ring-1 ring-white/10">
            Tap a dashed crease, then the side to fold over
          </p>
        )}
      </div>

      <footer className="flex items-center justify-center gap-2 px-4 pb-4 pt-2">
        <button
          onClick={() => {
            setFolds((f) => f.slice(0, -1));
            track.action('undo');
          }}
          disabled={!folds.length || solved}
          className="rounded-full bg-ink-2 px-5 py-2 text-sm ring-1 ring-white/10 disabled:opacity-40"
        >
          ↶ Undo
        </button>
        <button
          onClick={() => {
            restart();
            track.action('unfold_all');
          }}
          disabled={!folds.length}
          className="rounded-full bg-ink-2 px-5 py-2 text-sm ring-1 ring-white/10 disabled:opacity-40"
        >
          Unfold all
        </button>
        {!solved && (
          <button
            onClick={askHint}
            disabled={thinking || deadEnd}
            className="rounded-full bg-ink-2 px-5 py-2 text-sm ring-1 ring-ember/50 disabled:opacity-40"
          >
            {thinking ? 'Thinking…' : '💡 Hint'}
          </button>
        )}
        {solved && result && !showResult && !practice && (
          <button onClick={() => setShowResult(true)} className="rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white">
            Results
          </button>
        )}
      </footer>

      {howTo && <HowTo onClose={closeHowTo} />}

      {creating && <Creator loggedIn={!!data.username} onClose={() => setCreating(false)} />}

      {showResult && result && (
        <ResultSheet
          data={data}
          mine={result.mine}
          streak={result.streak}
          stats={result.stats}
          rank={result.rank}
          loggedIn={!!data.username}
          onAgain={restart}
          onPractice={() => startPractice('easy')}
          onCreate={() => setCreating(true)}
          onClose={() => setShowResult(false)}
        />
      )}

      {practice?.done && (
        <PracticeSheet
          done={practice.done}
          par={practice.puzzle.par}
          level={practice.level}
          onNext={startPractice}
          onBack={backToDaily}
          onCreate={() => setCreating(true)}
        />
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
