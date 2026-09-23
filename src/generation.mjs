const SYSTEM_DESIGN_MARKERS = /\b(api|service|system|database|distributed|scale|architecture|pipeline|cloud|performance)\b/i;
const DEBUGGING_MARKERS = /\b(debug|troubleshoot|reliab|incident|monitor|test|quality)\b/i;

function questionPrompt(requirement, companyBrief, variation = 0) {
  const context = companyBrief?.what_they_do ? ' Tie the answer to the company context supplied in the research evidence.' : '';
  const template = variation % 3;
  if (requirement.kind === 'behavioural') {
    if (template === 1) return `Describe a difficult situation where you demonstrated ${requirement.text}. Explain your decision-making, the outcome, and what you would improve.${context}`;
    if (template === 2) return `How would a teammate describe your approach to ${requirement.text}? Support your answer with one specific STAR example.${context}`;
    return `Tell me about a specific time you demonstrated ${requirement.text}. Use a concise STAR answer and name the measurable outcome.${context}`;
  }
  if (DEBUGGING_MARKERS.test(requirement.text)) {
    if (template === 1) return `A production issue affects ${requirement.text}. Walk through your triage order, the evidence you would collect, and the safe fix you would ship.${context}`;
    if (template === 2) return `What failure modes would you anticipate around ${requirement.text}, and how would you detect, diagnose, and prevent them?${context}`;
    return `Describe how you would investigate and resolve a failure related to: ${requirement.text}.${context}`;
  }
  if (SYSTEM_DESIGN_MARKERS.test(requirement.text)) {
    if (template === 1) return `Design an approach for ${requirement.text}. Start with the smallest viable version, then explain how you would evolve it for reliability and scale.${context}`;
    if (template === 2) return `What trade-offs would you make when designing for ${requirement.text}? Explain your chosen design, the alternative you rejected, and how you would test it.${context}`;
    return `How would you design a reliable solution for: ${requirement.text}? Explain assumptions, trade-offs, and how you would validate it.${context}`;
  }
  if (template === 1) return `Walk through how you have used, or would use, ${requirement.text} to deliver a feature. Explain the implementation choices and how you would verify the result.${context}`;
  if (template === 2) return `An interviewer challenges your understanding of ${requirement.text}. What would you explain first, what example would you use, and which trade-off matters most?${context}`;
  return `How would you apply or explain ${requirement.text} in this role? Ground the answer in one concrete example or trade-off.${context}`;
}

export function generateQuestions(requirements, companyBrief, { variation = 0 } = {}) {
  return requirements.map((requirement, index) => ({
    id: `q${index + 1}`,
    requirement_ids: [requirement.id],
    category: requirement.kind === 'behavioural' ? 'behavioural' : 'technical',
    prompt: questionPrompt(requirement, companyBrief, variation),
    answer_outline: requirement.kind === 'behavioural'
      ? 'Situation, task, actions you personally took, result, and what you learned.'
      : 'Clarify assumptions, describe the approach, call out the trade-off, then explain validation and monitoring.',
    difficulty: requirement.priority === 'must' ? 2 : 1,
    evidence: companyBrief?.sources?.map((source) => source.url) || []
  }));
}

export function generateQuestionsForCategory(requirements, companyBrief, { category, variation = 0 } = {}) {
  if (!['technical', 'behavioural'].includes(category)) {
    throw new Error('category must be technical or behavioural');
  }
  return generateQuestions(requirements, companyBrief, { variation }).filter((question) => question.category === category);
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
