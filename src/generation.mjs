const SYSTEM_DESIGN_MARKERS = /\b(api|service|system|database|distributed|scale|architecture|pipeline|cloud|performance)\b/i;
const DEBUGGING_MARKERS = /\b(debug|troubleshoot|reliab|incident|monitor|test|quality)\b/i;

function questionPrompt(requirement, companyBrief) {
  const context = companyBrief?.what_they_do ? ' Tie the answer to the company context supplied in the research evidence.' : '';
  if (requirement.kind === 'behavioural') {
    return `Tell me about a specific time you demonstrated ${requirement.text}. Use a concise STAR answer and name the measurable outcome.${context}`;
  }
  if (DEBUGGING_MARKERS.test(requirement.text)) {
    return `Describe how you would investigate and resolve a failure related to: ${requirement.text}.${context}`;
  }
  if (SYSTEM_DESIGN_MARKERS.test(requirement.text)) {
    return `How would you design a reliable solution for: ${requirement.text}? Explain assumptions, trade-offs, and how you would validate it.${context}`;
  }
  return `How would you apply or explain ${requirement.text} in this role? Ground the answer in one concrete example or trade-off.${context}`;
}

export function generateQuestions(requirements, companyBrief) {
  return requirements.map((requirement, index) => ({
    id: `q${index + 1}`,
    requirement_ids: [requirement.id],
    category: requirement.kind === 'behavioural' ? 'behavioural' : 'technical',
    prompt: questionPrompt(requirement, companyBrief),
    answer_outline: requirement.kind === 'behavioural'
      ? 'Situation, task, actions you personally took, result, and what you learned.'
      : 'Clarify assumptions, describe the approach, call out the trade-off, then explain validation and monitoring.',
    difficulty: requirement.priority === 'must' ? 2 : 1,
    evidence: companyBrief?.sources?.map((source) => source.url) || []
  }));
}

export function repairCoverage(requirements, questions) {
  const covered = new Set(questions.flatMap((question) => question.requirement_ids));
  const gaps = requirements.filter((requirement) => requirement.priority === 'must' && !covered.has(requirement.id));
  const repairs = gaps.map((requirement, index) => ({
    id: `q-repair-${index + 1}`,
    requirement_ids: [requirement.id],
    category: requirement.kind === 'behavioural' ? 'behavioural' : 'technical',
    prompt: `Coverage check: explain how you meet ${requirement.text}.`,
    answer_outline: 'Give a focused explanation and one evidence-backed example.',
    difficulty: 2,
    evidence: []
  }));
  return { questions: [...questions, ...repairs], repaired_requirement_ids: gaps.map((requirement) => requirement.id) };
}
