import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { FoldPostData } from '../shared/api.ts';
import { Pattern } from './Pattern.tsx';

const isFoldData = (d: unknown): d is FoldPostData =>
  typeof d === 'object' && d !== null && 'target' in d && 'n' in d;

/** Inline feed view: kept tiny — no server call, everything comes from postData. */
export const Splash = () => {
  const data = isFoldData(context.postData) ? context.postData : null;
  const [players, setPlayers] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json() as Promise<{ players?: number }>)
      .then((d) => setPlayers(typeof d.players === 'number' ? d.players : null))
      .catch(() => setPlayers(null));
  }, []);
  return (
    <div className="paper-texture flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-6 text-center">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl tracking-wide">Fold</span>
        {data && (
          <span className="text-sm text-kraft/80">
            {data.kind === 'custom' ? `by u/${data.author}` : `#${data.n}`}
          </span>
        )}
      </div>
      {data ? (
        <>
          <div className="rounded-2xl bg-ink-2 p-4 shadow-lg ring-1 ring-white/5">
            <Pattern view={data.target} size={112} />
          </div>
          <p className="max-w-[18rem] text-sm text-paper/80">
            {data.kind === 'custom' ? 'A community puzzle. ' : ''}Fold the sheet until it looks like this.{' '}
            <span className="text-kraft">
              {data.tier} · par {data.par}
            </span>
          </p>
        </>
      ) : (
        <p className="text-sm text-paper/80">A new folding puzzle every day.</p>
      )}
      <button
        className="rounded-full bg-ember px-7 py-2.5 font-semibold text-white shadow-md transition active:scale-95"
        onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
      >
        Start folding
      </button>
      {players !== null && players > 0 && (
        <p className="text-xs text-paper/60">
          {players} {players === 1 ? 'person has' : 'people have'} folded this
        </p>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
