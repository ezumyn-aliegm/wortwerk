import React from 'react';

export const VILLAGE_STAGES = ['Plot', 'Foundation', 'Frame', 'Walls', 'Roof', 'Details'];
const DESIGNS = {
  cabin: { name: 'Cabin', color: '#b8733f', side: '#81502d', roof: '#a44335',
    frame: 'M30 98V60L62 42L94 60V98M62 42V86M30 60L62 76L94 60',
    walls: ['30,60 62,76 62,104 30,88', '62,76 94,60 94,88 62,104'],
    top: ['24,60 58,34 100,56 62,78', '62,78 100,56 94,66 62,84'],
    details: ['38,68 49,73 49,85 38,80', '74,78 85,72 85,84 74,90', '70,43 70,25 80,29 80,48'] },
  lookout: { name: 'Lookout', color: '#d5ad51', side: '#96702f', roof: '#356b78',
    frame: 'M40 98V40L64 28L86 40V98M64 28V108M40 70L86 94M86 70L40 94',
    walls: ['40,40 64,52 64,72 40,60', '64,52 86,40 86,60 64,72'],
    top: ['32,40 62,20 94,38 64,54', '64,54 94,38 94,44 64,60'],
    details: ['59,18 64,10 69,18 64,26', '48,48 56,52 56,59 48,55', '70,52 78,48 78,55 70,59'] },
  greenhouse: { name: 'Greenhouse', color: '#91d2ac', side: '#3e9476', roof: '#c2ece7',
    frame: 'M22 90V66L58 42L98 64V90M58 42V108M22 66L58 86L98 64',
    walls: ['22,66 58,86 58,108 22,90', '58,86 98,64 98,90 58,108'],
    top: ['20,66 56,40 100,62 58,88', '58,88 100,62 98,68 58,94'],
    details: ['30,80 38,76 46,88 38,92', '67,91 75,78 83,82 75,96', '85,80 91,72 96,80 90,88'] },
  library: { name: 'Library', color: '#788ac0', side: '#495d93', roof: '#354269',
    frame: 'M24 92V56L62 38L98 56V92M62 38V110M24 56L62 76L98 56',
    walls: ['24,56 62,76 62,110 24,92', '62,76 98,56 98,92 62,110'],
    top: ['18,56 60,30 104,54 62,78', '62,78 104,54 98,64 62,84'],
    details: ['32,67 42,72 42,88 32,83', '47,75 55,79 55,95 47,91', '72,80 88,72 88,82 72,90', '69,98 77,92 85,94 77,100'] },
  portal: { name: 'Portal', color: '#a48bcc', side: '#68558d', roof: '#8063b0', stages: ['Plot', 'Foundation', 'Frame', 'Pillars', 'Arch', 'Light'],
    frame: 'M32 96V48L46 40V88M78 104V48L92 40V96M46 40L78 48',
    walls: ['32,48 46,40 46,88 32,96', '78,48 92,40 92,96 78,104'],
    top: ['28,48 44,24 80,24 96,40 78,50 68,38 52,38 44,48', '78,50 96,40 92,50 78,58'],
    details: ['48,56 61,44 74,56 74,88 61,98 48,88', '30,44 36,32 42,44 36,52', '80,40 86,28 92,40 86,48'] },
};

export function villageStage(id, level) {
  return (DESIGNS[id].stages || VILLAGE_STAGES)[level];
}

function Construction({ design, level }) {
  return <>
    {level >= 1 && <polygon points="18,98 60,78 104,98 60,118" fill="#a39b86" />}
    {level >= 2 && <path d={design.frame} fill="none" stroke={design.side} strokeWidth="4" />}
    {level >= 3 && design.walls.map((points, i) => <polygon key={`wall-${i}`} points={points} fill={i ? design.side : design.color} />)}
    {level >= 4 && design.top.map((points, i) => <polygon key={`roof-${i}`} points={points} fill={i ? design.side : design.roof} />)}
    {level >= 5 && design.details.map((points, i) => <polygon key={`detail-${i}`} points={points} fill={design.name === 'Greenhouse' ? '#27643f' : i === 2 ? design.side : '#ffe59c'} />)}
  </>;
}

export default function VillageBuilding({ id, currentLevel, historicalLevel, className = '' }) {
  const design = DESIGNS[id];
  const stage = villageStage(id, currentLevel);
  const historical = historicalLevel > currentLevel;
  const label = `${design.name}: level ${currentLevel} of 5, ${stage}${historical ? `; outline of previous level ${historicalLevel}` : ''}`;
  return <svg className={`village-building ${className}`} viewBox="0 0 120 128" role="img" aria-label={label} data-building-id={id} data-level={currentLevel} data-historical-level={historicalLevel}>
    <title>{label}</title>
    <polygon className="village-plot" points="12,98 60,74 108,98 60,122" fill="#d9c79b" stroke="#635a40" strokeWidth="2" />
    {historical && <g className="village-history" fill="none" stroke="#493a67" strokeWidth="2" strokeDasharray="4 3"><Construction design={design} level={historicalLevel} /></g>}
    <g stroke="#293e38" strokeWidth="1.5" strokeLinejoin="round"><Construction design={design} level={currentLevel} /></g>
  </svg>;
}
