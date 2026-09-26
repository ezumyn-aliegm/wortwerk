import test from "node:test";
import assert from "node:assert/strict";
import {
  freshState,
  startSession,
  setTeachingStep,
  advance,
  setDraft,
} from "../src/engine.js";
import { createTutor } from "../src/tutor.js";
import { completeLesson, seedTaught } from "./teaching-fixtures.mjs";
import {
  migrateLibrary,
  validateSave,
  validateLibrary,
  parseWave,
  waveStatus,
  wavePlan,
  recommendedWave,
  parseMiami,
  miamiInput,
  WAVE_ONE_DEADLINE,
} from "../src/library.js";
import {
  editLocal,
  fromRemote,
  readLocal,
  prepareUpload,
  acknowledge,
} from "../src/sync.js";
const now = Date.parse("2026-09-26T15:00:00Z");
const sample = () => ({
  title: "Wave 2",
  dueAt: "2026-10-05T09:00:00-04:00",
  words: migrateLibrary().waves[0].words.slice(0, 4),
});
test("migration preserves the exact current session and never mutates the original", () => {
  let legacy = startSession(freshState(), now);
  delete legacy.active.queue[0].intro;
  legacy = setTeachingStep(legacy, 1);
  legacy = setTeachingStep(legacy, 2);
  for (const word of Object.values(legacy.words)) delete word.taught;
  const untouched = structuredClone(legacy),
    migrated = migrateLibrary(legacy, now);
  assert.deepEqual(migrated.waves[0].progress, legacy);
  assert.deepEqual(legacy, untouched);
  assert.equal(migrated.waves[0].dueAt, Date.parse("2026-09-28T13:00:00Z"));
  assert.ok(validateLibrary(migrated));
  assert.equal(migrateLibrary(migrated), migrated);
  legacy = setDraft(completeLesson({ setTeachingStep, advance, setDraft }, legacy, now), "half-finished");
  assert.notEqual(legacy.active.queue[0].type, "teach");
  assert.equal(
    migrateLibrary(legacy).waves[0].progress.active.draft,
    "half-finished",
  );
});
test("new wave retains separate progress and builds the right-size course and exam", () => {
  const library = migrateLibrary(startSession(freshState(), now), now),
    first = structuredClone(library.waves[0]);
  const wave = parseWave(JSON.stringify(sample()), "wave-2");
  assert.ok(validateLibrary({ ...library, waves: [...library.waves, wave] }));
  assert.deepEqual(library.waves[0], first);
  assert.equal(wave.progress.totalSteps, 0);
  const tutor = createTutor(wave.words);
  const introduced = [0, 1, 2].flatMap((phase) =>
    tutor
      .buildQueue({ ...wave.progress, phase })
      .filter((q) => q.type === "teach")
      .map((q) => q.wordId),
  );
  assert.deepEqual(new Set(introduced), new Set(wave.words.map((w) => w.id)));
  assert.equal(tutor.buildQueue(wave.progress, "exam").length, 8);
  assert.ok(tutor.validateState(tutor.startSession(wave.progress, now)));
});
test("single-word wave starts and only references its own word", () => {
  const input = sample();
  input.words = input.words.slice(0, 1);
  const wave = parseWave(JSON.stringify(input), "single"),
    tutor = createTutor(wave.words);
  const p = tutor.startSession(wave.progress, now);
  assert.ok(p.active);
  assert.ok(p.active.queue.every((q) => q.wordId === wave.words[0].id));
});
test("malformed waves, incomplete content and invalid dates fail closed", () => {
  for (const modify of [
    (v) => v.words.push(v.words[0]),
    (v) => delete v.words[0].memory,
    (v) => (v.words[0].usages = []),
    (v) => (v.words[0].german = "a".repeat(201)),
    (v) => (v.words[0].usages = [["Sentence ___", "Translation", "a".repeat(201)]]),
    (v) => (v.words[0].forms = [["Requested form", "a".repeat(201), "Explanation"]]),
    (v) => (v.words[0].id = "__proto__"),
    (v) => (v.dueAt = "2026-09-28T09:00"),
    (v) => (v.words = []),
  ]) {
    const bad = sample();
    modify(bad);
    assert.throws(() => parseWave(JSON.stringify(bad), "wave-2"));
  }
  const bad = migrateLibrary();
  bad.waves[0].progress.active = { queue: [] };
  assert.equal(validateSave(bad), false);
  assert.equal(validateSave({ version: 3 }), false);
});
test("Miami deadlines do not depend on device zone; ambiguous DST times rejected", () => {
  assert.equal(parseMiami("2026-09-28T09:00"), WAVE_ONE_DEADLINE);
  assert.equal(miamiInput(WAVE_ONE_DEADLINE), "2026-09-28T09:00");
  assert.equal(parseMiami("2026-12-01T09:00"), Date.parse("2026-12-01T14:00Z"));
  assert.throws(() => parseMiami("2026-03-08T02:30"));
  assert.throws(() => parseMiami("2026-11-01T01:30"));
});
test("deadline never fabricates readiness; nearest upcoming actionable wave wins", () => {
  const library = migrateLibrary(undefined, now);
  library.waves.push(parseWave(JSON.stringify(sample()), "wave-2"));
  assert.equal(recommendedWave(library, now).id, "wave-1");
  assert.equal(waveStatus(library.waves[0], WAVE_ONE_DEADLINE + 1), "Past due");
  assert.equal(recommendedWave(library, WAVE_ONE_DEADLINE + 1).id, "wave-2");
  assert.equal(
    wavePlan(library.waves[0], WAVE_ONE_DEADLINE - 3600000).urgent,
    true,
  );
  assert.equal(
    wavePlan(library.waves[0], WAVE_ONE_DEADLINE - 3600000).remaining,
    27,
  );
});
test("short deadline permits recall before class without changing 8-hour mastery", () => {
  const wave = migrateLibrary().waves[0],
    tutor = createTutor(wave.words, { deadlineAt: WAVE_ONE_DEADLINE });
  const at = WAVE_ONE_DEADLINE - 3600000,
    p = seedTaught(tutor.freshState(), wave.words);
  p.startedAt = at;
  p.phase = 4;
  for (const w of Object.values(p.words)) {
    w.seen = true;
    w.introducedAt = at;
    w.lastExposedAt = at;
  }
  const s = tutor.startSession(p, at);
  assert.ok(s.active);
  const q = s.active.queue[0],
    answered = tutor.answerQuestion(s, tutor.describe(q).answer, at + 1000);
  assert.equal(answered.totalSteps, s.totalSteps + 1);
  assert.equal(answered.active.answers.at(-1).correct, true);
  assert.equal(answered.active.answers.at(-1).assisted, false);
  assert.equal(answered.words[q.wordId].delayed, false);
});
test("v2 sync persists all waves, offline draft and stable pending operation ID", () => {
  let local = fromRemote({ revision: 4, state: freshState() });
  const library = migrateLibrary(local.state, now);
  library.waves[0].progress = setDraft(
    completeLesson({ setTeachingStep, advance, setDraft }, startSession(freshState(), now), now),
    "draft",
  );
  assert.notEqual(library.waves[0].progress.active.queue[0].type, "teach");
  local = prepareUpload(editLocal(local, library), "operation-1");
  const restored = readLocal(JSON.stringify(local));
  assert.equal(restored.pending.mutationId, "operation-1");
  assert.equal(restored.state.waves[0].progress.active.draft, "draft");
  assert.equal(
    acknowledge(restored, { revision: 5, state: library }).dirty,
    false,
  );
});
