import test from 'node:test';
import assert from 'node:assert/strict';
import * as content from '../src/memory.js';
import { PREVIOUS_WORDS, PREVIOUS_MEMORY } from '../src/previous-content.js';
import { createTutor } from '../src/tutor.js';

test('shipped saved content receives corrections without changing saved session or custom content', () => {
  const words = PREVIOUS_WORDS.map(w => ({...structuredClone(w), memory: PREVIOUS_MEMORY[w.id]}));
  const state = createTutor(words).startSession(createTutor(words).freshState(), Date.now());
  state.active.draft = 'trau';
  const before = JSON.stringify({words,state});
  const resolved = words.map(w => content.wordForStudy?.(w, 'wave-1') ?? w);
  const tip = resolved.find(w => w.id === 'interessieren').tip;
  assert.doesNotMatch(tip, /One r, double s/);
  assert.match(tip, /two r/i);
  assert.equal(JSON.stringify({words,state}), before);
  const custom = {...words[0], tip:'My teacher explanation'};
  assert.equal(content.wordForStudy(custom, 'wave-1'), custom);
  assert.equal(content.wordForStudy(words[0], 'other-wave'), words[0]);
  resolved.forEach((w,i) => {
    assert.equal(w.german, words[i].german);
    assert.deepEqual(w.usages.map(x=>x[2]), words[i].usages.map(x=>x[2]));
    assert.deepEqual(w.forms.map(x=>x[1]), words[i].forms.map(x=>x[1]));
  });
});

test('spelling feedback identifies the actual differing spelling block', () => {
  const tutor = createTutor(PREVIOUS_WORDS);
  const result = tutor.grade({wordId:'brief', type:'spelling', variant:0}, 'der Brife');
  assert.equal(result.correct, false);
  assert.match(result.message, /ie/);
  assert.match(result.message, /You wrote/);
  assert.equal(tutor.grade({wordId:'brief',type:'spelling',variant:0}, 'der Brief').correct, true);
});
