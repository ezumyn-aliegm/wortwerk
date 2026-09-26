import test from "node:test";
import assert from "node:assert/strict";
import { activeSeconds, timeSegments } from "../src/study-clock.js";
const clock = {
  enabled: true,
  sessionId: "visit",
  lastInteraction: 100000,
  accountedAt: 100000,
};
test("time excludes pause, unfocused, hidden, idle and suspended browser intervals", () => {
  assert.equal(
    activeSeconds(clock, 110000, { visible: true, focused: true }),
    10,
  );
  assert.equal(
    activeSeconds({ ...clock, enabled: false }, 110000, {
      visible: true,
      focused: true,
    }),
    0,
  );
  assert.equal(
    activeSeconds(clock, 110000, { visible: false, focused: true }),
    0,
  );
  assert.equal(
    activeSeconds(clock, 110000, { visible: true, focused: false }),
    0,
  );
  assert.equal(
    activeSeconds(clock, 150000, { visible: true, focused: true }),
    0,
  );
  assert.equal(
    activeSeconds({ ...clock, accountedAt: 195000 }, 200000, {
      visible: true,
      focused: true,
    }),
    0,
  );
  assert.equal(
    activeSeconds({ ...clock, accountedAt: 185000 }, 195000, {
      visible: true,
      focused: true,
    }),
    5,
  );
});
test("time is split across Miami midnight without changing the total", () => {
  for (const midnight of ["2026-09-27T04:00:00Z", "2026-12-02T05:00:00Z"]) {
    const at = Date.parse(midnight),
      parts = timeSegments(at - 4000, at + 6000);
    assert.equal(parts.length, 2);
    assert.equal(parts[0].seconds, 4);
    assert.equal(parts[1].seconds, 6);
  }
});
