import { fetchPublicPage, parsePublicHttpUrl } from './retrieval.mjs';

const PAGE_HINTS = /\b(about|career|careers|culture|company|mission|values|team|life)\b/i;
const MAX_DISCOVERED_PAGES = 4;

function pageScore(link) {
  const value = `${link.label} ${link.url}`;
  const matches = value.match(new RegExp(PAGE_HINTS.source, 'gi'))?.length || 0;
  return matches * 10 - link.url.length / 10;
}

export function selectRelevantLinks(rootUrl, links) {
  const root = parsePublicHttpUrl(rootUrl);
  const seen = new Set([root.toString()]);
  return links
    .filter((link) => {
      try {
        const url = parsePublicHttpUrl(link.url);
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

export async function researchCompany(companyUrl) {
  const root = await fetchPublicPage(companyUrl);
  const selected = selectRelevantLinks(root.url, root.links);
  const pages = [root];
  const fetchErrors = [];

  for (const link of selected) {
    try {
      pages.push(await fetchPublicPage(link.url));
    } catch (error) {
      fetchErrors.push({ url: link.url, error: error.message || 'Page could not be retrieved' });
    }
  }

  const summaries = pages.map((page) => page.description || firstUsefulSentence(page.text)).filter(Boolean);
  return {
    companyBrief: {
      summary: summaries[0] || 'No company summary was found on the supplied pages.',
      what_they_do: summaries.slice(0, 3).join(' '),
      sources: pages.map((page) => ({ url: page.url, title: page.title, retrieved_at: page.retrievedAt }))
    },
    audit: {
      pages_requested: 1 + selected.length,
      pages_retrieved: pages.length,
      fetch_errors: fetchErrors,
      provider: 'public-web-retrieval'
    }
  };
}
