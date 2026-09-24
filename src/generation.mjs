const SYSTEM_DESIGN_MARKERS = /\b(api|service|system|database|distributed|scale|architecture|pipeline|cloud|performance)\b/i;
const DEBUGGING_MARKERS = /\b(debug|troubleshoot|reliab|incident|monitor|test|quality)\b/i;

function flashcardFor(requirement) {
  const text = requirement.text;
  if (/react/i.test(text)) return ['React: when would you lift state versus use context?', 'Lift state to the nearest common owner for explicit flow. Use context for broadly shared, stable values; avoid it for fast-changing local state because it widens re-renders.'];
  if (/typescript/i.test(text)) return ['TypeScript: what should strict typing protect at an API boundary?', 'Model request and response shapes, validate unknown runtime input, avoid unsafe casts, and use explicit error variants so callers handle failures deliberately.'];
  if (/node(?:\.js)?/i.test(text) || /rest api/i.test(text)) return ['Node.js API: what belongs in a production-ready create endpoint?', 'Validate input, authenticate and authorize, use a transaction for related writes, return accurate HTTP statuses, make retries safe when needed, log failures, and test success plus error paths.'];
  if (/postgres|\bsql\b|schema/i.test(text)) return ['SQL and schema design: how do you prevent duplicate or inconsistent records?', 'Use primary and foreign keys, unique constraints for business invariants, transactions for related writes, indexes for real query paths, and reviewed migrations.'];
  if (/debug|troubleshoot|reliab/i.test(text)) return ['Debugging: what evidence do you collect before changing production code?', 'Start with the symptom, timestamps, request or trace IDs, logs, metrics, recent deploys, and a reproducible path. Test the lowest-risk fix, verify recovery, and add prevention.'];
  if (/test/i.test(text)) return ['Testing: what belongs in unit versus integration tests?', 'Unit tests isolate one behavior and run quickly. Integration tests verify boundaries such as API, database, queue, or authentication working together. Use both on the critical workflow.'];
  if (/git/i.test(text)) return ['Git: how do you ship a risky change safely?', 'Use a focused branch and reviewable commits, run checks, get review, stage or flag risky changes where possible, monitor after merge, and retain a rollback path.'];
  if (/mentor|collaborat|communicat/i.test(text)) return ['Collaboration: what makes a strong STAR answer?', 'Name the situation and your responsibility, describe actions you personally took and why, quantify the result where possible, and finish with what you learned.'];
  if (/aws/i.test(text)) return ['AWS: when do you choose managed services over self-managed infrastructure?', 'Start from reliability, operational burden, latency, security, and cost. Prefer managed services for common needs; self-manage only when control or performance is justified.'];
  if (/docker/i.test(text)) return ['Docker: why use a multi-stage build?', 'It separates build tooling from the runtime image, reducing image size and attack surface. Pin base images, run non-root, keep secrets out of layers, and externalize configuration.'];
  if (/graphql/i.test(text)) return ['GraphQL: what does it solve, and what does it not solve?', 'It lets clients request precisely shaped typed data. You still need authorization per resolver, pagination, complexity limits, caching, and N+1 prevention.'];
  if (/payment/i.test(text)) return ['Payments: why is idempotency essential for a charge or order endpoint?', 'Networks retry. A stable idempotency key returns the original result for an identical retry instead of creating duplicate charges or orders.'];
  return [`${text}: what would you explain first in an interview?`, 'Define the concept plainly, connect it to a concrete decision, state one trade-off, and explain how you would validate the result.'];
}

export function generateFlashcards(requirements) {
  return requirements.map((requirement, index) => {
    const [front, back] = flashcardFor(requirement);
    return { id: `f${index + 1}`, front, back, requirement_ids: [requirement.id] };
  });
}

function interviewFormatQuestions(requirements, companyBrief) {
  const text = String(companyBrief?.interview_process?.summary || '').toLowerCase();
  const anchor = requirements.find((requirement) => requirement.priority === 'must' && requirement.kind === 'technical');
  if (!anchor) return [];
  const evidence = companyBrief?.interview_process?.sources?.map((source) => source?.url).filter(Boolean) || [];
  const questions = [];
  if (/take[ -]?home|assignment|exercise/.test(text)) questions.push({ id: 'q-format-take-home', requirement_ids: [anchor.id], category: 'technical', difficulty: 3, evidence, prompt: `Practice a take-home response for ${anchor.text}: scope the smallest deliverable, define assumptions, outline the API or data model, test plan, and README.`, answer_outline: 'Clarify scope, propose a small working design, state trade-offs, test the critical path, and document setup plus improvements.' });
  if (/system[ -]?design|architecture round/.test(text)) questions.push({ id: 'q-format-system-design', requirement_ids: [anchor.id], category: 'system-design', difficulty: 3, evidence, prompt: `Practice a system-design response anchored in ${anchor.text}: clarify scale, sketch components and data flow, choose storage, address failure handling, and explain observability.`, answer_outline: 'Requirements and scale first; then API and data model, component boundaries, reliability trade-offs, and monitoring.' });
  return questions;
}

function questionPrompt(requirement, companyBrief, variation = 0) {
  const context = companyBrief?.what_they_do ? ' Tie the answer to the company context supplied in the research evidence.' : '';
  const roleSpecificInterviewSource = companyBrief?.interview_process?.sources?.some((source) => ['exact-role', 'related-role'].includes(source?.role_relevance));
  const interviewContext = roleSpecificInterviewSource
    ? ' Public candidate reports relevant to this role were retrieved. Use their reported format as a practice cue, but do not present it as verified company policy.'
    : '';
  const template = variation % 3;
  if (requirement.kind === 'behavioural') {
    if (template === 1) return `Describe a difficult situation where you demonstrated ${requirement.text}. Explain your decision-making, the outcome, and what you would improve.${context}${interviewContext}`;
    if (template === 2) return `How would a teammate describe your approach to ${requirement.text}? Support your answer with one specific STAR example.${context}${interviewContext}`;
    return `Tell me about a specific time you demonstrated ${requirement.text}. Use a concise STAR answer and name the measurable outcome.${context}${interviewContext}`;
  }
  if (DEBUGGING_MARKERS.test(requirement.text)) {
    if (template === 1) return `A production issue affects ${requirement.text}. Walk through your triage order, the evidence you would collect, and the safe fix you would ship.${context}${interviewContext}`;
    if (template === 2) return `What failure modes would you anticipate around ${requirement.text}, and how would you detect, diagnose, and prevent them?${context}${interviewContext}`;
    return `Describe how you would investigate and resolve a failure related to: ${requirement.text}.${context}${interviewContext}`;
  }
  if (SYSTEM_DESIGN_MARKERS.test(requirement.text)) {
    if (template === 1) return `Design an approach for ${requirement.text}. Start with the smallest viable version, then explain how you would evolve it for reliability and scale.${context}${interviewContext}`;
    if (template === 2) return `What trade-offs would you make when designing for ${requirement.text}? Explain your chosen design, the alternative you rejected, and how you would test it.${context}${interviewContext}`;
    return `How would you design a reliable solution for: ${requirement.text}? Explain assumptions, trade-offs, and how you would validate it.${context}${interviewContext}`;
  }
  if (template === 1) return `Walk through how you have used, or would use, ${requirement.text} to deliver a feature. Explain the implementation choices and how you would verify the result.${context}${interviewContext}`;
  if (template === 2) return `An interviewer challenges your understanding of ${requirement.text}. What would you explain first, what example would you use, and which trade-off matters most?${context}${interviewContext}`;
  return `How would you apply or explain ${requirement.text} in this role? Ground the answer in one concrete example or trade-off.${context}${interviewContext}`;
}

export function generateQuestions(requirements, companyBrief, { variation = 0 } = {}) {
  return [...requirements.map((requirement, index) => ({
    id: `q${index + 1}`,
    requirement_ids: [requirement.id],
    category: requirement.kind === 'behavioural' ? 'behavioural' : 'technical',
    prompt: questionPrompt(requirement, companyBrief, variation),
    answer_outline: requirement.kind === 'behavioural'
      ? 'Situation, task, actions you personally took, result, and what you learned.'
      : 'Clarify assumptions, describe the approach, call out the trade-off, then explain validation and monitoring.',
    difficulty: requirement.priority === 'must' ? 2 : 1,
    evidence: companyBrief?.sources?.map((source) => typeof source === 'string' ? source : source?.url).filter(Boolean) || []
  })), ...interviewFormatQuestions(requirements, companyBrief)];
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
