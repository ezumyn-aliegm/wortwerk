import React, { useState } from 'react';
import { deriveSettlement, DISTRICT_CATALOG, buildingMilestones } from './settlement.js';
import { BUILDINGS, gameStatus } from './game.js';
import { BuildingSprite } from './Outpost.jsx';
import VillageBuilding from './VillageBuilding.jsx';
import ConstructionSprite, { CONSTRUCTION_STAGES } from './ConstructionSprite.jsx';
import terrain from './assets/settlement-terrain-v2.png';
import landmarks from './assets/settlement-landmarks-v1.png';
import './settlement.css';


export function LandmarkSprite({ index, label, className = '' }) {
  return <span role="img" aria-label={`${label}, planning artwork`} className={`landmark-sprite ${className}`}
    style={{backgroundImage:`url(${landmarks})`,backgroundPosition:`${index % 5 * 25}% ${Math.floor(index / 5) * 100}%`}} />;
}

function ExistingDistrict({ district }) {
  const built = district.legacy ? district.wave.progress.game?.built || [] : BUILDINGS.map(b => b.id);
  return <span className="settlement-cluster" aria-label={district.legacy ? `${built.length} legacy rewards` : `Earned architecture at ${district.historicalPercent}%`}>
    {built.map(id => {const i=BUILDINGS.findIndex(b=>b.id===id); return district.legacy ? <BuildingSprite key={id} id={id} className={`settlement-old-building home-slot-${i}`} /> : <VillageBuilding key={id} id={id} currentLevel={district.currentLevels[id]} historicalLevel={district.earnedLevels[id]} className={`settlement-old-building home-slot-${i}`} />;})}
  </span>;
}

export function DistrictFocus({ library, waveId }) {
  const district=deriveSettlement(library).find(d=>d.waveId===waveId);
  if (!district || district.legacy) return null;
  const status=gameStatus(district.wave.progress.game);
  const building=status.selectedBuild;
  const position=district.design.position || {x:50,y:50};
  return <div className="district-focus" aria-label={`${district.design.name} study close-up`} data-district-id={district.id}>
    <div className="district-focus-heading"><span className="eyebrow">YOUR DISTRICT · CLOSE-UP</span><strong>{district.design.name}</strong></div>
    <div className="district-focus-ground" style={{backgroundImage:`url(${terrain})`,backgroundPosition:`${position.x}% ${position.y}%`}}>
      <ExistingDistrict district={district}/>
    </div>
    <div className="district-focus-building">
      <VillageBuilding id={building.id} currentLevel={district.currentLevels[building.id]} historicalLevel={district.earnedLevels[building.id]}/>
      <div><span className="eyebrow">{status.allBuilt ? 'EARNED LANDMARK' : 'CURRENT BUILDING'}</span><h3>{building.label}</h3><p>{status.allBuilt ? 'All five upgrades earned.' : `Current · ${district.currentLevels[building.id]===0 ? 'Plot' : `Upgrade ${district.currentLevels[building.id]}`} · Next part: Upgrade ${district.currentLevels[building.id]+1}`}</p><p>{status.allBuilt ? 'District complete.' : `Next milestone · ${status.nextThreshold}% mastery`}</p></div>
    </div>
  </div>;
}

function Scene({ districts, selectedId, onSelect, previewCount, bakeryPreviewLevel }) {
  const sites=districts.filter(d=>d.design.position !== null);
  return <div className="settlement-scroll"><div className="settlement-scene" role="group" aria-label="One connected settlement with roads, bridges and future foundation plots">
    <img src={terrain} alt="Connected forest, autumn farm, stream bridges and harbor terrain" />
    {sites.map(d=> {
      const index=d.design.waveNumber-3;
      const preview=!d.wave && index>=0 && index<previewCount;
      return <button key={d.id} className={`settlement-site ${d.wave ? 'owned' : 'planned'} ${selectedId===d.id ? 'selected' : ''}`} style={{left:`${d.design.position.x}%`,top:`${d.design.position.y}%`}}
        onClick={()=>onSelect(d.id)} aria-pressed={selectedId===d.id} aria-label={`${d.design.name}. ${d.wave ? d.legacy ? 'Legacy rewards' : `${d.currentPercent}% current mastery` : 'Planning preview, no lesson'}`}>
        {d.wave ? <ExistingDistrict district={d}/> : preview ? index===0 ? <ConstructionSprite level={bakeryPreviewLevel} label="Bakery design preview"/> : <LandmarkSprite index={index} label={d.design.landmark}/> : <ConstructionSprite level={0} label={`${d.design.name} future plot`}/>}
        <span className="settlement-site-label"><strong>{d.design.waveNumber ? `W${d.design.waveNumber} · ` : ''}{d.design.name}</strong><small>{d.wave ? d.legacy ? 'Legacy rewards' : `${d.currentPercent}% learned` : preview ? 'Concept preview' : 'Future plot'}</small></span>
        {d.wave && !d.legacy && d.repairs.length>0 && <span className="settlement-repair" aria-label={`${d.repairs.length} repairs queued`}>Repair {d.repairs.length}</span>}
      </button>;
    })}
  </div></div>;
}

export default function Settlement({ library, onOpenWave, initialSelection }) {
  const districts=deriveSettlement(library);
  const [selectedId,setSelectedId]=useState(initialSelection || library.selectedWaveId);
  const [previewCount,setPreviewCount]=useState(0);
  const [bakeryPercent,setBakeryPercent]=useState(0);
  const [stagePreview,setStagePreview]=useState(false);
  const selected=districts.find(d=>d.id===selectedId || d.waveId===selectedId) || districts[0];
  const plannedBakery=DISTRICT_CATALOG.find(d=>d.waveNumber===3);
  const bakerySteps=buildingMilestones(plannedBakery).filter(m=>m.buildingId===plannedBakery.buildings[0].id);
  const bakeryLevel=bakerySteps.filter(m=>bakeryPercent>=m.percent).length;
  const nextBakery=bakerySteps.find(m=>m.percent>bakeryPercent);
  const milestones=selected.wave && !selected.legacy ? buildingMilestones(selected.design) : [];
  const next=milestones.find(m=>m.percent>selected.currentPercent);
  const count=library.waves.length;
  return <section className="settlement" aria-label="Growing village">
    <header className="settlement-heading"><div><span className="eyebrow">ONE WORLD, EVERY LESSON</span><h2>A place that grows with you.</h2><p>{count} saved {count===1 ? 'lesson' : 'lessons'} · each district keeps its own progress.</p></div>
      <label className="world-preview-control">Future world preview <select value={previewCount} onChange={e=>setPreviewCount(Number(e.target.value))}>
        <option value={0}>Show future plots</option>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>Through Wave {i+3} · concept art</option>)}
      </select></label>
    </header>
    {previewCount>0 && <p className="planning-notice" role="status">Planning preview only. These buildings are a design destination. No words, deadlines, rewards or playable lessons have been added.</p>}
    <p className="map-scroll-hint">Scroll the map sideways to see every district.</p>
    <Scene districts={districts} selectedId={selected.id} onSelect={setSelectedId} previewCount={previewCount} bakeryPreviewLevel={stagePreview ? bakeryLevel : 5}/>
    <div className="settlement-inspector" data-selected-district={selected.id}>
      <div><span className="eyebrow">{selected.wave ? 'YOUR SAVED DISTRICT' : 'FUTURE DISTRICT PLAN'}</span><h3>{selected.design.name}</h3>
        {selected.wave ? <>
          <p>{selected.wave.title}</p>
          {selected.legacy ? <p>{selected.wave.progress.game?.built?.length || 0} earned legacy buildings. Rewards are separate from mastery.</p> : <>
            <p><strong>{selected.currentPercent}% current mastery</strong> · {selected.historicalPercent}% highest earned construction</p>
            {selected.complete ? <p className="district-celebration" role="status">District complete. Every target and final check verified. Your architecture is yours to keep.</p> : next && <p>{selected.historicalPercent>selected.currentPercent ? 'Restore current support at' : 'Next milestone at'} {next.percent}% · {next.label} · {next.stage}. {Math.round((next.percent-selected.currentPercent)*10)/10} more percentage points of independent learning evidence.</p>}
            {selected.historicalPercent>selected.currentPercent && <p>Earned buildings stay standing. Review repairs restore current mastery.</p>}
            {!!selected.repairs.length && <p>{selected.repairs.length} target repairs queued in this lesson.</p>}
          </>}
          <button className="primary" onClick={()=>onOpenWave(selected.wave)}>{selected.active ? 'Resume exact saved session' : 'Open this lesson'}</button>
        </> : <>{selected.design.waveNumber===3 ? <ConstructionSprite level={stagePreview ? bakeryLevel : 5} className="selected-bakery"/> : <LandmarkSprite index={selected.design.waveNumber-3} label={selected.design.landmark} className="selected-landmark"/>}<p>{selected.design.preview}</p><p>Landmark · {selected.design.landmark}</p><p className="planning-notice">Planning only. Vocabulary, tests and deadline have not been supplied.</p></>}
      </div>
      <div className="settlement-inventory"><h4>{selected.wave ? 'Frozen building map' : 'Planned building inventory'}</h4><ol>{selected.design.buildings.map(b=><li key={b.id}>{b.label}</li>)}</ol>
        {selected.wave && !selected.legacy && <details><summary>Learning needed for construction</summary><p>Meaning 20%, exact spelling 40%, taught sentence use 20%, assigned forms 10%, delayed recall and final checks 10%. Independent spaced evidence earns construction. Guided answers and repeated easy answers cannot buy progress.</p><ul>{Object.entries(selected.categories).map(([key,c])=><li key={key}>{key==='form' ? 'Assigned forms' : key==='verification' ? 'Delayed and final checks' : key==='usage' ? 'Sentence use' : key==='spelling' ? 'Exact spelling' : 'Meaning'} · {c.earned}/{c.possible} evidence slots · {c.weight}% weight</li>)}</ul><p>The next milestone uses this lesson's frozen targets. At 100%, all 25 upgrades are complete. No extra construction gate.</p></details>}
      </div>
    </div>
    {districts.filter(d=>d.design.position === null).map(d=><div className="imported-district" key={d.id}><strong>{d.wave.title}</strong><span>{d.legacy ? 'Legacy rewards' : `${d.currentPercent}% learned`} · neutral imported district</span><button onClick={()=>onOpenWave(d.wave)}>{d.active ? 'Resume saved session' : 'Open lesson'}</button></div>)}
    <details className="construction-workshop"><summary>Preview real bakery construction · future Wave 3</summary>
      <p>Design preview only. The bakery has separate plot, foundation, frame, walls, roof and inhabited artwork. The five milestones follow the existing 4% allocation. Future learning requirements must be reviewed before activation.</p>
      <div className="construction-demo"><ConstructionSprite level={bakeryLevel}/><div><h3>Bakery · {CONSTRUCTION_STAGES[bakeryLevel]}</h3><label>Preview learning percentage · {bakeryPercent}%<input type="range" min="0" max="100" step="4" value={bakeryPercent} onChange={e=>{setBakeryPercent(Number(e.target.value));setStagePreview(true);setPreviewCount(Math.max(1,previewCount));}}/></label><p>{nextBakery ? `Next part: ${nextBakery.stage} at ${nextBakery.percent}%` : 'Inhabited bakery. All five parts earned in this design preview.'}</p><div className="construction-stage-buttons">{[0,4,24,44,64,84,100].map(n=><button key={n} aria-pressed={bakeryPercent===n} onClick={()=>{setBakeryPercent(n);setStagePreview(true);setPreviewCount(Math.max(1,previewCount));}}>{n}%</button>)}</div></div></div>
      <div className="construction-stage-strip">{CONSTRUCTION_STAGES.map((stage,i)=><figure key={stage}><ConstructionSprite level={i}/><figcaption>{stage}</figcaption></figure>)}</div>
    </details>
  </section>;
}
