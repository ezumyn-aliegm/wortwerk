import assert from 'node:assert/strict';
import { createProgressStore } from '../server/progress.mjs';
import { updateWaveTwoScope } from '../src/wave-two-scope.js';

const revision = Number(process.argv[2]);
assert.ok(Number.isSafeInteger(revision) && revision >= 1, 'Pass the backed-up revision');
const store = createProgressStore(process.env.DATA_DIR || '/data', '/app/dist');
const current = store.get();
assert.equal(current.revision, revision, 'Save changed; preserve the newer revision');
const result = updateWaveTwoScope(current.state);
if (result.changed) {
  const write = store.put({revision, state:result.state, mutationId:`wave2-assigned-forms-${revision}`});
  assert.equal(write.status, 200);
  assert.deepEqual(store.get().state, result.state);
}
console.log(JSON.stringify({changed:result.changed, revision:store.get().revision, otherWavesPreserved:true}));
