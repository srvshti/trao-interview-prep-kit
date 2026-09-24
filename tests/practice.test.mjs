import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveWeakSpots } from '../src/practice.mjs';

test('reports only low-confidence cards in priority order', () => {
  const weakSpots = deriveWeakSpots([
    { id: 'f1', front: 'API design' }, { id: 'f2', front: 'SQL joins' }, { id: 'f3', front: 'Testing' }
  ], { f1: 2, f2: 1, f3: 1 });
  assert.deepEqual(weakSpots.map((spot) => spot.id), ['f2', 'f3']);
});
