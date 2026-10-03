import assert from 'node:assert/strict';
import { validateLibrary } from './library.js';
import { createTutor } from './tutor.js';
import { WAVE_TWO } from './wave-two.js';
import { freshLearning, learningSummary, targetKey, assessedFormVariants } from './scoring.js';

export function updateWaveTwoScope(original) {
  assert.ok(validateLibrary(original), 'Save must validate before changing assessment scope');
  const saved = original.waves.find(w => w.id === WAVE_TWO.id);
  assert.ok(saved, 'Existing Wave 2 required; never invent progress');
  if (saved.assessmentRevision === 'assigned-forms-v2') return {state: original, changed: false};
  const state = structuredClone(original), wave = state.waves.find(w => w.id === WAVE_TWO.id);
  assert.deepEqual(wave.words.map(w => w.id), WAVE_TWO.words.map(w => w.id));
  for (const word of wave.words) {
    const reviewed = WAVE_TWO.words.find(w => w.id === word.id);
    assert.equal(word.german, reviewed.german, 'Assigned word must remain unchanged');
    assert.deepEqual(word.usages, reviewed.usages, 'Usage answers must remain unchanged');
    assert.deepEqual(word.forms.map(f => f.slice(0,2)), reviewed.forms.map(f => f.slice(0,2)), 'Unexpected form answers require manual review');
    if (reviewed.assessedFormVariants !== undefined) word.assessedFormVariants = [...reviewed.assessedFormVariants];
    word.tip = reviewed.tip;
    word.memory = structuredClone(reviewed.memory);
    word.forms = structuredClone(reviewed.forms);
  }
  const p = wave.progress, before = p.learning;
  const learning = freshLearning(wave.words);
  for (const key of Object.keys(learning.targets)) {
    assert.ok(before.targets[key], 'Cannot create credit for a new target');
    learning.targets[key] = before.targets[key];
  }
  learning.verification = before.verification;
  p.learning = learning;
  const required = q => q.type === 'teach'
    ? !q.focus?.startsWith('form:') || assessedFormVariants(wave.words.find(w => w.id === q.wordId)).includes(Number(q.focus.split(':')[1]))
    : Object.hasOwn(learning.targets, targetKey(q));
  if (p.active) {
    const a = p.active, current = a.queue[0];
    a.queue = a.queue.filter(required);
    // Preserve an ongoing mission/history even if its only remaining task was excluded.
    if (!a.queue.length) a.queue.push({wordId: current.wordId, type:'spelling', variant:0, retry:0});
    a.initialCount = a.completed + a.queue.filter(q => q.type !== 'teach').length;
    if (!required(current)) {
      a.draft = ''; a.feedback = null; a.correction = ''; a.helped = false; a.correcting = false; a.teachingStep = 0;
    } else if (current.type === 'teach') {
      a.teachingStep = Math.min(a.teachingStep || 0, createTutor(wave.words).teachingPages(wave.words.find(w => w.id === current.wordId), current).length - 1);
    }
  }
  const summary = learningSummary(learning, wave.words);
  p.game = {...p.game, percent:summary.percent, highPercent:Math.max(p.game.highPercent, summary.percent), repairs:summary.repairs};
  wave.assessmentRevision = 'assigned-forms-v2';
  assert.ok(validateLibrary(state), 'Revised save must validate before writing');
  assert.deepEqual(state.activity, original.activity);
  assert.equal(state.selectedWaveId, original.selectedWaveId);
  for (const other of original.waves.filter(w => w.id !== wave.id))
    assert.deepEqual(state.waves.find(w => w.id === other.id), other);
  return {state, changed:true};
}
