import { sessionCookie, store } from '../../../../src/storage.mjs';

export async function PUT(request, { params }) {
  try {
    const user = await store.getSessionUser(request.cookies.get(sessionCookie.name)?.value);
    if (!user) return Response.json({ status: 'error', error: 'Sign in to save kit changes' }, { status: 401 });
    const { kit } = await request.json();
    const { id } = await params;
    const saved = await store.updateKit(user.id, id, kit);
    return Response.json({ status: 'ok', saved });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Kit could not be saved' }, { status: 400 });
  }
}
