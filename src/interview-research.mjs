const REDDIT_SEARCH_URL = 'https://www.reddit.com/search.json';
const MAX_RESULTS = 3;

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cleanSnippet(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 420);
}

export function companyNameFromUrl(companyUrl) {
  const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');
  return hostname.split('.')[0].replace(/[-_]/g, ' ');
}

// Community posts are useful interview signals, but never verified company facts.
export async function searchInterviewDiscussions(companyName, { fetcher = fetch, retries = 2 } = {}) {
  const url = new URL(REDDIT_SEARCH_URL);
  url.searchParams.set('q', `${companyName} interview experience`);
  url.searchParams.set('limit', String(MAX_RESULTS));
  url.searchParams.set('sort', 'relevance');
  url.searchParams.set('t', 'all');

  let lastError;
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
      return { sources, error: null, provider: 'reddit-public-search' };
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await pause(300 * (2 ** attempt));
    }
  }
  return { sources: [], error: lastError?.message || 'Interview discussion search failed', provider: 'reddit-public-search' };
}
