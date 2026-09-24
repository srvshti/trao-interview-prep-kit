import { buildKit } from '../../../src/pipeline.mjs';
import { sessionCookie, store } from '../../../src/storage.mjs';
import { submissionDeduper, submissionFingerprint } from '../../../src/submission-dedup.mjs';

export async function GET(request) {
  const user = await store.getSessionUser(request.cookies.get(sessionCookie.name)?.value);
  if (!user) return Response.json({ status: 'error', error: 'Sign in to access saved kits' }, { status: 401 });
  return Response.json({ status: 'ok', kits: await store.listKits(user.id) });
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const user = await store.getSessionUser(request.cookies.get(sessionCookie.name)?.value);
    const fingerprint = submissionFingerprint({ jd: payload.jd, companyUrl: payload.companyUrl, days: payload.days });
    if (user) {
      const existing = await store.findKitByFingerprint(user.id, fingerprint);
      if (existing) return Response.json({ status: 'ok', kit: existing.kit, saved: true, savedId: existing.id, idempotent_replay: true });
    }
    const result = await submissionDeduper.run(`${user?.id || 'anonymous'}:${fingerprint}`, async () => {
      const kit = await buildKit({
        id: payload.id || crypto.randomUUID(),
        jd: payload.jd,
        company_url: payload.companyUrl,
        days: Number(payload.days)
      });
      kit.source.request_fingerprint = fingerprint;
      const saved = user ? await store.saveKit(user.id, kit) : null;
      return { kit, saved: Boolean(saved), savedId: saved?.id || null };
    });
    return Response.json({ status: 'ok', ...result.value, idempotent_replay: result.replayed });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Could not build preparation kit' }, { status: 400 });
  }
}
