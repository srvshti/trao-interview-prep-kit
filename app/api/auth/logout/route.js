import { sessionCookie, store } from '../../../../src/storage.mjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  await store.revokeSession(request.cookies.get(sessionCookie.name)?.value);
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set(sessionCookie.name, '', { ...sessionCookie.options, maxAge: 0 });
  return response;
}
