import test from "node:test";
import assert from "node:assert/strict";
import { allocateSchedule, createKit, extractRequirements, extractRoleTitle, findCoverageGaps, inferSeniority, validateKit } from "../src/core.mjs";

test("every must-have requirement receives a question", () => {
  const kit = createKit({
    id: "case-1",
    jd: "Required: TypeScript and REST APIs. Nice to have: Docker.",
    company_url: "https://example.com",
    days: 3
  });
  assert.deepEqual(kit.coverage.uncovered_requirement_ids, []);
});

test("schedule uses exactly the requested number of days", () => {
  const schedule = allocateSchedule([{ id: "q1", requirement_ids: ["r1"], difficulty: 2 }], [{ id: "r1", priority: "must" }], 4);
  assert.equal(schedule.days.length, 4);
  assert.equal(schedule.days_available, 4);
  assert.ok(schedule.days.every((day) => Number.isInteger(day.minutes)));
});

test('schedules a must-have recall session when days exceed unique questions', () => {
  const schedule = allocateSchedule(
    [{ id: 'q1', requirement_ids: ['r1'], difficulty: 2 }],
    [{ id: 'r1', text: 'TypeScript', kind: 'technical', priority: 'must' }],
    4
  );
  assert.ok(schedule.days.every((day) => day.question_ids.length === 1));
  assert.match(schedule.days[1].focus, /Review and recall/);
});

test("schedules must-have and harder questions before nice-to-have questions", () => {
  const schedule = allocateSchedule([
    { id: "q1", requirement_ids: ["r1"], difficulty: 1 },
    { id: "q2", requirement_ids: ["r2"], difficulty: 3 },
    { id: "q3", requirement_ids: ["r3"], difficulty: 3 },
    { id: "q4", requirement_ids: ["r4"], difficulty: 1 }
  ], [
    { id: "r1", priority: "must" }, { id: "r2", priority: "nice" },
    { id: "r3", priority: "must" }, { id: "r4", priority: "nice" }
  ], 2);
  assert.deepEqual(schedule.days[0].question_ids, ["q3", "q1"]);
  assert.deepEqual(schedule.days[1].question_ids, ["q2", "q4"]);
});

test("coverage identifies an uncovered must-have requirement", () => {
  const gaps = findCoverageGaps([{ id: "r1", priority: "must" }, { id: "r2", priority: "nice" }], []);
  assert.deepEqual(gaps, ["r1"]);
});

test("kit validation rejects uncovered must-have requirements", () => {
  const kit = createKit({ id: "test", jd: "Backend Engineer\nRequired: TypeScript", company_url: "https://example.com", days: 1 });
  kit.questions = [];
  assert.match(validateKit(kit).join("; "), /uncovered must-have requirements/);
});

test("generated kit matches the required structural references", () => {
  const kit = createKit({ id: "case-1", jd: "Must have Python.", company_url: "https://example.com", days: 1 });
  assert.deepEqual(validateKit(kit), []);
});

test("extracts a role title from the first meaningful JD line", () => {
  assert.equal(extractRoleTitle("Backend Engineer\n\nRequired: Node.js and SQL."), "Backend Engineer");
});

test('splits explicitly listed requirements into individually traceable items', () => {
  const requirements = extractRequirements('Required: TypeScript, Node.js, REST APIs, SQL, and strong communication.\nNice to have: AWS and Docker.');
  assert.deepEqual(requirements.map((requirement) => [requirement.text, requirement.kind, requirement.priority]), [
    ['TypeScript', 'technical', 'must'],
    ['Node.js', 'technical', 'must'],
    ['REST APIs', 'technical', 'must'],
    ['SQL', 'technical', 'must'],
    ['strong communication', 'behavioural', 'must'],
    ['AWS', 'technical', 'nice'],
    ['Docker', 'technical', 'nice']
  ]);
});

test('infers expected requirements from an unlabelled qualifications section', () => {
  const requirements = extractRequirements(`Backend Engineer
What we're looking for
Strong experience with Python and FastAPI
Comfortable debugging production issues and collaborating with product partners
Preferred qualifications
Familiarity with Docker and AWS`);
  assert.deepEqual(requirements.map(({ text, priority, kind }) => [text, priority, kind]), [
    ['Strong experience with Python', 'must', 'technical'],
    ['FastAPI', 'must', 'technical'],
    ['Comfortable debugging production issues', 'must', 'technical'],
    ['collaborating with product partners', 'must', 'behavioural'],
    ['Familiarity with Docker', 'nice', 'technical'],
    ['AWS', 'nice', 'technical']
  ]);
});

test('infers seniority from a range or entry-level language', () => {
  assert.equal(inferSeniority('Experience: 2-4 years', 'Software Engineer'), '2-4 years');
  assert.equal(inferSeniority('Recent graduates are welcome', 'AI Engineer Intern'), 'Entry-level');
});

test('schedule names the topics and exposes every scheduled question', () => {
  const schedule = allocateSchedule([
    { id: 'q1', requirement_ids: ['r1'], difficulty: 2 },
    { id: 'q2', requirement_ids: ['r2'], difficulty: 2 }
  ], [
    { id: 'r1', text: 'Python', priority: 'must', kind: 'technical' },
    { id: 'r2', text: 'Communication', priority: 'must', kind: 'behavioural' }
  ], 2);
  assert.match(schedule.days[0].focus, /Python/);
  assert.match(schedule.days[1].focus, /Communication/);
});

test("keeps a two-line stub honest instead of inventing requirements", () => {
  const kit = createKit({ id: "thin", jd: "Engineering opening\nApply now", company_url: "https://example.com", days: 1 });
  assert.equal(kit.role.requirements.length, 0);
  assert.match(kit.role.extraction_note, /intentionally a thin kit/i);
});
