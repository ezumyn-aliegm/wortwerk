import test from 'node:test';
import assert from 'node:assert/strict';
import {submittedAnswer, answerFeedback, sessionAccuracy} from '../src/answer-feedback.js';
import {createTutor} from '../src/tutor.js';
import {WAVE_TWO} from '../src/wave-two.js';
import {learningTargets} from '../src/scoring.js';

test('submission grades the current field, not a stale draft, and saves exactly what was submitted', () => {
  const tutor=createTutor(WAVE_TWO.words), now=Date.parse('2026-10-03T12:00:00Z');
  let state=tutor.startSession(tutor.freshState(),now);
  state=tutor.acknowledgeTeaching(state,now+1);
  assert.equal(state.active.queue[0].wordId,'oktoberfest');
  state=tutor.setDraft(state,'Oktoberfes');
  const form={elements:{namedItem:name=>name==='answer'?{value:'Oktoberfest'}:null}};
  const submitted=submittedAnswer(form,state.active.draft);
  state=tutor.answerQuestion(state,submitted,now+2);
  assert.equal(state.active.feedback.correct,true);
  assert.equal(state.active.feedback.input,'Oktoberfest');
  assert.equal(state.active.draft,'Oktoberfest');
  assert.equal(tutor.validateState(state),true);
});
test('all 92 assigned answers get identical correct verdicts on original and retry', () => {
  const tutor=createTutor(WAVE_TWO.words);
  for(const q of learningTargets(WAVE_TWO.words)) {
    const input=tutor.describe(q).answer;
    assert.equal(tutor.grade(q,input).correct,true);
    assert.deepEqual(tutor.grade(q,input),tutor.grade({...q,retry:1},input));
  }
});
test('every wrong feedback includes the actual input and the correct answer, including blanks', () => {
  for(const input of ['Oktoberfes','wrong','']) {
    const verdict=answerFeedback({correct:false,input,expected:'Oktoberfest'});
    assert.equal(verdict.input,input||'No answer entered');
    assert.equal(verdict.expected,'Oktoberfest');
  }
});
test('correct guided or closely repeated answers are always labeled correct, not wrong', () => {
  for(const flags of [{assisted:true},{independentSuccess:false},{independentSuccess:true}])
    assert.equal(answerFeedback({correct:true,...flags}).title,'Correct!');
});
test('six correct guided answers report six correct, not six mistakes; mastery credit stays zero', () => {
  const tutor=createTutor(WAVE_TWO.words), now=Date.parse('2026-10-03T12:00:00Z');
  let state=tutor.startSession(tutor.freshState(),now), at=now;
  while(state.active) {
    const q=state.active.queue[0];
    if(q.type==='teach') {state=tutor.acknowledgeTeaching(state,++at);continue;}
    if(tutor.missingTeaching(state)) state=tutor.acknowledgeTeaching(state,++at);
    state=tutor.answerQuestion(state,tutor.describe(q).answer,++at);
    assert.equal(state.active.feedback.correct,true);
    state=tutor.advance(state,++at);
  }
  const session=state.sessions.at(-1), accuracy=sessionAccuracy(session);
  assert.equal(accuracy.correct,6);assert.equal(accuracy.wrong,0);assert.equal(accuracy.guided,6);
  assert.equal(accuracy.masteryCredits,0);assert.equal(tutor.summary(state).percent,0);
});
test('session answer accuracy distinguishes wrong, guided, and unaided answers without changing history', () => {
  const session={count:3,correct:0,mistakes:[{correct:false},{correct:true,assisted:true}]};
  const before=structuredClone(session);
  assert.deepEqual(sessionAccuracy(session),{correct:2,wrong:1,guided:1,unaidedCorrect:1,unaidedPercent:33,masteryCredits:0});
  assert.deepEqual(session,before);
});
