import dns from 'node:dns/promises';

const MAX_RESPONSE_BYTES = 750_000;
const DEFAULT_TIMEOUT_MS = 8_000;

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) return false;

  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAttribute(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

function extractLinks(html, baseUrl) {
  const links = new Map();
  const expression = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(expression)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      const label = stripHtml(match[2]).slice(0, 120);
      links.set(url.toString(), { url: url.toString(), label });
    } catch {
      // Malformed or unsupported links are intentionally ignored.
    }
  }
  return [...links.values()].slice(0, 150);
}

export function parsePublicHttpUrl(value, { allowPrivateNetwork = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('URL must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http and https URLs are allowed');
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed');

  const hostname = url.hostname.toLowerCase();
  if (!allowPrivateNetwork && (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    || isPrivateIpv4(hostname) || isPrivateIpv6(hostname))) {
    throw new Error('Local or private network URLs are not allowed');
  }
  return url;
}

export async function assertPublicDns(url, { allowPrivateNetwork = false } = {}) {
  const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!records.length) throw new Error('Domain did not resolve');
  if (!allowPrivateNetwork && records.some((record) => isPrivateIpv4(record.address) || isPrivateIpv6(record.address))) {
    throw new Error('URL resolves to a private network address');
  }
}

function robotsAllows(text, pathname, userAgent = 'TraoInterviewPrepBot') {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let applies = false;
  const blockedPaths = [];
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [rawKey, ...rawValue] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.join(':').trim();
    if (key === 'user-agent') applies = value === '*' || value.toLowerCase() === userAgent.toLowerCase();
    if (applies && key === 'disallow' && value) blockedPaths.push(value);
  }
  return !blockedPaths.some((path) => pathname.startsWith(path));
}

async function fetchWithLimits(url, { timeoutMs = DEFAULT_TIMEOUT_MS, accept = 'text/html,text/plain;q=0.9,*/*;q=0.1' } = {}) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'TraoInterviewPrepBot/0.1 (educational assessment)', accept },
    redirect: 'error', signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    throw new Error(`Unsupported content type: ${contentType || 'unknown'}`);
  }
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_RESPONSE_BYTES) throw new Error('Response exceeded maximum allowed size');
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_RESPONSE_BYTES) throw new Error('Response exceeded maximum allowed size');
  return { contentType, text: new TextDecoder().decode(body) };
}

export async function fetchPublicPage(rawUrl, { allowPrivateNetwork = false, ...fetchOptions } = {}) {
  const url = parsePublicHttpUrl(rawUrl, { allowPrivateNetwork });
  await assertPublicDns(url, { allowPrivateNetwork });
  const robotsUrl = new URL('/robots.txt', url.origin);
  try {
    const robots = await fetchWithLimits(robotsUrl, { ...fetchOptions, accept: 'text/plain,*/*;q=0.1' });
    if (!robotsAllows(robots.text, url.pathname)) throw new Error('This path is disallowed by robots.txt');
  } catch (error) {
    if (error.message === 'This path is disallowed by robots.txt') throw error;
  }

  const page = await fetchWithLimits(url, fetchOptions);
  const title = extractAttribute(page.text, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = extractAttribute(page.text, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    || extractAttribute(page.text, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  return {
    url: url.toString(),
    title: title ? stripHtml(title) : null,
    description,
    text: stripHtml(page.text).slice(0, 60_000),
    links: extractLinks(page.text, url),
    retrievedAt: new Date().toISOString()
  };
}
