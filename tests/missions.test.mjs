import test from "node:test";
import assert from "node:assert/strict";
import { WORDS, BY_ID } from "../src/data.js";
import { createTutor } from "../src/tutor.js";
import { gameStatus, freshGame, checkpointGame, constructBuild } from "../src/game.js";
import { parseBackup } from "../src/storage.js";

const t = createTutor(WORDS);
const BASE = Date.parse("2026-09-26T14:00:00Z");

test("a beginner builds one word then recalls its spelling before seeing another word", () => {
  let s = t.startSession(t.freshState(), BASE);
  const q = s.active.queue[0];
  assert.equal(q.wordId, "traurig");
  assert.equal(t.teachingPages(BY_ID[q.wordId], q).length, 1);
  assert.equal(t.advance(s, BASE + 1), s, "Reading alone cannot finish the word forge");
  s = t.setDraft(s, "trau");
  assert.equal(t.advance(s, BASE + 2), s, "An incomplete spelling cannot finish the forge");
  s = parseBackup(JSON.stringify(s));
  assert.equal(s.active.draft, "trau");
  s = t.setDraft(s, "traurig");
  s = t.advance(s, BASE + 3);
  assert.equal(s.words.traurig.seen, true);
  assert.equal(t.mastery(s, "traurig").percent, 0, "Crafting from a model is not mastery");
  assert.deepEqual(s.words.traurig.taught, ["meaning", "spelling"]);
  assert.equal(s.active.queue[0].type, "meaning");
  s = t.answerQuestion(s, "sad", BASE + 4);
  s = t.advance(s, BASE + 5);
  assert.equal(s.active.queue[0].type, "spelling");
  assert.equal(s.active.queue[0].wordId, "traurig");
  assert.equal(s.active.draft, "");
  assert.equal(t.missingTeaching(s), null);
});

test("the first mission reaches a real build without a reading marathon; grammar stays teach-before-test", () => {
  let s = t.startSession(t.freshState(), BASE), now = BASE;
  let screens = 0, answers = 0, firstBuild = null, firstSpelling = null, pluralTaught = false;
  while (s.active && answers < 150) {
    const q = s.active.queue[0];
    if (q.type === "teach") {
      screens += t.teachingPages(BY_ID[q.wordId], q).length;
      s = t.setDraft(s, BY_ID[q.wordId].german);
      const next = t.advance(s, ++now);
      assert.notEqual(next, s);
      s = next;
      continue;
    }
    const lesson = t.missingTeaching(s);
    if (lesson) {
      screens++;
      assert.equal(t.answerQuestion(s, t.describe(q).answer, ++now), s);
      if (q.wordId === "brief" && q.type === "form") {
        assert.equal(lesson.answer, "die Briefe");
        pluralTaught = true;
      }
      s = t.acknowledgeTeaching(s, ++now);
    }
    if (q.type === "spelling" && firstSpelling === null) firstSpelling = screens;
    s = t.answerQuestion(s, t.describe(q).answer, ++now);
    answers++;
    const status = gameStatus(s.game || freshGame());
    if (status.canBuild && firstBuild === null) {
      firstBuild = { screens, answers };
      s.game = constructBuild(s.game, "cabin");
      assert.deepEqual(s.game.built, ["cabin"]);
    }
    s = t.advance(s, ++now);
    if (status.readyCheckpoint) s.game = checkpointGame(s.game);
    assert.equal(t.validateState(s), true);
  }
  assert.equal(firstSpelling, 1);
  assert.ok(firstBuild && firstBuild.screens <= 2 && firstBuild.answers <= 4);
  assert.equal(pluralTaught, true);
  assert.equal(s.active, null);
  assert.equal(t.summary(s).introduced, 9);
  assert.equal(t.summary(s).ready, 0, "One mission does not prove lasting memory");
  assert.ok(screens < 30, `${screens} teaching screens is too many`);
});

test("legacy teaching pages and the exact in-progress answer survive unchanged", () => {
  let s = t.startSession(t.freshState(), BASE);
  delete s.active.queue[0].intro;
  s = t.setTeachingStep(s, 1);
  s.active.draft = "a saved draft";
  const before = structuredClone(s);
  assert.deepEqual(parseBackup(JSON.stringify(s)), before);
  assert.equal(t.teachingPages(BY_ID.traurig, s.active.queue[0]).length, 5);
  assert.equal(t.advance(s, BASE + 1), s);
});

test("repeated mistakes teach only the failed skill, not another reading marathon", () => {
  for (const type of ["spelling", "form", "usage"]) {
    let s = t.startSession(t.freshState(), BASE);
    s.active.queue = [{wordId: "brief", type, variant: 0, retry: 1}];
    s.active.initialCount = 1;
    s.words.brief.taught = ["meaning", "spelling", "form:0", "usage:0"];
    s = t.answerQuestion(s, "wrong", BASE + 1);
    const review = s.active.queue.find((q) => q.type === "teach");
    const pages = t.teachingPages(BY_ID.brief, review);
    assert.equal(pages.length, 1);
    if (type === "spelling") assert.equal(review.intro, true);
    if (type === "form") assert.equal(pages[0].answer, "die Briefe");
    if (type === "usage") assert.equal(pages[0].answer, "Ich schreibe einen Brief.");
  }
});
