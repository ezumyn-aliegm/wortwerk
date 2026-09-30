import { WORDS } from './data.js';
import { MEMORY } from './memory.js';
import { LEGACY_MEMORY } from './legacy-memory.js';
import { PREVIOUS_WORDS, PREVIOUS_MEMORY } from './previous-content.js';
import { createTutor } from './tutor.js';

export const audioKey = (text, language) => JSON.stringify([language.split('-')[0], text]);

export function collectAudioLines() {
  const lines = new Map();
  const add = (text, language) => {
    if (text) lines.set(audioKey(text, language), { text, language });
  };
  const tutor = createTutor(WORDS);
  for (const word of [...WORDS, ...PREVIOUS_WORDS]) {
    add(word.german, 'de');
    add(`${word.german}. ${word.example}`, 'de');
    for (const page of tutor.teachingPages(word)) {
      add(page.answer, 'de');
      add(page.explanation, 'en');
    }
    add(MEMORY[word.id].scene, 'en');
    add(MEMORY[word.id].watch, 'en');
    // Keep previous audio available for old tabs and unchanged imported lessons.
    add(LEGACY_MEMORY[word.id].scene, 'en');
    add(LEGACY_MEMORY[word.id].watch, 'en');
    add(PREVIOUS_MEMORY[word.id].scene, 'en');
    add(PREVIOUS_MEMORY[word.id].watch, 'en');
  }
  return [...lines.values()];
}
