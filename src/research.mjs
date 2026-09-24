import { fetchPublicPage, parsePublicHttpUrl } from './retrieval.mjs';
import { companyNameFromUrl, searchInterviewDiscussions } from './interview-research.mjs';

const PAGE_HINTS = /\b(about|career|careers|culture|company|mission|values|team|life|hiring|interview|process|products?|solutions?|platform|customers?|business)\b/i;
const MAX_DISCOVERED_PAGES = 5;

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

function uniqueSummaries(summaries) {
  const unique = [];
  for (const summary of summaries) {
    const normalized = summary.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalized || unique.some((existing) => {
      const existingNormalized = existing.toLowerCase().replace(/[^a-z0-9]/g, '');
      return existingNormalized === normalized || existingNormalized.includes(normalized) || normalized.includes(existingNormalized);
    })) continue;
    unique.push(summary);
  }
  return unique;
}

function normalizedText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isNearDuplicate(left, right) {
  const normalizedLeft = normalizedText(left);
  const normalizedRight = normalizedText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = new Set(normalizedLeft.split(' ').filter((token) => token.length > 3));
  const rightTokens = new Set(normalizedRight.split(' ').filter((token) => token.length > 3));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(1, Math.min(leftTokens.size, rightTokens.size)) >= 0.82;
}

function pageCandidates(page) {
  const sentences = String(page.text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 55 && sentence.length <= 500);
  return [page.description, ...sentences].filter(Boolean);
}

export function deriveCompanyBrief(pages) {
  const candidates = uniqueSummaries(pages.flatMap(pageCandidates));
  const summary = candidates[0] || 'No company summary was found on the supplied pages.';
  const distinctDescription = candidates.find((candidate) => !isNearDuplicate(candidate, summary));

  return {
    summary,
    what_they_do: distinctDescription
      || 'The retrieved company pages did not provide a distinct operational description beyond the summary above.'
  };
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

export async function researchCompany(companyUrl, { interviewSearcher = searchInterviewDiscussions, roleTitle = '', ...options } = {}) {
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

  const companyFacts = deriveCompanyBrief(pages);
  let interviewResearch;
  try {
    interviewResearch = await interviewSearcher(companyNameFromUrl(companyUrl), { roleTitle });
  } catch (error) {
    // Interview chatter is supplementary; it must not block company-site research.
    interviewResearch = {
      sources: [],
      error: error.message || 'Interview discussion search failed',
      provider: 'public-interview-search'
    };
  }
  const officialProcessSources = pages.flatMap((page) => {
    const formats = [];
    if (/take[ -]?home|take[ -]?home assignment/i.test(page.text)) formats.push('take-home exercise');
    if (/system design|architecture round/i.test(page.text)) formats.push('system-design discussion');
    if (!formats.length) return [];
    return [{ url: page.url, title: page.title || page.url, snippet: `Company-published page mentions: ${formats.join(' and ')}.`, source_type: 'company-site', role_relevance: 'company-wide' }];
  });
  const interviewSummary = interviewResearch.sources
    .map((source) => {
      const scope = source.role_relevance === 'exact-role'
        ? 'Role-specific discussion'
        : source.role_relevance === 'related-role'
          ? 'Related-role discussion'
          : 'Company-wide interview discussion';
      return `${scope}: ${source.snippet}`;
    })
    .filter(Boolean)
    .join(' ')
    .trim()
    .slice(0, 900);
  const officialProcessSummary = officialProcessSources.map((source) => source.snippet).join(' ');
  const sourceRecords = [
    ...pages.map((page) => ({ url: page.url, title: page.title, retrieved_at: page.retrievedAt, source_type: 'company-site' })),
    ...interviewResearch.sources
  ];
  return {
    companyBrief: {
      summary: companyFacts.summary,
      // Do not pad this field by repeating the summary. A blocked or script-rendered site can
      // yield only a page shell, and the kit should preserve that uncertainty.
      what_they_do: companyFacts.what_they_do,
      interview_process: {
        summary: [officialProcessSummary, interviewSummary].filter(Boolean).join(' ').slice(0, 900) || 'No public interview discussion was retrieved.',
        sources: [...officialProcessSources, ...interviewResearch.sources]
      },
      // Appendix A requires source URLs, while source metadata stays in the audit trail.
      sources: sourceRecords.map((source) => source.url)
    },
    audit: {
      pages_requested: 1 + selected.length,
      pages_retrieved: pages.length,
      fetch_errors: fetchErrors,
      interview_discussion: { provider: interviewResearch.provider, results: interviewResearch.sources.length, error: interviewResearch.error },
      source_records: sourceRecords,
      provider: 'public-web-retrieval'
    }
  };
}
