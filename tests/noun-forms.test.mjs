import test from 'node:test';
import assert from 'node:assert/strict';
import { nounComparison, showNounComparison } from '../src/noun-forms.js';
import { WORDS } from '../src/data.js';
import { collectAudioLines } from '../src/audio-lines.js';

test('all four lesson nouns show explicit singular and plural with changed endings', () => {
  const expected = {brief:['der Brief','die Briefe','e'], job:['der Job','die Jobs','s'], treppe:['die Treppe','die Treppen','n'], fahrradtrial:['der Fahrradtrial','die Fahrradtrials','s']};
  const audio = new Set(collectAudioLines().filter(x=>x.language==='de').map(x=>x.text));
  for (const [id, forms] of Object.entries(expected)) {
    const result = nounComparison(WORDS.find(w=>w.id===id));
    assert.deepEqual([result.singular,result.plural,result.ending],forms);
    assert.ok(audio.has(result.singular));
    assert.ok(audio.has(result.plural));
  }
  assert.match(nounComparison(WORDS.find(w=>w.id==='treppe')).note,/singular/);
  assert.equal(nounComparison(WORDS.find(w=>w.id==='muede')),null);
});

test('comparisons are hidden in independent questions and exams, visible in teaching and plural repair', () => {
  const w=WORDS[0];
  assert.equal(showNounComparison(w,{type:'teach'}),true);
  assert.equal(showNounComparison(w,{type:'form',variant:0}),false);
  assert.equal(showNounComparison(w,{type:'form',variant:0},{correct:false}),true);
  assert.equal(showNounComparison(w,{type:'form',variant:0},{correct:false},true),false);
  assert.equal(showNounComparison(w,{type:'form',variant:1},{correct:false}),false);
  assert.equal(nounComparison({...w,german:'der Custom'}),null);
});
