import React from 'react';
import {createRoot} from 'react-dom/client';
import Outpost, {MissionHUD} from './Outpost.jsx';
import {freshVillage, freshGame, BUILDINGS} from './game.js';
import {WORDS} from './data.js';
import './styles.css';
import './car.css';

const params=new URLSearchParams(location.search);
const percent=Number(params.get('percent') || 0);
const highPercent=Number(params.get('high') || percent);
const legacy=params.get('wave')==='1';
const compact=params.has('compact');
const game=legacy ? {...freshGame(), built:BUILDINGS.map(b=>b.id),earned:Object.fromEntries(WORDS.map(w=>[`${w.id}/meaning`,2])),lastAnswers:Object.fromEntries(WORDS.map(w=>[`${w.id}/meaning`,1])),totalAnswers:WORDS.length*2} : {...freshVillage(),percent,highPercent};
const learning=legacy ? undefined : {scoringVersion:2,percent,repairs:[],initialComplete:true};
const props={game,learning,onSelect:()=>{},onBuild:()=>{},onContinue:()=>{},onOpen:()=>{},onPractice:()=>{},onWorkshop:()=>{}};
createRoot(document.getElementById('root')).render(<div className="game-shell car-mode"><header style={{padding:16,fontSize:22}}>Rendering fixture. Wave {legacy ? 1 : 2}. {percent}% current. {highPercent}% historical.</header><main style={{maxWidth:1400,margin:'auto',padding:32}}>{compact ? <div style={{maxWidth:420}}><MissionHUD {...props}/></div> : <Outpost {...props}/>}</main></div>);
