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

test('tries a role-specific public query when the broad query has no results', async () => {
  const requestedQueries = [];
  const result = await searchInterviewDiscussions('Acme', {
    fetcher: async (url) => {
      requestedQueries.push(new URL(url).searchParams.get('q'));
      const hasResults = requestedQueries.length === 2;
      return new Response(JSON.stringify({
        data: { children: hasResults ? [{ data: { title: 'Acme engineering interview', selftext: 'Technical screen followed by systems discussion.', permalink: '/r/jobs/comments/def/acme' } }] : [] }
      }), { status: 200 });
    },
    retries: 1
  });
  assert.deepEqual(requestedQueries, ['Acme interview experience', 'Acme software engineer interview']);
  assert.equal(result.sources.length, 1);
});

test('falls back to a citable Hacker News discussion when Reddit rejects the request', async () => {
  const result = await searchInterviewDiscussions('Stripe', {
    fetcher: async (url) => {
      if (new URL(url).hostname === 'www.reddit.com') return new Response('blocked', { status: 403 });
      return new Response(JSON.stringify({
        hits: [{
          objectID: '123',
          title: 'Stripe Interview for Software Engineer',
          url: 'https://example.com/stripe-interview',
          story_text: 'A candidate described the Stripe engineering interview process.'
        }]
      }), { status: 200 });
    },
    retries: 1
  });
  assert.equal(result.provider, 'hacker-news-public-search');
  assert.equal(result.sources[0].url, 'https://example.com/stripe-interview');
});
