import test from "node:test";
import assert from "node:assert/strict";
import { WORDS, BY_ID, requiredSkills } from "../src/data.js";
import { MEMORY } from "../src/memory.js";
import {
  freshState,
  startSession,
  answerQuestion,
  advance,
  describe,
  grade,
  useHint,
  setDraft,
  setCorrection,
  correctionNeeded,
  correctionReady,
  summary,
  dayTwoAt,
  mastery,
  validateState,
  buildQueue,
  STORAGE_KEY,
} from "../src/engine.js";
import { loadProgress, saveProgress, parseBackup } from "../src/storage.js";
import { visitWordbank, delayedReviewAt } from "../src/engine.js";
import { setTeachingStep, startCorrection } from "../src/engine.js";

const BASE = new Date("2026-09-26T10:00:00").getTime();
test("extra practice before cold recall still permits hints and adaptive retries", () => {
  let state = onlyQuestion("muede", "spelling");
  state.active.phase = 4;
  state.active.kind = "extra";
  state = useHint(state, BASE);
  assert.equal(state.active.helped, true);
  state = answerQuestion(state, "mude", BASE);
  assert.equal(state.active.queue.length, 2);
});
test("car teaching and correction screens resume exactly without awarding mastery", () => {
  let state = startSession(freshState(), BASE);
  state = setTeachingStep(state, 1);
  assert.equal(parseBackup(JSON.stringify(state)).active.teachingStep, 1);
  assert.equal(mastery(state, "traurig").percent, 0);
  assert.equal(setTeachingStep(state, 10), state);
  state = onlyQuestion("muede", "spelling");
  state = answerQuestion(state, "mude", BASE);
  state = startCorrection(state);
  state = setCorrection(state, "mü");
  assert.equal(parseBackup(JSON.stringify(state)).active.correcting, true);
  assert.equal(parseBackup(JSON.stringify(state)).active.correction, "mü");
  state.active.teachingStep = 100;
  assert.equal(validateState(state), false);
});
test("looking in the word bank marks the current question as supported", () => {
  let state = onlyQuestion("muede", "spelling");
  state.words.muede.seen = true;
  state = visitWordbank(state, BASE);
  assert.equal(state.active.helped, true);
  assert.equal(state.words.muede.lastExposedAt, BASE);
  state = answerQuestion(state, "müde", BASE);
  assert.equal(state.words.muede.skills.spelling.wins, 0);
});
test("when only delayed recall is missing, the tutor schedules a gap instead of an endless immediate drill", () => {
  const state = freshState();
  state.phase = 7;
  state.startedAt = BASE;
  for (const word of Object.values(state.words)) {
    word.seen = true;
    word.introducedAt = BASE;
    word.lastExposedAt = BASE;
    for (const skill of Object.values(word.skills)) skill.wins = 2;
  }
  assert.equal(delayedReviewAt(state), BASE + 8 * 3600000);
  assert.equal(startSession(state, BASE + 3600000), state);
  assert.ok(startSession(state, BASE + 8 * 3600000 + 1).active);
});
function completeSession(
  initial,
  at = BASE,
  answer = (q) => describe(q).answer,
) {
  let state = initial,
    turns = 0;
  while (state.active) {
    assert.ok(
      ++turns < 500,
      "Every session must finish, even for a struggling student",
    );
    const q = state.active.queue[0];
    if (q.type !== "teach" && !state.active.feedback)
      state = answerQuestion(state, answer(q), at + turns * 1000);
    if (correctionNeeded(state))
      state = setCorrection(state, describe(q).answer);
    state = advance(state, at + turns * 1000);
  }
  return state;
}
function onlyQuestion(id, type, extra = {}) {
  const s = startSession(freshState(), BASE);
  s.active.queue = [{ wordId: id, type, variant: 0, retry: 0, ...extra }];
  return s;
}
test("all 27 lesson words have original memory stories, reconstructable spelling chunks, and two usage variants", () => {
  assert.equal(WORDS.length, 27);
  assert.equal(new Set(WORDS.map((w) => w.id)).size, 27);
  for (const w of WORDS) {
    assert.equal(
      MEMORY[w.id].chunks.join(""),
      w.german.replace(/^(der|die|sich) /, ""),
      w.id,
    );
    assert.ok(MEMORY[w.id].scene.length > 30 && MEMORY[w.id].watch.length > 15);
    assert.equal(w.usages.length, 2);
    for (let variant = 0; variant < 2; variant++) {
      for (const type of requiredSkills(w)) {
        const q = { wordId: w.id, type, variant, retry: 0 };
        assert.equal(grade(q, describe(q).answer).correct, true);
      }
    }
  }
});
test("spelling grading preserves umlauts, ß, capital nouns, articles, spaces, and reflexive form", () => {
  const q = (id) => ({ wordId: id, type: "spelling", variant: 0 });
  for (const [id, wrong] of [
    ["muede", "mude"],
    ["fleissig", "fleissig"],
    ["brief", "der brief"],
    ["brief", "Brief"],
    ["fuehlen", "fühlen"],
    ["weit-weg", "weitweg"],
    ["hoffentlich", "hoffenlich"],
    ["fahrradtrial", "der Fahrradtrail"],
  ])
    assert.equal(grade(q(id), wrong).correct, false, wrong);
  assert.equal(
    grade(q("muede"), "mu\u0308de").correct,
    true,
    "Unicode combining characters normalize",
  );
  assert.equal(grade(q("brief"), " Der   Brief. ").correct, true);
  assert.equal(
    grade(q("fuehlen"), "fühlen (sich)").correct,
    true,
    "The supplied lesson notation is accepted",
  );
  assert.match(grade(q("brief"), "Brief").message, /article/);
  assert.match(grade(q("muede"), "mude").message, /exact lesson spelling/);
});
test("reading a word and copying a correction never award mastery", () => {
  let s = startSession(freshState(), BASE);
  s = advance(s, BASE); // teach
  assert.equal(s.words.traurig.seen, true);
  assert.equal(mastery(s, "traurig").percent, 0);
  s = onlyQuestion("muede", "spelling");
  s = answerQuestion(s, "mude", BASE);
  assert.equal(correctionNeeded(s), true);
  assert.equal(advance(s, BASE), s, "Cannot advance until correction is typed");
  s = setCorrection(s, "müde");
  assert.equal(correctionReady(s), true);
  s = advance(s, BASE);
  assert.equal(s.words.muede.skills.spelling.wins, 0);
});
test("a hint awards no mastery and schedules another unaided retrieval", () => {
  let s = onlyQuestion("traurig", "spelling");
  s = useHint(s, BASE);
  s = answerQuestion(s, "traurig", BASE);
  assert.equal(s.words.traurig.skills.spelling.wins, 0);
  assert.equal(s.active.queue.length, 2);
  assert.equal(s.active.answers[0].assisted, true);
});
test("wrong answers are repeated after other words, with explanations and bounded retry counts", () => {
  let s = startSession(freshState(), BASE);
  s = advance(s, BASE);
  s = answerQuestion(s, "wrong", BASE);
  assert.equal(s.active.feedback.correct, false);
  assert.ok(s.active.feedback.message.includes("sad"));
  assert.equal(s.active.queue[5].wordId, "traurig");
  assert.equal(s.active.queue[5].retry, 1);
  const done = completeSession(s, BASE, () => "wrong");
  assert.equal(done.phase, 1);
  assert.equal(summary(done).ready, 0);
  assert.equal(summary(done).introduced, 9);
});
test("every word is introduced on Day 1 and the cold recall session cannot start early", () => {
  let s = freshState();
  for (let phase = 0; phase < 4; phase++)
    s = completeSession(
      startSession(s, BASE + phase * 30 * 60000),
      BASE + phase * 30 * 60000,
    );
  assert.equal(s.phase, 4);
  assert.equal(summary(s).introduced, 27);
  assert.equal(startSession(s, BASE + 3 * 3600000), s);
  assert.equal(new Set(buildQueue(s).map((q) => q.wordId)).size, 27);
  const later = dayTwoAt(s) + 1;
  s = completeSession(startSession(s, later), later);
  assert.equal(s.phase, 5);
  assert.ok(
    Object.values(s.words).every((w) => w.delayed),
    "A successful cold recall earns delayed recall for all words",
  );
});
test("two spaced successes are required; immediate repeated answers cannot inflate a skill", () => {
  let s = onlyQuestion("traurig", "spelling");
  s.active.queue = Array.from({ length: 2 }, () => ({
    wordId: "traurig",
    type: "spelling",
    variant: 0,
    retry: 0,
  }));
  s = answerQuestion(s, "traurig", BASE);
  s = advance(s, BASE);
  s = answerQuestion(s, "traurig", BASE);
  assert.equal(s.words.traurig.skills.spelling.wins, 1);
  assert.equal(s.words.traurig.delayed, false);
});
test("exam covers all 27 words twice, disables hints, and reveals grades only after finishing", () => {
  let s = freshState();
  s.phase = 6;
  s = startSession(s, BASE);
  assert.equal(s.active.queue.length, 54);
  const counts = Object.fromEntries(WORDS.map((w) => [w.id, 0]));
  s.active.queue.forEach((q) => counts[q.wordId]++);
  assert.ok(Object.values(counts).every((n) => n === 2));
  assert.equal(useHint(s), s);
  s = answerQuestion(s, "wrong", BASE);
  assert.deepEqual(s.active.feedback, { hidden: true });
  assert.equal(
    s.active.queue.length,
    54,
    "No adaptive retries interrupt the exam",
  );
  s = completeSession(s, BASE);
  assert.equal(s.phase, 7);
  assert.equal(s.sessions.at(-1).count, 54);
  assert.equal(s.sessions.at(-1).mistakes.length, 1);
  assert.equal(s.sessions.at(-1).correct, 53);
});
test("perfect student completes the full course and can reach real mastery", () => {
  let s = freshState(),
    now = BASE;
  for (let i = 0; i < 10; i++) {
    if (s.phase === 4) now = dayTwoAt(s) + 1;
    s = completeSession(startSession(s, now), now);
    now += 30 * 60000;
    assert.equal(validateState(s), true);
    if (s.phase >= 7 && summary(s).ready === 27) break;
  }
  assert.equal(summary(s).ready, 27);
  assert.equal(s.sessions.find((r) => r.kind === "exam").score, 100);
});
test("progress, in-progress typing, and feedback survive serialization; bad saves never overwrite silently", () => {
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
  let s = onlyQuestion("muede", "spelling");
  s = setDraft(s, "mü");
  assert.equal(saveProgress(storage, s), true);
  assert.equal(loadProgress(storage).state.active.draft, "mü");
  s = answerQuestion(s, "mude", BASE);
  s = setCorrection(s, "mü");
  saveProgress(storage, s);
  assert.equal(loadProgress(storage).state.active.correction, "mü");
  assert.deepEqual(parseBackup(JSON.stringify(s)), s);
  storage.setItem(STORAGE_KEY, "{broken");
  assert.equal(loadProgress(storage).blocked, true);
  assert.equal(storage.getItem(STORAGE_KEY), "{broken");
  assert.throws(() => parseBackup('{"version":1}'), /compatible/);
  assert.equal(
    saveProgress(
      {
        setItem() {
          throw new Error("quota");
        },
      },
      s,
    ),
    false,
  );
});
