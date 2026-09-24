import assert from 'node:assert/strict';
import test from 'node:test';
import { companyNameFromUrl, searchInterviewDiscussions } from '../src/interview-research.mjs';

test('derives a readable company search term from a company URL', () => {
  assert.equal(companyNameFromUrl('https://www.acme-workflows.com/careers'), 'acme workflows');
});

test('records public interview discussion citations separately from company sources', async () => {
  const result = await searchInterviewDiscussions('Acme', {
    fetcher: async () => new Response(JSON.stringify({
      data: { children: [{ data: { title: 'Acme interview experience', selftext: 'I had a system design round and a behavioural round.', permalink: '/r/jobs/comments/abc/acme' } }] }
    }), { status: 200 }),
    retries: 1
  });
  assert.equal(result.provider, 'reddit-public-search');
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].source_type, 'public-interview-discussion');
  assert.match(result.sources[0].url, /reddit\.com\/r\/jobs/);
});
