import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKit } from '../src/pipeline.mjs';

const input = {
  id: 'pipeline-case',
  jd: 'Backend Engineer\nRequired: Python and REST APIs.\nRequired: Collaborate with stakeholders.',
  company_url: 'http://localhost:8099/acme/',
  days: 2
};

test('builds a researched kit through one shared pipeline', async () => {
  const kit = await buildKit(input, {
    allowPrivateNetwork: true,
    researcher: async () => ({
      companyBrief: { summary: 'Acme builds workflow software.', what_they_do: 'Workflow software.', sources: [{ url: 'http://localhost:8099/acme/about', title: 'About' }] },
      audit: { pages_requested: 2, pages_retrieved: 2, fetch_errors: [], provider: 'test' }
    })
  });
  assert.equal(kit.company_brief.summary, 'Acme builds workflow software.');
  assert.deepEqual(kit.source.pages_used, ['http://localhost:8099/acme/about']);
  assert.equal(kit.research_audit.pages_retrieved, 2);
  assert.deepEqual(kit.coverage.uncovered_requirement_ids, []);
});

test('keeps a kit usable when company research fails', async () => {
  const kit = await buildKit(input, { researcher: async () => { throw new Error('Timed out'); } });
  assert.match(kit.company_brief.summary, /could not be completed/i);
  assert.equal(kit.research_audit.fetch_errors.length, 1);
  assert.deepEqual(kit.coverage.uncovered_requirement_ids, []);
});
