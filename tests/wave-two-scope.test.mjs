import test from 'node:test';
import assert from 'node:assert/strict';
import {WAVE_TWO, WAVE_TWO_REFERENCE} from '../src/wave-two.js';
import {createTutor} from '../src/tutor.js';
import {parseWave, migrateLibrary, validateLibrary, validWords} from '../src/library.js';
import {learningTargets, learningSummary, targetKey} from '../src/scoring.js';
import {updateWaveTwoScope} from '../src/wave-two-scope.js';
import {firstWordContent} from '../src/first-word-content.js';

const now = Date.parse('2026-10-03T13:00:00Z');
function oldSave(current = {wordId:'baum',type:'spelling',variant:0,retry:0}) {
  const words = WAVE_TWO_REFERENCE.words.map(w => {const copy = structuredClone(w); delete copy.assessedFormVariants; return copy;});
  const library = migrateLibrary(undefined, now);
  const wave = parseWave(JSON.stringify({...WAVE_TWO,words}), WAVE_TWO.id);
  library.waves.push(wave); library.selectedWaveId = wave.id;
  const tutor = createTutor(words), p = wave.progress;
  for (const word of words) {
    p.words[word.id].seen = true;
    p.words[word.id].taught = tutor.teachingPages(word).flatMap(p => p.tags);
  }
  for (const target of Object.values(p.learning.targets)) {target.steps=1; target.attempts=3;}
  p.game.percent = learningSummary(p.learning,words).percent; p.game.highPercent=p.game.percent;
  wave.progress=tutor.startSession(p,now);
  wave.progress.active.queue=[current,{wordId:'blatt',type:'form',variant:0,retry:0},{wordId:'baum',type:'form',variant:1,retry:0}];
  wave.progress.active.draft='unfinished draft';
  assert.ok(validateLibrary(library));
  return library;
}
test('new wave has 92 targets: assigned nouns/articles but no conversion questions', () => {
  const targets=learningTargets(WAVE_TWO.words), tutor=createTutor(WAVE_TWO.words);
  assert.equal(targets.length,92);
  assert.equal(targets.filter(q=>q.type==='form').length,12);
  assert.ok(targets.filter(q=>q.type==='form').every(q=>q.variant===1 && q.wordId!=='gummistiefel'));
  const boots=tutor.describe({wordId:'gummistiefel',type:'spelling',variant:0});
  assert.equal(boots.answer,'die Gummistiefel');
  for(const word of WAVE_TWO.words) assert.ok(firstWordContent(word).every(p=>!p.prompt?.startsWith('Write the plural')));
  for(const variants of [[0,0],[-1],[99],['1']]) assert.equal(validWords(WAVE_TWO.words.map((w,i)=>i?w:{...w,assessedFormVariants:variants})),false);
});
test('migration preserves all retained evidence, history, current required draft and Wave 1; idempotent', () => {
  const before=oldSave(), snapshot=structuredClone(before), {state}=updateWaveTwoScope(before);
  assert.deepEqual(before,snapshot);
  assert.deepEqual(state.waves[0],before.waves[0]);
  const p=state.waves[1].progress, old=before.waves[1].progress;
  for(const [key,value] of Object.entries(p.learning.targets)) assert.deepEqual(value,old.learning.targets[key]);
  assert.deepEqual(p.learning.verification,old.learning.verification);
  assert.deepEqual(p.sessions,old.sessions);
  assert.deepEqual(p.words,old.words);
  assert.equal(p.active.draft,old.active.draft);
  assert.deepEqual(p.active.answers,old.active.answers);
  assert.equal(p.game.totalAnswers,old.game.totalAnswers);
  assert.ok(p.active.queue.every(q=>q.type!=='form'||q.variant===1));
  assert.ok(validateLibrary(state));
  assert.equal(updateWaveTwoScope(state).changed,false);
});
test('excluded current correction is removed without inventing credit or losing the ongoing mission', () => {
  const before=oldSave({wordId:'baum',type:'form',variant:0,retry:1});
  const {state}=updateWaveTwoScope(before), p=state.waves[1].progress;
  assert.equal(p.active.draft,'');
  assert.equal(p.active.queue[0].variant,1);
  assert.equal(p.active.feedback,null);
  assert.deepEqual(p.learning.targets['baum/spelling'],before.waves[1].progress.learning.targets['baum/spelling']);
  assert.ok(validateLibrary(state));
});
test('final inspection never chooses excluded forms, even when all original plural targets are unfinished', () => {
  const {state}=updateWaveTwoScope(oldSave()), wave=state.waves[1], tutor=createTutor(wave.words), p=wave.progress;
  p.active=null;
  for(const t of Object.values(p.learning.targets)) t.steps=2;
  p.game.percent=learningSummary(p.learning,wave.words).percent;
  p.game.highPercent=Math.max(p.game.highPercent,p.game.percent);
  const queue=tutor.buildQueue(p,'exam',now);
  assert.ok(queue.length>=40);
  assert.ok(queue.every(q=>q.type!=='form'||q.variant===1 && q.wordId!=='gummistiefel'));
  assert.ok(queue.every(q=>p.learning.targets[targetKey(q)]));
});
test('already answered plural in an ongoing inspection remains historical but never lowers the revised exam score', () => {
  const library=oldSave({wordId:'baum',type:'form',variant:0,retry:0}), wave=library.waves[1];
  const oldTutor=createTutor(wave.words);
  wave.progress.active.kind='exam';
  wave.progress.active.queue=[wave.progress.active.queue[0],{wordId:'baum',type:'form',variant:1,retry:0}];
  wave.progress=oldTutor.answerQuestion(wave.progress,'die Bäume',now+1);
  assert.equal(wave.progress.active.answers[0].correct,true);
  const {state}=updateWaveTwoScope(library), migrated=state.waves[1], tutor=createTutor(migrated.words);
  let p=tutor.answerQuestion(migrated.progress,'der Baum',now+2);
  p=tutor.advance(p,now+3);
  assert.equal(p.active,null);
  const result=p.sessions.at(-1);
  assert.equal(result.count,1);
  assert.equal(result.score,100);
  assert.equal(result.retiredAnswers.length,1);
  assert.equal(result.retiredAnswers[0].input,'die Bäume');
  assert.ok(tutor.validateState(p));
});
