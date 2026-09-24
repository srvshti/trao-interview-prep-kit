import { generateQuestions, repairCoverage } from '../../../src/generation.mjs';
import { researchCompany } from '../../../src/research.mjs';

export async function POST(request) {
  try {
    const { companyUrl, roleTitle = '', requirements = [], includeQuestions = true } = await request.json();
    const research = await researchCompany(companyUrl, { roleTitle });
    const generated = includeQuestions
      ? repairCoverage(requirements, generateQuestions(requirements, research.companyBrief))
      : { questions: [], repaired_requirement_ids: [] };
    return Response.json({
      status: 'ok',
      companyBrief: research.companyBrief,
      questions: generated.questions,
      coverage: { repaired_requirement_ids: generated.repaired_requirement_ids, passes: 2 },
      audit: research.audit
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Company research could not be completed' }, { status: 400 });
  }
}
