import test from "node:test";
import assert from "node:assert/strict";
import { WORDS, BY_ID } from "../src/data.js";
import { createTutor } from "../src/tutor.js";
import { migrateLibrary, validateLibrary } from "../src/library.js";
import { parseBackup } from "../src/storage.js";
import { seedTaught, teachingTopics } from "./teaching-fixtures.mjs";

const tutor = createTutor(WORDS);
const BASE = Date.parse("2026-09-26T14:00:00Z");
const question = (wordId, type, variant = 0) => ({ wordId, type, variant, retry: 0 });
function exercise(q) {
  const state = tutor.startSession(tutor.freshState(), BASE);
  state.active.queue = [q];
  state.active.initialCount = 1;
  return state;
}
function exercises(word) {
  return [
    [question(word.id, "meaning"), "meaning", word.english],
    [question(word.id, "spelling"), "spelling", word.german],
    ...word.usages.map((usage, i) => [question(word.id, "usage", i), `usage:${i}`, usage[2]]),
    ...word.forms.map((form, i) => [question(word.id, "form", i), `form:${i}`, form[1]]),
  ];
}

test("all 27 words explicitly teach meaning, spelling, and every usage/form variant", () => {
  assert.equal(WORDS.length, 27);
  for (const word of WORDS) {
    const pages = tutor.teachingPages(word);
    assert.equal(pages.length, 3 + word.usages.length + word.forms.length, word.id);
    assert.deepEqual(pages.flatMap((page) => page.tags), teachingTopics(word), word.id);
    assert.equal(pages.find((page) => page.tags.includes("meaning")).answer, word.german);
    assert.equal(pages.find((page) => page.tags.includes("spelling")).answer, word.german);
    const example = pages.find((page) => page.kind === "example");
    assert.equal(example.answer, word.example);
    assert.equal(example.translation, word.translation);
    for (const [i, [sentence, translation, answer]] of word.usages.entries()) {
      const page = pages.find((page) => page.tags.includes(`usage:${i}`));
      assert.equal(page.prompt, sentence, `${word.id}/usage:${i}`);
      assert.equal(page.answer, sentence.replace("___", answer));
      assert.equal(page.translation, translation);
    }
    for (const [i, [prompt, answer, explanation]] of word.forms.entries()) {
      const page = pages.find((page) => page.tags.includes(`form:${i}`));
      assert.equal(page.prompt, prompt, `${word.id}/form:${i}`);
      assert.equal(page.answer, answer);
      assert.equal(page.explanation, explanation);
    }
  }
});

test("every untaught exercise is blocked; its first answer after teaching is assisted", () => {
  for (const word of WORDS) {
    for (const [q, topic, correct] of exercises(word)) {
      const state = exercise(q), before = structuredClone(state);
      assert.equal(tutor.questionTopic(q), topic);
      assert.equal(tutor.missingTeaching(state).topic, topic, `${word.id}/${topic}`);
      assert.equal(tutor.answerQuestion(state, correct, BASE + 1000), state);
      assert.deepEqual(state, before, "A blocked answer must not alter any progress");
      const taught = tutor.acknowledgeTeaching(state, BASE + 2000);
      assert.deepEqual(state, before, "Acknowledging must not mutate the prior save");
      assert.equal(taught.totalSteps, 0);
      assert.deepEqual(taught.active.queue, before.active.queue);
      assert.equal(taught.words[word.id].lastExposedAt, BASE + 2000);
      assert.ok(taught.active.taughtHere.includes(`${word.id}/${topic}`));
      assert.equal(tutor.missingTeaching(taught), null);
      assert.equal(tutor.acknowledgeTeaching(taught, BASE + 3000), taught);
      const answered = tutor.answerQuestion(taught, correct, BASE + 3000);
      assert.equal(answered.totalSteps, 1);
      assert.equal(answered.active.answers[0].correct, true);
      assert.equal(answered.active.answers[0].assisted, true);
      assert.ok(Object.values(answered.words[word.id].skills).every((skill) => skill.wins === 0));
      assert.equal(answered.words[word.id].delayed, false);
      assert.equal(tutor.validateState(answered), true);
    }
  }
});

for (const intervening of [0, 3]) {
  test(`teaching supports only the first answer; retry after ${intervening} intervening questions respects skill spacing`, () => {
    let state = seedTaught(exercise(question("muede", "spelling")));
    state.words.muede.taught = state.words.muede.taught.filter((topic) => topic !== "spelling");
    state.totalSteps = 10;
    Object.assign(state.words.muede.skills.spelling, { wins: 1, attempts: 1, lastStep: 10 });
    const fillers = ["brief", "traurig", "job"].slice(0, intervening)
      .map((id) => question(id, "meaning"));
    state.active.queue.push(...fillers);
    state.active.initialCount = state.active.queue.length;

    state = tutor.acknowledgeTeaching(state, BASE + 1000);
    assert.equal(state.active.preparationAdded, true);
    assert.deepEqual(state.active.taughtHere, ["muede/spelling"]);
    state = tutor.answerQuestion(state, "müde", BASE + 2000);
    assert.equal(state.active.answers.at(-1).assisted, true);
    assert.equal(state.words.muede.skills.spelling.wins, 1);
    assert.equal(state.words.muede.skills.spelling.lastStep, 10);
    assert.deepEqual(state.active.taughtHere, [], "The first response consumes its support token");
    assert.equal(state.active.preparationAdded, true);
    assert.equal(state.active.queue.at(-1).wordId, "muede");
    assert.equal(state.active.queue.at(-1).retry, 1, "The engine schedules a hidden-answer retry");
    state = tutor.advance(state, BASE + 3000);
    state = parseBackup(JSON.stringify(state));
    assert.equal(state.active.preparationAdded, true, "Preparation survives saving after token consumption");
    for (const q of fillers) {
      assert.deepEqual(state.active.queue[0], q);
      state = tutor.answerQuestion(state, BY_ID[q.wordId].english, BASE + 4000);
      state = tutor.advance(state, BASE + 5000);
    }
    assert.equal(state.active.queue[0].retry, 1);
    assert.equal(state.active.feedback, null);
    assert.equal(state.active.helped, false);
    assert.equal(tutor.missingTeaching(state), null);
    state = tutor.answerQuestion(state, "müde", BASE + 6000);
    assert.equal(state.active.answers.at(-1).assisted, false);
    assert.equal(state.words.muede.skills.spelling.wins, intervening === 0 ? 1 : 2);
    assert.equal(state.words.muede.skills.spelling.lastStep, intervening === 0 ? 10 : 15);
    assert.equal(state.words.muede.delayed, false, "An immediate retry is not eight-hour recall");
    assert.equal(state.active.queue.length, 1, "The unaided correct retry adds no further retry");
    state = tutor.advance(state, BASE + 7000);
    assert.equal(state.active, null);
    const result = state.sessions.at(-1);
    assert.equal(result.preparationAdded, true, "Summary retains preparation after all tokens are consumed");
    assert.equal(result.count, intervening + 2);
    assert.equal(result.correct, intervening + 1);
    assert.equal(result.mistakes.length, 1);
    assert.equal(result.mistakes[0].assisted, true);
    assert.equal(tutor.validateState(state), true);
  });
}

test("one taught variant cannot authorize another, and wrapped variants use the matching lesson", () => {
  for (const word of WORDS) {
    for (const [type, variants] of [["usage", word.usages], ["form", word.forms]]) {
      for (let i = 0; i < variants.length; i++) {
        const q = question(word.id, type, i + variants.length * 2);
        const state = seedTaught(exercise(q));
        state.words[word.id].taught = state.words[word.id].taught.filter((topic) => topic !== `${type}:${i}`);
        assert.equal(tutor.questionTopic(q), `${type}:${i}`);
        assert.equal(tutor.missingTeaching(state).topic, `${type}:${i}`);
        assert.equal(tutor.answerQuestion(state, tutor.describe(q).answer, BASE), state);
      }
    }
  }
});

test("teaching cannot be skipped or advanced until every explicit page has been visited", () => {
  for (const word of WORDS) {
    let state = exercise(question(word.id, "teach"));
    state.active.queue.push(question(word.id, "spelling"));
    state.active.initialCount = 2;
    const finalPage = 2 + word.usages.length + word.forms.length;
    for (let page = 0; page < finalPage; page++) {
      assert.equal(state.active.teachingStep, page);
      assert.equal(tutor.advance(state, BASE), state, `${word.id}: page ${page} cannot finish teaching`);
      assert.equal(tutor.answerQuestion(state, word.german, BASE), state);
      assert.equal(tutor.setTeachingStep(state, page + 2), state, "Cannot jump over a page");
      state = tutor.setTeachingStep(state, page + 1);
      assert.equal(tutor.validateState(state), true);
      assert.equal(state.words[word.id].seen, false);
      assert.equal(tutor.mastery(state, word.id).percent, 0);
    }
    for (const invalid of [-1, 1.5, NaN, finalPage + 1])
      assert.equal(tutor.setTeachingStep(state, invalid), state);
    const lastTopic = teachingTopics(word).at(-1);
    assert.ok(!state.words[word.id].taught.includes(lastTopic), "Final page is acknowledged on advance");
    state = tutor.advance(state, BASE + 1000);
    assert.equal(state.active.queue[0].type, "spelling");
    assert.equal(state.active.completed, 1);
    assert.equal(state.words[word.id].seen, true);
    assert.deepEqual(state.words[word.id].taught, teachingTopics(word));
    assert.equal(state.totalSteps, 0);
    assert.equal(tutor.mastery(state, word.id).percent, 0);
  }
});

test("legacy absent teaching history preserves drafts, queue and progress through migration and preparation", () => {
  const legacy = exercise(question("brief", "form", 0));
  legacy.active.queue.push(question("muede", "spelling"));
  legacy.active.initialCount = 2;
  legacy.active.draft = "die Bri";
  legacy.active.completed = 7;
  legacy.totalSteps = 12;
  for (const progress of Object.values(legacy.words)) delete progress.taught;
  const before = structuredClone(legacy);
  assert.equal(tutor.validateState(legacy), true);
  assert.deepEqual(parseBackup(JSON.stringify(legacy)), before);
  const library = migrateLibrary(legacy, BASE);
  assert.equal(validateLibrary(library), true);
  assert.deepEqual(library.waves[0].progress, before);
  assert.equal(Object.hasOwn(library.waves[0].progress.words.brief, "taught"), false);
  assert.equal(tutor.answerQuestion(legacy, "die Briefe", BASE), legacy);
  const prepared = tutor.acknowledgeTeaching(legacy, BASE + 1000);
  assert.deepEqual(prepared.active.queue, before.active.queue);
  assert.equal(prepared.active.draft, "die Bri");
  assert.equal(prepared.active.completed, 7);
  assert.equal(prepared.totalSteps, 12);
  assert.deepEqual(prepared.words.brief.skills, before.words.brief.skills);
  assert.deepEqual(legacy, before);
  assert.deepEqual(parseBackup(JSON.stringify(prepared)), prepared);
  const answered = tutor.answerQuestion(prepared, "die Briefe", BASE + 2000);
  assert.equal(answered.active.answers[0].assisted, true);
});

test("wrong plural correction requires the exact plural rather than the dictionary headword", () => {
  let state = seedTaught(exercise(question("brief", "form", 0)));
  assert.equal(BY_ID.brief.forms[0][1], "die Briefe");
  state = tutor.answerQuestion(state, "die Brief", BASE);
  assert.equal(tutor.correctionNeeded(state), true);
  assert.equal(state.active.feedback.expected, "die Briefe");
  assert.equal(tutor.advance(state, BASE), state);
  state = tutor.startCorrection(state);
  for (const wrong of ["der Brief", "Briefe", "die briefe", "die Brief"]) {
    const copy = tutor.setCorrection(state, wrong);
    assert.equal(tutor.correctionReady(copy), false, wrong);
    assert.equal(tutor.advance(copy, BASE), copy);
  }
  const corrected = tutor.setCorrection(state, "die Briefe");
  assert.equal(tutor.correctionReady(corrected), true);
  assert.deepEqual(corrected.words.brief.skills, state.words.brief.skills);
  assert.notEqual(tutor.advance(corrected, BASE), corrected);
  assert.equal(corrected.words.brief.skills.form.wins, 0);
});

test("wrong spelling, usage and form require correction, while meaning and exams do not", () => {
  for (const type of ["meaning", "spelling", "usage", "form"]) {
    const state = seedTaught(exercise(question("brief", type)));
    const answered = tutor.answerQuestion(state, "synthetic wrong answer", BASE);
    assert.equal(tutor.correctionNeeded(answered), type !== "meaning", type);
    if (type !== "meaning") {
      assert.equal(tutor.advance(answered, BASE), answered);
      const corrected = tutor.setCorrection(answered, tutor.describe(state.active.queue[0]).answer);
      assert.equal(tutor.correctionReady(corrected), true);
      assert.notEqual(tutor.advance(corrected, BASE), corrected);
    }
    state.active.kind = "exam";
    const examAnswer = tutor.answerQuestion(state, "synthetic wrong answer", BASE);
    assert.equal(tutor.correctionNeeded(examAnswer), false);
    assert.deepEqual(examAnswer.active.feedback, { hidden: true });
  }
});

test("an entirely untaught exam prepares all 54 questions before grading and earns no unaided score", () => {
  let state = tutor.startSession(tutor.freshState(), BASE, "exam");
  const queue = structuredClone(state.active.queue);
  const expected = new Set(WORDS.flatMap((word) => [
    `${word.id}/spelling`,
    `${word.id}/${word.forms.length ? `form:${1 % word.forms.length}` : `usage:${1 % word.usages.length}`}`,
  ]));
  const prepared = new Set();
  assert.equal(expected.size, 54);
  while (tutor.missingTeaching(state)) {
    const lesson = tutor.missingTeaching(state);
    const topic = `${lesson.wordId}/${lesson.topic}`;
    assert.ok(expected.has(topic), topic);
    assert.ok(!prepared.has(topic), "Acknowledged topics must leave the preflight");
    assert.equal(tutor.answerQuestion(state, tutor.describe(queue[0]).answer, BASE), state);
    state = tutor.acknowledgeTeaching(state, BASE + 1000);
    prepared.add(topic);
    assert.deepEqual(state.active.queue, queue);
    assert.equal(state.totalSteps, 0);
    assert.equal(state.active.answers.length, 0);
    assert.equal(tutor.validateState(state), true);
  }
  assert.deepEqual(prepared, expected);
  for (const q of queue) {
    assert.deepEqual(state.active.queue[0], q);
    state = tutor.answerQuestion(state, tutor.describe(q).answer, BASE + 2000);
    assert.equal(state.active.answers.at(-1).assisted, true);
    assert.deepEqual(state.active.feedback, { hidden: true });
    state = tutor.advance(state, BASE + 2000);
  }
  assert.equal(state.active, null);
  assert.equal(state.sessions.at(-1).count, 54);
  assert.equal(state.sessions.at(-1).correct, 0);
  assert.equal(state.sessions.at(-1).score, 0);
  assert.equal(state.sessions.at(-1).preparationAdded, true);
  assert.equal(tutor.summary(state).percent, 0);
});

for (const kind of ["exam", "cold recall"]) {
  test(`${kind} preflights missing topics anywhere in the remaining queue before the first answer`, () => {
    let state = seedTaught(tutor.freshState());
    state.phase = kind === "exam" ? 6 : 4;
    state = tutor.startSession(state, BASE);
    assert.ok(state.active.queue.length > 1);
    const first = state.active.queue[0], last = state.active.queue.at(-1);
    const lastWord = BY_ID[last.wordId];
    const topic = last.type === "spelling" ? "spelling" : `${last.type}:${last.variant % (last.type === "form" ? lastWord.forms.length : lastWord.usages.length)}`;
    state.words[last.wordId].taught = state.words[last.wordId].taught.filter((t) => t !== topic);
    state.active.draft = "unfinished first answer";
    const before = structuredClone(state);
    assert.equal(tutor.missingTeaching(state).wordId, last.wordId);
    assert.equal(tutor.missingTeaching(state).topic, topic);
    assert.equal(tutor.answerQuestion(state, tutor.describe(first).answer, BASE), state);
    state = tutor.acknowledgeTeaching(state, BASE + 1000);
    assert.deepEqual(state.active.queue, before.active.queue);
    assert.equal(state.active.draft, before.active.draft);
    assert.equal(tutor.missingTeaching(state), null);
    let turns = 0;
    while (state.active) {
      assert.ok(++turns <= before.active.queue.length, "Preflight must not add exam or cold-check retries");
      const q = state.active.queue[0];
      state = tutor.answerQuestion(state, tutor.describe(q).answer, BASE + 2000);
      assert.equal(state.active.answers.at(-1).assisted,
        q.wordId === last.wordId && q.type === last.type && q.variant === last.variant);
      state = tutor.advance(state, BASE + 2000);
    }
    const result = state.sessions.at(-1);
    assert.equal(result.count, before.active.queue.length);
    assert.equal(result.correct, result.count - 1);
    assert.equal(result.preparationAdded, true);
  });
}
