import assert from "node:assert/strict";
import test from "node:test";
import { findFirstAvailableSlot } from "../src/domain/scheduling.js";

test("moves to the next free London business slot", () => {
  const slot = findFirstAvailableSlot(
    new Date("2026-09-07T07:55:00Z"),
    60,
    { startHour: 9, endHour: 17, workingDays: [1, 2, 3, 4, 5] },
    [{ start: new Date("2026-09-07T08:00:00Z"), end: new Date("2026-09-07T09:00:00Z") }],
    "Europe/London"
  );
  assert.equal(slot.start.toISOString(), "2026-09-07T09:00:00.000Z");
  assert.equal(slot.end.toISOString(), "2026-09-07T10:00:00.000Z");
});

test("skips weekends", () => {
  const slot = findFirstAvailableSlot(
    new Date("2026-09-05T12:00:00Z"), 60,
    { startHour: 9, endHour: 17, workingDays: [1, 2, 3, 4, 5] }, [], "Europe/London"
  );
  assert.equal(slot.start.toISOString(), "2026-09-07T08:00:00.000Z");
});
