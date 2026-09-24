import { allocateSchedule } from '../../../../src/core.mjs';

export async function POST(request) {
  try {
    const { questions = [], requirements = [], days } = await request.json();
    if (!Array.isArray(questions) || !Array.isArray(requirements) || !Number.isInteger(days)) {
      throw new Error('questions, requirements, and integer days are required');
    }
    return Response.json({ status: 'ok', schedule: allocateSchedule(questions, requirements, days) });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message || 'Schedule could not be regenerated' }, { status: 400 });
  }
}
