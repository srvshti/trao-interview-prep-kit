import assert from 'node:assert/strict';
import test from 'node:test';
import { companyNameFromUrl, searchInterviewDiscussions } from '../src/interview-research.mjs';

test('derives a readable company search term from a company URL', () => {
  assert.equal(companyNameFromUrl('https://www.acme-workflows.com/careers'), 'acme workflows');
});

test('records a role-specific public discussion citation separately from company sources', async () => {
  const result = await searchInterviewDiscussions('Acme', {
    roleTitle: 'Backend Engineer',
    fetcher: async () => new Response(JSON.stringify({
      data: { children: [{ data: { title: 'Acme backend engineer interview experience', selftext: 'I had a systems design round.', permalink: '/r/jobs/comments/abc/acme' } }] }
    }), { status: 200 }),
    retries: 1
  });
  assert.equal(result.provider, 'reddit-public-search');
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].source_type, 'public-interview-discussion');
  assert.equal(result.sources[0].role_relevance, 'exact-role');
  assert.match(result.sources[0].url, /reddit\.com\/r\/jobs/);
});

test('uses a role-specific public web result before broader company discussion', async () => {
  const result = await searchInterviewDiscussions('Stripe', {
    roleTitle: 'Full Stack Developer',
    fetcher: async (url) => {
      if (new URL(url).hostname === 'html.duckduckgo.com') {
        return new Response('<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fstripe-full-stack">Stripe Full Stack Developer Interview Guide</a>', { status: 200 });
      }
      throw new Error('A broader source should not be needed after an exact role result.');
    },
    retries: 1
  });
  assert.equal(result.provider, 'public-web-interview-search');
  assert.equal(result.sources[0].url, 'https://example.com/stripe-full-stack');
  assert.equal(result.sources[0].role_relevance, 'exact-role');
});

test('uses the parsed role title before trying company-wide interview discussion', async () => {
  const requestedQueries = [];
  const result = await searchInterviewDiscussions('Acme', {
    roleTitle: 'Data Analyst',
    fetcher: async (url) => {
      const parsed = new URL(url);
      requestedQueries.push(parsed.searchParams.get('q') || parsed.searchParams.get('query'));
      if (parsed.hostname === 'www.reddit.com') {
        return new Response(JSON.stringify({ data: { children: [] } }), { status: 200 });
      }
      return new Response(JSON.stringify({ hits: [] }), { status: 200 });
    },
    retries: 1
  });
  assert.deepEqual(requestedQueries, [
    'Acme Data Analyst interview',
    'Acme Data Analyst interview',
    'Acme Data Analyst interview',
    'Acme interview experience',
    'Acme interview experience',
    'Acme interview experience'
  ]);
  assert.equal(result.sources.length, 0);
});

test('does not present an unrelated engineering discussion as data analyst guidance', async () => {
  const result = await searchInterviewDiscussions('Stripe', {
    roleTitle: 'Data Analyst',
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
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].role_relevance, 'company-wide');
});

test('falls back to a related role source when the exact role source is not available', async () => {
  const result = await searchInterviewDiscussions('Stripe', {
    roleTitle: 'Backend Engineer',
    fetcher: async (url) => {
      if (new URL(url).hostname === 'www.reddit.com') return new Response('blocked', { status: 403 });
      return new Response(JSON.stringify({
        hits: [{
          objectID: '456',
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
  assert.equal(result.sources[0].role_relevance, 'related-role');
});
