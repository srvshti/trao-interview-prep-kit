const MUST_MARKERS = /\b(required|must have|must-have|essential|need to have|you will need|we are looking for)\b/i;
const NICE_MARKERS = /\b(nice to have|nice-to-have|preferred|bonus|plus|good to have|desirable)\b/i;
const TECHNICAL_MARKERS = /\b(java(script)?|typescript|python|react|node(\.js)?|fastapi|flask|django|sql|aws|docker|kubernetes|apis?|database|testing|debug(ging)?|git|linux|go(lang)?|java|c\+\+|machine learning|data structure|algorithm)\b/i;
const BEHAVIOURAL_MARKERS = /\b(communica\w*|collaborat\w*|mentor\w*|ownership|stakeholder\w*|leadership|team\w*|customer\w*|problem.?solv\w*)\b/i;
const REQUIREMENT_QUALIFIERS = /\b(experience|proficien|familiar|knowledge|understanding|ability|expertise|hands-on|strong|solid|degree|qualification)\b/i;
const RESPONSIBILITY_OPENERS = /^(you will|responsible for|in this role|what you('|’)ll do|your responsibilities)/i;

function normalizedLines(jd) {
  return String(jd)
    .split(/\r?\n/)
    .map((line) => line.replace(/^(?:\s*[•*\-]\s*|\s*\d+[.)]\s+)/, "").trim())
    .filter((line) => line.length >= 3);
}

function splitRequirementList(text) {
  const compact = text.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '').replace(/,\s*and\s+/i, ', ');
  if (!compact) return [];
  if (!/[,&]|\band\b/i.test(compact)) return [compact];
  return compact
    .split(/\s*,\s*|\s+and\s+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function requirementParts(line) {
  const text = line.replace(/\s+/g, ' ').trim();
  const tagged = text.match(/^(?:minimum |preferred |basic )?(?:requirements?|qualifications?|skills?)?\s*(required|must have|must-have|essential|need to have|nice to have|nice-to-have|preferred|bonus|plus|good to have|desirable)\s*[:\-]\s*(.+)$/i);
  if (!tagged) return [text];
  return splitRequirementList(tagged[2]);
}

function sectionPriority(line) {
  const heading = line.replace(/[:.]+$/, '').trim();
  if (/^(nice to have|preferred qualifications?|preferred skills?|bonus|good to have|desirable)$/i.test(heading)) return 'nice';
  if (/^(requirements?|required skills?|required qualifications?|qualifications?|minimum qualifications?|skills?|what you('|’)ll need|what we('|’)re looking for|who you are|eligibility)$/i.test(heading)) return 'must';
  return null;
}

function inferPriority(line, inheritedPriority) {
  if (NICE_MARKERS.test(line)) return 'nice';
  if (MUST_MARKERS.test(line) || inheritedPriority === 'must') return 'must';
  if (inheritedPriority === 'nice') return 'nice';
  // In an unlabelled JD, concrete technical skills and explicit capability language
  // are treated as expected qualifications rather than guessed nice-to-haves.
  return 'must';
}

function isRequirementLike(line, inheritedPriority) {
  if (MUST_MARKERS.test(line) || NICE_MARKERS.test(line) || inheritedPriority) return !RESPONSIBILITY_OPENERS.test(line) || REQUIREMENT_QUALIFIERS.test(line);
  return (TECHNICAL_MARKERS.test(line) || BEHAVIOURAL_MARKERS.test(line))
    && (!RESPONSIBILITY_OPENERS.test(line) || REQUIREMENT_QUALIFIERS.test(line));
}

function requirementKind(text) {
  if (BEHAVIOURAL_MARKERS.test(text)) return 'behavioural';
  if (TECHNICAL_MARKERS.test(text)) return 'technical';
  return 'domain';
}

export function extractRoleTitle(jd) {
  const ignored = /^(job description|about (the )?role|responsibilities|requirements|qualifications|what you('|’)ll do)$/i;
  const title = normalizedLines(jd).find((line) => !ignored.test(line) && line.length <= 100 && !/[.!?]$/.test(line));
  return title || "Role title not extracted";
}

export function extractResponsibilities(jd) {
  return normalizedLines(jd)
    .filter((line) => /\b(you will|responsible for|build|design|develop|debug|collaborate|maintain|deliver|own)\b/i.test(line))
    .slice(0, 6);
}

export function extractRequirements(jd) {
  const lines = String(jd)
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^(?:\s*[•*\-]\s*|\s*\d+[.)]\s+)/, '').trim())
    .filter(Boolean);
  let inheritedPriority = null;
  const candidates = [];

  for (const line of lines) {
    const headingPriority = sectionPriority(line);
    if (headingPriority) {
      inheritedPriority = headingPriority;
      continue;
    }
    if (line.length < 3 || !isRequirementLike(line, inheritedPriority)) continue;
    const explicitList = MUST_MARKERS.test(line) || NICE_MARKERS.test(line);
    const parts = explicitList || inheritedPriority ? requirementParts(line).flatMap((text) => splitRequirementList(text)) : [line];
    for (const text of parts) {
      if (text.length >= 2) candidates.push({ text, priority: inferPriority(line, inheritedPriority) });
    }
  }
  const unique = [...new Map(candidates.map((candidate) => [candidate.text.toLowerCase(), candidate])).values()];

  return unique.slice(0, 16).map(({ text, priority }, index) => ({
    id: `r${index + 1}`,
    text,
    kind: requirementKind(text),
    priority
  }));
}

export function inferSeniority(jd, roleTitle = '') {
  const text = `${roleTitle}\n${jd}`;
  const years = text.match(/\b(\d+)\s*(?:-|to)?\s*(\d+)?\s*years?\b/i);
  if (years) return years[2] ? `${years[1]}-${years[2]} years` : `${years[1]}+ years`;
  if (/\b(fresher|graduate|entry.?level|junior|intern|trainee|0\s*[-–]\s*1)\b/i.test(text)) return 'Entry-level';
  if (/\b(senior|staff|principal|lead)\b/i.test(text)) return 'Senior-level';
  if (/\b(mid.?level|intermediate)\b/i.test(text)) return 'Mid-level';
  return 'Not specified';
}

export function questionFor(requirement, index) {
  const category = requirement.kind === "behavioural" ? "behavioural" : "technical";
  const prompt = requirement.kind === "behavioural"
    ? `Tell me about a time you demonstrated: ${requirement.text}`
    : `How would you apply or explain ${requirement.text} in this role?`;
  return {
    id: `q${index + 1}`,
    requirement_ids: [requirement.id],
    category,
    prompt,
    answer_outline: `Define the relevant concept, connect it to the role, and give a concrete example or trade-off.`,
    difficulty: requirement.priority === "must" ? 2 : 1
  };
}

export function findCoverageGaps(requirements, questions) {
  const covered = new Set(questions.flatMap((question) => question.requirement_ids));
  return requirements.filter((requirement) => requirement.priority === "must" && !covered.has(requirement.id)).map((requirement) => requirement.id);
}

export function allocateSchedule(questions, requirements, daysAvailable) {
  if (!Number.isInteger(daysAvailable) || daysAvailable < 1 || daysAvailable > 60) {
    throw new Error("days must be an integer between 1 and 60");
  }
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const priority = new Map(requirements.map((requirement) => [requirement.id, requirement.priority === "must" ? 0 : 1]));
  const ordered = [...questions].sort((a, b) => {
    const aPriority = Math.min(...a.requirement_ids.map((id) => priority.get(id) ?? 1));
    const bPriority = Math.min(...b.requirement_ids.map((id) => priority.get(id) ?? 1));
    const requirementDifficulty = (question) => Math.max(...question.requirement_ids.map((id) => {
      const text = requirementById.get(id)?.text || '';
      return /\b(advanced|architecture|distributed|scale|performance|ownership|lead)\b/i.test(text) ? 3 : priority.get(id) === 0 ? 2 : 1;
    }));
    return aPriority - bPriority || requirementDifficulty(b) - requirementDifficulty(a) || b.difficulty - a.difficulty;
  });
  // Keep the sorted, high-priority work contiguous so it is scheduled earlier.
  const baseSize = Math.floor(ordered.length / daysAvailable);
  const remainder = ordered.length % daysAvailable;
  let offset = 0;
  const buckets = Array.from({ length: daysAvailable }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0);
    const questionIds = ordered.slice(offset, offset + size).map((question) => question.id);
    offset += size;
    return questionIds;
  });
  const focusFor = (questionIds, index) => {
    if (!questionIds.length) return 'Review and recap';
    const topicNames = [...new Set(questionIds.flatMap((questionId) => {
      const question = ordered.find((item) => item.id === questionId);
      return question?.requirement_ids.map((id) => requirementById.get(id)?.text).filter(Boolean) || [];
    }))].slice(0, 2);
    const selectedRequirements = questionIds.flatMap((questionId) => {
      const question = ordered.find((item) => item.id === questionId);
      return question?.requirement_ids.map((id) => requirementById.get(id)).filter(Boolean) || [];
    });
    if (selectedRequirements.length && selectedRequirements.every((requirement) => requirement.kind === 'behavioural')) return `Behavioural evidence: ${topicNames.join(' and ')}`;
    return `${index === 0 ? 'Core requirements' : 'Focused practice'}: ${topicNames.join(' and ')}`;
  };
  return {
    days_available: daysAvailable,
    days: buckets.map((questionIds, index) => ({
      day: index + 1,
      focus: focusFor(questionIds, index),
      question_ids: questionIds,
      minutes: questionIds.length ? Math.max(30, questionIds.length * 25) : 20
    }))
  };
}

export function validateKit(kit) {
  const errors = [];
  if (!kit?.source || !kit?.company_brief || !kit?.role || !Array.isArray(kit?.questions) || !Array.isArray(kit?.flashcards) || !kit?.schedule || !kit?.coverage) {
    return ['kit is missing one or more Appendix-A sections'];
  }
  if (!Array.isArray(kit.source.pages_used) || !kit.source.pages_used.every((url) => typeof url === 'string')) errors.push('source.pages_used must be an array of URLs');
  if (!Array.isArray(kit.company_brief.sources) || !kit.company_brief.sources.every((url) => typeof url === 'string')) errors.push('company_brief.sources must be an array of URLs');
  if (!Array.isArray(kit.role.requirements)) return [...errors, 'role.requirements must be an array'];
  const requirementIds = new Set(kit.role.requirements.map((requirement) => requirement.id));
  const questionIds = new Set(kit.questions.map((question) => question.id));
  const uncovered = findCoverageGaps(kit.role.requirements, kit.questions);
  const scheduledQuestionIds = new Set(kit.schedule.days.flatMap((day) => day.question_ids));
  const scheduledRequirementIds = new Set(kit.questions
    .filter((question) => scheduledQuestionIds.has(question.id))
    .flatMap((question) => question.requirement_ids));
  const unscheduledMust = kit.role.requirements
    .filter((requirement) => requirement.priority === 'must' && !scheduledRequirementIds.has(requirement.id))
    .map((requirement) => requirement.id);
  if (uncovered.length) errors.push(`uncovered must-have requirements: ${uncovered.join(', ')}`);
  if (unscheduledMust.length) errors.push(`must-have requirements missing from schedule: ${unscheduledMust.join(', ')}`);
  if (kit.schedule.days.length !== kit.schedule.days_available) errors.push("schedule day count does not match days_available");
  for (const requirement of kit.role.requirements) {
    if (!/^r\d+$/.test(requirement.id || '')) errors.push('requirement has an invalid stable id');
    if (!['technical', 'behavioural', 'domain'].includes(requirement.kind)) errors.push(`requirement ${requirement.id} has an invalid kind`);
    if (!['must', 'nice'].includes(requirement.priority)) errors.push(`requirement ${requirement.id} has an invalid priority`);
  }
  for (const question of kit.questions) {
    if (!question.requirement_ids.every((id) => requirementIds.has(id))) errors.push(`question ${question.id} references an unknown requirement`);
    if (!['technical', 'behavioural', 'system-design', 'company-fit'].includes(question.category)) errors.push(`question ${question.id} has invalid category`);
    if (![1, 2, 3].includes(question.difficulty)) errors.push(`question ${question.id} has invalid difficulty`);
  }
  for (const flashcard of kit.flashcards) {
    if (!flashcard.requirement_ids.every((id) => requirementIds.has(id))) errors.push(`flashcard ${flashcard.id} references an unknown requirement`);
  }
  for (const day of kit.schedule.days) {
    if (!Number.isInteger(day.day) || typeof day.focus !== 'string' || !Number.isInteger(day.minutes)) errors.push(`day ${day.day} does not match the schedule structure`);
    if (!day.question_ids.every((id) => questionIds.has(id))) errors.push(`day ${day.day} references an unknown question`);
  }
  if (!Array.isArray(kit.coverage.uncovered_requirement_ids) || !Number.isInteger(kit.coverage.passes)) errors.push('coverage does not match the required structure');
  return errors;
}

export function createKit({ id, jd, company_url, days }) {
  if (!id || !jd || !company_url) throw new Error("id, jd, and company_url are required");
  const url = new URL(company_url);
  if (!/^https?:$/.test(url.protocol)) throw new Error("company_url must use http or https");

  const requirements = extractRequirements(jd);
  const roleTitle = extractRoleTitle(jd);
  const responsibilities = extractResponsibilities(jd);
  const extractionNote = requirements.length === 0
    ? 'This description contained very little extractable detail, so this is intentionally a thin kit. Add a fuller posting for more targeted practice.'
    : null;
  const firstPassQuestions = generateQuestions(requirements, null);
  const coverageRepair = repairCoverage(requirements, firstPassQuestions);
  const questions = coverageRepair.questions;
  const coverage = findCoverageGaps(requirements, questions);
  const kit = {
    source: {
      company: url.hostname,
      company_url,
      role: roleTitle,
      location: "Not specified",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: []
    },
    company_brief: {
      summary: "Research has not yet been run for this company.",
      what_they_do: "Not yet retrieved.",
      sources: []
    },
    role: {
      title: roleTitle,
      seniority: inferSeniority(jd, roleTitle),
      responsibilities,
      extraction_note: extractionNote,
      requirements
    },
    questions,
    flashcards: requirements.map((requirement, index) => ({
      id: `f${index + 1}`,
      front: requirement.text,
      back: `Explain why this requirement matters and prepare one example that demonstrates it.`,
      requirement_ids: [requirement.id]
    })),
    schedule: allocateSchedule(questions, requirements, days),
    coverage: { uncovered_requirement_ids: coverage, repaired_requirement_ids: coverageRepair.repaired_requirement_ids, passes: 2 }
  };
  const errors = validateKit(kit);
  if (errors.length) throw new Error(`invalid kit: ${errors.join("; ")}`);
  return kit;
}
import { generateQuestions, repairCoverage } from './generation.mjs';
