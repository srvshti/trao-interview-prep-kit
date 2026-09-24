import { fetchPublicPage, parsePublicHttpUrl } from './retrieval.mjs';
import { companyNameFromUrl, searchInterviewDiscussions } from './interview-research.mjs';

const PAGE_HINTS = /\b(about|career|careers|culture|company|mission|values|team|life|hiring|interview|process)\b/i;
const MAX_DISCOVERED_PAGES = 4;

function pageScore(link) {
  const value = `${link.label} ${link.url}`;
  const matches = value.match(new RegExp(PAGE_HINTS.source, 'gi'))?.length || 0;
  return matches * 10 - link.url.length / 10;
}

export function selectRelevantLinks(rootUrl, links, options = {}) {
  const root = parsePublicHttpUrl(rootUrl, options);
  const seen = new Set([root.toString()]);
  return links
    .filter((link) => {
      try {
        const url = parsePublicHttpUrl(link.url, options);
        return url.origin === root.origin && PAGE_HINTS.test(`${link.label} ${url.pathname}`) && !seen.has(url.toString());
      } catch {
        return false;
      }
    })
    .sort((a, b) => pageScore(b) - pageScore(a))
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, MAX_DISCOVERED_PAGES);
}

function firstUsefulSentence(text) {
  return text.split(/(?<=[.!?])\s+/).find((sentence) => sentence.length >= 60)?.slice(0, 500) || text.slice(0, 500);
}

async function pause(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchPublicPage(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await pause(250 * (2 ** attempt));
    }
  }
  throw lastError;
}

export async function researchCompany(companyUrl, { interviewSearcher = searchInterviewDiscussions, ...options } = {}) {
  const root = await fetchWithRetry(companyUrl, options);
  const selected = selectRelevantLinks(root.url, root.links, options);
  const pages = [root];
  const fetchErrors = [];

  for (const link of selected) {
    try {
      await pause(150);
      pages.push(await fetchWithRetry(link.url, options));
    } catch (error) {
      fetchErrors.push({ url: link.url, error: error.message || 'Page could not be retrieved' });
    }
  }

  const summaries = pages.map((page) => page.description || firstUsefulSentence(page.text)).filter(Boolean);
  let interviewResearch;
  try {
    interviewResearch = await interviewSearcher(companyNameFromUrl(companyUrl));
  } catch (error) {
    // Interview chatter is supplementary; it must not block company-site research.
    interviewResearch = {
      sources: [],
      error: error.message || 'Interview discussion search failed',
      provider: 'public-interview-search'
    };
  }
  const interviewSummary = interviewResearch.sources.map((source) => source.snippet).filter(Boolean).join(' ').slice(0, 900);
  return {
    companyBrief: {
      summary: summaries[0] || 'No company summary was found on the supplied pages.',
      what_they_do: summaries.slice(0, 3).join(' '),
      interview_process: {
        summary: interviewSummary || 'No public interview discussion was retrieved.',
        sources: interviewResearch.sources
      },
      sources: [
        ...pages.map((page) => ({ url: page.url, title: page.title, retrieved_at: page.retrievedAt, source_type: 'company-site' })),
        ...interviewResearch.sources
      ]
    },
    audit: {
      pages_requested: 1 + selected.length,
      pages_retrieved: pages.length,
      fetch_errors: fetchErrors,
      interview_discussion: { provider: interviewResearch.provider, results: interviewResearch.sources.length, error: interviewResearch.error },
      provider: 'public-web-retrieval'
    }
  };
}
