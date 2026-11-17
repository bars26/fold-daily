import { useMemo, useState } from 'react';
import { navigateTo, showToast } from '@devvit/web/client';
import type { CreateResponse, ErrorResponse } from '../shared/api.ts';
import { CUSTOM_COLORS, CUSTOM_SIZES, MAX_CUSTOM_FOLDS, checkCustom } from '../shared/custom.ts';
import { BACK, makeFront, rng } from '../shared/daily.ts';
import { replay, topView, type Fold } from '../shared/fold.ts';
import { Board } from './Board.tsx';
import { PALETTE, PALETTE_DARK } from './palette.ts';
import { Pattern } from './Pattern.tsx';

type Size = (typeof CUSTOM_SIZES)[number];

const shuffled = (s: Size) => makeFront(s.w, s.h, CUSTOM_COLORS, rng(Math.floor(Math.random() * 2 ** 31)));

type Props = { loggedIn: boolean; onClose: () => void };

/** Paint a sheet, fold it 1–4 times, and post the result as a puzzle. */
export const Creator = ({ loggedIn, onClose }: Props) => {
  const [size, setSize] = useState<Size>(CUSTOM_SIZES[0]);
  const [front, setFront] = useState(() => shuffled(CUSTOM_SIZES[0]));
  const [mode, setMode] = useState<'paint' | 'fold'>('paint');
  const [folds, setFolds] = useState<Fold[]>([]);
  const [posting, setPosting] = useState(false);

  const paper = useMemo(() => replay(size.w, size.h, folds)!, [size, folds]);
  const view = topView(paper, front, BACK);
  const check = folds.length ? checkCustom(size.w, size.h, front, folds) : null;
  const cell = Math.floor(Math.min(window.innerWidth - 64, 340) / Math.max(size.w, size.h));

  const newSheet = (s: Size) => {
    setSize(s);
    setFront(shuffled(s));
    setFolds([]);
    setMode('paint');
  };

  const paint = (i: number) => setFront((f) => f.map((c, j) => (j === i ? (c % CUSTOM_COLORS) + 1 : c)));

  const toPaint = () => {
    setFolds([]); // colours can only change on a flat sheet
    setMode('paint');
  };

  const publish = async () => {
    if (!check?.ok || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ w: size.w, h: size.h, front, folds }),
      });
      const body = (await res.json()) as CreateResponse | ErrorResponse;
      if (!res.ok || !('url' in body)) throw new Error((body as ErrorResponse).message);
      showToast(`Posted! Par ${body.par}`);
      navigateTo(body.url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not post');
      setPosting(false);
    }
  };

  return (
    <div className="paper-texture absolute inset-0 z-50 flex flex-col overflow-y-auto bg-ink">
      <header className="flex items-center justify-between px-4 pt-3">
        <div>
          <p className="font-display text-2xl leading-none">Make a Fold</p>
          <p className="mt-1 text-xs text-paper/50">Paint a sheet, fold it, post it as a puzzle.</p>
        </div>
        <button onClick={onClose} className="rounded-full bg-ink-2 px-3 py-1 text-sm ring-1 ring-white/10">
          ✕
        </button>
      </header>

      <div className="mx-4 mt-3 flex items-center justify-between gap-2">
        <div className="flex rounded-full bg-ink-2 p-1 ring-1 ring-white/10">
          {(['paint', 'fold'] as const).map((m) => (
            <button
              key={m}
              onClick={() => (m === 'paint' ? toPaint() : setMode('fold'))}
              className={`rounded-full px-4 py-1 text-sm ${mode === m ? 'bg-paper text-ink' : ''}`}
            >
              {m === 'paint' ? '1 · Paint' : '2 · Fold'}
            </button>
          ))}
        </div>
        {mode === 'paint' && (
          <div className="flex gap-1">
            {CUSTOM_SIZES.map((s) => (
              <button
                key={`${s.w}x${s.h}`}
                onClick={() => newSheet(s)}
                className={`rounded-full px-2.5 py-1 text-xs ${s === size ? 'bg-paper text-ink' : 'bg-ink-2 ring-1 ring-white/10'}`}
              >
                {s.w}×{s.h}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-[280px] flex-1 items-center justify-center py-4">
        {mode === 'paint' ? (
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${size.w}, ${cell}px)`, gridAutoRows: `${cell}px` }}
          >
            {front.map((c, i) => (
              <button key={i} aria-label={`Recolour tile ${i + 1}`} onClick={() => paint(i)} className="relative">
                <span
                  className="absolute inset-[3%] rounded-[14%] transition active:scale-95"
                  style={{ background: PALETTE[c], boxShadow: `inset 0 -${cell / 14}px 0 ${PALETTE_DARK[c]}` }}
                />
              </button>
            ))}
          </div>
        ) : (
          <Board
            paper={paper}
            front={front}
            back={BACK}
            cell={cell}
            disabled={folds.length >= MAX_CUSTOM_FOLDS}
            hint={false}
            target=""
            suggest={null}
            onFold={(f) => setFolds((fs) => [...fs, f])}
          />
        )}
      </div>

      <footer className="flex flex-col gap-3 px-4 pb-4">
        {mode === 'paint' ? (
          <>
            <p className="text-center text-sm text-paper/70">Tap tiles to change their colour.</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFront(shuffled(size))}
                className="rounded-full bg-ink-2 py-2 text-sm ring-1 ring-white/10"
              >
                🎲 Shuffle
              </button>
              <button
                onClick={() => setMode('fold')}
                className="rounded-full bg-ember py-2 text-sm font-semibold text-white"
              >
                Start folding →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-ink-2 p-3 ring-1 ring-white/5">
              {folds.length ? (
                <Pattern view={view} size={64} />
              ) : (
                <div className="h-16 w-16 rounded-lg border-2 border-dashed border-white/20" />
              )}
              <div className="flex-1 text-sm">
                <p className="text-[11px] uppercase tracking-widest text-paper/50">Your puzzle</p>
                <p>
                  {folds.length} / {MAX_CUSTOM_FOLDS} folds
                  {check?.ok ? ` · par ${check.par}` : ''}
                </p>
                {!folds.length && <p className="text-paper/60">Fold the sheet 2–4 times.</p>}
                {check && !check.ok && <p className="text-ember">{check.reason}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFolds((f) => f.slice(0, -1))}
                disabled={!folds.length}
                className="rounded-full bg-ink-2 py-2 text-sm ring-1 ring-white/10 disabled:opacity-40"
              >
                ↶ Undo
              </button>
              <button
                onClick={publish}
                disabled={!check?.ok || posting || !loggedIn}
                className="rounded-full bg-ember py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {posting ? 'Posting…' : loggedIn ? 'Post as a puzzle' : 'Log in to post'}
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  );
};
