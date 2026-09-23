const MUST_MARKERS = /\b(required|must have|must-have|essential|need to have|you will need|we are looking for)\b/i;
const NICE_MARKERS = /\b(nice to have|nice-to-have|preferred|bonus|plus|good to have|desirable)\b/i;
const TECHNICAL_MARKERS = /\b(java(script)?|typescript|python|react|node(\.js)?|sql|aws|docker|kubernetes|api|database|testing|git|linux|go(lang)?|java|c\+\+|machine learning|data structure|algorithm)\b/i;
const BEHAVIOURAL_MARKERS = /\b(communicat|collaborat|mentor|ownership|stakeholder|leadership|team|customer|problem.solv)\b/i;

function normalizedLines(jd) {
  return String(jd)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•*\-\d.)]+/, "").trim())
    .filter((line) => line.length >= 3);
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
    .map((line) => line.replace(/^[\s•*\-\d.)]+/, "").trim())
    .filter((line) => line.length >= 8);

  const candidates = lines.filter((line) => MUST_MARKERS.test(line) || NICE_MARKERS.test(line) || TECHNICAL_MARKERS.test(line));
  const unique = [...new Set(candidates.map((line) => line.replace(/\s+/g, " ").trim()))];

  return unique.slice(0, 16).map((text, index) => ({
    id: `r${index + 1}`,
    text,
    kind: TECHNICAL_MARKERS.test(text) ? "technical" : BEHAVIOURAL_MARKERS.test(text) ? "behavioural" : "domain",
    priority: NICE_MARKERS.test(text) && !MUST_MARKERS.test(text) ? "nice" : "must"
  }));
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
  const priority = new Map(requirements.map((requirement) => [requirement.id, requirement.priority === "must" ? 0 : 1]));
  const ordered = [...questions].sort((a, b) => {
    const aPriority = Math.min(...a.requirement_ids.map((id) => priority.get(id) ?? 1));
    const bPriority = Math.min(...b.requirement_ids.map((id) => priority.get(id) ?? 1));
    return aPriority - bPriority || b.difficulty - a.difficulty;
  });
  const buckets = Array.from({ length: daysAvailable }, () => []);
  ordered.forEach((question, index) => buckets[index % daysAvailable].push(question.id));
  return {
    days_available: daysAvailable,
    days: buckets.map((questionIds, index) => ({
      day: index + 1,
      focus: questionIds.length ? (index === 0 ? "Must-have foundations" : "Targeted practice") : "Review and recap",
      question_ids: questionIds,
      minutes: questionIds.length ? Math.max(30, questionIds.length * 25) : 20
    }))
  };
}

export function validateKit(kit) {
  const errors = [];
  const requirementIds = new Set(kit.role.requirements.map((requirement) => requirement.id));
  const questionIds = new Set(kit.questions.map((question) => question.id));
  if (kit.schedule.days.length !== kit.schedule.days_available) errors.push("schedule day count does not match days_available");
  for (const question of kit.questions) {
    if (!question.requirement_ids.every((id) => requirementIds.has(id))) errors.push(`question ${question.id} references an unknown requirement`);
    if (![1, 2, 3].includes(question.difficulty)) errors.push(`question ${question.id} has invalid difficulty`);
  }
  for (const day of kit.schedule.days) {
    if (!Number.isInteger(day.minutes)) errors.push(`day ${day.day} minutes must be an integer`);
    if (!day.question_ids.every((id) => questionIds.has(id))) errors.push(`day ${day.day} references an unknown question`);
  }
  return errors;
}

export function createKit({ id, jd, company_url, days }) {
  if (!id || !jd || !company_url) throw new Error("id, jd, and company_url are required");
  const url = new URL(company_url);
  if (!/^https?:$/.test(url.protocol)) throw new Error("company_url must use http or https");

  const requirements = extractRequirements(jd);
  const roleTitle = extractRoleTitle(jd);
  const responsibilities = extractResponsibilities(jd);
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
      seniority: "Not specified",
      responsibilities,
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
