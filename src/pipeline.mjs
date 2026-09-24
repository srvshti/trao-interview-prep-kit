import { allocateSchedule, createKit, findCoverageGaps, validateKit } from './core.mjs';
import { generateQuestionDrafts } from './ai-generation.mjs';
import { repairCoverage } from './generation.mjs';
import { researchCompany } from './research.mjs';

function partialResearchBrief(error) {
  return {
    summary: 'Company research could not be completed. The kit was generated from the job description only.',
    what_they_do: 'No verified company context was retrieved.',
    sources: [],
    retrieval_error: error instanceof Error ? error.message : 'Unknown research error'
  };
}

function sourceUrl(source) {
  return typeof source === 'string' ? source : source?.url;
}

function normalizeCompanyBrief(brief) {
  return {
    ...brief,
    summary: brief?.summary?.trim() || 'No company summary was found on the supplied pages.',
    what_they_do: brief?.what_they_do?.trim() || 'No verified company context was retrieved.',
    sources: Array.isArray(brief?.sources) ? brief.sources : [],
    interview_process: {
      ...brief?.interview_process,
      summary: brief?.interview_process?.summary?.trim() || 'No public interview discussion was retrieved.',
      sources: Array.isArray(brief?.interview_process?.sources) ? brief.interview_process.sources : []
    }
  };
}

export async function buildKit(input, { researcher = researchCompany, allowPrivateNetwork = false } = {}) {
  const draft = createKit(input);
  let companyBrief;
  let audit;

  try {
    const research = await researcher(input.company_url, { allowPrivateNetwork });
    companyBrief = normalizeCompanyBrief(research.companyBrief);
    audit = research.audit;
  } catch (error) {
    companyBrief = normalizeCompanyBrief(partialResearchBrief(error));
    audit = { pages_requested: 0, pages_retrieved: 0, fetch_errors: [{ url: input.company_url, error: companyBrief.retrieval_error }], provider: 'public-web-retrieval' };
  }

  const generation = await generateQuestionDrafts(draft.role.requirements, companyBrief);
  const repaired = repairCoverage(draft.role.requirements, generation.questions);
  const uncovered = findCoverageGaps(draft.role.requirements, repaired.questions);
  const kit = {
    ...draft,
    source: {
      ...draft.source,
      researched_at: new Date().toISOString(),
      pages_used: (companyBrief.sources || []).map(sourceUrl).filter(Boolean)
    },
    company_brief: {
      ...companyBrief,
      sources: (companyBrief.sources || []).map(sourceUrl).filter(Boolean)
    },
    questions: repaired.questions,
    schedule: allocateSchedule(repaired.questions, draft.role.requirements, Number(input.days)),
    coverage: { uncovered_requirement_ids: uncovered, repaired_requirement_ids: repaired.repaired_requirement_ids, passes: 2 },
    research_audit: audit,
    generation_audit: { provider: generation.provider, errors: generation.errors }
  };
  const errors = validateKit(kit);
  if (errors.length) throw new Error(`invalid kit: ${errors.join('; ')}`);
  return kit;
}
