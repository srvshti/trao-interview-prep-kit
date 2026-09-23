import { allocateSchedule, createKit, findCoverageGaps, validateKit } from './core.mjs';
import { generateQuestions, repairCoverage } from './generation.mjs';
import { researchCompany } from './research.mjs';

function partialResearchBrief(error) {
  return {
    summary: 'Company research could not be completed. The kit was generated from the job description only.',
    what_they_do: 'No verified company context was retrieved.',
    sources: [],
    retrieval_error: error instanceof Error ? error.message : 'Unknown research error'
  };
}

export async function buildKit(input, { researcher = researchCompany, allowPrivateNetwork = false } = {}) {
  const draft = createKit(input);
  let companyBrief;
  let audit;

  try {
    const research = await researcher(input.company_url, { allowPrivateNetwork });
    companyBrief = research.companyBrief;
    audit = research.audit;
  } catch (error) {
    companyBrief = partialResearchBrief(error);
    audit = { pages_requested: 0, pages_retrieved: 0, fetch_errors: [{ url: input.company_url, error: companyBrief.retrieval_error }], provider: 'public-web-retrieval' };
  }

  const firstPassQuestions = generateQuestions(draft.role.requirements, companyBrief);
  const repaired = repairCoverage(draft.role.requirements, firstPassQuestions);
  const uncovered = findCoverageGaps(draft.role.requirements, repaired.questions);
  const kit = {
    ...draft,
    source: {
      ...draft.source,
      researched_at: new Date().toISOString(),
      pages_used: companyBrief.sources.map((source) => source.url)
    },
    company_brief: companyBrief,
    questions: repaired.questions,
    schedule: allocateSchedule(repaired.questions, draft.role.requirements, Number(input.days)),
    coverage: { uncovered_requirement_ids: uncovered, repaired_requirement_ids: repaired.repaired_requirement_ids, passes: 2 },
    research_audit: audit
  };
  const errors = validateKit(kit);
  if (errors.length) throw new Error(`invalid kit: ${errors.join('; ')}`);
  return kit;
}
