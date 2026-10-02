import test from 'node:test';
import assert from 'node:assert/strict';
import { WAVE_TWO } from '../src/wave-two.js';
import { parseWave, migrateLibrary, validateLibrary } from '../src/library.js';
import { appendWave, serializeBackup, parseLibraryBackup } from '../src/library-state.js';
import { createTutor } from '../src/tutor.js';
import { freshState, startSession, setDraft } from '../src/engine.js';
import { nounComparison } from '../src/noun-forms.js';

test('autumn wave has the exact twenty words and confirmed deadline', () => {
  assert.equal(WAVE_TWO.words.length, 20);
  assert.equal(new Set(WAVE_TWO.words.map(w => w.id)).size, 20);
  assert.equal(Date.parse(WAVE_TWO.dueAt), Date.parse('2026-10-05T13:00:00Z'));
  assert.ok(WAVE_TWO.words.every(w => w.studyVersion === 2));
  assert.equal(WAVE_TWO.words.find(w => w.id === 'bauernhaus').german, 'das Bauernhaus');
  assert.equal(WAVE_TWO.words.find(w => w.id === 'drachen').english, 'kite');
  assert.equal(WAVE_TWO.words.find(w => w.id === 'gummistiefel').german, 'die Gummistiefel');
});
test('all assessment variants are explicitly taught and memory chunks spell the exact word', () => {
  const tutor = createTutor(WAVE_TWO.words);
  for (const w of WAVE_TWO.words) {
    assert.equal(w.memory.chunks.join(''), w.german.replace(/^(der|die|das) /, ''));
    const pages = tutor.teachingPages(w);
    w.usages.forEach(([sentence, english, answer], i) => {
      const page = pages.find(p => p.tags.includes(`usage:${i}`));
      assert.equal(page.answer, sentence.replace('___', answer));
      assert.equal(page.translation, english);
    });
    w.forms.forEach(([, answer], i) => assert.equal(pages.find(p => p.tags.includes(`form:${i}`)).answer, answer));
    if (w.kind === 'noun') {
      const forms = nounComparison(w);
      assert.ok(forms, w.id);
      assert.ok(w.tip.includes(forms.singular));
      assert.ok(w.tip.includes(forms.plural));
      assert.ok(w.forms.some(f => f[1] === forms.plural));
    }
  }
});
test('meaning synonyms are accepted while exact assigned German spelling remains required', () => {
  const tutor = createTutor(WAVE_TWO.words);
  for (const w of WAVE_TWO.words) {
    for (const answer of w.meaningAnswers) assert.ok(tutor.grade({wordId:w.id,type:'meaning',variant:0}, answer).correct, `${w.id}: ${answer}`);
  }
  assert.equal(tutor.grade({wordId:'neblig',type:'spelling',variant:0}, 'nebelig').correct, false);
  assert.equal(tutor.grade({wordId:'kuehl',type:'spelling',variant:0}, 'kuhl').correct, false);
});
test('fifth new-wave mission still protects hints and review, without inheriting legacy cold-test guards', () => {
  const tutor = createTutor(WAVE_TWO.words), now = Date.parse('2026-10-02T13:00:00Z');
  let state = tutor.freshState();
  state.phase = 4;
  for (const w of WAVE_TWO.words) {
    state.words[w.id].seen = true;
    state.words[w.id].taught = tutor.teachingPages(w).flatMap(p => p.tags);
  }
  state = tutor.startSession(state, now);
  assert.ok(tutor.useHint(state, now + 1).active.helped);
  assert.ok(tutor.visitWordbank(state, now + 1).active.helped);
  assert.equal(tutor.visitWordbank(state, now + 1).learning.verification[state.active.queue[0].wordId].exposedAt, now + 1);
});
test('adding autumn preserves an ongoing legacy lesson and backup roundtrip', () => {
  const library = migrateLibrary(setDraft(startSession(freshState(), Date.parse('2026-10-01T13:00:00Z')), 'unfinished student draft'));
  const old = JSON.stringify(library.waves[0]);
  const wave = parseWave(JSON.stringify(WAVE_TWO), WAVE_TWO.id);
  const next = appendWave(library, wave);
  assert.equal(JSON.stringify(next.waves[0]), old);
  assert.equal(next.waves[0], library.waves[0]);
  assert.equal(next.waves[1].progress.totalSteps, 0);
  assert.ok(validateLibrary(next));
  assert.deepEqual(parseLibraryBackup(serializeBackup(next)), next);
});

test('actual twenty-word curriculum has a finite independent route to full village completion', () => {
  const tutor = createTutor(WAVE_TWO.words);
  let state = tutor.freshState(), now = Date.parse('2026-10-02T13:00:00Z'), missions = 0;
  function completeMission() {
    let actions = 0;
    while (state.active) {
      assert.ok(++actions < 250, 'bounded mission must finish');
      if (state.active.queue[0].type === 'teach') {
        const q = state.active.queue[0], word = tutor.BY_ID[q.wordId];
        for (let step = 1; step < tutor.teachingPages(word, q).length; step++) state = tutor.setTeachingStep(state, step);
        state = tutor.advance(state, ++now);
        continue;
      }
      if (tutor.missingTeaching(state)) {
        state = tutor.acknowledgeTeaching(state, ++now);
        continue;
      }
      const q = state.active.queue[0];
      state = tutor.answerQuestion(state, tutor.describe(q).answer, ++now);
      assert.ok(tutor.validateState(JSON.parse(JSON.stringify(state))), 'every answer save must restore');
      if (tutor.correctionNeeded(state)) state = tutor.setCorrection(state, tutor.describe(q).answer);
      state = tutor.advance(state, ++now);
      assert.ok(tutor.validateState(state));
    }
  }
  while (!tutor.summary(state).initialComplete && missions++ < 120) {
    state = tutor.startSession(state, now);
    assert.ok(state.active, 'unfinished learning must remain actionable');
    assert.ok(state.active.queue.filter(q => q.type !== 'teach').length <= 6);
    completeMission();
    now += 6 * 60_000;
  }
  assert.ok(missions < 120);
  assert.equal(tutor.summary(state).percent, 90);
  now += 9 * 3_600_000;
  state = tutor.startSession(state, now);
  assert.equal(state.active.kind, 'exam');
  for (const w of WAVE_TWO.words) {
    assert.ok(state.active.queue.some(q => q.wordId === w.id && q.type === 'spelling'));
    assert.ok(state.active.queue.some(q => q.wordId === w.id && ['form','usage'].includes(q.type)));
  }
  completeMission();
  assert.equal(tutor.summary(state).percent, 100);
  assert.equal(tutor.summary(state).ready, 20);
  assert.equal(state.game.percent, 100);
});
