import test from "node:test";
import assert from "node:assert/strict";
import { WORDS, BY_ID } from "../src/data.js";
import { createTutor } from "../src/tutor.js";
import { migrateLibrary, validateSave } from "../src/library.js";
import { serializeBackup, parseLibraryBackup } from "../src/library-state.js";
import { parseBackup } from "../src/storage.js";

const tutor = createTutor(WORDS);
const NOW = Date.parse("2026-09-26T15:00:00Z");
const q = (wordId, type, extra = {}) => ({ wordId, type, variant: 0, retry: 0, ...extra });
function active(question) {
  const s = tutor.startSession(tutor.freshState(), NOW);
  s.active.queue = [question]; s.active.initialCount = 1;
  return s;
}

test("legacy teach queue preserves draft and feedback across single and library saves", () => {
  const s = active(q("brief", "teach"));
  s.active.draft = "die Bri";
  s.active.feedback = { wordId: "brief", type: "spelling", correct: false, assisted: false, input: "Brief", expected: "Brief", message: "Try again", at: NOW };
  const old = structuredClone(s);
  assert.deepEqual(parseBackup(JSON.stringify(s)), old);
  const lib = migrateLibrary(s, NOW);
  assert.deepEqual(lib.waves[0].progress, old);
  const copy = parseLibraryBackup(serializeBackup(lib));
  assert.deepEqual(copy.waves[0].progress, old);
});

test("intro draft roundtrips unchanged; only the exact headword advances it", () => {
  let s = active(q("traurig", "teach", { intro: true }));
  assert.equal(tutor.teachingPages(BY_ID.traurig, s.active.queue[0]).length, 1);
  s.active.draft = "trau";
  s = parseBackup(JSON.stringify(s));
  assert.equal(s.active.draft, "trau");
  assert.equal(tutor.advance(s, NOW + 1), s);
  s = tutor.setDraft(s, BY_ID.traurig.german);
  s = parseBackup(JSON.stringify(s));
  const next = tutor.advance(s, NOW + 2);
  assert.deepEqual(next.words.traurig.taught, ["meaning", "spelling"]);
  assert.equal(next.words.traurig.seen, true);
  assert.equal(tutor.mastery(next, "traurig").percent, 0);
  assert.equal(next.totalSteps, 0);
});

test("intro never removes article/reflexive requirements or JIT usage/form teaching", () => {
  for (const word of WORDS.filter((w) => /^(der|die|das|sich) /.test(w.german))) {
    const s = active(q(word.id, "teach", { intro: true }));
    s.active.draft = word.german.replace(/^(der|die|das|sich) /, "");
    assert.equal(tutor.advance(s, NOW), s, word.id);
  }
  for (const word of WORDS) for (const type of ["usage", ...(word.forms.length ? ["form"] : [])]) {
    const s = active(q(word.id, type));
    assert.equal(tutor.missingTeaching(s).topic.startsWith(type), true);
    const taught = tutor.acknowledgeTeaching(s, NOW + 1);
    assert.ok(taught.active.taughtHere.length);
    assert.equal(tutor.missingTeaching(taught), null);
    const answered = tutor.answerQuestion(taught, tutor.describe(taught.active.queue[0]).answer, NOW + 2);
    assert.equal(answered.active.answers[0].assisted, true);
  }
});

test("each word intro followed by spelling marks it seen without mastery or rewards", () => {
  for (const word of WORDS) {
    let s = tutor.startSession(tutor.freshState(), NOW);
    s.active.queue = [
      { wordId: word.id, type: "teach", variant: 0, retry: 0, intro: true },
      { wordId: word.id, type: "spelling", variant: 0, retry: 0 },
    ];
    s.active.initialCount = 2;
    s = tutor.setDraft(s, word.german);
    s = tutor.advance(s, NOW + 1);
    assert.equal(s.words[word.id].seen, true, word.id);
    assert.equal(tutor.mastery(s, word.id).percent, 0, word.id);
    assert.equal(s.totalSteps, 0, word.id);
    s = tutor.answerQuestion(s, word.german, NOW + 2);
    s = tutor.advance(s, NOW + 3);
    assert.equal(s.words[word.id].seen, true, word.id);
  }
});

test("malformed intro property is rejected", () => {
  const malformed = active(q("traurig", "teach", { intro: "yes" }));
  assert.equal(tutor.validateState(malformed), false);
  assert.equal(validateSave(malformed), false);
});
