import { BUILDINGS, villageLevels } from './game.js';
import { learningSummary, usesLearningScore } from './scoring.js';
import { WAVE_TWO } from './wave-two.js';

const STAGES = Object.freeze(['Plot', 'Foundation', 'Frame', 'Walls', 'Roof', 'Alive']);
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const themes = [
  ['original', 'Original village', null, 'Star portal', 'The original village and its earned legacy rewards.'],
  ['autumn', 'Autumn village', null, 'Star portal', 'The detailed Autumn atlas beside the original settlement.'],
  ['farm', 'Harvest farm', ['Bakery', 'Windmill', 'Granary', 'Orchard cottage', 'Harvest barn'], 'Bakery', 'A bakery and autumn fields beside the village road.'],
  ['harbor', 'Harbor', ['Boathouse', 'Dock workshop', 'Fish market', 'Harbor inn', 'Lighthouse'], 'Lighthouse', 'A bridge leads to docks, boats and a lighthouse.'],
  ['forge', 'Forge quarter', ['Blacksmith forge', 'Kiln house', 'Toolmaker shop', 'Ore store', 'Foundry hall'], 'Blacksmith forge', 'A stone road brings workshops around a glowing forge.'],
  ['forest', 'Forest edge', ['Ranger lodge', 'Tree nursery', 'Sawmill', 'Canopy cabin', 'Ancient-tree hall'], 'Ancient-tree hall', 'A woodland trail reaches timber homes and a great tree.'],
  ['mountain', 'Mountain pass', ['Mountain lodge', 'Climber shelter', 'Cable station', 'Stone mason house', 'Summit tower'], 'Mountain lodge', 'A rising path reaches stone terraces and a summit tower.'],
  ['river', 'River crossing', ['Watermill', 'Ferry house', 'Bridgekeeper lodge', 'Riverside workshop', 'Lock house'], 'Watermill', 'Connected banks meet at a bridge and turning watermill.'],
  ['garden', 'Garden quarter', ['Seed house', 'Glass conservatory', 'Beekeeper cottage', 'Herbalist shop', 'Garden pavilion'], 'Glass conservatory', 'Flower paths surround a tall glass conservatory.'],
  ['observatory', 'Star hill', ['Mapmaker studio', 'Instrument house', 'Astronomer cottage', 'Chart library', 'Observatory'], 'Observatory', 'A hillside road opens toward a telescope and night sky.'],
  ['festival', 'Festival square', ['Music hall', 'Banner workshop', 'Market arcade', 'Stage house', 'Festival hall'], 'Festival hall', 'The road widens into a lantern-filled gathering square.'],
  ['gateway', 'Gateway district', ['Traveler lodge', 'Gatekeeper house', 'Caravan depot', 'Beacon tower', 'Grand gateway'], 'Grand gateway', 'The final road reaches a monumental gateway and new horizons.'],
];

// Reserved locations are a plan, not vocabulary assignments or playable waves.
export const DISTRICT_CATALOG = freeze(themes.map(([id, name, labels, landmark, preview], index) => ({
  id, waveNumber: index + 1, waveId: index === 0 ? 'wave-1' : index === 1 ? WAVE_TWO.id : null,
  name, landmark, preview, position: { x: [14, 38, 62, 86][index % 4], y: [22, 42, 60][Math.floor(index / 4)] },
  buildings: labels ? labels.map((label, slot) => ({
    id: `${id}-${label.toLowerCase().replaceAll(' ', '-')}`, label,
    ...(index === 2 && slot === 0 ? { asset: 'bakery' } : {}),
  })) : BUILDINGS.map(({ id: buildingId, label }) => ({ id: buildingId, label, asset: buildingId })),
})));

export function buildingMilestones(design) {
  return Array.from({ length: 25 }, (_, index) => {
    const building = design.buildings[index % 5];
    const level = Math.floor(index / 5) + 1;
    return { percent: (index + 1) * 4, buildingId: building.id, label: building.label, level, stage: design.waveNumber === 1 || design.waveNumber === 2 || design.waveNumber === null ? (level === 5 ? 'Complete' : `Upgrade ${level}`) : STAGES[level] };
  });
}

function levels(design, percent) {
  const old = villageLevels(percent);
  return Object.fromEntries(design.buildings.map((building, index) => [building.id, old[BUILDINGS[index].id]]));
}

function district(design, wave, selectedWaveId) {
  const legacy = !!wave && !usesLearningScore(wave.words);
  const summary = wave && !legacy ? learningSummary(wave.progress.learning, wave.words) : null;
  const currentPercent = summary?.percent ?? null;
  const historicalPercent = summary ? Math.max(currentPercent, wave.progress.game?.highPercent ?? 0) : null;
  // Legacy architecture only records actual purchases; it is never invented mastery.
  const currentLevels = legacy
    ? Object.fromEntries(design.buildings.map((building) => [building.id, wave.progress.game?.built?.includes(building.id) ? 5 : 0]))
    : levels(design, currentPercent ?? 0);
  const earnedLevels = legacy ? { ...currentLevels } : levels(design, historicalPercent ?? 0);
  return {
    id: design.id, waveId: wave?.id ?? null, wave: wave ?? null, design, legacy,
    currentPercent, historicalPercent, currentLevels, earnedLevels,
    categories: summary?.categories ?? null, repairs: summary ? [...summary.repairs] : [], active: !!wave?.progress.active,
    complete: legacy ? design.buildings.every((building) => earnedLevels[building.id] === 5) : !!summary?.complete,
  };
}

// Pure view derivation: no save changes, sessions, curriculum or global denominator.
export function deriveSettlement(library) {
  const waves = library?.waves ?? [];
  const known = new Set(DISTRICT_CATALOG.map((design) => design.waveId).filter(Boolean));
  const districts = DISTRICT_CATALOG.map((design) => district(design,
    design.waveId ? waves.find((wave) => wave.id === design.waveId) : null, library?.selectedWaveId));
  for (const wave of waves.filter((item) => !known.has(item.id))) {
    // Imports do not silently consume a future themed plot. Stable identity follows the wave id.
    const design = {
      id: `import-${wave.id}`, waveNumber: null, waveId: wave.id, name: wave.title,
      landmark: 'Lesson outpost', preview: 'Imported lesson · district artwork awaiting an explicit plan.',
      position: null, buildings: BUILDINGS.map(({ id, label }) => ({ id, label, asset: id })),
    };
    districts.push(district(design, wave, library?.selectedWaveId));
  }
  return districts;
}
