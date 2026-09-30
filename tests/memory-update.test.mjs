import test from 'node:test';
import assert from 'node:assert/strict';
import * as memory from '../src/memory.js';
import { LEGACY_MEMORY } from '../src/legacy-memory.js';
import { WORDS } from '../src/data.js';
import { migrateLibrary, validateLibrary } from '../src/library.js';
import { createTutor } from '../src/tutor.js';

const resolve = (word, waveId) => memory.memoryForWord?.(word, waveId) ?? word.memory;

test('original saved wave displays new cues without rewriting progress or draft', () => {
  const tutor = createTutor(WORDS);
  const progress = tutor.startSession(tutor.freshState(), Date.now());
  progress.active.draft = 'trau';
  const library = migrateLibrary(progress);
  library.waves[0].words.forEach(w => { w.memory = structuredClone(LEGACY_MEMORY[w.id]); });
  const before = JSON.stringify(library);
  for (const w of library.waves[0].words) {
    const cue = resolve(w, 'wave-1');
    assert.notEqual(cue.scene, w.memory.scene);
    assert.deepEqual(cue, memory.MEMORY[w.id]);
    assert.equal(cue.chunks.join(''), w.german.replace(/^(der|die|das|sich) /, ''));
  }
  assert.equal(JSON.stringify(library), before);
  assert.equal(library.waves[0].progress.active.draft, 'trau');
  assert.ok(validateLibrary(library));
});

test('custom waves and customized words keep their own cues', () => {
  const word = {...WORDS[0], memory:structuredClone(LEGACY_MEMORY.brief)};
  assert.equal(resolve(word, 'imported-wave'), word.memory);
  const editedCue = {...word, memory:{...word.memory, scene:'My own memory link'}};
  assert.equal(resolve(editedCue, 'wave-1'), editedCue.memory);
  const editedLesson = {...word, english:'custom meaning'};
  assert.equal(resolve(editedLesson, 'wave-1'), editedLesson.memory);
});
