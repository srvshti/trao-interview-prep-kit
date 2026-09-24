import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFileStore } from '../src/storage.mjs';

test('stores an account, authenticates it, and keeps kits private to that user', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'trao-store-'));
  try {
    const localStore = createFileStore(path.join(directory, 'store.json'));
    const firstUser = await localStore.createUser({ email: 'first@example.com', password: 'correct-horse' });
    const secondUser = await localStore.createUser({ email: 'second@example.com', password: 'correct-horse' });
    const verified = await localStore.verifyUser({ email: 'first@example.com', password: 'correct-horse' });
    assert.equal(verified.id, firstUser.id);
    const session = await localStore.createSession(firstUser.id);
    assert.equal((await localStore.getSessionUser(session.token)).email, 'first@example.com');
    await localStore.saveKit(firstUser.id, { source: { request_fingerprint: 'request-1' }, role: { title: 'Backend Engineer' } });
    assert.equal((await localStore.listKits(firstUser.id)).length, 1);
    assert.equal((await localStore.listKits(secondUser.id)).length, 0);
    assert.equal((await localStore.findKitByFingerprint(firstUser.id, 'request-1')).kit.role.title, 'Backend Engineer');
    const [savedKit] = await localStore.listKits(firstUser.id);
    await localStore.updateKit(firstUser.id, savedKit.id, { role: { title: 'Updated Backend Engineer' } });
    assert.equal((await localStore.listKits(firstUser.id))[0].kit.role.title, 'Updated Backend Engineer');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
