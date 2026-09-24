import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubmissionDeduper, submissionFingerprint } from '../src/submission-dedup.mjs';

test('uses one in-flight result for duplicate submissions', async () => {
  const deduper = createSubmissionDeduper();
  let calls = 0;
  const work = async () => {
    calls += 1;
    return { kit: 'result' };
  };
  const [first, second] = await Promise.all([deduper.run('user:key', work), deduper.run('user:key', work)]);
  assert.equal(calls, 1);
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
});

test('normalizes whitespace when creating a duplicate-submission fingerprint', () => {
  const first = submissionFingerprint({ jd: 'Required: Node.js', companyUrl: 'HTTPS://EXAMPLE.COM', days: 3 });
  const second = submissionFingerprint({ jd: ' Required:   Node.js ', companyUrl: 'https://example.com', days: '3' });
  assert.equal(first, second);
});
