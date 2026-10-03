import { WORDS } from './data.js';
import { MEMORY } from './memory.js';
import { LEGACY_MEMORY } from './legacy-memory.js';
import { PREVIOUS_WORDS, PREVIOUS_MEMORY } from './previous-content.js';
import { createTutor } from './tutor.js';
import { WAVE_TWO, WAVE_TWO_REFERENCE } from './wave-two.js';

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
  const autumnTutor = createTutor(WAVE_TWO.words);
  for (const word of [...WAVE_TWO.words, ...WAVE_TWO_REFERENCE.words]) {
    add(word.german, 'de');
    add(`${word.german}. ${word.example}`, 'de');
    for (const page of autumnTutor.teachingPages(word)) {
      add(page.answer, 'de');
      add(page.explanation, 'en');
    }
    add(word.memory.scene, 'en');
    add(word.memory.watch, 'en');
    add(word.memory.recall, 'en');
    if (word.nounForms) {
      add(word.nounForms.singular, 'de');
      add(word.nounForms.plural, 'de');
      // Retain reference/history recordings even when a form is no longer assessed.
      for (const [, answer, explanation] of word.forms) {
        add(answer, 'de'); add(explanation, 'en');
      }
    }
  }
  return [...lines.values()];
}
