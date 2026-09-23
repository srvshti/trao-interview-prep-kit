import { generateQuestions, repairCoverage } from '../../../../src/generation.mjs';

export async function POST(request) {
  try {
    const { requirements = [], companyBrief = null, revision = 1 } = await request.json();
    if (!Array.isArray(requirements) || !Number.isInteger(revision) || revision < 1) {
      throw new Error('requirements and a positive integer revision are required');
    }

    const generated = repairCoverage(
      requirements,
      generateQuestions(requirements, companyBrief, { variation: revision })
    );

    return Response.json({
      status: 'ok',
      questions: generated.questions,
      coverage: { repaired_requirement_ids: generated.repaired_requirement_ids, passes: 2 },
      revision
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Questions could not be regenerated' }, { status: 400 });
  }
}
