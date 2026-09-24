import { generateFlashcards } from '../../../../src/generation.mjs';

export async function POST(request) {
  try {
    const { requirements = [] } = await request.json();
    if (!Array.isArray(requirements)) throw new Error('requirements must be an array');
    return Response.json({ status: 'ok', flashcards: generateFlashcards(requirements) });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Flashcards could not be regenerated' }, { status: 400 });
  }
}
