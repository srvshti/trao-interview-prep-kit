import { sessionCookie, store } from '../../../../src/storage.mjs';

export async function GET(request) {
  const user = await store.getSessionUser(request.cookies.get(sessionCookie.name)?.value);
  return Response.json({ user });
}
