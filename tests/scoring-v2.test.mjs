import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../src/data.js';
import { createTutor } from '../src/tutor.js';
import { freshLearning, learningTargets, learningSummary, recordLearning, targetKey, DELAY_MS } from '../src/scoring.js';
import { freshVillage, villageLevels, updateVillage, gameStatus, checkpointGame } from '../src/game.js';
import { validWords, parseWave, wavePlan, waveStatus, migrateLibrary, validateLibrary } from '../src/library.js';
import { appendWave } from '../src/library-state.js';
import { MEMORY } from '../src/memory.js';
import { WAVE_TWO } from '../src/wave-two.js';

const words = WORDS.slice(0, 5).map((w) => ({ ...w, memory: MEMORY[w.id], studyVersion: 2 }));
const t = createTutor(words), BASE = Date.parse('2026-10-01T13:00:00Z');
const q = { wordId: words[0].id, type: 'spelling', variant: 0, retry: 0 };

test('reviewed Wave2 English synonyms accept partial slash meanings without loosening German answers', () => {
  const tutor = createTutor(WAVE_TWO.words);
  const word = WAVE_TWO.words.find((w) => w.english.includes(' / ') && w.meaningAnswers?.length);
  assert.ok(word, 'actual content supplies reviewed partial meanings');
  for (const answer of word.meaningAnswers) {
    assert.equal(tutor.grade({ wordId: word.id, type: 'meaning', variant: 0 }, answer).correct, true);
    assert.equal(tutor.grade({ wordId: word.id, type: 'meaning', variant: 0 }, answer.toUpperCase()).correct, true);
  }
  assert.equal(tutor.grade({ wordId: word.id, type: 'meaning', variant: 0 }, 'unreviewed unrelated meaning').correct, false);
  assert.equal(tutor.grade({ wordId: word.id, type: 'spelling', variant: 0 }, word.meaningAnswers[0]).correct, false);
  assert.equal(tutor.describe({ wordId: word.id, type: 'spelling', variant: 0 }).answer, word.german);
});
function answer(learning, question, correct = true, assisted = false, at = BASE) {
  return recordLearning(learning, question, { correct, assisted, at });
}
function space(learning, question = q) {
  for (const filler of learningTargets(words).filter((a) => a.wordId !== question.wordId).slice(0, 3)) answer(learning, filler);
}
function finishSession(state, { hint = false, miss = false, now = BASE } = {}) {
  let s = state, i = 0;
  while (s.active) {
    if (++i > 250) throw new Error('Unbounded session');
    if (s.active.queue[0].type === 'teach') {
      const a = s.active.queue[0];
      for (let step = 1; step < t.teachingPages(t.BY_ID[a.wordId], a).length; step++) s = t.setTeachingStep(s, step);
      s = t.advance(s, ++now);
      continue;
    }
    if (t.missingTeaching(s)) s = t.acknowledgeTeaching(s, ++now);
    const question = s.active.queue[0];
    if (hint && s.active.kind !== 'exam') s = t.useHint(s, ++now);
    s = t.answerQuestion(s, miss ? 'wrong' : t.describe(question).answer, ++now);
    assert.equal(t.answerQuestion(s, 'duplicate', ++now), s);
    assert.equal(t.validateState(JSON.parse(JSON.stringify(s))), true);
    if (t.correctionNeeded(s)) s = t.setCorrection(s, t.describe(question).answer);
    s = t.advance(s, ++now);
    assert.equal(t.validateState(s), true);
  }
  return s;
}

test('all and only all numeric version-2 words opt in; legacy fresh state unchanged', () => {
  assert.equal(t.scoringV2, true);
  assert.equal(createTutor([words[0], WORDS[1]]).scoringV2, false);
  assert.equal(createTutor(WORDS).freshState().learning, undefined);
  assert.equal(validWords(words), true);
  assert.equal(validWords([{ ...words[0], meaningAnswers: [42] }]), false);
  assert.equal(t.validateState(createTutor(WORDS).freshState()), false);
});

test('unseen word starts with every taught topic, no epoch recall date and no introduction credit', () => {
  let s = t.startSession(t.freshState(), BASE);
  const q = s.active.queue[0];
  assert.equal(q.type, 'teach');
  assert.equal(Number.isFinite(t.summary(s).nextDelayedAt), false);
  const pages = t.teachingPages(t.BY_ID[q.wordId], q);
  assert.deepEqual(new Set(pages.flatMap((p) => p.tags)), new Set(learningTargets([t.BY_ID[q.wordId]]).map((q) => q.type === 'usage' || q.type === 'form' ? `${q.type}:${q.variant}` : q.type)));
  for (let step = 1; step < pages.length; step++) s = t.setTeachingStep(s, step);
  s = t.advance(s, BASE + 1);
  assert.equal(t.summary(s).percent, 0);
  assert.equal(t.summary(s).nextDelayedAt, BASE + 1 + DELAY_MS);
  const next = s.active.queue[0];
  s = t.answerQuestion(s, 'wrong', BASE + 2);
  assert.equal(s.active.feedback.assisted, true);
  assert.equal(s.learning.targets[targetKey(next)].repair, false, 'first guided practice is protected');
});

test('an independent miss deducts one step without requiring a credit spacing gap', () => {
  const l = freshLearning(words);
  answer(l, q);
  assert.equal(l.targets[targetKey(q)].other, 0);
  answer(l, q, false);
  assert.equal(l.targets[targetKey(q)].steps, 0);
  answer(l, q, false);
  assert.equal(l.targets[targetKey(q)].steps, 0);
});

test('weighted evidence covers every usage/form variant; no spelling-to-meaning shortcuts', () => {
  const l = freshLearning(words);
  answer(l, q);
  assert.equal(l.targets[`${q.wordId}/meaning`].steps, 0);
  assert.equal(learningSummary(l, words).categories.spelling.earned, 1);
  for (const a of learningTargets(words)) { l.targets[targetKey(a)].steps = 2; }
  const form = learningTargets(words).find((a) => a.type === 'form' && a.variant === 1);
  l.targets[targetKey(form)].steps = 0;
  assert.equal(learningSummary(l, words).initialComplete, false);
  assert.ok(learningSummary(l, words).percent < 90);
});

test('immediate retry, teaching/hints and guided mistakes do not credit or stack deductions', () => {
  const l = freshLearning(words);
  answer(l, q); answer(l, q);
  assert.equal(l.targets[targetKey(q)].steps, 1);
  space(l); answer(l, q);
  assert.equal(l.targets[targetKey(q)].steps, 2);
  space(l); answer(l, q, false);
  assert.equal(l.targets[targetKey(q)].steps, 1);
  assert.equal(l.targets[targetKey(q)].repair, true);
  answer(l, q, false); answer(l, { ...q, retry: 1 }, false); answer(l, q, false, true);
  assert.equal(l.targets[targetKey(q)].steps, 1);
  answer(l, q); assert.equal(l.targets[targetKey(q)].steps, 1);
  space(l); answer(l, q); assert.equal(l.targets[targetKey(q)].steps, 2);
  space(l); answer(l, q, false); space(l); answer(l, q, false);
  assert.equal(l.targets[targetKey(q)].steps, 0);
});

test('delayed verification uses actual latest exposure and never rounds partial to 100', () => {
  const l = freshLearning(words);
  answer(l, q, true, false, BASE);
  space(l); answer(l, q, true, false, BASE + DELAY_MS - 1);
  assert.equal(l.verification[q.wordId].delayed, false);
  space(l); answer(l, q, true, false, BASE + DELAY_MS);
  assert.equal(l.verification[q.wordId].delayed, false, 'the intervening exposed answer restarted the clock');
  space(l); answer(l, q, true, false, BASE + DELAY_MS * 2);
  assert.equal(l.verification[q.wordId].delayed, true);
  for (const a of Object.values(l.targets)) a.steps = 2;
  for (const v of Object.values(l.verification)) Object.assign(v, { delayed: true, finalSpelling: true, finalTransfer: true });
  l.verification[words.at(-1).id].finalTransfer = false;
  assert.ok(learningSummary(l, words).percent < 100);
  l.verification[words.at(-1).id].finalTransfer = true;
  assert.equal(learningSummary(l, words).percent, 100);
});

test('25 four-percent milestones preserve historical silhouettes after a small penalty', () => {
  assert.deepEqual(villageLevels(46), { cabin: 3, lookout: 2, greenhouse: 2, library: 2, portal: 2 });
  assert.deepEqual(villageLevels(100), { cabin: 5, lookout: 5, greenhouse: 5, library: 5, portal: 5 });
  let g = updateVillage(freshVillage(), { percent: 46, repairs: [] }, true);
  g = updateVillage(g, { percent: 43.9, repairs: ['brief/spelling'] });
  assert.equal(gameStatus(g).levels.cabin, 2);
  assert.equal(gameStatus(g).historicalLevels.cabin, 3);
  assert.equal(gameStatus(g).canBuild, false);
  assert.equal(gameStatus(checkpointGame(g)).independentSuccesses, 0);
});

test('six wrong or hinted answers end bounded missions without construction or success', () => {
  for (const opts of [{ miss: true }, { hint: true }]) {
    let s = finishSession(t.startSession(t.freshState(), BASE), opts);
    assert.equal(s.sessions.at(-1).count, 6);
    assert.equal(s.sessions.at(-1).correct, 0);
    assert.equal(s.game.percent, 0);
    assert.equal(gameStatus(s.game).independentSuccesses, 0);
    assert.equal(gameStatus(s.game).readyCheckpoint, true, 'checkpoint is an activity pause');
  }
});

test('strong learner reaches all targets, full final coverage, delayed recall and 100 via public API', () => {
  let s = t.freshState(), sessions = 0, now = BASE;
  while (!t.summary(s).initialComplete && sessions++ < 100) {
    s = finishSession(t.startSession(s, now), { now }); now += 60_000;
  }
  assert.ok(sessions < 100, 'all target variants have an achievable route');
  assert.equal(t.summary(s).percent, 90);
  now += DELAY_MS;
  s = t.startSession(s, now);
  assert.equal(s.active.kind, 'exam');
  const beforeGame = structuredClone(s.game), beforeLearning = structuredClone(s.learning);
  s = t.answerQuestion(s, t.describe(s.active.queue[0]).answer, now + 1);
  assert.deepEqual(s.game, beforeGame, 'inspection grades cannot leak via village');
  assert.deepEqual(s.learning, beforeLearning, 'inspection grades cannot leak via coverage');
  s = t.advance(s, now + 2);
  for (const w of words) {
    assert.ok([...s.active.queue, ...s.active.answers].some((a) => a.wordId === w.id && a.type === 'spelling'));
    assert.ok(s.active.queue.some((a) => a.wordId === w.id && ['usage', 'form'].includes(a.type)));
  }
  s = finishSession(s, { now });
  assert.equal(t.summary(s).percent, 100);
  assert.equal(t.summary(s).ready, words.length);
  assert.equal(gameStatus(s.game).allBuilt, true);
  assert.equal(t.startSession(s, now + 1), s);
});

test('failed final target can be repaired later, including a one-word wave; stale checks cannot bypass learning', () => {
  const single = createTutor([{ ...words[0], forms: [['Form?', 'form', 'Explanation']] }]);
  let s = single.freshState();
  s.words[words[0].id].seen = true;
  s.words[words[0].id].taught = single.teachingPages(single.WORDS[0]).flatMap((page) => page.tags);
  for (const a of Object.values(s.learning.targets)) a.steps = 2;
  s.game.percent = s.game.highPercent = single.summary(s).percent;
  s = single.startSession(s, BASE + DELAY_MS);
  const missed = s.active.queue[0];
  s = single.answerQuestion(s, 'wrong', BASE + DELAY_MS + 1);
  s = single.advance(s, BASE + DELAY_MS + 2);
  while (s.active) { const a = s.active.queue[0]; s = single.answerQuestion(s, single.describe(a).answer, BASE + DELAY_MS + 3); s = single.advance(s, BASE + DELAY_MS + 4); }
  assert.equal(single.summary(s).complete, false);
  for (let round = 0; round < 12 && !single.summary(s).complete; round++) {
    s = single.startSession(s, BASE + DELAY_MS * (round + 3));
    while (s.active) {
      if (single.missingTeaching(s)) s = single.acknowledgeTeaching(s, BASE + DELAY_MS * (round + 3));
      s = single.answerQuestion(s, single.describe(s.active.queue[0]).answer, BASE + DELAY_MS * (round + 3) + 1);
      s = single.advance(s, BASE + DELAY_MS * (round + 3) + 2);
    }
  }
  assert.equal(single.summary(s).percent, 100, `repair route for ${missed.wordId} remains achievable`);
});

test('frozen answers/denominator and JSON drafts validate; installing Wave2 preserves Wave1', () => {
  const s = t.setDraft(t.startSession(t.freshState(), BASE), 'saved draft');
  assert.equal(t.validateState(JSON.parse(JSON.stringify(s))), true);
  assert.equal(createTutor(words.map((w, i) => i ? w : { ...w, german: 'changed' })).validateState(s), false);
  const legacy = migrateLibrary(undefined, BASE), before = structuredClone(legacy.waves[0]);
  const wave = parseWave(JSON.stringify({ title: 'Wave2', dueAt: '2026-10-05T09:00:00-04:00', words }), 'test-v2');
  const installed = appendWave(legacy, wave);
  assert.deepEqual(installed.waves[0], before);
  assert.equal(validateLibrary(installed), true);
  assert.ok(wavePlan(wave, BASE).sessionsLeft > 7);
  wave.progress.phase = 99;
  assert.equal(wavePlan(wave, BASE).steps[0].done, false);
  assert.notEqual(waveStatus(wave, BASE), 'Ready');
});
