import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePublicHttpUrl } from '../src/retrieval.mjs';

test('accepts a normal public https URL', () => {
  const url = parsePublicHttpUrl('https://example.com/careers');
  assert.equal(url.hostname, 'example.com');
});

test('rejects local and private URL targets', () => {
  for (const url of ['http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.4', 'http://192.168.1.10']) {
    assert.throws(() => parsePublicHttpUrl(url), /not allowed/);
  }
});

test('allows local URLs only when an explicit evaluator option is supplied', () => {
  const url = parsePublicHttpUrl('http://localhost:8099/acme/', { allowPrivateNetwork: true });
  assert.equal(url.hostname, 'localhost');
});

test('rejects non-http protocols and credential URLs', () => {
  assert.throws(() => parsePublicHttpUrl('file:///etc/passwd'), /Only http and https/);
  assert.throws(() => parsePublicHttpUrl('https://user:secret@example.com'), /credentials/);
});
