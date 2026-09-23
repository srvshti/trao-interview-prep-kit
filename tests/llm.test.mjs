import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQuestionDrafts } from '../src/ai-generation.mjs';
import { generateGeminiJson } from '../src/llm.mjs';

test('retries a rate-limited Gemini request and parses JSON output', async () => {
  let calls = 0;
  const result = await generateGeminiJson({
    env: { GEMINI_API_KEY: 'test-key' },
    retries: 2,
    fetcher: async () => {
      calls += 1;
      if (calls === 1) return new Response('slow down', { status: 429 });
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    }
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
});

test('keeps validated LLM questions and falls back when a category response is invalid', async () => {
  const requirements = [{ id: 'r1', text: 'Required: Python.', kind: 'technical', priority: 'must' }];
  const result = await generateQuestionDrafts(requirements, null, {
    configured: true,
    generator: async () => ({ questions: [{ id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'Explain how you would use Python to build a reliable API.', answer_outline: 'Clarify needs, explain the design, and validate it with tests.', difficulty: 2 }] })
  });
  assert.equal(result.provider, 'gemini');
  assert.match(result.questions[0].prompt, /reliable API/);
});
