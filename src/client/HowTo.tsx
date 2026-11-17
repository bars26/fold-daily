import { PALETTE, PALETTE_DARK } from './palette.ts';

const tile = (c: number) => ({
  background: PALETTE[c],
  boxShadow: `inset 0 -3px 0 ${PALETTE_DARK[c]}`,
});

/** Looping two-tile demo: the left tile flips over the crease and lands
 *  kraft-side up on the right tile. */
const FlipDemo = () => (
  <div className="relative mx-auto flex h-16 w-32" style={{ perspective: 400 }}>
    <div className="absolute left-16 top-0 h-16 w-16 p-1">
      <div className="h-full w-full rounded-lg" style={tile(2)} />
    </div>
    <div
      className="howto-flap absolute left-0 top-0 z-10 h-16 w-16"
      style={{ transformStyle: 'preserve-3d', transformOrigin: '100% 50%' }}
    >
      <div className="face m-1 rounded-lg" style={tile(1)} />
      <div className="face m-1 rounded-lg" style={{ ...tile(0), transform: 'rotateY(180deg) translateZ(1px)' }} />
    </div>
    <div className="absolute left-16 top-[-6px] h-[76px] border-l-2 border-dashed border-white/60" />
  </div>
);

type Props = { onClose: () => void };

export const HowTo = ({ onClose }: Props) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
    <div className="pop w-full max-w-sm rounded-3xl bg-ink-2 p-5 shadow-2xl ring-1 ring-white/10">
      <h2 className="font-display text-center text-2xl">How to fold</h2>
      <div className="mt-4 rounded-2xl bg-ink-3 py-4">
        <FlipDemo />
      </div>
      <ol className="mt-4 space-y-3 text-sm text-paper/85">
        <li className="flex gap-3">
          <span className="font-display text-lg text-ember">1</span>
          <span>
            Tap a <b>dashed crease</b>. Each side shows a <b>preview</b> of the sheet after the
            fold — tap the one you want.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-display text-lg text-ember">2</span>
          <span>
            The folded part lands on top <b>upside down</b>, so it shows the back of the sheet:
            plain <span className="rounded px-1 text-ink" style={{ background: PALETTE[0] }}>kraft</span>.
            Fold it again and the colours come back.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-display text-lg text-ember">3</span>
          <span>
            Make the sheet look exactly like the <b>picture</b> — same shape, same colours — in as
            few folds as you can. Stuck? Use <b>Hint</b> or <b>Undo</b>.
          </span>
        </li>
      </ol>
      <button
        onClick={onClose}
        className="mt-5 w-full rounded-full bg-ember py-2.5 font-semibold text-white active:scale-[0.98]"
      >
        Let's fold
      </button>
    </div>
  </div>
);
