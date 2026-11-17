import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  bounds,
  canFold,
  legalFolds,
  parseKey,
  applyFold,
  topView,
  topColor,
  type Axis,
  type Fold,
  type Layer,
  type PaperState,
} from '../shared/fold.ts';
import { PALETTE, PALETTE_DARK } from './palette.ts';
import { Pattern } from './Pattern.tsx';

type Crease = { axis: Axis; at: number };

type Props = {
  paper: PaperState;
  front: number[];
  back: number;
  /** Cell size in px. */
  cell: number;
  disabled: boolean;
  hint: boolean;
  /** Target view, to mark previews that match it. */
  target: string;
  /** A suggested fold (from the Hint button) to point at. */
  suggest: Fold | null;
  onFold: (f: Fold) => void;
};

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const colorOf = (layers: Layer[], front: number[], back: number) => topColor(layers, front, back);

/** Colour that shows once a moving stack has flipped: its bottom layer, turned over. */
const revealedColor = (layers: Layer[], front: number[], back: number) => {
  const bottom = layers[0]!;
  return !bottom.up ? front[bottom.cell]! : back;
};

const Tile = ({ color, layers, s }: { color: number; layers: number; s: number }) => (
  <div
    className="absolute inset-[3%] rounded-[14%]"
    style={{
      background: PALETTE[color],
      boxShadow: `inset 0 -${Math.max(2, s / 14)}px 0 ${PALETTE_DARK[color]}, 0 ${Math.min(layers - 1, 4) * 1.5}px 0 rgba(0,0,0,0.35)`,
    }}
  >
    {layers > 1 && (
      <span
        className="absolute right-[10%] top-[6%] text-[10px] font-semibold opacity-50"
        style={{ color: color === 0 ? '#5b4a33' : '#fff' }}
      >
        {layers}
      </span>
    )}
  </div>
);

export const Board = ({
  paper,
  front,
  back,
  cell: s,
  disabled,
  hint,
  target,
  suggest,
  onFold,
}: Props) => {
  // The selection remembers which paper it was made on, so undo/reset clear it.
  const [picked, setPicked] = useState<{ crease: Crease; paper: PaperState } | null>(null);
  const sel =
    picked && picked.paper === paper
      ? picked.crease
      : suggest
        ? { axis: suggest.axis, at: suggest.at }
        : null;
  const suggested = (from: 'low' | 'high') =>
    !!suggest && !!sel && suggest.axis === sel.axis && suggest.at === sel.at && suggest.from === from;
  const setSel = (c: Crease | null) => setPicked(c ? { crease: c, paper } : null);
  const [anim, setAnim] = useState<Fold | null>(null);
  const flapRef = useRef<HTMLDivElement>(null);

  const b = bounds(paper);
  const frameW = (b.maxX - b.minX + 1) * s;
  const frameH = (b.maxY - b.minY + 1) * s;

  const creases = useMemo(() => {
    const seen = new Set<string>();
    const out: Crease[] = [];
    for (const f of legalFolds(paper)) {
      const k = `${f.axis}${f.at}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ axis: f.axis, at: f.at });
      }
    }
    return out;
  }, [paper]);

  useLayoutEffect(() => {
    if (!anim) return;
    const el = flapRef.current;
    const finish = () => {
      setAnim(null);
      onFold(anim);
    };
    if (!el || reducedMotion()) {
      finish();
      return;
    }
    const sign = anim.from === 'low' ? 1 : -1;
    const rot =
      anim.axis === 'x'
        ? [`rotateY(0deg)`, `rotateY(${180 * sign}deg)`]
        : [`rotateX(0deg)`, `rotateX(${-180 * sign}deg)`];
    const a = el.animate([{ transform: rot[0]! }, { transform: rot[1]! }], {
      duration: 430,
      easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
      fill: 'forwards',
    });
    a.onfinish = finish;
    return () => a.cancel();
  }, [anim, onFold]);

  const isMoving = (k: string) => {
    if (!anim) return false;
    const [x, y] = parseKey(k);
    const c = anim.axis === 'x' ? x : y;
    return anim.from === 'low' ? c < anim.at : c >= anim.at;
  };

  const pos = (k: string) => {
    const [x, y] = parseKey(k);
    return { left: (x - b.minX) * s, top: (y - b.minY) * s };
  };

  const pick = (from: 'low' | 'high') => {
    if (!sel || disabled || anim) return;
    const f: Fold = { ...sel, from };
    if (!canFold(paper, f)) return;
    setSel(null);
    setAnim(f);
  };

  const sideRect = (from: 'low' | 'high') => {
    if (!sel) return null;
    const line = (sel.at - (sel.axis === 'x' ? b.minX : b.minY)) * s;
    if (sel.axis === 'x') {
      return from === 'low'
        ? { left: 0, top: 0, width: line, height: frameH }
        : { left: line, top: 0, width: frameW - line, height: frameH };
    }
    return from === 'low'
      ? { left: 0, top: 0, width: frameW, height: line }
      : { left: 0, top: line, width: frameW, height: frameH - line };
  };

  const origin = anim
    ? anim.axis === 'x'
      ? `${(anim.at - b.minX) * s}px 50%`
      : `50% ${(anim.at - b.minY) * s}px`
    : '50% 50%';

  return (
    <div className="relative" style={{ perspective: 1100 }}>
      <div
        className="relative transition-[width,height] duration-300"
        style={{ width: frameW, height: frameH, transformStyle: 'preserve-3d' }}
      >
        {[...paper.entries()]
          .filter(([k]) => !isMoving(k))
          .map(([k, layers]) => (
            <div
              key={k}
              className="absolute transition-[left,top] duration-300"
              style={{ ...pos(k), width: s, height: s }}
            >
              <Tile color={colorOf(layers, front, back)} layers={layers.length} s={s} />
            </div>
          ))}

        {anim && (
          <div
            ref={flapRef}
            className="absolute inset-0"
            style={{ transformOrigin: origin, transformStyle: 'preserve-3d', zIndex: 5 }}
          >
            {[...paper.entries()]
              .filter(([k]) => isMoving(k))
              .map(([k, layers]) => (
                <div
                  key={k}
                  className="absolute"
                  style={{ ...pos(k), width: s, height: s, transformStyle: 'preserve-3d' }}
                >
                  <div className="face">
                    <Tile color={colorOf(layers, front, back)} layers={layers.length} s={s} />
                  </div>
                  <div
                    className="face"
                    style={{ transform: anim.axis === 'x' ? 'rotateY(180deg)' : 'rotateX(180deg)' }}
                  >
                    <Tile color={revealedColor(layers, front, back)} layers={1} s={s} />
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Side pickers once a crease is chosen */}
        {sel &&
          (['low', 'high'] as const).map((from) => {
            const r = sideRect(from);
            const ok = canFold(paper, { ...sel, from });
            if (!r || !ok) return null;
            const hinted = suggested(from);
            // While a hint is showing on this crease, only offer the hinted side.
            if (suggest && !hinted && suggest.axis === sel.axis && suggest.at === sel.at) return null;
            const arrow =
              sel.axis === 'x' ? (from === 'low' ? '→' : '←') : from === 'low' ? '↓' : '↑';
            // Show what the sheet would look like after this fold.
            const after = topView(applyFold(paper, { ...sel, from }), front, back);
            const wins = after === target;
            const previewSize = Math.max(28, Math.min(72, Math.min(r.width, r.height) - 16));
            return (
              <button
                key={from}
                aria-label={`Fold this side over (${arrow})`}
                onClick={() => pick(from)}
                className={`pop absolute z-10 flex items-center justify-center rounded-lg text-2xl font-bold text-white backdrop-blur-[1px] transition ${
                  hinted
                    ? 'bg-ember/10 ring-4 ring-ember hover:bg-ember/20'
                    : 'bg-white/10 ring-2 ring-white/60 hover:bg-white/20 active:bg-white/30'
                }`}
                style={r}
              >
                <span className="flex flex-col items-center gap-1 rounded-xl bg-ink/80 p-1.5 shadow-lg">
                  <Pattern view={after} size={previewSize} gap={1} label="Result of this fold" />
                  <span
                    className={`rounded-full px-2 text-sm leading-5 ${
                      wins ? 'bg-emerald-500 text-white' : hinted ? 'nudge bg-ember' : ''
                    }`}
                  >
                    {wins ? '✓' : arrow}
                  </span>
                </span>
              </button>
            );
          })}

        {/* Crease handles */}
        {!anim &&
          !disabled &&
          creases.map((c, i) => {
            const line = (c.at - (c.axis === 'x' ? b.minX : b.minY)) * s;
            const active = sel?.axis === c.axis && sel.at === c.at;
            // While a crease is chosen, hide the others so the side buttons get the taps.
            if (sel && !active) return null;
            const style =
              c.axis === 'x'
                ? { left: line - 11, top: -8, width: 22, height: frameH + 16 }
                : { top: line - 11, left: -8, height: 22, width: frameW + 16 };
            return (
              <button
                key={`${c.axis}${c.at}`}
                aria-label={`Crease ${c.axis === 'x' ? 'vertical' : 'horizontal'} ${c.at}`}
                onClick={() => setSel(active ? null : c)}
                className="group absolute z-20 flex items-center justify-center"
                style={style}
              >
                <span
                  className={`block ${c.axis === 'x' ? 'h-full w-0 border-l-2' : 'h-0 w-full border-t-2'} border-dashed transition ${
                    active
                      ? 'border-white'
                      : 'border-white/35 group-hover:border-white/80'
                  } ${hint && i === 0 && !sel ? 'nudge border-white' : ''}`}
                />
              </button>
            );
          })}
      </div>
    </div>
  );
};
