import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCustom } from './custom.ts';
import type { Fold } from './fold.ts';

const front = Array.from({ length: 16 }, (_, i) => 1 + (i % 4));

test('accepts a real fold and computes par', () => {
  const r = checkCustom(4, 4, front, [
    { axis: 'x', at: 1, from: 'low' },
    { axis: 'y', at: 1, from: 'low' },
  ] satisfies Fold[]);
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(r.par >= 1 && r.par <= 2);
});

test('rejects bad input', () => {
  assert.equal(checkCustom(7, 7, front, [{ axis: 'x', at: 1, from: 'low' }]).ok, false);
  assert.equal(checkCustom(4, 4, front.slice(1), [{ axis: 'x', at: 1, from: 'low' }]).ok, false);
  assert.equal(checkCustom(4, 4, front.map(() => 9), [{ axis: 'x', at: 1, from: 'low' }]).ok, false);
  assert.equal(checkCustom(4, 4, front, []).ok, false);
  assert.equal(checkCustom(4, 4, front, [{ axis: 'x', at: 0, from: 'low' }]).ok, false);
  assert.equal(checkCustom(4, 4, front, 'nope').ok, false);
});

test('rejects folding down to a single tile', () => {
  const folds: Fold[] = [
    { axis: 'x', at: 2, from: 'low' },
    { axis: 'x', at: 3, from: 'high' },
    { axis: 'y', at: 2, from: 'low' },
    { axis: 'y', at: 3, from: 'high' },
  ];
  assert.equal(checkCustom(4, 4, front, folds).ok, false);
});

test('rejects an all-kraft picture', () => {
  const r = checkCustom(4, 4, front, [
    { axis: 'x', at: 2, from: 'low' },
    { axis: 'y', at: 2, from: 'low' },
  ]);
  assert.equal(r.ok, false);
});
