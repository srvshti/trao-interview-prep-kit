import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseStore } from '../src/storage.mjs';

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('Supabase adapter creates a user without returning credential material', async () => {
  const calls = [];
  const store = createSupabaseStore({
    url: 'https://project.supabase.co/',
    serviceRoleKey: 'server-only-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === 'GET') return jsonResponse([]);
      if (options.method === 'POST') return jsonResponse([JSON.parse(options.body)]);
      throw new Error(`Unexpected request: ${options.method}`);
    }
  });

  const user = await store.createUser({ email: 'candidate@example.com', password: 'correct-horse' });

  assert.equal(user.email, 'candidate@example.com');
  assert.equal(Object.hasOwn(user, 'password'), false);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /app_users\?select=/);
  assert.equal(calls[1].options.headers.apikey, 'server-only-key');
  assert.equal(JSON.parse(calls[1].options.body).password.hash.length, 128);
});

test('Supabase adapter scopes saved-kit reads to the signed-in user', async () => {
  const store = createSupabaseStore({
    url: 'https://project.supabase.co',
    serviceRoleKey: 'server-only-key',
    fetchImpl: async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.match(url, /user_id=eq.user-123/);
      return jsonResponse([{ id: 'kit-1', kit: { role: { title: 'Backend Engineer' } }, created_at: '2026-01-01', updated_at: '2026-01-02' }]);
    }
  });

  const kits = await store.listKits('user-123');
  assert.equal(kits[0].id, 'kit-1');
  assert.equal(kits[0].kit.role.title, 'Backend Engineer');
});
