import test from 'node:test';
import assert from 'node:assert/strict';
import {createTutor} from '../src/tutor.js';
import {WAVE_TWO} from '../src/wave-two.js';
import {learningTargets} from '../src/scoring.js';
import {firstWordContent} from '../src/first-word-content.js';

test('every assessed German noun response recalls the complete assigned article and word', () => {
  const tutor=createTutor(WAVE_TWO.words);
  const before=structuredClone(WAVE_TWO);
  for(const q of learningTargets(WAVE_TWO.words)) {
    const word=tutor.BY_ID[q.wordId];
    if(word.kind !== 'noun' || q.type === 'meaning') continue;
    const spec=tutor.describe(q);
    assert.equal(spec.answer,word.german,`${q.wordId}/${q.type}/${q.variant}`);
    assert.equal(tutor.grade(q,word.german).correct,true);
    assert.equal(tutor.grade(q,word.german.split(' ').slice(1).join(' ')).correct,false);
    assert.equal(tutor.grade(q,word.german.split(' ')[0]).correct,false);
  }
  assert.deepEqual(WAVE_TWO,before);
  assert.equal(learningTargets(WAVE_TWO.words).length,92);
});

test('form teaching introduces the complete assigned noun before it is requested', () => {
  const tutor=createTutor(WAVE_TWO.words);
  const pages=tutor.teachingPages(tutor.BY_ID.kuerbis);
  const form=pages.find(page=>page.tags.includes('form:1'));
  assert.equal(form.answer,'der Kürbis');
  assert.ok(form.prompt.includes('complete'));
  assert.equal(firstWordContent(tutor.BY_ID.kuerbis).find(page=>page.label === 'Learn this form').answer,'der Kürbis');
});

test('a saved old correction can finish without rewriting the historical feedback or evidence', () => {
  const tutor=createTutor(WAVE_TWO.words);
  let state=tutor.startSession(tutor.freshState(),Date.parse('2026-10-04T12:00:00Z'));
  state=tutor.acknowledgeTeaching(state);
  state=tutor.answerQuestion(state,'wrong');
  state.active.feedback.expected='Oktoberfest';
  state.active.answers.at(-1).expected='Oktoberfest';
  const feedback=structuredClone(state.active.feedback), learning=structuredClone(state.learning);
  state=tutor.setCorrection(state,'Oktoberfest');
  assert.equal(tutor.correctionReady(state),true);
  assert.deepEqual(state.active.feedback,feedback);
  assert.deepEqual(state.learning,learning);
  assert.equal(tutor.validateState(state),true);
});
