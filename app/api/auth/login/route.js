import { sessionCookie, store } from '../../../../src/storage.mjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const user = await store.verifyUser({ email, password });
    const session = await store.createSession(user.id);
    const response = NextResponse.json({ status: 'ok', user });
    response.cookies.set(sessionCookie.name, session.token, sessionCookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ status: 'error', error: error.message || 'Could not sign in' }, { status: 400 });
  }
}
