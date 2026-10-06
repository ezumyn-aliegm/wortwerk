import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICT_CATALOG, deriveSettlement, buildingMilestones } from '../src/settlement.js';
import { BUILDINGS, villageLevels } from '../src/game.js';
import { createTutor } from '../src/tutor.js';
import { migrateLibrary } from '../src/library.js';
import { WAVE_TWO } from '../src/wave-two.js';
import { learningSummary, recordLearning } from '../src/scoring.js';

const waveTwo = () => ({ ...WAVE_TWO, dueAt:Date.parse(WAVE_TWO.dueAt), progress: createTutor(WAVE_TWO.words).freshState() });
function library() {
  const result = migrateLibrary();
  result.waves.push(waveTwo());
  result.selectedWaveId = WAVE_TWO.id;
  return result;
}

test('ten unique frozen future plans contain no curriculum, date or playable session', () => {
  assert.equal(DISTRICT_CATALOG.length, 12);
  assert.ok(Object.isFrozen(DISTRICT_CATALOG[2].buildings[0]));
  const future = DISTRICT_CATALOG.slice(2);
  assert.deepEqual(future.map((d) => d.waveNumber), [3,4,5,6,7,8,9,10,11,12]);
  assert.equal(new Set(future.flatMap((d) => d.buildings.map((b) => b.id))).size, 50);
  for (const design of future) {
    assert.equal(design.waveId, null);
    assert.equal(design.words, undefined);
    assert.equal(design.dueAt, undefined);
    assert.equal(design.buildings.length, 5);
    assert.ok(design.buildings.some((b) => b.label === design.landmark));
  }
  for (const d of deriveSettlement(library()).slice(2)) {
    assert.equal(d.wave, null);
    assert.equal(d.active, false);
    assert.equal(d.currentPercent, null);
    assert.equal(d.complete, false);
  }
});

test('construction thresholds exactly match existing allocation from 0 through 100', () => {
  const design = DISTRICT_CATALOG[2], milestones = buildingMilestones(design);
  assert.equal(milestones.length, 25);
  assert.deepEqual(milestones.map((m) => m.percent), Array.from({length:25}, (_, i) => (i + 1) * 4));
  for (const percent of [0, 4, 20, 40, 60, 80, 100]) {
    const expected = Object.values(villageLevels(percent));
    const actual = design.buildings.map((building) => milestones.filter((m) => m.buildingId === building.id && m.percent <= percent).length);
    assert.deepEqual(actual, expected);
  }
  assert.deepEqual([0,1,2,3,4].map((i) => milestones[i * 5].stage), ['Foundation','Frame','Walls','Roof','Alive']);
});

test('legacy district shows actual built architecture and never claimed mastery', () => {
  const saved = library();
  saved.waves[0].progress.game = { built: ['cabin', 'library'] };
  const district = deriveSettlement(saved)[0];
  assert.equal(district.legacy, true);
  assert.equal(district.currentPercent, null);
  assert.equal(district.historicalPercent, null);
  assert.deepEqual(district.earnedLevels, {cabin:5,lookout:0,greenhouse:0,library:5,portal:0});
  assert.equal(district.complete, false);
});

test('current evidence derives locally and repairs preserve historical architecture without save writes', () => {
  const saved = library(), wave = saved.waves[1];
  const targets = Object.values(wave.progress.learning.targets);
  for (const t of targets) t.steps = 2;
  for (const v of Object.values(wave.progress.learning.verification)) Object.assign(v, {delayed:true,finalSpelling:true,finalTransfer:true});
  wave.progress.game.highPercent = 100;
  targets[0].steps = 0;
  targets[0].repair = true;
  wave.progress.active = { kind: 'course', queue: [{wordId:wave.words[0].id,type:'meaning'}], correction:'exact draft' };
  const before = JSON.stringify(saved), expected = learningSummary(wave.progress.learning, wave.words);
  const district = deriveSettlement(saved)[1];
  assert.equal(district.currentPercent, expected.percent);
  assert.equal(district.historicalPercent, 100);
  assert.deepEqual(Object.values(district.earnedLevels), [5,5,5,5,5]);
  assert.deepEqual(district.repairs, expected.repairs);
  assert.equal(district.complete, false);
  assert.equal(district.wave.progress.active.correction, 'exact draft');
  assert.equal(JSON.stringify(saved), before);
  const extra = {...waveTwo(), id:'new-import', title:'New teacher lesson'};
  saved.waves.push(extra);
  assert.equal(deriveSettlement(saved)[1].currentPercent, expected.percent);
});

test('completed older wave retains completion while current wave remains unfinished and selection preserves resume', () => {
  const saved = library(), old = saved.waves[1];
  for (const t of Object.values(old.progress.learning.targets)) t.steps = 2;
  for (const v of Object.values(old.progress.learning.verification)) Object.assign(v, {delayed:true,finalSpelling:true,finalTransfer:true});
  const current = {...waveTwo(), id:'new-import', title:'Current teacher lesson'};
  current.progress.active = { queue: [{wordId:current.words[1].id,type:'spelling'}], correction:'precise unfinished answer'};
  saved.waves.push(current);
  saved.selectedWaveId = current.id;
  const result = deriveSettlement(saved);
  assert.equal(result[1].complete, true);
  assert.equal(result[1].currentPercent, 100);
  assert.equal(result[1].active, false);
  assert.equal(result[12].active, true);
  assert.equal(result[12].currentPercent, 0);
  assert.equal(result[12].wave.progress.active, current.progress.active);
  assert.deepEqual(result[12].design.buildings.map((b) => b.id), BUILDINGS.map((b) => b.id));
  saved.selectedWaveId = old.id;
  assert.equal(deriveSettlement(saved)[1].active, false);
  assert.equal(current.progress.active.correction, 'precise unfinished answer');
});

test('unknown imports remain neutral and stable rather than consume planned farm or harbor', () => {
  const saved = library();
  saved.waves.push({...waveTwo(), id:'wave-3', title:'Imported content'});
  const result = deriveSettlement(saved);
  assert.equal(result[2].waveId, null);
  assert.equal(result[12].id, 'import-wave-3');
  assert.equal(result[12].design.waveNumber, null);
  assert.equal(result[12].design.position, null);
  saved.waves.reverse();
  assert.equal(deriveSettlement(saved)[12].id, result[12].id);
});

test('repeated easy answers cannot fabricate settlement growth beyond accepted independent evidence', () => {
  const saved = library(), wave = saved.waves[1];
  const question = {wordId:wave.words[0].id, type:'meaning', variant:0, retry:0};
  recordLearning(wave.progress.learning, question, {correct:true, assisted:false, at:1000});
  const afterIndependent = deriveSettlement(saved)[1].currentPercent;
  for (let attempt = 0; attempt < 30; attempt++)
    recordLearning(wave.progress.learning, question, {correct:true, assisted:false, at:2000 + attempt});
  assert.equal(deriveSettlement(saved)[1].currentPercent, afterIndependent);
  assert.deepEqual(Object.values(deriveSettlement(saved)[1].currentLevels), [0,0,0,0,0]);
});
