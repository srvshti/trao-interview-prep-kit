import { createKit } from '../../../src/core.mjs';
import { sessionCookie, store } from '../../../src/storage.mjs';

export async function GET(request) {
  const user = await store.getSessionUser(request.cookies.get(sessionCookie.name)?.value);
  if (!user) return Response.json({ status: 'error', error: 'Sign in to access saved kits' }, { status: 401 });
  return Response.json({ status: 'ok', kits: await store.listKits(user.id) });
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const kit = createKit({
      id: payload.id || crypto.randomUUID(),
      jd: payload.jd,
      company_url: payload.companyUrl,
      days: Number(payload.days)
    });
    const user = await store.getSessionUser(request.cookies.get(sessionCookie.name)?.value);
    const saved = user ? await store.saveKit(user.id, kit) : null;
    return Response.json({ status: 'ok', kit, saved: Boolean(saved), savedId: saved?.id || null });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Could not build preparation kit' }, { status: 400 });
  }
}
