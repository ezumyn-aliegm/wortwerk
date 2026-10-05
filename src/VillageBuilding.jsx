import React from 'react';
import buildings from './assets/outpost-buildings.png';

export const VILLAGE_STAGES = ['Plot', 'Upgrade 1', 'Upgrade 2', 'Upgrade 3', 'Upgrade 4', 'Complete'];
const DESIGNS = {
  cabin: { name: 'Cabin', index: 0 },
  lookout: { name: 'Lookout', index: 1 },
  greenhouse: { name: 'Greenhouse', index: 2 },
  library: { name: 'Library', index: 3 },
  portal: { name: 'Portal', index: 4, stages: [...VILLAGE_STAGES.slice(0, 5), 'Active'] },
};
const UPGRADE_APPEARANCE = [
  { opacity: 0.12, saturation: 0 },
  { opacity: 0.32, saturation: 0.2 },
  { opacity: 0.48, saturation: 0.4 },
  { opacity: 0.64, saturation: 0.6 },
  { opacity: 0.82, saturation: 0.8 },
  { opacity: 1, saturation: 1 },
];

export function villageStage(id, level) {
  return (DESIGNS[id].stages || VILLAGE_STAGES)[level];
}

export default function VillageBuilding({ id, currentLevel, historicalLevel, className = '' }) {
  const design = DESIGNS[id];
  const appearance = UPGRADE_APPEARANCE[currentLevel];
  const stage = villageStage(id, currentLevel);
  const historical = historicalLevel > currentLevel;
  const label = `${design.name}: level ${currentLevel} of 5, ${stage}${historical ? `; outline of previous level ${historicalLevel}` : ''}`;
  return <svg className={`village-building ${className}`} viewBox="0 0 120 210" role="img" aria-label={label} data-building-id={id} data-level={currentLevel} data-historical-level={historicalLevel}>
    <title>{label}</title>
    <svg className="village-upgrade-art" width="120" height="200" viewBox="0 0 120 200" overflow="hidden" style={{ opacity: appearance.opacity, filter: `saturate(${appearance.saturation})` }}>
      <image href={buildings} x={-design.index * 120} y="0" width="600" height="200" preserveAspectRatio="none" />
    </svg>
    <g className="village-upgrade-markers">
      {Array.from({ length: 5 }, (_, i) => {
        const earned = i < currentLevel;
        const previous = !earned && i < historicalLevel;
        return <circle key={i} cx={32 + i * 14} cy="204" r="4" className={earned ? 'village-upgrade-earned' : previous ? 'village-upgrade-previous' : 'village-upgrade-pending'} />;
      })}
    </g>
  </svg>;
}
