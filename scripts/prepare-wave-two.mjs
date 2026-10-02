import {writeFile} from 'node:fs/promises';
import {WAVE_TWO} from '../src/wave-two.js';
// Reproducible import package; never reads or rewrites student progress.
await writeFile(new URL('../wave-2-autumn.json', import.meta.url), JSON.stringify(WAVE_TWO, null, 2) + '\n');
console.log(`Prepared ${WAVE_TWO.words.length} words; due ${WAVE_TWO.dueAt}`);
