import test from "node:test";
import assert from "node:assert/strict";
import { freshActivity, validateActivity, recordActivity, activityStats } from "../src/activity.js";

const at = (date) => Date.parse(date);
const BASE = at("2026-01-01T05:00:00Z");
const waves = [{ id: "one", words: [{ id: "brief" }] }, { id: "two", words: [{ id: "brief" }] }];
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let nextId = 1;
function event(extra = {}) {
  return { id: id(nextId++), sessionId: id(999999), waveId: "one", at: BASE + 1000, kind: "engage", ...extra };
}
function answer(extra = {}) {
  return event({ kind: "answer", wordId: "brief", type: "spelling", correct: true, assisted: false, retry: 0, ...extra });
}
function stats(state, extra = {}) { return activityStats(state, { now: BASE + 100_000, range: "all", ...extra }); }

test("fresh tracking has no fabricated tutor history", () => {
  const state = freshActivity(BASE);
  assert.equal(validateActivity(state, waves), true);
  const result = stats(state);
  assert.equal(result.totals.visits, 0);
  assert.equal(result.totals.activeSeconds, 0);
  assert.equal(result.totals.lastAt, null);
  assert.equal(result.firstTryAccuracy, null);
  assert.equal(result.startedAt, BASE);
});

test("time-only/idle events do not create visits; positive known time is capped at 15 seconds", () => {
  const initial = freshActivity(BASE);
  assert.equal(recordActivity(initial, event({ kind: "time", seconds: 15 })), initial);
  assert.equal(recordActivity(initial, event({ kind: "idle" })), initial);
  let state = recordActivity(initial, event());
  for (const seconds of [-1, 0, NaN, Infinity, "15"]) assert.equal(recordActivity(state, event({ kind: "time", seconds })), state);
  assert.equal(recordActivity(state, event({ kind: "time", seconds: 4, waveId: "two" })), state);
  state = recordActivity(state, event({ kind: "time", seconds: 999 }));
  state = recordActivity(state, event({ kind: "time", seconds: 1.25 }));
  assert.equal(stats(state).totals.visits, 1);
  assert.equal(stats(state).totals.activeSeconds, 16.25);
  assert.equal(validateActivity(state, waves), true);
});

test("answers open visits, repeated engagement does not, and recording is immutable", () => {
  const initial = freshActivity(BASE);
  const serialized = JSON.stringify(initial);
  let state = recordActivity(initial, answer());
  assert.equal(JSON.stringify(initial), serialized);
  state = recordActivity(state, event());
  assert.equal(stats(state).totals.visits, 1);
  state = recordActivity(state, answer({ sessionId: id(100000) }));
  assert.equal(stats(state).totals.visits, 2);
  assert.equal(validateActivity(state, waves), true);
});

test("event IDs deduplicate engage, answers, and time, including after JSON roundtrip", () => {
  let state = freshActivity(BASE);
  for (const e of [event(), answer(), event({ kind: "time", seconds: 10 })]) {
    state = JSON.parse(JSON.stringify(recordActivity(state, e)));
    assert.equal(recordActivity(state, e), state);
    assert.equal(recordActivity(state, { ...e, waveId: "two" }), state);
  }
  assert.equal(stats(state).totals.answers, 1);
  assert.equal(stats(state).totals.activeSeconds, 10);
  assert.equal(validateActivity(state, waves), true);
});

test("first try requires retry zero and unassisted correctness; retries never repair its score", () => {
  let state = freshActivity(BASE);
  for (const extra of [
    { correct: false, retry: 0 },
    { correct: true, retry: 1 },
    { correct: true, retry: 0, assisted: true },
    { correct: true, retry: 0 },
    { correct: false, retry: 2, assisted: true },
    { correct: true, retry: undefined },
  ]) state = recordActivity(state, answer(extra));
  const result = stats(state);
  assert.equal(result.totals.answers, 6);
  assert.equal(result.totals.firstTries, 3);
  assert.equal(result.totals.firstTryCorrect, 1);
  assert.equal(result.totals.retries, 2);
  assert.equal(result.totals.assisted, 2);
  assert.equal(result.totals.unknownRetries, 1);
  assert.equal(result.firstTryAccuracy, 1 / 3);
  assert.equal(result.skills.spelling.answers, 6);
  assert.equal(validateActivity(state, waves), true);
});

test("today uses Miami midnight, not UTC or the machine time zone", () => {
  let state = freshActivity(BASE);
  const before = at("2026-01-02T04:59:59Z");
  const after = at("2026-01-02T05:00:00Z");
  state = recordActivity(state, answer({ at: before, sessionId: id(11) }));
  state = recordActivity(state, answer({ at: after, sessionId: id(12) }));
  assert.equal(stats(state, { now: before, range: "today" }).totals.answers, 1);
  const result = stats(state, { now: after, range: "today" });
  assert.equal(result.totals.answers, 1);
  assert.equal(result.totals.visits, 1);
  assert.equal(result.daysActive, 1);
  assert.equal(result.visits.length, 1);
  assert.equal(result.through, "2026-01-02");
});

test("Monday calendar weeks work across spring-forward and fall-back DST changes", () => {
  for (const [beforeMonday, monday, sunday, nextMonday] of [
    ["2026-03-02T04:59:59Z", "2026-03-02T05:00:00Z", "2026-03-09T03:59:59Z", "2026-03-09T04:00:00Z"],
    ["2026-10-26T03:59:59Z", "2026-10-26T04:00:00Z", "2026-11-02T04:59:59Z", "2026-11-02T05:00:00Z"],
  ]) {
    let state = freshActivity(BASE);
    for (const date of [beforeMonday, monday, sunday, nextMonday]) state = recordActivity(state, answer({ at: at(date), sessionId: id(nextId++) }));
    assert.equal(stats(state, { now: at(sunday), range: "week" }).totals.answers, 2);
    assert.equal(stats(state, { now: at(nextMonday), range: "week" }).totals.answers, 1);
    assert.equal(validateActivity(state, waves), true);
  }
});

test("one visit across waves counts once overall and once per engaged wave", () => {
  let state = recordActivity(freshActivity(BASE), answer());
  state = recordActivity(state, answer({ waveId: "two", type: "meaning" }));
  state = recordActivity(state, event({ waveId: "two", kind: "time", seconds: 5 }));
  assert.equal(stats(state).totals.visits, 1);
  assert.equal(stats(state).totals.answers, 2);
  assert.equal(stats(state, { waveId: "one" }).totals.visits, 1);
  assert.equal(stats(state, { waveId: "two" }).totals.visits, 1);
  assert.equal(stats(state, { waveId: "one" }).totals.activeSeconds, 0);
  assert.equal(stats(state, { waveId: "two" }).skills.meaning.answers, 1);
  assert.equal(stats(state, { waveId: "missing" }).totals.answers, 0);
  assert.equal(validateActivity(state, waves), true);
});

test("cross-midnight visit filters its time, answers, errors and last activity consistently", () => {
  let state = recordActivity(freshActivity(BASE), answer({ at: BASE + 1000, correct: false, input: "brif", expected: "Brief" }));
  const nextDay = BASE + 86_400_000;
  state = recordActivity(state, event({ at: nextDay, kind: "time", seconds: 10 }));
  state = recordActivity(state, answer({ at: nextDay + 1000, retry: 1 }));
  state = recordActivity(state, answer({ at: nextDay + 2000, waveId: "two", correct: false }));
  const result = stats(state, { now: nextDay + 3000, range: "today", waveId: "one" });
  assert.equal(result.totals.visits, 0);
  assert.equal(result.totals.answers, 1);
  assert.equal(result.totals.activeSeconds, 10);
  assert.equal(result.totals.lastAt, nextDay + 1000);
  assert.equal(result.daysActive, 1);
  assert.equal(result.visits.length, 1);
  assert.equal(result.visits[0].totals.answers, 1);
  assert.equal(result.visits[0].totals.activeSeconds, 10);
  assert.deepEqual(result.visits[0].waveIds, ["one"]);
  assert.equal(result.spellingErrors.length, 0);
  assert.equal(validateActivity(state, waves), true);
});

test("repeated spelling examples aggregate within filters, retain case, and bound text", () => {
  let state = freshActivity(BASE);
  for (const offset of [1, 2, 86401]) state = recordActivity(state, answer({ at: BASE + offset * 1000, correct: false, input: "der brief", expected: "der Brief" }));
  state = recordActivity(state, answer({ at: BASE + 86402_000, waveId: "two", correct: false, input: "der brief", expected: "der Brief" }));
  state = recordActivity(state, answer({ at: BASE + 86403_000, correct: false, input: "x".repeat(1000), expected: "B".repeat(1000) }));
  const result = stats(state, { now: BASE + 86404_000, range: "all", waveId: "one" });
  assert.equal(result.spellingErrors[0].count, 3);
  assert.equal(result.spellingErrors[0].expected, "der Brief");
  assert.equal(result.spellingErrors[1].input.length, 160);
  assert.equal(result.spellingErrors[1].expected.length, 160);
  assert.equal(stats(state, { now: BASE + 86404_000, range: "today", waveId: "one" }).spellingErrors[0].count, 1);
  assert.equal(validateActivity(state, waves), true);
});

test("retention preserves lifetime totals and bounds a school year of synthetic records", () => {
  let state = freshActivity(BASE);
  for (let d = 0; d < 370; d++) {
    state = recordActivity(state, answer({ at: BASE + d * 86400_000 + 1000, sessionId: id(20000 + d), correct: false, input: `brif-${d}`, expected: "Brief" }));
  }
  const result = stats(state, { now: BASE + 369 * 86400_000 + 2000 });
  assert.equal(result.totals.answers, 370);
  assert.equal(result.totals.visits, 370);
  assert.equal(result.daysActive, 370);
  assert.equal(state.days.length, 365);
  assert.equal(state.visits.length, 100);
  assert.equal(state.spellingErrors.length, 100);
  assert.equal(result.detailTruncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(state)) <= 900_000);
  assert.equal(validateActivity(state, waves), true);
  assert.equal(recordActivity(state, answer({ at: BASE + 1000 })), state);
});

test("deduplication buffers and long-session detail remain bounded", () => {
  let state = freshActivity(BASE);
  for (let i = 0; i < 2050; i++) state = recordActivity(state, answer({ sessionId: id(30000 + i) }));
  assert.equal(state.eventIds.length, 2048);
  assert.equal(state.sessions.length, 1024);
  assert.equal(state.visits.length, 100);
  assert.equal(state.lifetime.totals.visits, 2050);
  assert.equal(validateActivity(state, waves), true);
  let long = freshActivity(BASE);
  for (let d = 0; d < 35; d++) long = recordActivity(long, answer({ at: BASE + d * 86400_000 + 1000 }));
  assert.equal(long.visits[0].parts.length, 32);
  assert.equal(long.visits[0].truncated, true);
  assert.equal(validateActivity(long, waves), true);
});

test("busy multiwave storage prunes detail before 900 KB without losing all-time totals", () => {
  const manyWaves = Array.from({ length: 12 }, (_, i) => ({ id: `wave-${i}`, words: [{ id: "brief" }] }));
  let state = freshActivity(BASE);
  for (let d = 0; d < 85; d++) {
    for (let w = 0; w < manyWaves.length; w++) {
      state = recordActivity(state, answer({ at: BASE + d * 86400_000 + w * 1000, waveId: manyWaves[w].id, sessionId: id(70000 + d * 12 + w) }));
    }
  }
  assert.ok(state.days.length < 85, "Byte budget must shorten daily detail for a busy library");
  assert.equal(state.lifetime.totals.answers, 85 * 12);
  assert.equal(state.lifetime.daysActive, 85);
  assert.ok(Buffer.byteLength(JSON.stringify(state)) <= 900_000);
  assert.equal(validateActivity(state, manyWaves), true);
  const result = stats(state, { now: BASE + 84 * 86400_000 + 20000 });
  assert.equal(result.totals.answers, 85 * 12);
  assert.equal(result.detailTruncated, true);
});

test("malformed events are ignored without mutating the supplied record", () => {
  const state = freshActivity(BASE);
  for (const bad of [null, {}, answer({ id: "not-uuid" }), answer({ sessionId: "bad" }), answer({ at: NaN }), answer({ at: -1 }), answer({ at: BASE - 1 }), answer({ correct: "yes" }), answer({ retry: -1 }), answer({ retry: 1.5 }), answer({ assisted: 1 }), answer({ type: "teach" }), answer({ wordId: "" }), answer({ input: {} })]) {
    assert.equal(recordActivity(state, bad), state);
  }
});

test("validation fails closed for malformed, inconsistent, unknown and oversized records", () => {
  assert.equal(validateActivity(), false);
  assert.equal(validateActivity(new Proxy({}, { ownKeys() { throw new Error("malformed input"); } }), waves), false);
  const good = recordActivity(freshActivity(BASE), answer({ correct: false, input: "brif", expected: "Brief" }));
  assert.equal(validateActivity(good, waves), true);
  for (const value of [null, undefined, [], {}, "text", 1]) assert.equal(validateActivity(value, waves), false);
  for (const mutate of [
    (s) => { s.version = 2; },
    (s) => { s.unknown = true; },
    (s) => { s.startedAt = NaN; },
    (s) => { s.detailSince = "2026-02-30"; },
    (s) => { s.lifetime.totals.answers = -1; },
    (s) => { s.lifetime.totals.activeSeconds = Infinity; },
    (s) => { s.lifetime.totals.activeSeconds = 3; },
    (s) => { s.lifetime.totals.lastAt = null; },
    (s) => { s.lifetime.totals.firstTryCorrect = 2; },
    (s) => { s.lifetime.skills.spelling.answers = 0; },
    (s) => { s.waves[0].waveId = "missing"; },
    (s) => { s.days[0].date = "2026-01-02"; },
    (s) => { s.days.push(s.days[0]); },
    (s) => { s.eventIds.push(s.eventIds[0]); },
    (s) => { s.sessions = Array(1); },
    (s) => { s.sessions[0].waveIds = ["missing"]; },
    (s) => { s.visits[0].lastAt = BASE - 1; },
    (s) => { s.visits[0].parts[0].totals.firstTries = 90; },
    (s) => { s.spellingErrors[0].wordId = "missing"; },
    (s) => { s.spellingErrors[0].input = "a".repeat(161); },
    (s) => { s.spellingErrors[0].count = 0; },
    (s) => { s.spellingErrors[0].count = 200; },
    (s) => { s.spellingErrors = Array(101).fill(s.spellingErrors[0]); },
    (s) => { s.lifetime.daysActive = 0; },
  ]) {
    const bad = structuredClone(good);
    mutate(bad);
    assert.equal(validateActivity(bad, waves), false, mutate.toString());
  }
  const cyclic = structuredClone(good);
  cyclic.days.push(cyclic);
  assert.equal(validateActivity(cyclic, waves), false);
  assert.equal(validateActivity(good, null), false);
  assert.equal(validateActivity(good, [{ id: "one", words: [] }]), false);
});
