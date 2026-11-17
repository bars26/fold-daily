import { useMemo, useState } from 'react';
import { BACK } from '../shared/daily.ts';
import { replay, topView, type Fold } from '../shared/fold.ts';
import { Board } from './Board.tsx';
import { Pattern } from './Pattern.tsx';
import { playFold, playWin } from './sound.ts';

// A 3×2 sheet: orange | blue | yellow columns. Folding the yellow column over
// the crease lands it kraft-side up on the blue one.
const W = 3;
const H = 2;
const FRONT = [1, 2, 3, 1, 2, 3];
const LESSON: Fold = { axis: 'x', at: 2, from: 'high' };
const TARGET = topView(replay(W, H, [LESSON])!, FRONT, BACK);

type Props = { onDone: () => void };

/** First-run lesson: one guided fold on the real board, then straight into play. */
export const Tutorial = ({ onDone }: Props) => {
  const [folds, setFolds] = useState<Fold[]>([]);
  const paper = useMemo(() => replay(W, H, folds)!, [folds]);
  const solved = topView(paper, FRONT, BACK) === TARGET;
  const wrong = folds.length > 0 && !solved;
  const cell = Math.floor(Math.min(window.innerWidth - 80, 300) / W);

  const onFold = (f: Fold) => {
    const next = [...folds, f];
    setFolds(next);
    playFold();
    if (topView(replay(W, H, next)!, FRONT, BACK) === TARGET) setTimeout(playWin, 250);
  };

  return (
    <div className="paper-texture absolute inset-0 z-50 flex flex-col items-center overflow-y-auto bg-ink px-4 py-4">
      <div className="flex w-full max-w-sm items-center justify-between">
        <p className="font-display text-2xl">How to fold</p>
        <button onClick={onDone} className="text-sm text-paper/60 underline underline-offset-2">
          Skip
        </button>
      </div>

      <div className="mt-3 flex w-full max-w-sm items-center gap-3 rounded-2xl bg-ink-2 p-3 ring-1 ring-white/5">
        <Pattern view={TARGET} size={56} />
        <p className="text-sm text-paper/85">
          <span className="block text-[11px] uppercase tracking-widest text-paper/50">Make this</span>
          The goal is always to make the sheet look like this picture.
        </p>
      </div>

      <div className="flex min-h-[220px] flex-1 items-center justify-center py-4">
        <Board
          paper={paper}
          front={FRONT}
          back={BACK}
          cell={cell}
          disabled={solved || wrong}
          hint={false}
          target={TARGET}
          suggest={folds.length ? null : LESSON}
          onFold={onFold}
        />
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-ink-2 p-4 text-sm ring-1 ring-white/5">
        {solved ? (
          <div className="pop space-y-3">
            <p>
              <b>That's it!</b> The yellow column flipped over the crease, so it now shows the{' '}
              <b>kraft back</b> of the paper.
            </p>
            <p className="text-paper/70">
              Every puzzle works like this: tap a crease, look at the previews, and match the picture
              in as few folds as you can. Stuck? Use 💡 Hint or ↶ Undo.
            </p>
            <button
              onClick={onDone}
              className="w-full rounded-full bg-ember py-2.5 font-semibold text-white active:scale-[0.98]"
            >
              Play today's Fold →
            </button>
          </div>
        ) : wrong ? (
          <div className="space-y-3">
            <p>Not quite. That fold doesn't match the picture.</p>
            <button
              onClick={() => setFolds([])}
              className="w-full rounded-full bg-ink-3 py-2 font-semibold ring-1 ring-white/10"
            >
              ↶ Unfold and try again
            </button>
          </div>
        ) : (
          <p>
            A crease is selected. Each side shows a <b>preview</b> of the sheet after folding — the one
            with <span className="rounded-full bg-emerald-500 px-1.5 text-white">✓</span> matches the
            picture. <b>Tap it</b> to fold.
          </p>
        )}
      </div>
    </div>
  );
};
