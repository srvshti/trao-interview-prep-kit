import assert from 'node:assert/strict';
import test from 'node:test';
import { generateFlashcards, generateQuestions, generateQuestionsForCategory, repairCoverage } from '../src/generation.mjs';
import { selectRelevantLinks } from '../src/research.mjs';

test('uses research context while generating a technical question', () => {
  const [question] = generateQuestions([{ id: 'r1', text: 'Build reliable APIs', kind: 'technical', priority: 'must' }], {
    what_they_do: 'The company provides payment infrastructure.',
    sources: [{ url: 'https://example.com/about' }]
  });
  assert.match(question.prompt, /company context/i);
  assert.deepEqual(question.evidence, ['https://example.com/about']);
});

test('uses role-relevant interview evidence without treating it as company fact', () => {
  const [question] = generateQuestions([{ id: 'r1', text: 'Build reliable APIs', kind: 'technical', priority: 'must' }], {
    interview_process: {
      summary: 'Role-specific candidate reports mention a system-design exercise.',
      sources: [{ role_relevance: 'exact-role', snippet: 'System design exercise.' }]
    },
    sources: []
  });
  assert.match(question.prompt, /candidate reports relevant to this role/i);
  assert.match(question.prompt, /not present it as verified company policy/i);
});

test('adds format-specific practice when company research reports a take-home and system-design round', () => {
  const questions = generateQuestions([{ id: 'r1', text: 'Design Node.js REST APIs', kind: 'technical', priority: 'must' }], {
    interview_process: {
      summary: 'A company-published page mentions a take-home assignment followed by a system-design round.',
      sources: [{ url: 'https://example.com/interview-process' }]
    },
    sources: []
  });
  const formatQuestions = questions.filter((question) => question.id.startsWith('q-format-'));
  assert.deepEqual(formatQuestions.map((question) => question.id), ['q-format-take-home', 'q-format-system-design']);
  assert.ok(formatQuestions.every((question) => question.difficulty === 3));
  assert.ok(formatQuestions.every((question) => question.requirement_ids.includes('r1')));
});

test('uses a distinct prompt template for a later regeneration revision', () => {
  const requirements = [{ id: 'r1', text: 'TypeScript and REST APIs', kind: 'technical', priority: 'must' }];
  const initial = generateQuestions(requirements, null)[0];
  const regenerated = generateQuestions(requirements, null, { variation: 1 })[0];
  const laterRegeneration = generateQuestions(requirements, null, { variation: 4 })[0];
  assert.notEqual(regenerated.prompt, initial.prompt);
  assert.notEqual(laterRegeneration.prompt, regenerated.prompt);
  assert.equal(regenerated.id, initial.id);
});

test('generates only the requested question category', () => {
  const requirements = [
    { id: 'r1', text: 'Build REST APIs', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Collaborate with stakeholders', kind: 'behavioural', priority: 'must' }
  ];
  const questions = generateQuestionsForCategory(requirements, null, { category: 'behavioural', variation: 1 });
  assert.equal(questions.length, 1);
  assert.equal(questions[0].category, 'behavioural');
  assert.deepEqual(questions[0].requirement_ids, ['r2']);
});

test('adds a second-pass question for a missing must-have requirement', () => {
  const result = repairCoverage([{ id: 'r1', text: 'SQL', kind: 'technical', priority: 'must' }], []);
  assert.equal(result.questions.length, 1);
  assert.deepEqual(result.repaired_requirement_ids, ['r1']);
});

test('creates concrete flashcards for Node.js and SQL requirements', () => {
  const cards = generateFlashcards([
    { id: 'r1', text: 'Node.js', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'SQL', kind: 'technical', priority: 'must' }
  ]);
  assert.match(cards[0].front, /production-ready create endpoint/i);
  assert.match(cards[1].front, /prevent duplicate/i);
});

test('selects only high-signal same-origin research links', () => {
  const selected = selectRelevantLinks('https://example.com', [
    { url: 'https://example.com/careers', label: 'Careers' },
    { url: 'https://another.example/about', label: 'About us' },
    { url: 'https://example.com/blog', label: 'Blog' }
  ]);
  assert.deepEqual(selected, [{ url: 'https://example.com/careers', label: 'Careers' }]);
});
