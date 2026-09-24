import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCases } from '../scripts/evaluate.mjs';

test('batch evaluation continues after a failed case and returns Appendix-B kits', async () => {
  const output = await evaluateCases([{ id: 'bad' }, { id: 'good' }], {
    builder: async (entry) => {
      if (entry.id === 'bad') throw new Error('Bad input');
      return { source: { role: 'Backend Engineer' } };
    }
  });
  assert.equal(output.kits.length, 2);
  assert.equal(output.kits[0].status, 'failed');
  assert.equal(output.kits[1].status, 'ok');
  assert.ok(output.generated_at);
});
