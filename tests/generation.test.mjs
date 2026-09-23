import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQuestions, repairCoverage } from '../src/generation.mjs';
import { selectRelevantLinks } from '../src/research.mjs';

test('uses research context while generating a technical question', () => {
  const [question] = generateQuestions([{ id: 'r1', text: 'Build reliable APIs', kind: 'technical', priority: 'must' }], {
    what_they_do: 'The company provides payment infrastructure.',
    sources: [{ url: 'https://example.com/about' }]
  });
  assert.match(question.prompt, /company context/i);
  assert.deepEqual(question.evidence, ['https://example.com/about']);
});

test('adds a second-pass question for a missing must-have requirement', () => {
  const result = repairCoverage([{ id: 'r1', text: 'SQL', kind: 'technical', priority: 'must' }], []);
  assert.equal(result.questions.length, 1);
  assert.deepEqual(result.repaired_requirement_ids, ['r1']);
});

test('selects only high-signal same-origin research links', () => {
  const selected = selectRelevantLinks('https://example.com', [
    { url: 'https://example.com/careers', label: 'Careers' },
    { url: 'https://another.example/about', label: 'About us' },
    { url: 'https://example.com/blog', label: 'Blog' }
  ]);
  assert.deepEqual(selected, [{ url: 'https://example.com/careers', label: 'Careers' }]);
});
