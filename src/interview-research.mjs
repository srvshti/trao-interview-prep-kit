const REDDIT_SEARCH_URL = 'https://www.reddit.com/search.json';
const HACKER_NEWS_SEARCH_URL = 'https://hn.algolia.com/api/v1/search';
const MAX_RESULTS = 3;

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cleanSnippet(text) {
  return String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 420);
}

function normalizeForMatch(value) {
  return cleanSnippet(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function roleTerms(roleTitle) {
  const ignored = new Set(['senior', 'junior', 'associate', 'staff', 'principal', 'lead', 'intern', 'trainee', 'level']);
  return [...new Set(normalizeForMatch(roleTitle).split(' ').filter((term) => term.length >= 3 && !ignored.has(term)))];
}

function buildSearchPlans(companyName, roleTitle) {
  const role = cleanSnippet(roleTitle);
  return [
    ...(role ? [{ query: `${companyName} ${role} interview`, scope: 'role-specific' }] : []),
    { query: `${companyName} interview experience`, scope: 'company-wide' }
  ];
}

function roleRelevance(source, companyName, roleTitle, scope) {
  const content = normalizeForMatch(`${source.title} ${source.url} ${source.snippet}`);
  const company = normalizeForMatch(companyName);
  if (!company || !content.includes(company)) return null;
  if (scope === 'company-wide') return 'company-wide';

  const terms = roleTerms(roleTitle);
  if (!terms.length) return 'company-wide';
  const matchedTerms = terms.filter((term) => content.includes(term));
  if (matchedTerms.length === terms.length) return 'exact-role';
  if (matchedTerms.length > 0) return 'related-role';
  return null;
}

function withRelevance(source, companyName, roleTitle, scope) {
  const relevance = roleRelevance(source, companyName, roleTitle, scope);
  return relevance ? { ...source, role_relevance: relevance } : null;
}

export function companyNameFromUrl(companyUrl) {
  const hostname = new URL(companyUrl).hostname.replace(/^www\./, '');
  return hostname.split('.')[0].replace(/[-_]/g, ' ');
}

// Community posts are useful interview signals, but never verified company facts.
// The exact role is searched before company-wide discussion so a backend kit does
// not silently inherit advice intended for an unrelated role.
export async function searchInterviewDiscussions(companyName, { roleTitle = '', fetcher = fetch, retries = 2 } = {}) {
  const plans = buildSearchPlans(companyName, roleTitle);
  let lastError;

  for (const [planIndex, plan] of plans.entries()) {
    const reddit = await searchRedditDiscussion(companyName, roleTitle, plan, { fetcher, retries });
    if (reddit.sources.length) return reddit;
    lastError = reddit.error || lastError;

    const hackerNews = await searchHackerNewsInterviewDiscussions(companyName, roleTitle, plan, { fetcher, retries });
    if (hackerNews.sources.length) return hackerNews;
    lastError = hackerNews.error || lastError;

    if (planIndex < plans.length - 1) await pause(250);
  }

  return {
    sources: [],
    error: lastError || 'No citable public interview discussion was found.',
    provider: 'public-interview-search'
  };
}

async function searchRedditDiscussion(companyName, roleTitle, plan, { fetcher, retries }) {
  const url = new URL(REDDIT_SEARCH_URL);
  url.searchParams.set('q', plan.query);
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
      if (!response.ok) throw new Error(`Reddit interview discussion search returned HTTP ${response.status}`);
      const payload = await response.json();
      const sources = (payload?.data?.children || [])
        .map((child) => child?.data)
        .filter((post) => post?.title && post?.permalink)
        .map((post) => withRelevance({
          url: `https://www.reddit.com${post.permalink}`,
          title: cleanSnippet(post.title),
          snippet: cleanSnippet(post.selftext || post.title),
          retrieved_at: new Date().toISOString(),
          source_type: 'public-interview-discussion'
        }, companyName, roleTitle, plan.scope))
        .filter(Boolean)
        .slice(0, MAX_RESULTS);
      return { sources, error: null, provider: 'reddit-public-search' };
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await pause(300 * (2 ** attempt));
    }
  }
  return { sources: [], error: lastError?.message || 'Reddit interview discussion search failed', provider: 'reddit-public-search' };
}

async function searchHackerNewsInterviewDiscussions(companyName, roleTitle, plan, { fetcher, retries }) {
  const url = new URL(HACKER_NEWS_SEARCH_URL);
  url.searchParams.set('query', plan.query);
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
        .map((source) => withRelevance(source, companyName, roleTitle, plan.scope))
        .filter(Boolean)
        .slice(0, MAX_RESULTS);
      return { sources, error: sources.length ? null : 'No citable Hacker News interview discussion was found.', provider: 'hacker-news-public-search' };
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await pause(300 * (2 ** attempt));
    }
  }
  return { sources: [], error: lastError?.message || 'Hacker News interview discussion search failed', provider: 'hacker-news-public-search' };
}
