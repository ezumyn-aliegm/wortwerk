import React from 'react';
import {createRoot} from 'react-dom/client';
import Settlement from './Settlement.jsx';
import LibraryApp from './LibraryApp.jsx';
import {migrateLibrary} from './library.js';
import {WAVE_TWO} from './wave-two.js';
import {createTutor} from './tutor.js';
import {learningSummary} from './scoring.js';
import {WORDS} from './data.js';
import {BUILDINGS, freshGame} from './game.js';
import './styles.css';
import './car.css';

const params=new URLSearchParams(location.search);
const tutor=createTutor(WAVE_TWO.words);
const library=migrateLibrary();
const wave={...structuredClone(WAVE_TWO),dueAt:Date.parse(WAVE_TWO.dueAt),progress:tutor.freshState()};
const percent=Number(params.get('percent') || 0);
const high=Number(params.get('high') || percent);
const score=wave.progress.learning;
const spelling=Object.entries(score.targets).filter(([key])=>key.endsWith('/spelling'));
for(const [i,[,target]] of spelling.entries()) target.steps=percent>=40 ? 2 : i<percent ? 1 : 0;
for(const [key,target] of Object.entries(score.targets)) {
  if(key.endsWith('/meaning') && percent>=60 || key.includes('/usage:') && percent>=80 || key.includes('/form:') && percent===100) target.steps=2;
}
if(percent===100) for(const v of Object.values(score.verification)) Object.assign(v,{delayed:true,finalSpelling:true,finalTransfer:true});
const actual=learningSummary(score,wave.words).percent;
Object.assign(wave.progress.game,{percent:actual,highPercent:Math.max(high,actual)});
if(params.has('repair')) {const key=Object.keys(score.targets)[0];score.targets[key].steps=0;score.targets[key].repair=true;wave.progress.game.percent=learningSummary(score,wave.words).percent;wave.progress.game.repairs=[key];}
const old=library.waves[0].progress.game=freshGame();
Object.assign(old,{earned:Object.fromEntries(WORDS.map(w=>[`${w.id}/meaning`,2])),lastAnswers:Object.fromEntries(WORDS.map(w=>[`${w.id}/meaning`,1])),totalAnswers:WORDS.length*2,built:BUILDINGS.map(b=>b.id)});
library.waves.push(wave);
library.selectedWaveId=wave.id;
if(params.has('session') || params.has('correction')) {
  let state=tutor.startSession(wave.progress,Date.now());
  state=tutor.setDraft(state,'exact unfinished draft');
  if(params.has('correction')) {
    state=tutor.acknowledgeTeaching(state,Date.now()+1);
    state=tutor.answerQuestion(state,'deliberately wrong',Date.now()+2);
    state=tutor.setCorrection(state,'exact unfinished correction');
  }
  wave.progress=state;
}
const open=params.has('app');
if(params.has('correction')) {
  const legacyTutor=createTutor(library.waves[0].words);
  library.waves[0].progress=legacyTutor.setDraft(legacyTutor.startSession(library.waves[0].progress,Date.now()),'exact older lesson draft');
}
window.__fixtureLibrary=structuredClone(library);
createRoot(document.getElementById('root')).render(<div className="game-shell car-mode"><header style={{padding:16,fontSize:20}}>Isolated synthetic fixture. No student storage or server sync.</header>{open ? <LibraryApp initialState={library} onStateChange={state=>{window.__fixtureLibrary=structuredClone(state);}}/> : <main style={{maxWidth:1400,margin:'auto',padding:20}}><Settlement library={library} onOpenWave={()=>{}}/></main>}</div>);
