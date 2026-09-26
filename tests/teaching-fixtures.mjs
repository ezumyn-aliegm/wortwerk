import assert from "node:assert/strict";
import { WORDS } from "../src/data.js";

// Expected curriculum comes from lesson content, independently of teachingPages.
export function teachingTopics(word) {
  return [
    "meaning",
    "spelling",
    ...word.usages.map((_, variant) => `usage:${variant}`),
    ...word.forms.map((_, variant) => `form:${variant}`),
  ];
}

// Use only in fixtures that isolate grading from the teaching prerequisite.
export function seedTaught(state, words = WORDS) {
  for (const word of words) state.words[word.id].taught = teachingTopics(word);
  return state;
}

export function completeLesson(tutor, state, now, words = WORDS) {
  assert.equal(state.active.queue[0].type, "teach");
  const word = words.find((word) => word.id === state.active.queue[0].wordId);
  if (state.active.queue[0].intro) {
    return tutor.advance(tutor.setDraft(state, word.german), now);
  }
  if (state.active.queue[0].focus) return tutor.advance(state, now);
  const finalPage = 2 + word.usages.length + word.forms.length;
  for (let page = (state.active.teachingStep || 0) + 1; page <= finalPage; page++) {
    const next = tutor.setTeachingStep(state, page);
    assert.notEqual(next, state, `${word.id}: page ${page} must be reachable`);
    state = next;
  }
  const next = tutor.advance(state, now);
  assert.notEqual(next, state, `${word.id}: the completed lesson must advance`);
  return next;
}
