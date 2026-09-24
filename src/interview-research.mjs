const REDDIT_SEARCH_URL = 'https://www.reddit.com/search.json';
const HACKER_NEWS_SEARCH_URL = 'https://hn.algolia.com/api/v1/search';
const MAX_RESULTS = 3;
const SEARCH_QUERIES = (companyName) => [
  `${companyName} interview experience`,
  `${companyName} software engineer interview`
];

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cleanSnippet(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
}

export function companyNameFromUrl(companyUrl) {
  const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');
  return hostname.split('.')[0].replace(/[-_]/g, ' ');
}

// Community posts are useful interview signals, but never verified company facts.
export async function searchInterviewDiscussions(companyName, { fetcher = fetch, retries = 2 } = {}) {
  let lastError;
  for (const [queryIndex, query] of SEARCH_QUERIES(companyName).entries()) {
    const url = new URL(REDDIT_SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(MAX_RESULTS));
    url.searchParams.set('sort', 'relevance');
    url.searchParams.set('t', 'all');

    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const response = await fetcher(url, {
          headers: { 'user-agent': 'TraoInterviewPrepBot/0.1 (educational assessment)' },
          signal: AbortSignal.timeout(8_000)
        });
        if (!response.ok) throw new Error(`Interview discussion search returned HTTP ${response.status}`);
        const payload = await response.json();
        const sources = (payload?.data?.children || [])
          .map((child) => child?.data)
          .filter((post) => post?.title && post?.permalink)
          .map((post) => ({
            url: `https://www.reddit.com${post.permalink}`,
            title: cleanSnippet(post.title),
            snippet: cleanSnippet(post.selftext || post.title),
            retrieved_at: new Date().toISOString(),
            source_type: 'public-interview-discussion'
          }))
          .slice(0, MAX_RESULTS);
        if (sources.length) return { sources, error: null, provider: 'reddit-public-search' };
        break;
      } catch (error) {
        lastError = error;
        if (attempt < retries - 1) await pause(300 * (2 ** attempt));
      }
    }
    if (queryIndex < SEARCH_QUERIES(companyName).length - 1) await pause(250);
  }

  const hackerNews = await searchHackerNewsInterviewDiscussions(companyName, { fetcher, retries });
  if (hackerNews.sources.length) return hackerNews;
  return {
    sources: [],
    error: hackerNews.error || lastError?.message || 'Interview discussion search failed',
    provider: 'reddit-and-hacker-news-public-search'
  };
}

async function searchHackerNewsInterviewDiscussions(companyName, { fetcher, retries }) {
  const url = new URL(HACKER_NEWS_SEARCH_URL);
  url.searchParams.set('query', `${companyName} software engineer interview`);
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', String(MAX_RESULTS));
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Hacker News search returned HTTP ${response.status}`);
      const payload = await response.json();
      const sources = (payload?.hits || [])
        .filter((hit) => hit?.title || hit?.story_title)
        .map((hit) => ({
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          title: cleanSnippet(hit.title || hit.story_title),
          snippet: cleanSnippet(hit.story_text || hit.comment_text || hit.title || hit.story_title),
          retrieved_at: new Date().toISOString(),
          source_type: 'public-interview-discussion'
        }))
        .filter((source) => /interview|hiring|recruit/i.test(`${source.title} ${source.snippet}`))
        .slice(0, MAX_RESULTS);
      if (sources.length) return { sources, error: null, provider: 'hacker-news-public-search' };
      return { sources: [], error: 'No citable Hacker News interview discussion was found.', provider: 'hacker-news-public-search' };
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await pause(300 * (2 ** attempt));
    }
  }
  return { sources: [], error: lastError?.message || 'Hacker News interview discussion search failed', provider: 'hacker-news-public-search' };
}
