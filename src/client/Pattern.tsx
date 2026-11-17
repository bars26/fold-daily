import { parseView } from '../shared/fold.ts';
import { PALETTE, PALETTE_DARK } from './palette.ts';

type Props = { view: string; size: number; gap?: number; className?: string; label?: string };

/** Static picture of a top view, e.g. the target. */
export const Pattern = ({ view, size, gap = 2, className, label }: Props) => {
  const { w, h, rows } = parseView(view);
  const cell = Math.floor((size - gap * (Math.max(w, h) - 1)) / Math.max(w, h));
  return (
    <div
      role="img"
      aria-label={label ?? 'Target pattern'}
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${w}, ${cell}px)`,
        gridTemplateRows: `repeat(${h}, ${cell}px)`,
        gap,
      }}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (
          <div
            key={`${x},${y}`}
            style={{
              borderRadius: Math.max(2, cell / 8),
              background: ch === '.' ? 'transparent' : PALETTE[Number(ch)],
              boxShadow:
                ch === '.' ? 'none' : `inset 0 -${Math.max(1, cell / 12)}px 0 ${PALETTE_DARK[Number(ch)]}`,
            }}
          />
        ))
      )}
    </div>
  );
};
