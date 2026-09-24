import { createHash } from 'node:crypto';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function submissionFingerprint({ jd, companyUrl, days }) {
  const normalized = [String(jd || '').trim().replace(/\s+/g, ' '), String(companyUrl || '').trim().toLowerCase(), String(days)].join('\n');
  return createHash('sha256').update(normalized).digest('hex');
}

export function createSubmissionDeduper({ ttlMs = DEFAULT_TTL_MS } = {}) {
  const entries = new Map();
  return {
    async run(key, work) {
      const now = Date.now();
      const existing = entries.get(key);
      if (existing && existing.expiresAt > now) return { value: await existing.promise, replayed: true };

      const entry = { expiresAt: now + ttlMs, promise: Promise.resolve().then(work) };
      entries.set(key, entry);
      entry.promise.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return { value: await entry.promise, replayed: false };
    }
  };
}

export const submissionDeduper = createSubmissionDeduper();
