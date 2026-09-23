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

test("coverage identifies an uncovered must-have requirement", () => {
  const gaps = findCoverageGaps([{ id: "r1", priority: "must" }, { id: "r2", priority: "nice" }], []);
  assert.deepEqual(gaps, ["r1"]);
});

test("generated kit matches the required structural references", () => {
  const kit = createKit({ id: "case-1", jd: "Must have Python.", company_url: "https://example.com", days: 1 });
  assert.deepEqual(validateKit(kit), []);
});

test("extracts a role title from the first meaningful JD line", () => {
  assert.equal(extractRoleTitle("Backend Engineer\n\nRequired: Node.js and SQL."), "Backend Engineer");
});
