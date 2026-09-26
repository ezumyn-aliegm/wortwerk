import test from "node:test";
import assert from "node:assert/strict";
import { migrateLibrary, validateSave } from "../src/library.js";
import { createTutor } from "../src/tutor.js";
import { activeSeconds } from "../src/study-clock.js";
import {
  UPLOAD_LIMIT, uploadBody, serializeBackup, parseLibraryBackup, importWave,
  replaceWaveProgress, parentLocked, prepareParentView, emptyStudyClock, touchStudyClock,
} from "../src/library-state.js";

const NOW = Date.parse("2026-09-26T15:00:00Z");
const bytes = (raw) => new TextEncoder().encode(raw).length;
function library() {
  const value = migrateLibrary(undefined, NOW);
  value.waves.push({ ...structuredClone(value.waves[0]), id: "wave-2" });
  return value;
}
function lesson(value) {
  return JSON.stringify({ title: "Next wave", dueAt: "2026-10-05T09:00:00-04:00", words: value.waves[0].words.slice(0, 3) });
}
function deferredFile(raw) {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  return { file: { size: bytes(raw), text: () => pending }, finish: () => resolve(raw) };
}
function largeLibrary(target) {
  const value = library();
  const mistakes = value.waves[0].words.flatMap((word) => [0, 1].map(() => ({
    wordId: word.id, type: "spelling", variant: 0, input: "not remembered",
    expected: word.german, message: word.tip, correct: false, assisted: false, at: NOW,
  })));
  const session = { kind: "exam", phase: 6, startedAt: NOW, finishedAt: NOW,
    count: mistakes.length, correct: 0, score: 0, mistakes };
  for (let i = 0; bytes(serializeBackup(value)) < target; i++) {
    assert.ok(i < 200, "fixture stays within the tutor's session retention");
    value.waves[i % 2].progress.sessions.push(structuredClone(session));
  }
  assert.ok(validateSave(value));
  return value;
}

test("backups above the former 1.9 MB cutoff remain restorable and uploadable", () => {
  const value = largeLibrary(1_950_000);
  const compact = serializeBackup(value);
  const pretty = JSON.stringify(value, null, 2);
  assert.ok(bytes(compact) > 1_900_000);
  assert.ok(bytes(pretty) > UPLOAD_LIMIT);
  assert.deepEqual(parseLibraryBackup(compact), value);
  assert.deepEqual(parseLibraryBackup(pretty), value);
  assert.doesNotThrow(() => uploadBody({ revision: 1, mutationId: "restore", state: value }));
});

test("oversized offline saves still round-trip; only the upload is refused", () => {
  const value = largeLibrary(UPLOAD_LIMIT + 1000);
  assert.deepEqual(parseLibraryBackup(serializeBackup(value)), value);
  assert.throws(() => uploadBody({ revision: 1, mutationId: "large", state: value }),
    (error) => error.code === "SAVE_TOO_LARGE");
});

test("upload limit counts the whole compact envelope in UTF-8 bytes", () => {
  const pending = { revision: 1, mutationId: "id", state: { text: "" } };
  const overhead = bytes(serializeBackup(pending));
  pending.state.text = "a".repeat(UPLOAD_LIMIT - overhead);
  assert.equal(bytes(uploadBody(pending)), UPLOAD_LIMIT);
  pending.state.text += "ä";
  assert.throws(() => uploadBody(pending), { code: "SAVE_TOO_LARGE" });
});

test("overlapping imports retain newer answers, edited deadlines, and both waves", async () => {
  let current = library();
  const a = deferredFile(lesson(current)), b = deferredFile(lesson(current));
  const update = (fn) => { current = fn(current); };
  const first = importWave(a.file, update, "wave-3");
  const second = importWave(b.file, update, "wave-4");
  const progress = { ...current.waves[0].progress, totalSteps: 12 };
  current = replaceWaveProgress(current, "wave-1", progress);
  current = { ...current, waves: current.waves.map((w) => ({ ...w, dueAt: w.dueAt + 3600000 })) };
  const deadline = current.waves[0].dueAt;
  b.finish(); await second;
  a.finish(); await first;
  assert.equal(current.waves.length, 4);
  assert.equal(current.waves[0].progress, progress);
  assert.equal(current.waves[0].dueAt, deadline);
  assert.deepEqual(current.waves.slice(2).map((w) => w.id), ["wave-4", "wave-3"]);
});

test("an import interrupted by remote replacement leaves the new library untouched", async () => {
  let current = library(), epoch = 0;
  const file = deferredFile(lesson(current));
  const startingEpoch = epoch;
  const pending = importWave(file.file, (fn) => { current = fn(current); }, "wave-3", () => epoch === startingEpoch);
  const remote = library();
  remote.waves[0].title = "New server version";
  remote.waves[0].progress.totalSteps = 23;
  current = remote;
  epoch++;
  file.finish();
  await assert.rejects(pending, /library changed/);
  assert.equal(current, remote);
  assert.equal(current.waves.length, 2);
  assert.equal(current.waves[0].progress.totalSteps, 23);
});

test("pending imports recheck capacity against the latest library", async () => {
  let current = library();
  const word = current.waves[0].words[0];
  current.waves = Array.from({ length: 49 }, (_, i) => ({
    ...current.waves[0], id: `wave-${i + 1}`, words: [word], progress: createTutor([word]).freshState(),
  }));
  const a = deferredFile(lesson(current)), b = deferredFile(lesson(current));
  const update = (fn) => { current = fn(current); };
  const first = importWave(a.file, update, "wave-50");
  const second = importWave(b.file, update, "wave-51");
  a.finish(); await first;
  b.finish(); await assert.rejects(second, /50 waves/);
  assert.equal(current.waves.length, 50);
});

test("a progress callback targets its original wave even after selection changes", () => {
  const value = library();
  const secondProgress = value.waves[1].progress;
  value.selectedWaveId = "wave-2";
  const progress = { ...value.waves[0].progress, totalSteps: 7 };
  const next = replaceWaveProgress(value, "wave-1", progress);
  assert.equal(next.waves[0].progress, progress);
  assert.equal(next.waves[1].progress, secondProgress);
  assert.equal(next.selectedWaveId, "wave-2");
  assert.equal(replaceWaveProgress(next, "removed-wave", progress), next);
});

test("any wave's exam or cold check blocks parent answers regardless of selection", () => {
  for (const [kind, phase] of [["exam", 6], ["course", 4]]) {
    const value = library(), wave = value.waves[1];
    const tutor = createTutor(wave.words);
    wave.progress = tutor.startSession(wave.progress, NOW);
    wave.progress.active.kind = kind;
    wave.progress.active.phase = phase;
    assert.equal(value.selectedWaveId, "wave-1");
    assert.equal(parentLocked(value), true);
    assert.equal(prepareParentView(value, NOW + 1000), value);
  }
});

test("opening parent marks active questions assisted without losing drafts or queues", () => {
  const value = library();
  for (const wave of value.waves) {
    const tutor = createTutor(wave.words);
    wave.progress = tutor.startSession(wave.progress, NOW);
    const q = { wordId: wave.words[0].id, type: "spelling", variant: 0, retry: 0 };
    wave.progress.active.queue = [q];
    wave.progress.active.draft = "unfinished";
    wave.progress.words[q.wordId].seen = true;
  }
  const before = structuredClone(value);
  const next = prepareParentView(value, NOW + 1000);
  assert.equal(parentLocked(next), false);
  assert.deepEqual(value, before);
  for (let i = 0; i < next.waves.length; i++) {
    const progress = next.waves[i].progress;
    assert.equal(progress.active.helped, true);
    assert.equal(progress.active.draft, "unfinished");
    assert.deepEqual(progress.active.queue, before.waves[i].progress.active.queue);
    assert.equal(progress.words[progress.active.queue[0].wordId].lastExposedAt, NOW + 1000);
  }
});

test("wave navigation clears attribution until a new learning interaction", () => {
  let clock = { enabled: true, sessionId: "old-visit", lastInteraction: NOW, accountedAt: NOW, waveId: "wave-1" };
  clock = emptyStudyClock(NOW + 1000);
  clock.enabled = true;
  assert.equal(clock.waveId, null);
  assert.equal(activeSeconds(clock, NOW + 11000, { visible: true, focused: true }), 0);
  Object.assign(clock, { sessionId: "new-visit", waveId: "wave-2", lastInteraction: NOW + 12000, accountedAt: NOW + 12000 });
  assert.equal(activeSeconds(clock, NOW + 22000, { visible: true, focused: true }), 10);
});

test("input capture only refreshes an existing active visit and does not count prior idle time", () => {
  const clock = emptyStudyClock(NOW);
  touchStudyClock(clock, "wave-1", NOW + 1000);
  assert.equal(clock.sessionId, null);
  assert.equal(clock.lastInteraction, 0);
  Object.assign(clock, { enabled: true, sessionId: "visit", waveId: "wave-1", lastInteraction: NOW });
  touchStudyClock(clock, "wave-1", NOW + 500);
  assert.equal(clock.lastInteraction, NOW, "capture is throttled");
  touchStudyClock(clock, "wave-2", NOW + 2000);
  assert.equal(clock.lastInteraction, NOW, "other waves cannot extend a visit");
  touchStudyClock(clock, "wave-1", NOW + 100000);
  assert.equal(clock.lastInteraction, NOW + 100000);
  assert.equal(clock.accountedAt, NOW + 100000, "idle time is not backfilled");
  touchStudyClock(clock, "wave-1", NOW + 500000);
  assert.equal(clock.lastInteraction, NOW + 100000, "expired visits need a new study action");
  clock.enabled = false;
  touchStudyClock(clock, "wave-1", NOW + 102000);
  assert.equal(clock.lastInteraction, NOW + 100000, "game and pause time stay excluded");
});
