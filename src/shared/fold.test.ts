import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFold,
  canFold,
  initialState,
  legalFolds,
  minFolds,
  replay,
  solveFrom,
  solves,
  topView,
  type Fold,
} from './fold.ts';
import { generate, puzzleNumberFor, dateForPuzzle, publicPuzzle, EPOCH_MS } from './daily.ts';

const front4 = [1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3];

test('flat sheet shows the front', () => {
  assert.equal(topView(initialState(4, 4), front4, 0), '4x4:1122/1122/3333/3333');
});

test('folding the left half over shows the back on top, mirrored', () => {
  const s = applyFold(initialState(4, 4), { axis: 'x', at: 2, from: 'low' });
  assert.equal(topView(s, front4, 0), '2x4:00/00/00/00');
  // each remaining stack has two layers, the moved one on top and face down
  const stack = s.get('2,0')!;
  assert.equal(stack.length, 2);
  assert.deepEqual(stack[1], { cell: 1, up: false });
});

test('folding twice back reveals the front again', () => {
  let s = applyFold(initialState(4, 1), { axis: 'x', at: 2, from: 'low' }); // cols 2..3
  s = applyFold(s, { axis: 'x', at: 3, from: 'high' }); // col 3 onto col 2
  // col 3 stack was [cell3 up, cell0 down]; reversed + flipped → [cell0 up, cell3 down]
  const st = s.get('2,0')!;
  assert.deepEqual(st.at(-1), { cell: 3, up: false });
  assert.equal(st.length, 4);
});

test('uneven fold extends past the edge', () => {
  const s = applyFold(initialState(4, 1), { axis: 'x', at: 1, from: 'high' });
  // cols 1..3 flip onto 0..-2
  assert.deepEqual([...s.keys()].sort(), ['-1,0', '-2,0', '0,0']);
});

test('cannot fold along an edge', () => {
  assert.equal(canFold(initialState(3, 3), { axis: 'x', at: 0, from: 'low' }), false);
  assert.equal(canFold(initialState(3, 3), { axis: 'x', at: 3, from: 'high' }), false);
  assert.equal(legalFolds(initialState(3, 3)).length, 8);
});

test('replay rejects illegal or malformed folds', () => {
  assert.equal(replay(3, 3, [{ axis: 'x', at: 0, from: 'low' }]), null);
  assert.equal(replay(3, 3, [{ axis: 'z', at: 1, from: 'low' } as unknown as Fold]), null);
  assert.equal(replay(3, 3, [{ axis: 'x', at: 1.5, from: 'low' }]), null);
});

test('minFolds finds the shortest path', () => {
  const s = applyFold(initialState(4, 4), { axis: 'x', at: 2, from: 'low' });
  assert.equal(minFolds(4, 4, front4, 0, topView(s, front4, 0), 3), 1);
});

test('solveFrom gives hints from mid-game and detects dead ends', () => {
  const p = generate(5);
  // From the flat sheet: a path of par length that really solves it.
  const path = solveFrom(initialState(p.w, p.h), p.front, p.back, p.target, p.par)!;
  assert.equal(path.length, p.par);
  assert.ok(solves(p, path));
  // After the first solution fold, the rest is at most par - 1 more.
  const mid = replay(p.w, p.h, p.solution.slice(0, 1))!;
  const rest = solveFrom(mid, p.front, p.back, p.target, p.par)!;
  assert.ok(rest.length <= p.par - 1);
  // Folding down to one stack can never reach a multi-tile target.
  let s = initialState(p.w, p.h);
  while (legalFolds(s).length) s = applyFold(s, legalFolds(s)[0]!);
  assert.equal(s.size, 1);
  assert.equal(solveFrom(s, p.front, p.back, p.target, 4), null);
});

test('daily puzzle numbering', () => {
  assert.equal(puzzleNumberFor(EPOCH_MS), 1);
  assert.equal(puzzleNumberFor(EPOCH_MS + 86_400_000 - 1), 1);
  assert.equal(puzzleNumberFor(EPOCH_MS + 86_400_000), 2);
  assert.equal(dateForPuzzle(1), '2026-11-17');
});

test('generated puzzles are deterministic, solvable and at par', () => {
  for (let n = 1; n <= 21; n++) {
    const t0 = performance.now();
    const p = generate(n);
    const ms = performance.now() - t0;
    assert.deepEqual(generate(n).target, p.target, `puzzle ${n} deterministic`);
    assert.ok(solves(p, p.solution), `puzzle ${n} solution works`);
    assert.equal(p.par, p.solution.length);
    assert.equal('solution' in publicPuzzle(p), false);
    assert.ok(ms < 5000, `puzzle ${n} took ${ms.toFixed(0)}ms`);
  }
});
