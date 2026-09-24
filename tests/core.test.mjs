import test from "node:test";
import assert from "node:assert/strict";
import { allocateSchedule, createKit, extractRoleTitle, findCoverageGaps, validateKit } from "../src/core.mjs";

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

test("keeps a two-line stub honest instead of inventing requirements", () => {
  const kit = createKit({ id: "thin", jd: "Engineering opening\nApply now", company_url: "https://example.com", days: 1 });
  assert.equal(kit.role.requirements.length, 0);
  assert.match(kit.role.extraction_note, /intentionally a thin kit/i);
});
