import { useEffect, useState } from 'react';
import { navigateTo } from '@devvit/web/client';
import type { ArchiveEntry, ArchiveResponse } from '../shared/api.ts';
import { Pattern } from './Pattern.tsx';

type Props = { currentPostId: string | null; onClose: () => void };

const badge = (e: ArchiveEntry) => {
  if (!e.mine) return { text: 'Not played', cls: 'bg-ink-3 text-paper/60' };
  if (e.mine.folds <= e.par) return { text: `⭐ ${e.mine.folds}`, cls: 'bg-ember text-white' };
  return { text: `✓ ${e.mine.folds}`, cls: 'bg-paper text-ink' };
};

const open = (postId: string) => navigateTo(`https://www.reddit.com/comments/${postId.replace(/^t3_/, '')}`);

const Row = ({ e, current }: { e: ArchiveEntry; current: boolean }) => {
  const b = badge(e);
  return (
    <button
      onClick={() => !current && open(e.postId)}
      className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left ring-1 transition ${
        current ? 'bg-ember/15 ring-ember/40' : 'bg-ink-2 ring-white/5 hover:bg-ink-3'
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center">
        <Pattern view={e.target} size={44} gap={1} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {e.title}
          {e.today && <span className="ml-2 text-xs font-normal text-ember">today</span>}
          {current && <span className="ml-2 text-xs font-normal text-paper/60">you're here</span>}
        </p>
        <p className="truncate text-xs text-paper/60">
          {e.detail} · par {e.par} · {e.players} {e.players === 1 ? 'folder' : 'folders'}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${b.cls}`}>{b.text}</span>
    </button>
  );
};

/** Past daily puzzles and recent community puzzles, each opening its post. */
export const Archive = ({ currentPostId, onClose }: Props) => {
  const [tab, setTab] = useState<'daily' | 'community'>('daily');
  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/archive')
      .then((r) => (r.ok ? (r.json() as Promise<ArchiveResponse>) : Promise.reject(new Error('archive'))))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const list = data ? data[tab] : [];

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-ink/70 backdrop-blur-sm sm:items-center">
      <div className="pop m-3 flex max-h-[90vh] w-full max-w-sm flex-col gap-3 rounded-3xl bg-ink-2 p-4 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">More Folds</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full bg-ink-3 px-3 py-1 text-sm">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 rounded-full bg-ink-3 p-1 text-sm">
          {(['daily', 'community'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full py-1.5 ${tab === t ? 'bg-paper text-ink' : 'text-paper/70'}`}
            >
              {t === 'daily' ? 'Daily archive' : 'Community'}
            </button>
          ))}
        </div>
        <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {failed && <p className="py-6 text-center text-sm text-paper/60">Could not load the list.</p>}
          {!data && !failed && <p className="animate-pulse py-6 text-center text-sm text-paper/60">Loading…</p>}
          {data && !list.length && (
            <p className="py-6 text-center text-sm text-paper/60">
              {tab === 'daily'
                ? 'No past puzzles yet.'
                : 'No community puzzles yet. Solve one and tap “Make your own Fold”!'}
            </p>
          )}
          {list.map((e) => (
            <Row key={e.postId} e={e} current={e.postId === currentPostId} />
          ))}
        </div>
      </div>
    </div>
  );
};
