// Administrative, explicit install while study is paused and the service is stopped.
// Uses the application's atomic store; never replaces or edits existing waves.
import assert from 'node:assert/strict';
import {createProgressStore} from '../server/progress.mjs';
import {migrateLibrary, parseWave, validateLibrary} from '../src/library.js';
import {WAVE_TWO} from '../src/wave-two.js';

export function withAutumnWave(state) {
  const library = migrateLibrary(state);
  if (library.waves.some(w => w.id === WAVE_TWO.id || w.words.some(word => word.id === 'oktoberfest' && word.studyVersion === 2)))
    return {state, added:false};
  if (library.waves.length >= 50) throw new Error('Wave limit reached; nothing changed.');
  const next = {...library, waves:[...library.waves, parseWave(JSON.stringify(WAVE_TWO), WAVE_TWO.id)]};
  assert.ok(validateLibrary(next), 'New library must validate before writing');
  assert.deepEqual(next.waves.slice(0, library.waves.length), library.waves);
  assert.equal(next.selectedWaveId, library.selectedWaveId);
  assert.deepEqual(next.activity, library.activity);
  return {state:next, added:true};
}

if (process.argv[1]?.endsWith('/install-wave-two.mjs')) {
  const revision = Number(process.argv[2]);
  assert.ok(Number.isSafeInteger(revision) && revision >= 1, 'Pass the backed-up revision explicitly');
  const store = createProgressStore(process.env.DATA_DIR || '/data', '/app/dist');
  const current = store.get();
  assert.equal(current.revision, revision, 'Live revision changed; stop and preserve the newer save');
  assert.ok(current.state, 'No existing family save; refusing to invent one');
  const update = withAutumnWave(current.state);
  if (update.added) {
    const result = store.put({revision, state:update.state, mutationId:`install-autumn-wave2-${revision}`});
    assert.equal(result.status, 200);
    assert.deepEqual(store.get().state, update.state);
  }
  console.log(JSON.stringify({added:update.added, previousWavesUnchanged:true, revision:store.get().revision}));
}
