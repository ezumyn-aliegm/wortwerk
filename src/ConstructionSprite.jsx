import React from 'react';
import bakery from './assets/bakery-stages-v1.png';

export const CONSTRUCTION_STAGES = ['Plot', 'Foundation', 'Frame', 'Walls', 'Roof', 'Alive'];

export default function ConstructionSprite({ level, label = 'Bakery', className = '' }) {
  return <span className={`construction-sprite ${className}`} role="img" aria-label={`${label}: ${CONSTRUCTION_STAGES[level]}`} data-construction-stage={level}
    style={{ backgroundImage: `url(${bakery})`, backgroundPosition: `${level * 20}% center` }} />;
}
