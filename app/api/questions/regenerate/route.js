import { generateQuestionsForCategory } from '../../../../src/generation.mjs';

export async function POST(request) {
  try {
    const { requirements = [], companyBrief = null, category, revision = 1 } = await request.json();
    if (!Array.isArray(requirements) || !Number.isInteger(revision) || revision < 1 || !category) {
      throw new Error('requirements, category, and a positive integer revision are required');
    }

    const questions = generateQuestionsForCategory(requirements, companyBrief, { category, variation: revision });

    return Response.json({
      status: 'ok',
      questions,
      category,
      revision
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Questions could not be regenerated' }, { status: 400 });
  }
}
